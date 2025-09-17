"""
Serializers for Face Recognition API
"""
from rest_framework import serializers
from django.contrib.auth import get_user_model
from .models import FaceEnrollment, AuthenticationAttempt, FaceImage

User = get_user_model()


class UserSerializer(serializers.ModelSerializer):
    """Serializer for User model"""
    
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name', 
                 'is_face_enrolled', 'face_enrollment_date', 'created_at']
        read_only_fields = ['id', 'is_face_enrolled', 'face_enrollment_date', 'created_at']


class UserRegistrationSerializer(serializers.ModelSerializer):
    """Serializer for user registration"""
    password = serializers.CharField(write_only=True, min_length=8)
    password_confirm = serializers.CharField(write_only=True)
    
    class Meta:
        model = User
        fields = ['username', 'email', 'password', 'password_confirm', 
                 'first_name', 'last_name']
    
    def validate(self, attrs):
        if attrs['password'] != attrs['password_confirm']:
            raise serializers.ValidationError("Passwords don't match")
        return attrs
    
    def create(self, validated_data):
        validated_data.pop('password_confirm')
        user = User.objects.create_user(**validated_data)
        return user


class FaceEnrollmentSerializer(serializers.ModelSerializer):
    """Serializer for Face Enrollment"""
    user_email = serializers.EmailField(source='user.email', read_only=True)
    
    class Meta:
        model = FaceEnrollment
        fields = ['id', 'user', 'user_email', 'enrollment_date', 'image_count',
                 'embedding_dimension', 'status', 'metadata']
        read_only_fields = ['id', 'enrollment_date', 'user_email']


class FaceEnrollmentRequestSerializer(serializers.Serializer):
    """Serializer for face enrollment request"""
    image = serializers.CharField(help_text="Base64 encoded image data")
    metadata = serializers.JSONField(required=False, default=dict)
    
    def validate_image(self, value):
        if not value:
            raise serializers.ValidationError("Image data is required")
        return value


class FaceAuthenticationSerializer(serializers.Serializer):
    """Serializer for face authentication request"""
    image = serializers.CharField(help_text="Base64 encoded image data")
    
    def validate_image(self, value):
        if not value:
            raise serializers.ValidationError("Image data is required")
        return value


class AuthenticationAttemptSerializer(serializers.ModelSerializer):
    """Serializer for Authentication Attempt"""
    user_email = serializers.EmailField(source='user.email', read_only=True)
    timestamp = serializers.DateTimeField(source='attempt_date', read_only=True)
    
    class Meta:
        model = AuthenticationAttempt
        fields = ['id', 'user', 'user_email', 'attempt_date', 'timestamp', 'success',
                 'confidence_score', 'ip_address', 'method', 'error_message']
        read_only_fields = ['id', 'attempt_date', 'timestamp', 'user_email']


class FaceImageSerializer(serializers.ModelSerializer):
    """Serializer for Face Image metadata"""
    user_email = serializers.EmailField(source='user.email', read_only=True)
    
    class Meta:
        model = FaceImage
        fields = ['id', 'user', 'user_email', 'chroma_id', 'upload_date',
                 'image_quality_score', 'face_bbox', 'landmarks', 'metadata']
        read_only_fields = ['id', 'upload_date', 'user_email']


class FaceQualitySerializer(serializers.Serializer):
    """Serializer for face quality assessment request"""
    image = serializers.CharField(help_text="Base64 encoded image data")
    
    def validate_image(self, value):
        if not value:
            raise serializers.ValidationError("Image data is required")
        return value