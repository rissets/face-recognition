from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.utils.html import format_html
from django.urls import reverse
from django.utils.safestring import mark_safe
from .models import User, FaceEnrollment, AuthenticationAttempt, FaceImage


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    """Enhanced User admin with face enrollment info"""
    
    list_display = ('username', 'email', 'first_name', 'last_name', 
                   'is_face_enrolled', 'face_enrollment_date', 'enrollment_count',
                   'last_login_attempt', 'is_staff', 'is_active')
    list_filter = ('is_face_enrolled', 'is_staff', 'is_active', 'face_enrollment_date')
    search_fields = ('username', 'email', 'first_name', 'last_name')
    readonly_fields = ('created_at', 'face_enrollment_date', 'enrollment_count', 'last_login_attempt')
    
    fieldsets = BaseUserAdmin.fieldsets + (
        ('Face Recognition Info', {
            'fields': ('is_face_enrolled', 'face_enrollment_date', 'created_at', 
                      'enrollment_count', 'last_login_attempt'),
        }),
    )
    
    def enrollment_count(self, obj):
        """Count of face enrollments for this user"""
        return obj.faceenrollment_set.count()
    enrollment_count.short_description = 'Enrollments'
    
    def last_login_attempt(self, obj):
        """Last authentication attempt"""
        attempt = obj.authenticationattempt_set.filter(success=True).first()
        if attempt:
            return attempt.attempt_date.strftime('%Y-%m-%d %H:%M')
        return 'Never'
    last_login_attempt.short_description = 'Last Login'


@admin.register(FaceEnrollment)
class FaceEnrollmentAdmin(admin.ModelAdmin):
    """Face Enrollment admin interface"""
    
    list_display = ('id', 'user_link', 'user_email', 'enrollment_date', 
                   'image_count', 'status', 'embedding_dimension', 'method')
    list_filter = ('status', 'enrollment_date', 'embedding_dimension')
    search_fields = ('user__username', 'user__email', 'id')
    readonly_fields = ('id', 'enrollment_date', 'user_email', 'metadata_display')
    
    fieldsets = (
        (None, {
            'fields': ('id', 'user', 'user_email', 'enrollment_date', 'status')
        }),
        ('Technical Details', {
            'fields': ('image_count', 'embedding_dimension', 'metadata_display'),
            'classes': ('collapse',)
        }),
    )
    
    def user_link(self, obj):
        """Link to user admin page"""
        url = reverse('admin:authentication_user_change', args=[obj.user.pk])
        return format_html('<a href="{}">{}</a>', url, obj.user.username)
    user_link.short_description = 'User'
    
    def user_email(self, obj):
        return obj.user.email
    user_email.short_description = 'Email'
    
    def method(self, obj):
        """Extract enrollment method from metadata"""
        if obj.metadata and 'enrollment_method' in obj.metadata:
            return obj.metadata['enrollment_method']
        return 'unknown'
    method.short_description = 'Method'
    
    def metadata_display(self, obj):
        """Display metadata in a readable format"""
        if not obj.metadata:
            return 'No metadata'
        
        html = '<div style="font-family: monospace; font-size: 12px;">'
        for key, value in obj.metadata.items():
            if key in ['user_agent']:
                # Truncate long user agent strings
                value = str(value)[:50] + '...' if len(str(value)) > 50 else value
            html += f'<strong>{key}:</strong> {value}<br>'
        html += '</div>'
        return mark_safe(html)
    metadata_display.short_description = 'Metadata'


@admin.register(AuthenticationAttempt)
class AuthenticationAttemptAdmin(admin.ModelAdmin):
    """Authentication Attempt admin interface"""
    
    list_display = ('user_link', 'user_email', 'attempt_date', 'success', 
                   'method', 'confidence_score', 'ip_address', 'error_message_short')
    list_filter = ('success', 'method', 'attempt_date')
    search_fields = ('user__username', 'user__email', 'ip_address')
    readonly_fields = ('id', 'attempt_date', 'user_email')
    date_hierarchy = 'attempt_date'
    
    fieldsets = (
        (None, {
            'fields': ('id', 'user', 'user_email', 'attempt_date', 'success')
        }),
        ('Technical Details', {
            'fields': ('method', 'confidence_score', 'ip_address', 'error_message'),
        }),
    )
    
    def user_link(self, obj):
        """Link to user admin page"""
        if obj.user:
            url = reverse('admin:authentication_user_change', args=[obj.user.pk])
            return format_html('<a href="{}">{}</a>', url, obj.user.username)
        return "No User"
    user_link.short_description = 'User'
    
    def user_email(self, obj):
        return obj.user.email if obj.user else "No Email"
    user_email.short_description = 'Email'
    
    def error_message_short(self, obj):
        """Truncated error message for list view"""
        if obj.error_message:
            return obj.error_message[:50] + '...' if len(obj.error_message) > 50 else obj.error_message
        return '-'
    error_message_short.short_description = 'Error'


@admin.register(FaceImage)
class FaceImageAdmin(admin.ModelAdmin):
    """Face Image metadata admin interface"""
    
    list_display = ('id', 'user_link', 'user_email', 'upload_date', 
                   'image_quality_score', 'chroma_id_short')
    list_filter = ('upload_date', 'image_quality_score')
    search_fields = ('user__username', 'user__email', 'chroma_id')
    readonly_fields = ('id', 'upload_date', 'user_email', 'metadata_display')
    
    fieldsets = (
        (None, {
            'fields': ('id', 'user', 'user_email', 'upload_date', 'chroma_id')
        }),
        ('Image Details', {
            'fields': ('image_quality_score', 'face_bbox', 'landmarks', 'metadata_display'),
            'classes': ('collapse',)
        }),
    )
    
    def user_link(self, obj):
        """Link to user admin page"""
        url = reverse('admin:authentication_user_change', args=[obj.user.pk])
        return format_html('<a href="{}">{}</a>', url, obj.user.username)
    user_link.short_description = 'User'
    
    def user_email(self, obj):
        return obj.user.email
    user_email.short_description = 'Email'
    
    def chroma_id_short(self, obj):
        """Shortened ChromaDB ID for display"""
        return obj.chroma_id[:16] + '...' if len(obj.chroma_id) > 16 else obj.chroma_id
    chroma_id_short.short_description = 'Chroma ID'
    
    def metadata_display(self, obj):
        """Display metadata in a readable format"""
        if not obj.metadata:
            return 'No metadata'
        
        html = '<div style="font-family: monospace; font-size: 12px;">'
        for key, value in obj.metadata.items():
            html += f'<strong>{key}:</strong> {value}<br>'
        html += '</div>'
        return mark_safe(html)
    metadata_display.short_description = 'Metadata'


# Custom admin site configuration
admin.site.site_header = 'Face Recognition Admin'
admin.site.site_title = 'Face Recognition Admin'
admin.site.index_title = 'Face Recognition Administration'
