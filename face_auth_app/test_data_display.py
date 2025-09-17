#!/usr/bin/env python
"""
Test script to verify that enrollment and activity data is displaying correctly
"""
import os
import sys
import django

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'face_auth.settings')
django.setup()

from authentication.models import User, FaceEnrollment, AuthenticationAttempt
from rest_framework.authtoken.models import Token

def test_data_display():
    print("=== Testing Data Display ===\n")
    
    # Check users
    users = User.objects.all()
    print(f"Total Users: {users.count()}")
    for user in users:
        print(f"  - {user.username} (Enrolled: {user.is_face_enrolled})")
    
    # Check enrollments
    enrollments = FaceEnrollment.objects.all()
    print(f"\nTotal Enrollments: {enrollments.count()}")
    for enrollment in enrollments:
        print(f"  - {enrollment.user.username}: {enrollment.status} ({enrollment.enrollment_date})")
    
    # Check attempts
    attempts = AuthenticationAttempt.objects.all()
    print(f"\nTotal Attempts: {attempts.count()}")
    for attempt in attempts[:5]:  # Show first 5
        print(f"  - {attempt.user.username if attempt.user else 'Unknown'}: {attempt.success} ({attempt.method})")
    
    # Test API responses for enrolled user
    enrolled_user = User.objects.filter(is_face_enrolled=True).first()
    if enrolled_user:
        print(f"\n=== Testing API for {enrolled_user.username} ===")
        
        # Get or create token
        from rest_framework.authtoken.models import Token as AuthToken
        token, created = AuthToken.objects.get_or_create(user=enrolled_user)
        print(f"Token: {token.key}")
        
        # Test data counts directly
        user_enrollments = FaceEnrollment.objects.filter(user=enrolled_user)
        user_attempts = AuthenticationAttempt.objects.filter(user=enrolled_user)
        
        print(f"Enrollments for {enrolled_user.username}: {user_enrollments.count()}")
        print(f"Attempts for {enrolled_user.username}: {user_attempts.count()}")
        
    print("\n=== Test Complete ===")

if __name__ == '__main__':
    test_data_display()