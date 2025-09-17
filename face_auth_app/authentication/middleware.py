"""
Custom middleware for CSRF exemption
"""
import re
from django.middleware.csrf import CsrfViewMiddleware
from django.conf import settings


class CsrfExemptMiddleware(CsrfViewMiddleware):
    """
    Middleware that exempts certain URL patterns from CSRF validation
    """
    def process_view(self, request, callback, callback_args, callback_kwargs):
        # Check if the request path matches any exempt URLs
        if hasattr(settings, 'CSRF_EXEMPT_URLS'):
            for pattern in settings.CSRF_EXEMPT_URLS:
                if re.match(pattern, request.path):
                    # Mark the view as CSRF exempt
                    setattr(callback, 'csrf_exempt', True)
                    break
        
        return super().process_view(request, callback, callback_args, callback_kwargs)