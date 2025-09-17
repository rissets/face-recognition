/**
 * Face Recognition Authentication Demo
 * JavaScript client for WebSocket and REST API testing
 */

class FaceAuthDemo {
    constructor() {
        this.ws = null;
        this.video = null;
        this.canvas = null;
        this.ctx = null;
        this.stream = null;
        this.currentImageData = null;
        
        this.apiBaseUrl = '/api/auth';
        this.wsUrl = `ws://${window.location.host}/ws/face-auth/`;
        
        this.initializeElements();
        this.setupEventListeners();
        this.logActivity('System', 'Demo application initialized', 'info');
    }
    
    initializeElements() {
        // Video and canvas elements
        this.video = document.getElementById('video');
        this.canvas = document.getElementById('canvas');
        this.ctx = this.canvas.getContext('2d');
        
        // UI elements
        this.elements = {
            // Connection
            connectBtn: document.getElementById('connect-btn'),
            statusText: document.getElementById('status-text'),
            statusIndicator: document.querySelector('.status-indicator'),
            
            // Camera
            startCamera: document.getElementById('start-camera'),
            stopCamera: document.getElementById('stop-camera'),
            cameraOverlay: document.getElementById('camera-overlay'),
            overlayText: document.getElementById('overlay-text'),
            
            // Quality
            checkQuality: document.getElementById('check-quality'),
            qualityAssessment: document.getElementById('quality-assessment'),
            qualityBar: document.getElementById('quality-bar'),
            qualityScore: document.getElementById('quality-score'),
            facesDetected: document.getElementById('faces-detected'),
            qualityRecommendations: document.getElementById('quality-recommendations'),
            
            // WebSocket actions
            wsAuthenticate: document.getElementById('ws-authenticate'),
            wsEnroll: document.getElementById('ws-enroll'),
            wsUserId: document.getElementById('ws-user-id'),
            
            // API actions
            apiAuthenticate: document.getElementById('api-authenticate'),
            apiEnroll: document.getElementById('api-enroll'),
            apiRegister: document.getElementById('api-register'),
            apiToken: document.getElementById('api-token'),
            apiUserId: document.getElementById('api-user-id'),
            
            // Results and logs
            resultContent: document.getElementById('result-content'),
            activityLog: document.getElementById('activity-log'),
            clearLog: document.getElementById('clear-log'),
            
            // Registration modal
            registerModal: new bootstrap.Modal(document.getElementById('registerModal')),
            submitRegistration: document.getElementById('submit-registration')
        };
    }
    
    setupEventListeners() {
        // Connection
        this.elements.connectBtn.addEventListener('click', () => this.toggleWebSocket());
        
        // Camera
        this.elements.startCamera.addEventListener('click', () => this.startCamera());
        this.elements.stopCamera.addEventListener('click', () => this.stopCamera());
        
        // Quality check
        this.elements.checkQuality.addEventListener('click', () => this.checkQuality());
        
        // WebSocket actions
        this.elements.wsAuthenticate.addEventListener('click', () => this.authenticateWebSocket());
        this.elements.wsEnroll.addEventListener('click', () => this.enrollWebSocket());
        
        // API actions
        this.elements.apiAuthenticate.addEventListener('click', () => this.authenticateAPI());
        this.elements.apiEnroll.addEventListener('click', () => this.enrollAPI());
        this.elements.apiRegister.addEventListener('click', () => this.elements.registerModal.show());
        
        // Registration
        this.elements.submitRegistration.addEventListener('click', () => this.registerUser());
        
        // Clear log
        this.elements.clearLog.addEventListener('click', () => this.clearLog());
    }
    
    // WebSocket Management
    toggleWebSocket() {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.disconnectWebSocket();
        } else {
            this.connectWebSocket();
        }
    }
    
    connectWebSocket() {
        try {
            this.ws = new WebSocket(this.wsUrl);
            
            this.ws.onopen = () => {
                this.updateConnectionStatus(true);
                this.logActivity('WebSocket', 'Connected successfully', 'success');
            };
            
            this.ws.onmessage = (event) => {
                this.handleWebSocketMessage(JSON.parse(event.data));
            };
            
            this.ws.onclose = () => {
                this.updateConnectionStatus(false);
                this.logActivity('WebSocket', 'Connection closed', 'warning');
            };
            
            this.ws.onerror = (error) => {
                this.logActivity('WebSocket', 'Connection error', 'error');
                console.error('WebSocket error:', error);
            };
            
        } catch (error) {
            this.logActivity('WebSocket', `Connection failed: ${error.message}`, 'error');
        }
    }
    
    disconnectWebSocket() {
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
    }
    
    updateConnectionStatus(connected) {
        const indicator = this.elements.statusIndicator;
        const text = this.elements.statusText;
        const btn = this.elements.connectBtn;
        
        if (connected) {
            indicator.className = 'status-indicator status-connected';
            text.textContent = 'Connected';
            btn.textContent = 'Disconnect';
            btn.className = 'btn btn-danger btn-sm ms-3';
            
            // Enable WebSocket buttons
            this.elements.wsAuthenticate.disabled = false;
            this.elements.wsEnroll.disabled = false;
        } else {
            indicator.className = 'status-indicator status-disconnected';
            text.textContent = 'Disconnected';
            btn.textContent = 'Connect WebSocket';
            btn.className = 'btn btn-primary btn-sm ms-3';
            
            // Disable WebSocket buttons
            this.elements.wsAuthenticate.disabled = true;
            this.elements.wsEnroll.disabled = true;
        }
    }
    
    handleWebSocketMessage(data) {
        console.log('WebSocket message:', data);
        
        switch (data.type) {
            case 'connection':
                this.logActivity('WebSocket', data.message, 'info');
                break;
                
            case 'processing':
                this.showProcessingStatus(data.message);
                break;
                
            case 'authenticate_result':
                this.handleAuthenticationResult(data, 'WebSocket');
                break;
                
            case 'enroll_result':
                this.handleEnrollmentResult(data, 'WebSocket');
                break;
                
            case 'quality_result':
                this.handleQualityResult(data);
                break;
                
            case 'error':
                this.logActivity('WebSocket', `Error: ${data.message}`, 'error');
                this.hideProcessingStatus();
                break;
                
            case 'pong':
                this.logActivity('WebSocket', 'Ping response received', 'info');
                break;
        }
    }
    
    // Camera Management
    async startCamera() {
        try {
            this.stream = await navigator.mediaDevices.getUserMedia({
                video: { width: 640, height: 480 }
            });
            
            this.video.srcObject = this.stream;
            this.video.style.display = 'block';
            this.canvas.style.display = 'none';
            
            this.elements.startCamera.disabled = true;
            this.elements.stopCamera.disabled = false;
            this.elements.checkQuality.disabled = false;
            this.elements.apiAuthenticate.disabled = false;
            this.elements.apiEnroll.disabled = false;
            
            this.logActivity('Camera', 'Started successfully', 'success');
            
        } catch (error) {
            this.logActivity('Camera', `Failed to start: ${error.message}`, 'error');
        }
    }
    
    stopCamera() {
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
        }
        
        this.video.srcObject = null;
        this.video.style.display = 'block';
        this.canvas.style.display = 'none';
        
        this.elements.startCamera.disabled = false;
        this.elements.stopCamera.disabled = true;
        this.elements.checkQuality.disabled = true;
        this.elements.apiAuthenticate.disabled = true;
        this.elements.apiEnroll.disabled = true;
        
        this.logActivity('Camera', 'Stopped', 'info');
    }
    
    captureImage() {
        if (!this.video.videoWidth || !this.video.videoHeight) {
            throw new Error('Camera not ready');
        }
        
        this.canvas.width = this.video.videoWidth;
        this.canvas.height = this.video.videoHeight;
        this.ctx.drawImage(this.video, 0, 0);
        
        return this.canvas.toDataURL('image/jpeg', 0.8);
    }
    
    // Quality Assessment
    async checkQuality() {
        try {
            const imageData = this.captureImage();
            this.currentImageData = imageData;
            
            if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                // Use WebSocket
                this.ws.send(JSON.stringify({
                    type: 'quality_check',
                    image: imageData
                }));
            } else {
                // Use REST API
                const response = await fetch(`${this.apiBaseUrl}/quality-check/`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ image: imageData })
                });
                
                const result = await response.json();
                this.handleQualityResult(result);
            }
            
        } catch (error) {
            this.logActivity('Quality', `Check failed: ${error.message}`, 'error');
        }
    }
    
    handleQualityResult(data) {
        if (data.success) {
            const score = Math.round(data.quality_score * 100);
            const faces = data.faces_detected || 0;
            
            this.elements.qualityScore.textContent = `${score}%`;
            this.elements.facesDetected.textContent = `${faces} face${faces !== 1 ? 's' : ''}`;
            this.elements.qualityBar.style.width = `${score}%`;
            
            // Update bar color based on quality
            this.elements.qualityBar.className = 'quality-bar';
            if (score >= 80) {
                this.elements.qualityBar.classList.add('bg-success');
            } else if (score >= 60) {
                this.elements.qualityBar.classList.add('bg-warning');
            } else {
                this.elements.qualityBar.classList.add('bg-danger');
            }
            
            // Show recommendations
            const recommendations = data.recommendations || [];
            this.elements.qualityRecommendations.innerHTML = recommendations
                .map(rec => `<small class="text-muted d-block">• ${rec}</small>`)
                .join('');
            
            this.elements.qualityAssessment.style.display = 'block';
            this.logActivity('Quality', `Score: ${score}%, Faces: ${faces}`, 'info');
            
        } else {
            this.logActivity('Quality', `Assessment failed: ${data.error}`, 'error');
        }
    }
    
    // WebSocket Actions
    authenticateWebSocket() {
        try {
            const imageData = this.captureImage();
            this.currentImageData = imageData;
            
            this.ws.send(JSON.stringify({
                type: 'authenticate',
                image: imageData
            }));
            
            this.logActivity('WebSocket', 'Authentication request sent', 'info');
            
        } catch (error) {
            this.logActivity('WebSocket', `Authentication failed: ${error.message}`, 'error');
        }
    }
    
    enrollWebSocket() {
        const userId = this.elements.wsUserId.value.trim();
        if (!userId) {
            this.logActivity('WebSocket', 'User ID required for enrollment', 'error');
            return;
        }
        
        try {
            const imageData = this.captureImage();
            this.currentImageData = imageData;
            
            this.ws.send(JSON.stringify({
                type: 'enroll',
                user_id: userId,
                image: imageData,
                metadata: {
                    enrollment_source: 'demo_websocket'
                }
            }));
            
            this.logActivity('WebSocket', `Enrollment request sent for user: ${userId}`, 'info');
            
        } catch (error) {
            this.logActivity('WebSocket', `Enrollment failed: ${error.message}`, 'error');
        }
    }
    
    // REST API Actions
    async authenticateAPI() {
        try {
            const imageData = this.captureImage();
            this.currentImageData = imageData;
            
            const response = await fetch(`${this.apiBaseUrl}/authenticate/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ image: imageData })
            });
            
            const result = await response.json();
            this.handleAuthenticationResult(result, 'REST API');
            
        } catch (error) {
            this.logActivity('REST API', `Authentication failed: ${error.message}`, 'error');
        }
    }
    
    async enrollAPI() {
        const userId = this.elements.apiUserId.value.trim();
        const token = this.elements.apiToken.value.trim();
        
        if (!userId) {
            this.logActivity('REST API', 'User ID required for enrollment', 'error');
            return;
        }
        
        try {
            const imageData = this.captureImage();
            this.currentImageData = imageData;
            
            const headers = {
                'Content-Type': 'application/json',
            };
            
            if (token) {
                headers['Authorization'] = `Token ${token}`;
            }
            
            const response = await fetch(`${this.apiBaseUrl}/enroll/`, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify({
                    image: imageData,
                    metadata: {
                        enrollment_source: 'demo_api'
                    }
                })
            });
            
            const result = await response.json();
            this.handleEnrollmentResult(result, 'REST API');
            
        } catch (error) {
            this.logActivity('REST API', `Enrollment failed: ${error.message}`, 'error');
        }
    }
    
    async registerUser() {
        const formData = {
            username: document.getElementById('reg-username').value,
            email: document.getElementById('reg-email').value,
            first_name: document.getElementById('reg-first-name').value,
            last_name: document.getElementById('reg-last-name').value,
            password: document.getElementById('reg-password').value,
            password_confirm: document.getElementById('reg-password-confirm').value
        };
        
        // Basic validation
        if (formData.password !== formData.password_confirm) {
            alert('Passwords do not match');
            return;
        }
        
        try {
            const response = await fetch(`${this.apiBaseUrl}/register/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(formData)
            });
            
            const result = await response.json();
            
            if (response.ok) {
                this.logActivity('Registration', `User ${formData.username} registered successfully`, 'success');
                this.elements.registerModal.hide();
                
                // Update API token field
                if (result.token) {
                    this.elements.apiToken.value = result.token;
                }
                
                // Update user ID fields
                if (result.user && result.user.id) {
                    this.elements.apiUserId.value = result.user.id;
                    this.elements.wsUserId.value = result.user.id;
                }
                
                document.getElementById('register-form').reset();
                
            } else {
                const errors = result.errors || result;
                const errorMessage = typeof errors === 'object' 
                    ? Object.values(errors).flat().join(', ')
                    : errors.message || 'Registration failed';
                    
                this.logActivity('Registration', `Failed: ${errorMessage}`, 'error');
            }
            
        } catch (error) {
            this.logActivity('Registration', `Error: ${error.message}`, 'error');
        }
    }
    
    // Result Handlers
    handleAuthenticationResult(data, method) {
        const resultHtml = `
            <div class="alert ${data.success ? 'alert-success' : 'alert-danger'}" role="alert">
                <h6><i class="fas ${data.success ? 'fa-check-circle' : 'fa-times-circle'}"></i> 
                    Authentication ${data.success ? 'Successful' : 'Failed'} (${method})</h6>
                ${data.success ? `
                    <p><strong>User:</strong> ${data.user ? data.user.email : 'Unknown'}</p>
                    <p><strong>Confidence:</strong> ${Math.round(data.confidence * 100)}%</p>
                    <p><strong>Faces Detected:</strong> ${data.faces_detected || 0}</p>
                ` : `
                    <p><strong>Error:</strong> ${data.error || data.message}</p>
                `}
            </div>
        `;
        
        this.elements.resultContent.innerHTML = resultHtml;
        this.hideProcessingStatus();
        
        const status = data.success ? 'success' : 'error';
        const message = data.success 
            ? `Authentication successful (${Math.round(data.confidence * 100)}% confidence)`
            : `Authentication failed: ${data.error || data.message}`;
            
        this.logActivity(method, message, status);
    }
    
    handleEnrollmentResult(data, method) {
        const resultHtml = `
            <div class="alert ${data.success ? 'alert-success' : 'alert-danger'}" role="alert">
                <h6><i class="fas ${data.success ? 'fa-check-circle' : 'fa-times-circle'}"></i> 
                    Enrollment ${data.success ? 'Successful' : 'Failed'} (${method})</h6>
                ${data.success ? `
                    <p><strong>Faces Detected:</strong> ${data.faces_detected || 0}</p>
                    <p><strong>Quality Score:</strong> ${data.quality_score ? Math.round(data.quality_score * 100) + '%' : 'N/A'}</p>
                    <p><strong>Embedding Dimension:</strong> ${data.embedding_dimension || 'N/A'}</p>
                ` : `
                    <p><strong>Error:</strong> ${data.error || data.message}</p>
                `}
            </div>
        `;
        
        this.elements.resultContent.innerHTML = resultHtml;
        this.hideProcessingStatus();
        
        const status = data.success ? 'success' : 'error';
        const message = data.success 
            ? 'Face enrollment completed successfully'
            : `Enrollment failed: ${data.error || data.message}`;
            
        this.logActivity(method, message, status);
    }
    
    // UI Helpers
    showProcessingStatus(message) {
        this.elements.statusIndicator.className = 'status-indicator status-processing';
        this.elements.cameraOverlay.style.display = 'block';
        this.elements.overlayText.textContent = message;
    }
    
    hideProcessingStatus() {
        this.elements.cameraOverlay.style.display = 'none';
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.elements.statusIndicator.className = 'status-indicator status-connected';
        } else {
            this.elements.statusIndicator.className = 'status-indicator status-disconnected';
        }
    }
    
    logActivity(source, message, type = 'info') {
        const timestamp = new Date().toLocaleTimeString();
        const logEntry = document.createElement('div');
        logEntry.className = `log-entry log-${type}`;
        logEntry.innerHTML = `<strong>[${source}]</strong> ${timestamp} - ${message}`;
        
        this.elements.activityLog.appendChild(logEntry);
        this.elements.activityLog.scrollTop = this.elements.activityLog.scrollHeight;
    }
    
    clearLog() {
        this.elements.activityLog.innerHTML = '<div class="log-entry log-info"><strong>[System]</strong> Log cleared</div>';
    }
}

// Initialize the demo when the page loads
document.addEventListener('DOMContentLoaded', () => {
    window.faceAuthDemo = new FaceAuthDemo();
});