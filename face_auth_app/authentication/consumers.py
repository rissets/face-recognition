"""
WebSocket consumers for real-time face recognition
"""
import json
import asyncio
import logging
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from django.contrib.auth import get_user_model
from django.utils import timezone
from .models import AuthenticationAttempt
from .face_service import face_recognition_service
from .chroma_service import chroma_service

logger = logging.getLogger(__name__)
User = get_user_model()


class FaceAuthConsumer(AsyncWebsocketConsumer):
    """WebSocket consumer for real-time face authentication"""
    
    async def connect(self):
        """Accept WebSocket connection"""
        await self.accept()
        
        # Send welcome message
        await self.send(text_data=json.dumps({
            'type': 'connection',
            'status': 'connected',
            'message': 'WebSocket connected successfully',
            'timestamp': timezone.now().isoformat()
        }))
        
        logger.info(f"WebSocket connected: {self.channel_name}")
    
    async def disconnect(self, close_code):
        """Handle WebSocket disconnection"""
        logger.info(f"WebSocket disconnected: {self.channel_name}, code: {close_code}")
    
    async def receive(self, text_data):
        """Handle incoming WebSocket messages"""
        try:
            data = json.loads(text_data)
            message_type = data.get('type')
            
            if message_type == 'authenticate':
                await self.handle_authenticate(data)
            elif message_type == 'enroll':
                await self.handle_enroll(data)
            elif message_type == 'quality_check':
                await self.handle_quality_check(data)
            elif message_type == 'ping':
                await self.handle_ping(data)
            else:
                await self.send_error('Invalid message type')
                
        except json.JSONDecodeError:
            await self.send_error('Invalid JSON format')
        except Exception as e:
            logger.error(f"WebSocket error: {e}")
            await self.send_error('Internal server error')
    
    async def handle_authenticate(self, data):
        """Handle face authentication via WebSocket"""
        try:
            image_data = data.get('image')
            if not image_data:
                await self.send_error('Image data is required')
                return
            
            # Send processing status
            await self.send(text_data=json.dumps({
                'type': 'processing',
                'message': 'Processing face authentication...',
                'timestamp': timezone.now().isoformat()
            }))
            
            # Process authentication (run in thread pool for CPU-intensive task)
            result = await asyncio.get_event_loop().run_in_executor(
                None, face_recognition_service.authenticate_user, image_data
            )
            
            # Get user data if authentication successful
            user_data = None
            if result['success']:
                user_data = await self.get_user_data(result['user_id'])
            
            # Log authentication attempt
            await self.log_authentication_attempt(result, user_data)
            
            # Send result
            response = {
                'type': 'authenticate_result',
                'success': result['success'],
                'timestamp': timezone.now().isoformat(),
                'confidence': result.get('confidence', 0.0),
                'faces_detected': result.get('faces_detected', 0),
                'message': 'Authentication successful' if result['success'] else result.get('error', 'Authentication failed')
            }
            
            if user_data:
                response['user'] = user_data
            
            await self.send(text_data=json.dumps(response))
            
        except Exception as e:
            logger.error(f"Authentication error: {e}")
            await self.send_error('Authentication failed')
    
    async def handle_enroll(self, data):
        """Handle face enrollment via WebSocket"""
        try:
            user_id = data.get('user_id')
            image_data = data.get('image')
            metadata = data.get('metadata', {})
            
            if not user_id or not image_data:
                await self.send_error('User ID and image data are required')
                return
            
            # Check if user exists
            user_exists = await self.check_user_exists(user_id)
            if not user_exists:
                await self.send_error('User not found')
                return
            
            # Send processing status
            await self.send(text_data=json.dumps({
                'type': 'processing',
                'message': 'Processing face enrollment...',
                'timestamp': timezone.now().isoformat()
            }))
            
            # Add WebSocket metadata
            metadata.update({
                'enrollment_method': 'websocket',
                'channel_name': self.channel_name
            })
            
            # Process enrollment
            result = await asyncio.get_event_loop().run_in_executor(
                None, face_recognition_service.enroll_user_face, 
                user_id, image_data, metadata
            )
            
            # Update user enrollment status if successful
            if result['success']:
                await self.update_user_enrollment(user_id)
            
            # Send result
            response = {
                'type': 'enroll_result',
                'success': result['success'],
                'timestamp': timezone.now().isoformat(),
                'faces_detected': result.get('faces_detected', 0),
                'message': 'Enrollment successful' if result['success'] else result.get('error', 'Enrollment failed')
            }
            
            if result['success']:
                response['embedding_dimension'] = result.get('embedding_dimension')
                response['quality_score'] = result.get('best_face_score')
            
            await self.send(text_data=json.dumps(response))
            
        except Exception as e:
            logger.error(f"Enrollment error: {e}")
            await self.send_error('Enrollment failed')
    
    async def handle_quality_check(self, data):
        """Handle face quality assessment via WebSocket"""
        try:
            image_data = data.get('image')
            if not image_data:
                await self.send_error('Image data is required')
                return
            
            # Send processing status
            await self.send(text_data=json.dumps({
                'type': 'processing',
                'message': 'Assessing image quality...',
                'timestamp': timezone.now().isoformat()
            }))
            
            # Process quality check
            result = await asyncio.get_event_loop().run_in_executor(
                None, face_recognition_service.get_face_quality_score, image_data
            )
            
            # Send result
            response = {
                'type': 'quality_result',
                'success': result['success'],
                'timestamp': timezone.now().isoformat(),
                **result
            }
            
            await self.send(text_data=json.dumps(response))
            
        except Exception as e:
            logger.error(f"Quality check error: {e}")
            await self.send_error('Quality check failed')
    
    async def handle_ping(self, data):
        """Handle ping messages"""
        await self.send(text_data=json.dumps({
            'type': 'pong',
            'timestamp': timezone.now().isoformat(),
            'message': 'pong'
        }))
    
    async def send_error(self, message):
        """Send error message to client"""
        await self.send(text_data=json.dumps({
            'type': 'error',
            'message': message,
            'timestamp': timezone.now().isoformat()
        }))
    
    @database_sync_to_async
    def get_user_data(self, user_id):
        """Get user data from database"""
        try:
            user = User.objects.get(id=user_id)
            return {
                'id': str(user.id),
                'username': user.username,
                'email': user.email,
                'first_name': user.first_name,
                'last_name': user.last_name,
                'is_face_enrolled': user.is_face_enrolled
            }
        except User.DoesNotExist:
            return None
    
    @database_sync_to_async
    def check_user_exists(self, user_id):
        """Check if user exists"""
        return User.objects.filter(id=user_id).exists()
    
    @database_sync_to_async
    def update_user_enrollment(self, user_id):
        """Update user enrollment status"""
        try:
            user = User.objects.get(id=user_id)
            user.is_face_enrolled = True
            user.face_enrollment_date = timezone.now()
            user.save()
        except User.DoesNotExist:
            pass
    
    @database_sync_to_async
    def log_authentication_attempt(self, result, user_data):
        """Log authentication attempt to database"""
        try:
            attempt_data = {
                'success': result['success'],
                'confidence_score': result.get('confidence', 0.0),
                'method': 'websocket',
                'metadata': {
                    'faces_detected': result.get('faces_detected', 0),
                    'detection_score': result.get('detection_score', 0.0),
                    'channel_name': self.channel_name
                }
            }
            
            if user_data:
                user = User.objects.get(id=user_data['id'])
                attempt_data['user'] = user
            
            if not result['success']:
                attempt_data['error_message'] = result.get('error', 'Authentication failed')
            
            AuthenticationAttempt.objects.create(**attempt_data)
            
        except Exception as e:
            logger.error(f"Failed to log authentication attempt: {e}")


class FaceEnrollmentConsumer(AsyncWebsocketConsumer):
    """WebSocket consumer for face enrollment with real-time feedback"""
    
    async def connect(self):
        """Accept WebSocket connection"""
        self.user_id = self.scope['url_route']['kwargs'].get('user_id')
        if not self.user_id:
            await self.close()
            return
        
        await self.accept()
        
        await self.send(text_data=json.dumps({
            'type': 'connection',
            'status': 'connected',
            'message': f'Enrollment session started for user {self.user_id}',
            'timestamp': timezone.now().isoformat()
        }))
    
    async def disconnect(self, close_code):
        """Handle WebSocket disconnection"""
        logger.info(f"Enrollment WebSocket disconnected: {self.channel_name}")
    
    async def receive(self, text_data):
        """Handle incoming WebSocket messages"""
        try:
            data = json.loads(text_data)
            message_type = data.get('type')
            
            if message_type == 'enroll_image':
                await self.handle_enroll_image(data)
            elif message_type == 'complete_enrollment':
                await self.handle_complete_enrollment(data)
            elif message_type == 'cancel_enrollment':
                await self.handle_cancel_enrollment(data)
            else:
                await self.send_error('Invalid message type')
                
        except json.JSONDecodeError:
            await self.send_error('Invalid JSON format')
        except Exception as e:
            logger.error(f"Enrollment WebSocket error: {e}")
            await self.send_error('Internal server error')
    
    async def handle_enroll_image(self, data):
        """Handle individual image enrollment"""
        try:
            image_data = data.get('image')
            if not image_data:
                await self.send_error('Image data is required')
                return
            
            # Process enrollment
            metadata = data.get('metadata', {})
            metadata.update({
                'enrollment_method': 'websocket_multi',
                'channel_name': self.channel_name
            })
            
            result = await asyncio.get_event_loop().run_in_executor(
                None, face_recognition_service.enroll_user_face,
                self.user_id, image_data, metadata
            )
            
            await self.send(text_data=json.dumps({
                'type': 'image_processed',
                'success': result['success'],
                'message': 'Image processed successfully' if result['success'] else result.get('error'),
                'details': result,
                'timestamp': timezone.now().isoformat()
            }))
            
        except Exception as e:
            logger.error(f"Image enrollment error: {e}")
            await self.send_error('Failed to process image')
    
    async def handle_complete_enrollment(self, data):
        """Handle enrollment completion"""
        await self.update_user_enrollment()
        
        await self.send(text_data=json.dumps({
            'type': 'enrollment_completed',
            'message': 'Face enrollment completed successfully',
            'timestamp': timezone.now().isoformat()
        }))
    
    async def handle_cancel_enrollment(self, data):
        """Handle enrollment cancellation"""
        await self.send(text_data=json.dumps({
            'type': 'enrollment_cancelled',
            'message': 'Face enrollment cancelled',
            'timestamp': timezone.now().isoformat()
        }))
    
    async def send_error(self, message):
        """Send error message to client"""
        await self.send(text_data=json.dumps({
            'type': 'error',
            'message': message,
            'timestamp': timezone.now().isoformat()
        }))
    
    @database_sync_to_async
    def update_user_enrollment(self):
        """Update user enrollment status"""
        try:
            user = User.objects.get(id=self.user_id)
            user.is_face_enrolled = True
            user.face_enrollment_date = timezone.now()
            user.save()
        except User.DoesNotExist:
            pass