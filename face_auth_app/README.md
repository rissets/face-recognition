# Face Recognition Authentication App

A Django-based face recognition authentication system with REST API and WebSocket support.

## Features

- 🔐 Face recognition authentication using InsightFace
- 🚀 Real-time WebSocket communication
- 📡 REST API endpoints
- 🗄️ ChromaDB for vector storage
- 🎥 Live camera demo interface
- 📊 Quality assessment and feedback
- 🔍 Comprehensive logging and monitoring

## Quick Start

### Prerequisites

- Python 3.8+
- Redis (for WebSocket support)
- Webcam (for demo)

### Installation

1. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

2. **Set up environment variables:**
   ```bash
   cp .env.example .env
   # Edit .env with your settings
   ```

3. **Run migrations:**
   ```bash
   python manage.py migrate
   ```

4. **Create superuser (optional):**
   ```bash
   python manage.py createsuperuser
   ```

5. **Start Redis (required for WebSocket):**
   ```bash
   # On macOS with Homebrew:
   brew services start redis
   
   # On Ubuntu:
   sudo systemctl start redis
   
   # Or with Docker:
   docker run -d -p 6379:6379 redis:alpine
   ```

6. **Run the development server:**
   ```bash
   python manage.py runserver
   ```

### Testing the Application

1. **Access the demo interface:**
   - Open http://localhost:8000/demo/
   - Click "Start Camera" to enable webcam
   - Test both WebSocket and REST API endpoints

2. **API Documentation:**
   - Base URL: http://localhost:8000/api/auth/
   - WebSocket: ws://localhost:8000/ws/face-auth/

## API Endpoints

### REST API

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/auth/register/` | POST | Register new user |
| `/api/auth/authenticate/` | POST | Authenticate by face |
| `/api/auth/enroll/` | POST | Enroll user face |
| `/api/auth/quality-check/` | POST | Check image quality |
| `/api/auth/profile/` | GET/PUT | User profile |
| `/api/auth/enrollments/` | GET | List enrollments |
| `/api/auth/attempts/` | GET | List auth attempts |

### WebSocket Messages

**Connect:** `ws://localhost:8000/ws/face-auth/`

**Message Types:**
- `authenticate` - Face authentication
- `enroll` - Face enrollment
- `quality_check` - Image quality assessment
- `ping` - Connection test

## Example Usage

### Register User (REST API)
```bash
curl -X POST http://localhost:8000/api/auth/register/ \
  -H "Content-Type: application/json" \
  -d '{
    "username": "john_doe",
    "email": "john@example.com",
    "password": "secure_password",
    "password_confirm": "secure_password",
    "first_name": "John",
    "last_name": "Doe"
  }'
```

### Enroll Face (REST API)
```bash
curl -X POST http://localhost:8000/api/auth/enroll/ \
  -H "Content-Type: application/json" \
  -H "Authorization: Token YOUR_TOKEN" \
  -d '{
    "image": "data:image/jpeg;base64,/9j/4AAQ...",
    "metadata": {"source": "api"}
  }'
```

### Authenticate (REST API)
```bash
curl -X POST http://localhost:8000/api/auth/authenticate/ \
  -H "Content-Type: application/json" \
  -d '{
    "image": "data:image/jpeg;base64,/9j/4AAQ..."
  }'
```

### WebSocket Example (JavaScript)
```javascript
const ws = new WebSocket('ws://localhost:8000/ws/face-auth/');

// Authenticate
ws.send(JSON.stringify({
  type: 'authenticate',
  image: 'data:image/jpeg;base64,/9j/4AAQ...'
}));

// Handle response
ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  if (data.type === 'authenticate_result') {
    console.log('Authentication result:', data);
  }
};
```

## Configuration

### Face Recognition Settings
```python
FACE_RECOGNITION = {
    'MODEL_NAME': 'buffalo_l',
    'THRESHOLD': 0.7,
    'DET_SIZE': (640, 640),
}
```

### ChromaDB Settings
```python
CHROMADB_SETTINGS = {
    'persist_directory': './chroma_db',
    'collection_name': 'face_embeddings',
}
```

## Project Structure

```
face_auth_app/
├── face_auth/              # Django project settings
├── authentication/         # Main app
│   ├── models.py           # Database models
│   ├── views.py            # REST API views
│   ├── consumers.py        # WebSocket consumers
│   ├── face_service.py     # Face recognition logic
│   ├── chroma_service.py   # ChromaDB integration
│   └── serializers.py      # API serializers
├── static/                 # Static files
├── templates/              # HTML templates
├── chroma_db/              # ChromaDB storage
└── requirements.txt        # Dependencies
```

## Development

### Adding New Features

1. **Custom face recognition models:**
   - Modify `face_service.py`
   - Update `FACE_RECOGNITION` settings

2. **Additional API endpoints:**
   - Add views in `views.py`
   - Update `urls.py`

3. **WebSocket message types:**
   - Extend `consumers.py`
   - Update frontend JavaScript

### Testing

```bash
# Run tests
python manage.py test

# Run with coverage
coverage run --source='.' manage.py test
coverage report
```

## Deployment

### Production Considerations

1. **Security:**
   - Set `DEBUG=False`
   - Use strong `SECRET_KEY`
   - Configure `ALLOWED_HOSTS`
   - Use HTTPS

2. **Database:**
   - Use PostgreSQL instead of SQLite
   - Set up database backups

3. **Redis:**
   - Configure Redis clustering
   - Set up Redis persistence

4. **Static Files:**
   - Use a CDN or nginx for static files
   - Run `python manage.py collectstatic`

### Docker Deployment

```dockerfile
FROM python:3.11-slim

WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt

COPY . .

EXPOSE 8000
CMD ["daphne", "-b", "0.0.0.0", "-p", "8000", "face_auth.asgi:application"]
```

## Troubleshooting

### Common Issues

1. **Camera not working:**
   - Check browser permissions
   - Use HTTPS for production
   - Verify camera hardware

2. **WebSocket connection failed:**
   - Ensure Redis is running
   - Check firewall settings
   - Verify WebSocket URL

3. **Face detection issues:**
   - Ensure good lighting
   - Face should be clearly visible
   - Check image quality

4. **ChromaDB errors:**
   - Verify write permissions
   - Check disk space
   - Clear corrupted data

### Logs

Check Django logs for detailed error information:
```bash
# Enable debug logging
export DJANGO_LOG_LEVEL=DEBUG
python manage.py runserver
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## License

MIT License - see LICENSE file for details.

## Support

For issues and questions:
- Create an issue on GitHub
- Check the documentation
- Review the demo code