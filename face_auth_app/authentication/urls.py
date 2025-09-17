"""
URL Configuration for Authentication App
"""
from django.urls import path
from django.views.generic import TemplateView
from . import views

app_name = 'authentication'

urlpatterns = [
    # User management
    path('register/', views.UserRegistrationView.as_view(), name='user-register'),
    path('profile/', views.UserProfileView.as_view(), name='user-profile'),
    
    # Face recognition endpoints
    path('enroll/', views.enroll_face, name='enroll-face'),
    path('authenticate/', views.authenticate_face, name='authenticate-face'),
    path('quality-check/', views.assess_face_quality, name='assess-quality'),
    path('delete-enrollment/', views.delete_face_enrollment, name='delete-enrollment'),
    
    # Data access
    path('enrollments/', views.FaceEnrollmentListView.as_view(), name='enrollment-list'),
    path('attempts/', views.AuthenticationAttemptListView.as_view(), name='attempt-list'),
    
    # Statistics endpoints
    path('user-stats/', views.get_user_stats, name='user-stats'),
    path('stats/', views.get_system_stats, name='system-stats'),
    
    # Demo page
    path('demo/', TemplateView.as_view(template_name='demo.html'), name='demo'),
]