"""
WebSocket URL routing for face recognition
"""
from django.urls import re_path
from . import consumers

websocket_urlpatterns = [
    re_path(r'ws/face-auth/$', consumers.FaceAuthConsumer.as_asgi()),
    re_path(r'ws/enroll/(?P<user_id>[^/]+)/$', consumers.FaceEnrollmentConsumer.as_asgi()),
]