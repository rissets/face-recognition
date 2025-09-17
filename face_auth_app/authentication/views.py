"""
API Views for Face Recognition Authentication
"""
from rest_framework import status, generics, permissions
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.authtoken.models import Token
from django.contrib.auth import get_user_model, authenticate
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt
from django.utils.decorators import method_decorator
from django.db import transaction
from .models import FaceEnrollment, AuthenticationAttempt, FaceImage
from .serializers import (
    UserSerializer, UserRegistrationSerializer, FaceEnrollmentSerializer,
    FaceEnrollmentRequestSerializer, FaceAuthenticationSerializer,
    AuthenticationAttemptSerializer, FaceQualitySerializer
)
from .face_service import face_recognition_service
from .chroma_service import chroma_service
import logging
import uuid

logger = logging.getLogger(__name__)
User = get_user_model()


class UserRegistrationView(generics.CreateAPIView):
    """User registration endpoint"""
    queryset = User.objects.all()
    serializer_class = UserRegistrationSerializer
    permission_classes = [permissions.AllowAny]
    
    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        
        # Create auth token
        token, created = Token.objects.get_or_create(user=user)
        
        return Response({
            'user': UserSerializer(user).data,
            'token': token.key,
            'message': 'User registered successfully'
        }, status=status.HTTP_201_CREATED)


class UserProfileView(generics.RetrieveUpdateAPIView):
    """User profile endpoint"""
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_object(self):
        return self.request.user


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
@csrf_exempt
def enroll_face(request):
    """
    Enroll user's face for authentication
    """
    try:
        serializer = FaceEnrollmentRequestSerializer(data=request.data)
        if not serializer.is_valid():
            return Response({
                'success': False,
                'errors': serializer.errors
            }, status=status.HTTP_400_BAD_REQUEST)
        
        user = request.user
        image_data = serializer.validated_data['image']
        metadata = serializer.validated_data.get('metadata', {})
        
        # Add request metadata
        metadata.update({
            'ip_address': request.META.get('REMOTE_ADDR'),
            'user_agent': request.META.get('HTTP_USER_AGENT', ''),
        })
        
        # Create enrollment record
        with transaction.atomic():
            enrollment = FaceEnrollment.objects.create(
                user=user,
                status='pending',
                metadata=metadata
            )
            
            # Process face enrollment
            result = face_recognition_service.enroll_user_face(
                user_id=str(user.id),
                image_data=image_data,
                metadata=metadata
            )
            
            if result['success']:
                # Update enrollment status
                enrollment.status = 'completed'
                enrollment.image_count = 1
                enrollment.embedding_dimension = result['embedding_dimension']
                enrollment.save()
                
                # Update user
                user.is_face_enrolled = True
                user.face_enrollment_date = timezone.now()
                user.save()
                
                # Create face image record
                FaceImage.objects.create(
                    user=user,
                    enrollment=enrollment,
                    chroma_id=f"{user.id}_{enrollment.id}",
                    image_quality_score=result.get('best_face_score'),
                    face_bbox=result.get('metadata', {}).get('bbox', {}),
                    metadata=result.get('metadata', {})
                )
                
                return Response({
                    'success': True,
                    'message': 'Face enrolled successfully',
                    'enrollment_id': enrollment.id,
                    'details': result
                }, status=status.HTTP_201_CREATED)
            
            else:
                enrollment.status = 'failed'
                enrollment.metadata.update({'error': result.get('error')})
                enrollment.save()
                
                return Response({
                    'success': False,
                    'message': 'Face enrollment failed',
                    'error': result.get('error'),
                    'details': result
                }, status=status.HTTP_400_BAD_REQUEST)
    
    except Exception as e:
        logger.error(f"Face enrollment error: {e}")
        return Response({
            'success': False,
            'error': 'Internal server error'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([permissions.AllowAny])
@csrf_exempt
def authenticate_face(request):
    """
    Authenticate user by face recognition
    """
    try:
        serializer = FaceAuthenticationSerializer(data=request.data)
        if not serializer.is_valid():
            return Response({
                'success': False,
                'errors': serializer.errors
            }, status=status.HTTP_400_BAD_REQUEST)
        
        image_data = serializer.validated_data['image']
        
        # Process face authentication
        result = face_recognition_service.authenticate_user(image_data)
        
        # Log authentication attempt
        attempt_data = {
            'attempt_date': timezone.now(),
            'success': result['success'],
            'confidence_score': result.get('confidence', 0.0),
            'ip_address': request.META.get('REMOTE_ADDR'),
            'user_agent': request.META.get('HTTP_USER_AGENT', ''),
            'method': 'rest_api',
            'metadata': {
                'faces_detected': result.get('faces_detected', 0),
                'detection_score': result.get('detection_score', 0.0),
                'all_matches': result.get('all_matches', [])
            }
        }
        
        user = None
        token = None
        
        if result['success']:
            try:
                user = User.objects.get(id=result['user_id'])
                token, created = Token.objects.get_or_create(user=user)
                attempt_data['user'] = user
            except User.DoesNotExist:
                result['success'] = False
                result['error'] = 'User not found'
        
        if not result['success']:
            attempt_data['error_message'] = result.get('error', 'Authentication failed')
        
        # Save authentication attempt
        AuthenticationAttempt.objects.create(**attempt_data)
        
        if result['success']:
            return Response({
                'success': True,
                'message': 'Authentication successful',
                'user': UserSerializer(user).data,
                'token': token.key,
                'confidence': result['confidence'],
                'details': result
            }, status=status.HTTP_200_OK)
        else:
            return Response({
                'success': False,
                'message': 'Authentication failed',
                'error': result.get('error'),
                'details': result
            }, status=status.HTTP_401_UNAUTHORIZED)
    
    except Exception as e:
        logger.error(f"Face authentication error: {e}")
        return Response({
            'success': False,
            'error': 'Internal server error'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([permissions.AllowAny])
def assess_face_quality(request):
    """
    Assess the quality of a face image for enrollment
    """
    try:
        serializer = FaceQualitySerializer(data=request.data)
        if not serializer.is_valid():
            return Response({
                'success': False,
                'errors': serializer.errors
            }, status=status.HTTP_400_BAD_REQUEST)
        
        image_data = serializer.validated_data['image']
        result = face_recognition_service.get_face_quality_score(image_data)
        
        return Response(result, status=status.HTTP_200_OK)
    
    except Exception as e:
        logger.error(f"Face quality assessment error: {e}")
        return Response({
            'success': False,
            'error': 'Internal server error'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class FaceEnrollmentListView(generics.ListAPIView):
    """List user's face enrollments"""
    serializer_class = FaceEnrollmentSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        return FaceEnrollment.objects.filter(user=self.request.user)


class AuthenticationAttemptListView(generics.ListAPIView):
    """List user's authentication attempts"""
    serializer_class = AuthenticationAttemptSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        return AuthenticationAttempt.objects.filter(user=self.request.user)


@api_view(['DELETE'])
@permission_classes([permissions.IsAuthenticated])
def delete_face_enrollment(request):
    """
    Delete user's face enrollment data
    """
    try:
        user = request.user
        
        # Delete from ChromaDB
        chroma_service.delete_user_embeddings(str(user.id))
        
        # Delete from database
        FaceEnrollment.objects.filter(user=user).delete()
        FaceImage.objects.filter(user=user).delete()
        
        # Update user
        user.is_face_enrolled = False
        user.face_enrollment_date = None
        user.save()
        
        return Response({
            'success': True,
            'message': 'Face enrollment data deleted successfully'
        }, status=status.HTTP_200_OK)
    
    except Exception as e:
        logger.error(f"Delete face enrollment error: {e}")
        return Response({
            'success': False,
            'error': 'Internal server error'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def get_user_stats(request):
    """
    Get user-specific statistics for dashboard
    """
    try:
        user = request.user
        
        # Get user attempts
        user_attempts = AuthenticationAttempt.objects.filter(user=user)
        
        # Calculate statistics
        total_attempts = user_attempts.count()
        successful_attempts = user_attempts.filter(success=True).count()
        face_attempts = user_attempts.filter(method='face').count()
        
        # Calculate success rate
        success_rate = 0
        if total_attempts > 0:
            success_rate = round((successful_attempts / total_attempts) * 100, 2)
        
        # Get last login attempt
        last_attempt = user_attempts.filter(success=True).order_by('-attempt_date').first()
        last_login = last_attempt.attempt_date.isoformat() if last_attempt else None
        
        # Get enrollment info
        enrollment_count = FaceEnrollment.objects.filter(user=user).count()
        
        stats = {
            'total_attempts': total_attempts,
            'successful_attempts': successful_attempts,
            'face_attempts': face_attempts,
            'success_rate': success_rate,
            'last_login': last_login,
            'is_face_enrolled': user.is_face_enrolled,
            'enrollment_count': enrollment_count,
            'enrollment_date': user.face_enrollment_date.isoformat() if user.face_enrollment_date else None
        }
        
        return Response({
            'success': True,
            'stats': stats
        }, status=status.HTTP_200_OK)
        
    except Exception as e:
        logger.error(f"Get user stats error: {e}")
        return Response({
            'success': False,
            'error': 'Internal server error'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def get_system_stats(request):
    """
    Get system statistics (admin only)
    """
    if not request.user.is_staff:
        return Response({
            'error': 'Permission denied'
        }, status=status.HTTP_403_FORBIDDEN)
    
    try:
        stats = chroma_service.get_collection_stats()
        
        stats.update({
            'total_users': User.objects.count(),
            'enrolled_users': User.objects.filter(is_face_enrolled=True).count(),
            'total_enrollments': FaceEnrollment.objects.count(),
            'successful_attempts_today': AuthenticationAttempt.objects.filter(
                success=True,
                attempt_date__date=timezone.now().date()
            ).count(),
            'failed_attempts_today': AuthenticationAttempt.objects.filter(
                success=False,
                attempt_date__date=timezone.now().date()
            ).count(),
        })
        
        return Response({
            'success': True,
            'stats': stats
        }, status=status.HTTP_200_OK)
    
    except Exception as e:
        logger.error(f"Get system stats error: {e}")
        return Response({
            'success': False,
            'error': 'Internal server error'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
