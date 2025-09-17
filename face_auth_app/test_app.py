"""
Test script for Face Recognition Authentication App
"""
import os
import sys
import django
from django.test import TestCase
from django.test.client import Client
from django.contrib.auth import get_user_model
import json
import base64
from io import BytesIO
from PIL import Image
import numpy as np

# Setup Django environment
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'face_auth.settings')
django.setup()

User = get_user_model()

def create_test_image():
    """Create a simple test image"""
    # Create a simple colored image
    img = Image.new('RGB', (400, 300), color='red')
    buffer = BytesIO()
    img.save(buffer, format='JPEG')
    image_data = base64.b64encode(buffer.getvalue()).decode()
    return f"data:image/jpeg;base64,{image_data}"

def test_api_endpoints():
    """Test main API endpoints"""
    client = Client()
    
    print("🧪 Testing Face Recognition Authentication API...")
    
    # Test API root
    print("1. Testing API root...")
    response = client.get('/api/')
    assert response.status_code == 200
    print("   ✅ API root accessible")
    
    # Test user registration
    print("2. Testing user registration...")
    user_data = {
        'username': 'testuser',
        'email': 'test@example.com',
        'password': 'testpassword123',
        'password_confirm': 'testpassword123',
        'first_name': 'Test',
        'last_name': 'User'
    }
    
    response = client.post('/api/auth/register/', 
                          data=json.dumps(user_data),
                          content_type='application/json')
    
    if response.status_code == 201:
        result = response.json()
        print("   ✅ User registration successful")
        print(f"   📧 User: {result['user']['email']}")
        print(f"   🔑 Token: {result['token'][:20]}...")
        token = result['token']
        user_id = result['user']['id']
    else:
        print(f"   ❌ Registration failed: {response.json()}")
        return
    
    # Test quality check
    print("3. Testing image quality check...")
    test_image = create_test_image()
    
    quality_data = {'image': test_image}
    response = client.post('/api/auth/quality-check/',
                          data=json.dumps(quality_data),
                          content_type='application/json')
    
    if response.status_code == 200:
        result = response.json()
        print("   ✅ Quality check successful")
        if result['success']:
            print(f"   📊 Quality score: {result['quality_score']:.2f}")
            print(f"   👤 Faces detected: {result['faces_detected']}")
        else:
            print(f"   ⚠️ Quality check failed: {result['error']}")
    else:
        print(f"   ❌ Quality check request failed: {response.status_code}")
    
    # Test face authentication (should fail with test image)
    print("4. Testing face authentication...")
    auth_data = {'image': test_image}
    response = client.post('/api/auth/authenticate/',
                          data=json.dumps(auth_data),
                          content_type='application/json')
    
    if response.status_code in [200, 401]:
        result = response.json()
        print("   ✅ Authentication endpoint accessible")
        if not result['success']:
            print(f"   ⚠️ Authentication failed (expected): {result['error']}")
    else:
        print(f"   ❌ Authentication request failed: {response.status_code}")
    
    # Test face enrollment (with token)
    print("5. Testing face enrollment...")
    headers = {'HTTP_AUTHORIZATION': f'Token {token}'}
    enroll_data = {'image': test_image, 'metadata': {'test': True}}
    
    response = client.post('/api/auth/enroll/',
                          data=json.dumps(enroll_data),
                          content_type='application/json',
                          **headers)
    
    if response.status_code in [201, 400]:
        result = response.json()
        print("   ✅ Enrollment endpoint accessible")
        if result['success']:
            print("   ✅ Face enrolled successfully")
        else:
            print(f"   ⚠️ Enrollment failed (expected with test image): {result['error']}")
    else:
        print(f"   ❌ Enrollment request failed: {response.status_code}")
    
    # Test user profile
    print("6. Testing user profile...")
    response = client.get('/api/auth/profile/', **headers)
    
    if response.status_code == 200:
        result = response.json()
        print("   ✅ Profile endpoint accessible")
        print(f"   👤 User: {result['email']}")
    else:
        print(f"   ❌ Profile request failed: {response.status_code}")
    
    print("\n✅ API testing completed!")

def test_demo_page():
    """Test demo page accessibility"""
    client = Client()
    
    print("🎭 Testing demo page...")
    response = client.get('/demo/')
    
    if response.status_code == 200:
        print("   ✅ Demo page accessible")
        print("   🌐 Visit: http://localhost:8000/demo/")
    else:
        print(f"   ❌ Demo page failed: {response.status_code}")

def check_dependencies():
    """Check if all required dependencies are available"""
    print("📦 Checking dependencies...")
    
    try:
        import cv2
        print("   ✅ OpenCV available")
    except ImportError:
        print("   ❌ OpenCV not found")
    
    try:
        import insightface
        print("   ✅ InsightFace available")
    except ImportError:
        print("   ❌ InsightFace not found")
    
    try:
        import chromadb
        print("   ✅ ChromaDB available")
    except ImportError:
        print("   ❌ ChromaDB not found")
    
    try:
        import channels
        print("   ✅ Django Channels available")
    except ImportError:
        print("   ❌ Django Channels not found")
    
    try:
        import rest_framework
        print("   ✅ Django REST Framework available")
    except ImportError:
        print("   ❌ Django REST Framework not found")

def main():
    """Run all tests"""
    print("🚀 Face Recognition Authentication App - Test Suite")
    print("=" * 60)
    
    check_dependencies()
    print()
    
    test_demo_page()
    print()
    
    test_api_endpoints()
    print()
    
    print("🎯 Next steps:")
    print("1. Start Redis: brew services start redis")
    print("2. Run server: python manage.py runserver")
    print("3. Open demo: http://localhost:8000/demo/")
    print("4. Test with real camera for face recognition")
    print()
    print("📚 See README.md for complete documentation")

if __name__ == '__main__':
    main()