# Face Authentication Application - PlantUML Diagrams

Koleksi diagram PlantUML untuk visualisasi technical flow aplikasi Face Authentication.

## Cara Menggunakan

1. **Online PlantUML Editor**: Copy-paste kode ke [PlantUML Online Server](http://www.plantuml.com/plantuml/uml/)
2. **VS Code Extension**: Install PlantUML extension dan preview file .puml
3. **Command Line**: Install PlantUML jar dan generate dengan `java -jar plantuml.jar filename.puml`

## Diagram yang Tersedia

### 1. User Registration Flow (`01_user_registration.puml`)
- Flow pendaftaran user baru
- Token generation
- Database interaction

### 2. Face Enrollment Flow (`02_face_enrollment.puml`)
- Process enrollment wajah user
- InsightFace model integration
- ChromaDB embedding storage
- Error handling untuk berbagai skenario

### 3. Face Authentication Flow (`03_face_authentication.puml`)
- Flow autentikasi menggunakan wajah
- Vector similarity search
- Token-based authentication
- Comprehensive logging

### 4. Quality Assessment Flow (`04_quality_assessment.puml`)
- Pre-enrollment quality check
- Face quality metrics
- User feedback dan recommendations

### 5. WebSocket Real-time Authentication (`05_websocket_realtime.puml`)
- Real-time face authentication
- WebSocket connection management
- Live camera feed processing

### 6. Data Architecture (`06_data_architecture.puml`)
- Database schema relationships
- ChromaDB vector storage structure
- Model relationships dan foreign keys

### 7. System Architecture (`07_system_architecture.puml`)
- High-level system components
- Service layers dan dependencies
- Infrastructure components

## Technical Stack

- **Django REST Framework**: API layer
- **InsightFace (buffalo_l)**: Face detection dan encoding
- **ChromaDB**: Vector database untuk embeddings
- **WebSocket (Channels)**: Real-time communication
- **PostgreSQL/SQLite**: Metadata storage

## Key Features Covered

1. **Secure Registration & Enrollment**
2. **Face Quality Assessment**
3. **Real-time Authentication**
4. **Comprehensive Logging**
5. **Vector Similarity Search**
6. **Token-based Security**
7. **WebSocket Support**
8. **Scalable Architecture**

## Performance Considerations

- Cosine similarity threshold: 0.7
- 512-dimensional face embeddings
- Asynchronous processing untuk real-time features
- Comprehensive error handling
- Security logging dan audit trails