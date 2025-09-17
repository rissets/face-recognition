# Face Authentication Application - Technical Flow Documentation

## 1. Arsitektur Sistem

### Komponen Utama:

1. **Django REST Framework** - API Layer
2. **InsightFace Model (buffalo_l)** - Face Detection & Embedding Generation  
3. **ChromaDB** - Vector Database untuk Face Embeddings
4. **PostgreSQL/SQLite** - Metadata Storage
5. **WebSocket** - Real-time Communication (Channels)

### Models:
- **User** - Extended Django User dengan face enrollment status
- **FaceEnrollment** - Track enrollment process
- **AuthenticationAttempt** - Log semua authentication attempts
- **FaceImage** - Metadata gambar dan referensi ke ChromaDB

### Services:
- **FaceRecognitionService** - Handle face detection, encoding, quality assessment
- **ChromaDBService** - Vector similarity search dan storage

---

## 2. Flow Technical - User Registration & Face Enrollment

### 2.1 User Registration Flow

```plantuml
@startuml User Registration
!theme plain
title User Registration Flow

actor User
participant "Client App" as Client
participant "Django API" as API
participant "Database" as DB
participant "Auth Token" as Token

User -> Client: Input registration data\n(email, username, password)
Client -> API: POST /api/register/
API -> API: Validate input data
API -> DB: Create User record
DB --> API: User created
API -> Token: Generate auth token
Token --> API: Token created
API --> Client: Response with user data & token
Client --> User: Registration successful

note right of API
  User.is_face_enrolled = False
  User.face_enrollment_date = None
end note

@enduml
```

### 2.2 Face Enrollment Flow

```plantuml
@startuml Face Enrollment
!theme plain
title Face Enrollment Flow

actor User
participant "Client App" as Client
participant "Django API" as API
participant "FaceService" as FS
participant "InsightFace\nModel" as IF
participant "ChromaDB" as Chroma
participant "Database" as DB

User -> Client: Capture/Upload face image
Client -> API: POST /api/enroll/\n(image_data, metadata)
API -> API: Validate auth token & input

API -> DB: Create FaceEnrollment\n(status='pending')
DB --> API: Enrollment record created

API -> FS: enroll_user_face(user_id, image_data)
FS -> FS: decode_image(image_data)
FS -> IF: detect_faces(image)
IF --> FS: List of detected faces\n(embeddings, bbox, scores)

alt No faces detected
    FS --> API: {success: false, error: "No faces detected"}
    API -> DB: Update enrollment\n(status='failed')
    API --> Client: Enrollment failed
else Face detected
    FS -> FS: Select best face\n(highest det_score)
    FS -> Chroma: add_face_embedding(\nuser_id, embedding, metadata)
    Chroma -> Chroma: Store embedding with\ncosine similarity index
    Chroma --> FS: Storage successful
    
    FS --> API: {success: true, embedding_dimension, scores}
    
    API -> DB: Update FaceEnrollment\n(status='completed')
    API -> DB: Update User\n(is_face_enrolled=True)
    API -> DB: Create FaceImage record\n(chroma_id, metadata)
    
    API --> Client: {success: true, enrollment_id, details}
    Client --> User: Enrollment successful
end

@enduml
```

---

## 3. Flow Technical - Face Authentication

### 3.1 Face Authentication Flow

```plantuml
@startuml Face Authentication
!theme plain
title Face Authentication Flow

actor User
participant "Client App" as Client
participant "Django API" as API
participant "FaceService" as FS
participant "InsightFace\nModel" as IF
participant "ChromaDB" as Chroma
participant "Database" as DB
participant "Auth Token" as Token

User -> Client: Capture face image for login
Client -> API: POST /api/authenticate/\n(image_data)

API -> FS: authenticate_user(image_data)
FS -> FS: decode_image(image_data)
FS -> IF: detect_faces(image)
IF --> FS: List of detected faces

alt No faces detected
    FS --> API: {success: false, error: "No faces detected"}
else Face detected
    FS -> FS: Select best face\n(highest det_score)
    FS -> Chroma: search_similar_faces(\nembedding, n_results=5, threshold=0.7)
    
    Chroma -> Chroma: Query with cosine similarity
    Chroma -> Chroma: Filter by similarity threshold
    Chroma --> FS: List of matching users\n(user_id, similarity_score)
    
    alt No matches found
        FS --> API: {success: false, error: "No matching face"}
    else Match found
        FS --> API: {success: true, user_id, confidence, matches}
        
        API -> DB: Get User by user_id
        DB --> API: User object
        
        API -> Token: Get or create auth token
        Token --> API: Authentication token
    end
end

API -> DB: Create AuthenticationAttempt\n(user, success, confidence, metadata)
DB --> API: Attempt logged

alt Authentication successful
    API --> Client: {success: true, user_data, token}
    Client --> User: Login successful
else Authentication failed
    API --> Client: {success: false, error_message}
    Client --> User: Login failed
end

@enduml
```

---

## 4. Flow Technical - Quality Assessment

```plantuml
@startuml Face Quality Assessment
!theme plain
title Face Quality Assessment Flow

actor User
participant "Client App" as Client
participant "Django API" as API
participant "FaceService" as FS
participant "InsightFace\nModel" as IF

User -> Client: Request quality check\nbefore enrollment
Client -> API: POST /api/quality-check/\n(image_data)

API -> FS: get_face_quality_score(image_data)
FS -> FS: decode_image(image_data)
FS -> IF: detect_faces(image)
IF --> FS: List of detected faces\n(with scores and metadata)

alt No faces detected
    FS --> API: {success: false, quality_score: 0.0}
else Face detected
    FS -> FS: Calculate quality metrics:\n- Face area ratio\n- Detection score\n- Blur assessment\n- Lighting conditions
    
    FS -> FS: Generate quality score\n(0.0 - 1.0)
    
    FS --> API: {\n  success: true,\n  quality_score: 0.85,\n  recommendations: [...],\n  face_count: 1,\n  bbox: [x1,y1,x2,y2]\n}
end

API --> Client: Quality assessment result
Client -> Client: Display quality feedback\nand recommendations
Client --> User: Quality assessment\nwith improvement tips

@enduml
```

---

## 5. WebSocket Real-time Authentication Flow

```plantuml
@startuml WebSocket Authentication
!theme plain
title WebSocket Real-time Authentication

actor User
participant "Client App" as Client
participant "WebSocket\nConsumer" as WS
participant "FaceService" as FS
participant "ChromaDB" as Chroma
participant "Database" as DB

User -> Client: Start real-time\nface authentication
Client -> WS: WebSocket connection\n+ auth token

WS -> WS: Authenticate connection
WS --> Client: Connection established

loop Real-time face detection
    User -> Client: Camera frame capture
    Client -> WS: send_frame(image_data)
    
    WS -> FS: authenticate_user(frame_data)
    FS -> FS: Process frame\n(detect + match)
    FS -> Chroma: Search similar faces
    Chroma --> FS: Match results
    FS --> WS: Authentication result
    
    WS -> DB: Log attempt (background)
    
    WS --> Client: {\n  success: boolean,\n  confidence: float,\n  user_id: string,\n  timestamp: datetime\n}
    
    Client -> Client: Update UI\n(show result/feedback)
    Client --> User: Visual feedback
end

User -> Client: Stop authentication
Client -> WS: Disconnect
WS -> WS: Cleanup resources

@enduml
```

---

## 6. Data Storage Architecture

```plantuml
@startuml Data Architecture
!theme plain
title Data Storage Architecture

package "Django Database" {
    class User {
        +UUID id
        +String email
        +Boolean is_face_enrolled
        +DateTime face_enrollment_date
    }
    
    class FaceEnrollment {
        +UUID id
        +Foreign user
        +String status
        +Integer image_count
        +JSON metadata
    }
    
    class AuthenticationAttempt {
        +UUID id
        +Foreign user
        +Boolean success
        +Float confidence_score
        +String method
        +JSON metadata
    }
    
    class FaceImage {
        +UUID id
        +Foreign user
        +String chroma_id
        +Float quality_score
        +JSON face_bbox
    }
}

package "ChromaDB Vector Store" {
    class FaceEmbeddings {
        +String id
        +Vector embedding[512]
        +JSON metadata
        +String user_id
    }
}

User ||--o{ FaceEnrollment
User ||--o{ AuthenticationAttempt
User ||--o{ FaceImage
FaceEnrollment ||--o{ FaceImage

FaceImage ..> FaceEmbeddings : chroma_id reference

note bottom of FaceEmbeddings
  - Cosine similarity index
  - 512-dimensional vectors
  - Metadata includes detection scores,
    bbox coordinates, enrollment method
end note

@enduml
```

---

## 7. Security & Performance Considerations

### Security:
- **Token-based Authentication** untuk API access
- **CSRF Protection** untuk web endpoints  
- **Rate Limiting** untuk mencegah brute force
- **Input Validation** untuk image data
- **Audit Logging** semua authentication attempts

### Performance:
- **ChromaDB Indexing** dengan cosine similarity
- **Async Processing** untuk WebSocket connections
- **Image Quality Assessment** sebelum enrollment
- **Caching** untuk frequently accessed embeddings
- **Background Tasks** untuk logging dan cleanup

### Scalability:
- **Horizontal Scaling** ChromaDB clusters
- **Load Balancing** untuk multiple Django instances  
- **WebSocket Connection Pooling**
- **Database Read Replicas** untuk analytics
- **CDN** untuk static assets
