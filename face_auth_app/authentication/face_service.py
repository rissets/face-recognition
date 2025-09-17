"""
Face Recognition Service using InsightFace and ChromaDB
"""
import cv2
import numpy as np
import insightface
import base64
import io
from PIL import Image
from typing import List, Dict, Optional, Tuple, Union
from django.conf import settings
from .chroma_service import chroma_service
import logging

logger = logging.getLogger(__name__)


class FaceRecognitionService:
    """Service class for face detection, encoding, and recognition"""
    
    def __init__(self):
        self.model = None
        self.threshold = settings.FACE_RECOGNITION.get('THRESHOLD', 0.91)
        self.det_size = settings.FACE_RECOGNITION.get('DET_SIZE', (640, 640))
        self.model_name = settings.FACE_RECOGNITION.get('MODEL_NAME', 'buffalo_l')
        self._initialize_model()
    
    def _initialize_model(self):
        """Initialize InsightFace model"""
        try:
            self.model = insightface.app.FaceAnalysis(
                name=self.model_name,
                providers=['CPUExecutionProvider']
            )
            self.model.prepare(ctx_id=0, det_size=self.det_size)
            logger.info(f"InsightFace model '{self.model_name}' initialized successfully")
        except Exception as e:
            logger.error(f"Failed to initialize InsightFace model: {e}")
            raise
    
    def decode_image(self, image_data: Union[str, bytes]) -> Optional[np.ndarray]:
        """
        Decode image from various formats (base64, bytes, file path)
        
        Args:
            image_data: Image data in base64 string, bytes, or file path
            
        Returns:
            numpy array of the image or None if failed
        """
        try:
            if isinstance(image_data, str):
                # Handle base64 encoded image
                if image_data.startswith('data:image'):
                    # Remove data URL prefix
                    image_data = image_data.split(',')[1]
                
                # Decode base64
                image_bytes = base64.b64decode(image_data)
                
                # Convert to PIL Image then to numpy array
                pil_image = Image.open(io.BytesIO(image_bytes))
                image = cv2.cvtColor(np.array(pil_image), cv2.COLOR_RGB2BGR)
                
            elif isinstance(image_data, bytes):
                # Handle raw bytes
                nparr = np.frombuffer(image_data, np.uint8)
                image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
                
            else:
                # Assume it's a file path
                image = cv2.imread(str(image_data))
            
            return image
            
        except Exception as e:
            logger.error(f"Failed to decode image: {e}")
            return None
    
    def detect_faces(self, image: np.ndarray) -> List[Dict]:
        """
        Detect faces in an image and extract embeddings
        
        Args:
            image: Input image as numpy array
            
        Returns:
            List of dictionaries containing face data
        """
        try:
            if image is None:
                return []
            
            faces = self.model.get(image)
            
            detected_faces = []
            for face in faces:
                face_data = {
                    'embedding': face.embedding.astype(np.float32),
                    'bbox': face.bbox.tolist(),  # [x1, y1, x2, y2]
                    'kps': face.kps.tolist() if hasattr(face, 'kps') else None,  # Keypoints
                    'det_score': float(face.det_score),  # Detection confidence
                    'age': int(face.age) if hasattr(face, 'age') else None,
                    'gender': int(face.gender) if hasattr(face, 'gender') else None,
                }
                detected_faces.append(face_data)
            
            logger.info(f"Detected {len(detected_faces)} faces in image")
            return detected_faces
            
        except Exception as e:
            logger.error(f"Face detection failed: {e}")
            return []
    
    def enroll_user_face(self, user_id: str, image_data: Union[str, bytes], 
                        metadata: Dict = None) -> Dict:
        """
        Enroll a user's face by extracting and storing embeddings
        
        Args:
            user_id: Unique user identifier
            image_data: Image data (base64, bytes, or file path)
            metadata: Additional metadata to store
            
        Returns:
            Dictionary with enrollment result
        """
        try:
            # Decode image
            image = self.decode_image(image_data)
            if image is None:
                return {
                    'success': False,
                    'error': 'Failed to decode image',
                    'faces_detected': 0
                }
            
            # Detect faces
            faces = self.detect_faces(image)
            if not faces:
                return {
                    'success': False,
                    'error': 'No faces detected in image',
                    'faces_detected': 0
                }
            
            # Use the face with highest detection score
            best_face = max(faces, key=lambda x: x['det_score'])
            
            # Prepare metadata
            if metadata is None:
                metadata = {}
            
            # Convert bbox list to string for ChromaDB compatibility
            bbox_str = ','.join(map(str, best_face['bbox'])) if best_face['bbox'] else None
            
            metadata.update({
                'det_score': best_face['det_score'],
                'bbox': bbox_str,  # Store as string instead of list
                'age': best_face.get('age'),
                'gender': best_face.get('gender'),
                'enrollment_method': 'api'
            })
            
            # Store embedding in ChromaDB
            success = chroma_service.add_face_embedding(
                user_id=user_id,
                embedding=best_face['embedding'],
                metadata=metadata
            )
            
            if success:
                return {
                    'success': True,
                    'faces_detected': len(faces),
                    'best_face_score': best_face['det_score'],
                    'embedding_dimension': len(best_face['embedding']),
                    'metadata': metadata
                }
            else:
                return {
                    'success': False,
                    'error': 'Failed to store embedding',
                    'faces_detected': len(faces)
                }
                
        except Exception as e:
            logger.error(f"Face enrollment failed for user {user_id}: {e}")
            return {
                'success': False,
                'error': str(e),
                'faces_detected': 0
            }
    
    def authenticate_user(self, image_data: Union[str, bytes]) -> Dict:
        """
        Authenticate a user by comparing face with stored embeddings
        
        Args:
            image_data: Image data for authentication
            
        Returns:
            Dictionary with authentication result
        """
        try:
            # Decode image
            image = self.decode_image(image_data)
            if image is None:
                return {
                    'success': False,
                    'error': 'Failed to decode image',
                    'user_id': None,
                    'confidence': 0.0
                }
            
            # Detect faces
            faces = self.detect_faces(image)
            if not faces:
                return {
                    'success': False,
                    'error': 'No faces detected in image',
                    'user_id': None,
                    'confidence': 0.0
                }
            
            # Use the face with highest detection score
            best_face = max(faces, key=lambda x: x['det_score'])
            
            # Search for similar faces in ChromaDB
            matches = chroma_service.search_similar_faces(
                embedding=best_face['embedding'],
                n_results=5,
                threshold=self.threshold
            )
            
            if matches:
                # Get the best match
                best_match = matches[0]
                
                return {
                    'success': True,
                    'user_id': best_match['user_id'],
                    'confidence': best_match['similarity'],
                    'faces_detected': len(faces),
                    'detection_score': best_face['det_score'],
                    'all_matches': matches[:3]  # Return top 3 matches
                }
            else:
                return {
                    'success': False,
                    'error': 'No matching face found',
                    'user_id': None,
                    'confidence': 0.0,
                    'faces_detected': len(faces)
                }
                
        except Exception as e:
            logger.error(f"Face authentication failed: {e}")
            return {
                'success': False,
                'error': str(e),
                'user_id': None,
                'confidence': 0.0
            }
    
    def get_face_quality_score(self, image_data: Union[str, bytes]) -> Dict:
        """
        Assess the quality of a face image for enrollment
        
        Args:
            image_data: Image data to assess
            
        Returns:
            Dictionary with quality assessment
        """
        try:
            image = self.decode_image(image_data)
            if image is None:
                return {
                    'success': False,
                    'error': 'Failed to decode image',
                    'quality_score': 0.0
                }
            
            faces = self.detect_faces(image)
            if not faces:
                return {
                    'success': False,
                    'error': 'No faces detected',
                    'quality_score': 0.0
                }
            
            best_face = max(faces, key=lambda x: x['det_score'])
            
            # Calculate quality score based on various factors
            bbox = best_face['bbox']
            face_area = (bbox[2] - bbox[0]) * (bbox[3] - bbox[1])
            image_area = image.shape[0] * image.shape[1]
            face_ratio = face_area / image_area
            
            # Quality score factors:
            # 1. Detection confidence (0-1)
            # 2. Face size ratio (larger faces are better)
            # 3. Image blur detection (optional, can be added)
            
            det_score = best_face['det_score']
            size_score = min(face_ratio * 10, 1.0)  # Normalize face size
            
            # Combined quality score
            quality_score = (det_score * 0.7) + (size_score * 0.3)
            
            return {
                'success': True,
                'quality_score': float(quality_score),
                'detection_score': float(det_score),
                'face_size_ratio': float(face_ratio),
                'faces_detected': len(faces),
                'recommendations': self._get_quality_recommendations(quality_score, det_score, face_ratio)
            }
            
        except Exception as e:
            logger.error(f"Quality assessment failed: {e}")
            return {
                'success': False,
                'error': str(e),
                'quality_score': 0.0
            }
    
    def _get_quality_recommendations(self, quality_score: float, 
                                   det_score: float, face_ratio: float) -> List[str]:
        """Generate recommendations for image quality improvement"""
        recommendations = []
        
        if quality_score < 0.6:
            recommendations.append("Overall image quality is low")
        
        if det_score < 0.8:
            recommendations.append("Face detection confidence is low - ensure good lighting")
        
        if face_ratio < 0.1:
            recommendations.append("Face is too small - move closer to camera")
        elif face_ratio > 0.6:
            recommendations.append("Face is too large - move further from camera")
        
        if not recommendations:
            recommendations.append("Image quality is good for enrollment")
        
        return recommendations


# Singleton instance
face_recognition_service = FaceRecognitionService()