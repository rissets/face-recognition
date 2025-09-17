"""
URL configuration for face_auth project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/4.2/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from django.http import JsonResponse
from django.views.generic import TemplateView

def api_root(request):
    return JsonResponse({
        'message': 'Face Recognition Authentication API',
        'version': '1.0',
        'endpoints': {
            'register': '/api/auth/register/',
            'authenticate': '/api/auth/authenticate/',
            'enroll': '/api/auth/enroll/',
            'profile': '/api/auth/profile/',
            'quality_check': '/api/auth/quality-check/',
            'websocket': '/ws/face-auth/',
            'admin': '/admin/',
            'demo': '/demo/',
        }
    })

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', api_root, name='api-root'),
    path('api/auth/', include('authentication.urls', namespace='api')),
    path('demo/', TemplateView.as_view(template_name='demo.html'), name='demo'),
    path('app/', TemplateView.as_view(template_name='index.html'), name='app'),
    path('', TemplateView.as_view(template_name='index.html'), name='index'),
]

# Serve static and media files in development
if settings.DEBUG:
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
