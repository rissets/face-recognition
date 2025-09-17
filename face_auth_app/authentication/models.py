from django.db import models
from django.contrib.auth.models import AbstractUser
from django.utils import timezone
import uuid


class User(AbstractUser):
    """Extended User model for face recognition authentication"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    email = models.EmailField(unique=True)
    is_face_enrolled = models.BooleanField(default=False)
    face_enrollment_date = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['username', 'first_name', 'last_name']
    
    class Meta:
        db_table = 'auth_user'
    
    def __str__(self):
        return f"{self.email} ({self.username})"


class FaceEnrollment(models.Model):
    """Model to track face enrollment attempts and metadata"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='face_enrollments')
    enrollment_date = models.DateTimeField(auto_now_add=True)
    image_count = models.PositiveIntegerField(default=0)
    embedding_dimension = models.PositiveIntegerField(default=512)
    status = models.CharField(
        max_length=20,
        choices=[
            ('pending', 'Pending'),
            ('completed', 'Completed'),
            ('failed', 'Failed'),
        ],
        default='pending'
    )
    metadata = models.JSONField(default=dict, blank=True)
    
    class Meta:
        ordering = ['-enrollment_date']
    
    def __str__(self):
        return f"Face enrollment for {self.user.email} - {self.status}"


class AuthenticationAttempt(models.Model):
    """Model to log face recognition authentication attempts"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        User, 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True,
        related_name='auth_attempts'
    )
    attempt_date = models.DateTimeField(auto_now_add=True)
    success = models.BooleanField(default=False)
    confidence_score = models.FloatField(null=True, blank=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.TextField(blank=True)
    method = models.CharField(
        max_length=20,
        choices=[
            ('websocket', 'WebSocket'),
            ('rest_api', 'REST API'),
        ],
        default='rest_api'
    )
    error_message = models.TextField(blank=True)
    metadata = models.JSONField(default=dict, blank=True)
    
    class Meta:
        ordering = ['-attempt_date']
        indexes = [
            models.Index(fields=['user', '-attempt_date']),
            models.Index(fields=['success', '-attempt_date']),
            models.Index(fields=['ip_address', '-attempt_date']),
        ]
    
    def __str__(self):
        status = "Success" if self.success else "Failed"
        user_info = self.user.email if self.user else "Unknown"
        return f"{status} auth attempt for {user_info} at {self.attempt_date}"


class FaceImage(models.Model):
    """Model to store face images metadata (actual images stored in ChromaDB as embeddings)"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='face_images')
    enrollment = models.ForeignKey(
        FaceEnrollment, 
        on_delete=models.CASCADE, 
        related_name='images',
        null=True, 
        blank=True
    )
    image_path = models.CharField(max_length=255, blank=True)  # Optional: store image path
    chroma_id = models.CharField(max_length=255, unique=True)  # ID in ChromaDB
    upload_date = models.DateTimeField(auto_now_add=True)
    image_quality_score = models.FloatField(null=True, blank=True)
    face_bbox = models.JSONField(default=dict, blank=True)  # Bounding box coordinates
    landmarks = models.JSONField(default=dict, blank=True)  # Face landmarks
    metadata = models.JSONField(default=dict, blank=True)
    
    class Meta:
        ordering = ['-upload_date']
        indexes = [
            models.Index(fields=['user', '-upload_date']),
            models.Index(fields=['chroma_id']),
        ]
    
    def __str__(self):
        return f"Face image for {self.user.email} - {self.chroma_id[:8]}..."
