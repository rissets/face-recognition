"""
ChromaDB service for face recognition embeddings
"""
import chromadb
from chromadb.config import Settings
import numpy as np
from typing import List, Dict, Optional, Tuple
from django.conf import settings
import logging

logger = logging.getLogger(__name__)


class ChromaDBService:
    """Service class for managing face embeddings with ChromaDB"""
    
    def __init__(self):
        self.client = None
        self.collection = None
        self._initialize_client()
    
    def _initialize_client(self):
        """Initialize ChromaDB client and collection"""
        try:
            # Create ChromaDB client with persistent storage
            self.client = chromadb.PersistentClient(
                path=settings.CHROMADB_SETTINGS['persist_directory']
            )
            
            # Get or create collection for face embeddings
            self.collection = self.client.get_or_create_collection(
                name=settings.CHROMADB_SETTINGS['collection_name'],
                metadata={"hnsw:space": "cosine"}  # Use cosine similarity
            )
            
            logger.info(f"ChromaDB initialized with collection: {self.collection.name}")
            
        except Exception as e:
            logger.error(f"Failed to initialize ChromaDB: {e}")
            raise
    
    def add_face_embedding(self, user_id: str, embedding: np.ndarray, 
                          metadata: Dict = None) -> bool:
        """
        Add a face embedding to the database
        
        Args:
            user_id: Unique identifier for the user
            embedding: Face embedding vector
            metadata: Additional metadata for the embedding
            
        Returns:
            bool: True if successful, False otherwise
        """
        try:
            if metadata is None:
                metadata = {}
            
            # Ensure embedding is in the correct format
            embedding_list = embedding.astype(np.float32).tolist()
            
            # Convert complex metadata to strings (ChromaDB only supports basic types)
            processed_metadata = {
                'user_id': user_id,
                'embedding_dimension': len(embedding_list),
            }
            
            # Add simple metadata fields
            for key, value in metadata.items():
                if isinstance(value, (str, int, float, bool)) or value is None:
                    processed_metadata[key] = value
                elif isinstance(value, list):
                    # Convert lists to strings
                    processed_metadata[f"{key}_str"] = str(value)
                else:
                    # Convert other types to strings
                    processed_metadata[f"{key}_str"] = str(value)
            
            # Generate unique ID for this embedding
            existing_embeddings = self.get_user_embeddings(user_id)
            embedding_id = f"{user_id}_{len(existing_embeddings)}"
            
            self.collection.add(
                embeddings=[embedding_list],
                metadatas=[processed_metadata],
                ids=[embedding_id]
            )
            
            logger.info(f"Added embedding for user {user_id}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to add embedding for user {user_id}: {e}")
            return False
    
    def search_similar_faces(self, embedding: np.ndarray, 
                           n_results: int = 5, 
                           threshold: float = 0.7) -> List[Dict]:
        """
        Search for similar faces in the database
        
        Args:
            embedding: Query face embedding
            n_results: Number of results to return
            threshold: Similarity threshold (0-1)
            
        Returns:
            List of dictionaries containing match results
        """
        try:
            # Ensure embedding is in the correct format
            embedding_list = embedding.astype(np.float32).tolist()
            
            # Query the collection
            results = self.collection.query(
                query_embeddings=[embedding_list],
                n_results=n_results,
                include=['metadatas', 'distances']
            )
            
            matches = []
            if results['distances'] and results['metadatas']:
                for distance, metadata in zip(results['distances'][0], results['metadatas'][0]):
                    # Convert distance to similarity (ChromaDB returns distances)
                    similarity = 1 - distance
                    
                    if similarity >= threshold:
                        matches.append({
                            'user_id': metadata.get('user_id'),
                            'similarity': similarity,
                            'metadata': metadata
                        })
            
            return matches
            
        except Exception as e:
            logger.error(f"Failed to search similar faces: {e}")
            return []
    
    def get_user_embeddings(self, user_id: str) -> List[Dict]:
        """
        Get all embeddings for a specific user
        
        Args:
            user_id: User identifier
            
        Returns:
            List of embedding data for the user
        """
        try:
            results = self.collection.get(
                where={"user_id": user_id},
                include=['metadatas', 'embeddings']
            )
            
            embeddings = []
            if results.get('embeddings') and results.get('metadatas'):
                for embedding, metadata in zip(results['embeddings'], results['metadatas']):
                    embeddings.append({
                        'embedding': np.array(embedding),
                        'metadata': metadata
                    })
            
            return embeddings
            
        except Exception as e:
            logger.error(f"Failed to get embeddings for user {user_id}: {e}")
            return []
    
    def delete_user_embeddings(self, user_id: str) -> bool:
        """
        Delete all embeddings for a specific user
        
        Args:
            user_id: User identifier
            
        Returns:
            bool: True if successful, False otherwise
        """
        try:
            # Get all IDs for the user
            results = self.collection.get(
                where={"user_id": user_id},
                include=['metadatas']
            )
            
            if results['ids']:
                self.collection.delete(ids=results['ids'])
                logger.info(f"Deleted {len(results['ids'])} embeddings for user {user_id}")
            
            return True
            
        except Exception as e:
            logger.error(f"Failed to delete embeddings for user {user_id}: {e}")
            return False
    
    def get_collection_stats(self) -> Dict:
        """
        Get statistics about the collection
        
        Returns:
            Dictionary with collection statistics
        """
        try:
            count = self.collection.count()
            return {
                'total_embeddings': count,
                'collection_name': self.collection.name
            }
            
        except Exception as e:
            logger.error(f"Failed to get collection stats: {e}")
            return {'total_embeddings': 0, 'collection_name': 'unknown'}


# Singleton instance
chroma_service = ChromaDBService()