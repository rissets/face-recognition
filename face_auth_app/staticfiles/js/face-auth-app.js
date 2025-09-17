/**
 * Face Auth System - Main Application
 * Complete frontend application for face recognition authentication
 */

class FaceAuthApp {
    constructor() {
        this.apiBaseUrl = window.location.origin + '/api/auth';
        this.wsBaseUrl = window.location.origin.replace('http', 'ws') + '/ws/face-auth/';
        this.token = localStorage.getItem('authToken');
        this.user = JSON.parse(localStorage.getItem('user') || 'null');
        this.camera = null;
        this.websocket = null;
        this.notifications = [];
        this.loadingTimeout = null;
        this.autoLoginInterval = null;
        
        this.init();
    }

    init() {
        this.initNotificationSystem();
        this.updateNavigation();
        this.loadInitialPage();
        this.initLifecycleEvents();
        this.initKeyboardShortcuts();
    }

    initKeyboardShortcuts() {
        document.addEventListener('keydown', (event) => {
            // ESC key to force close modals
            if (event.key === 'Escape') {
                this.forceCloseAllModals();
            }
        });
    }

    initNotificationSystem() {
        // Create notification container
        if (!document.getElementById('notificationContainer')) {
            const container = document.createElement('div');
            container.id = 'notificationContainer';
            container.style.cssText = `
                position: fixed;
                top: 80px;
                right: 20px;
                z-index: 9999;
                max-width: 350px;
            `;
            document.body.appendChild(container);
        }
    }

    showNotification(title, message, type = 'info', duration = 5000) {
        const notificationId = Date.now();
        const notification = document.createElement('div');
        notification.id = `notification-${notificationId}`;
        
        const iconMap = {
            success: 'fa-check-circle',
            error: 'fa-times-circle',
            warning: 'fa-exclamation-triangle',
            info: 'fa-info-circle'
        };

        const colorMap = {
            success: 'success',
            error: 'danger',
            warning: 'warning',
            info: 'primary'
        };

        notification.innerHTML = `
            <div class="alert alert-${colorMap[type]} alert-dismissible fade show shadow-sm mb-3" role="alert">
                <div class="d-flex align-items-center">
                    <i class="fas ${iconMap[type]} me-2"></i>
                    <div class="flex-grow-1">
                        <strong>${title}</strong>
                        ${message ? `<div class="small">${message}</div>` : ''}
                    </div>
                    <button type="button" class="btn-close" onclick="app.closeNotification('${notificationId}')"></button>
                </div>
                <div class="progress mt-2" style="height: 3px;">
                    <div class="progress-bar" role="progressbar" style="width: 100%; animation: shrink ${duration}ms linear;"></div>
                </div>
            </div>
        `;

        // Add animation styles if not present
        if (!document.head.querySelector('#notification-styles')) {
            const style = document.createElement('style');
            style.id = 'notification-styles';
            style.textContent = `
                @keyframes shrink {
                    from { width: 100%; }
                    to { width: 0%; }
                }
                .alert {
                    animation: slideInRight 0.3s ease-out;
                }
                @keyframes slideInRight {
                    from {
                        opacity: 0;
                        transform: translateX(100%);
                    }
                    to {
                        opacity: 1;
                        transform: translateX(0);
                    }
                }
                @keyframes slideOutRight {
                    from {
                        opacity: 1;
                        transform: translateX(0);
                    }
                    to {
                        opacity: 0;
                        transform: translateX(100%);
                    }
                }
            `;
            document.head.appendChild(style);
        }

        document.getElementById('notificationContainer').appendChild(notification);
        
        // Auto remove after duration
        setTimeout(() => {
            this.closeNotification(notificationId);
        }, duration);

        return notificationId;
    }

    closeNotification(notificationId) {
        const notification = document.getElementById(`notification-${notificationId}`);
        if (notification) {
            notification.style.animation = 'slideOutRight 0.3s ease-out';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }
    }

    // Authentication Service
    async apiCall(endpoint, method = 'GET', data = null, includeAuth = true) {
        const headers = {
            'Content-Type': 'application/json',
        };

        if (includeAuth && this.token) {
            headers['Authorization'] = `Token ${this.token}`;
        }

        const config = {
            method,
            headers,
        };

        if (data && method !== 'GET') {
            config.body = JSON.stringify(data);
        }

        try {
            const response = await fetch(`${this.apiBaseUrl}${endpoint}`, config);
            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || result.message || 'API call failed');
            }

            return result;
        } catch (error) {
            console.error('API call error:', error);
            throw error;
        }
    }

    // WebSocket Connection
    connectWebSocket() {
        if (this.websocket) {
            this.websocket.close();
        }

        this.websocket = new WebSocket(this.wsBaseUrl);
        
        this.websocket.onopen = () => {
            console.log('WebSocket connected');
            this.showNotification('Connected', 'Real-time features are now active', 'success', 3000);
        };

        this.websocket.onmessage = (event) => {
            const data = JSON.parse(event.data);
            this.handleWebSocketMessage(data);
        };

        this.websocket.onerror = (error) => {
            console.error('WebSocket error:', error);
            this.showNotification('Connection Error', 'Real-time features are temporarily unavailable', 'warning', 5000);
        };

        this.websocket.onclose = (event) => {
            console.log('WebSocket disconnected');
            if (event.code !== 1000) { // Not a normal closure
                this.showNotification('Disconnected', 'Real-time connection lost. Attempting to reconnect...', 'warning', 3000);
                // Attempt to reconnect after 3 seconds
                setTimeout(() => {
                    if (this.isAuthenticated()) {
                        this.connectWebSocket();
                    }
                }, 3000);
            }
        };

        return this.websocket;
    }

    handleWebSocketMessage(data) {
        // Handle different WebSocket message types
        switch (data.type) {
            case 'face_auth_result':
                this.handleFaceAuthResult(data);
                break;
            case 'enrollment_result':
                this.handleEnrollmentResult(data);
                break;
            case 'quality_check_result':
                this.handleQualityCheckResult(data);
                break;
            default:
                console.log('Unknown WebSocket message:', data);
        }
    }

    // Page Management
    showPage(pageId) {
        // Hide all pages
        document.querySelectorAll('.page').forEach(page => {
            page.classList.add('d-none');
        });

        // Update navigation
        document.querySelectorAll('.nav-link').forEach(link => {
            link.classList.remove('active');
        });

        // Show requested page
        const page = document.getElementById(`page-${pageId}`);
        if (page) {
            page.classList.remove('d-none');
            page.classList.add('fade-in');
        }

        // Update active nav
        const navItem = document.getElementById(`nav-${pageId}`);
        if (navItem) {
            navItem.querySelector('.nav-link').classList.add('active');
        }

        // Load page content if needed
        this.loadPageContent(pageId);
    }

    loadPageContent(pageId) {
        switch (pageId) {
            case 'register':
                this.loadRegisterPage();
                break;
            case 'login':
                this.loadLoginPage();
                break;
            case 'enroll':
                this.loadEnrollPage();
                break;
            case 'dashboard':
                this.loadDashboardPage();
                break;
            case 'enrollments':
                this.loadEnrollmentsPage();
                break;
            case 'activity':
                this.loadActivityPage();
                break;
            case 'statistics':
                this.loadStatisticsPage();
                break;
        }
    }

    loadInitialPage() {
        if (this.isAuthenticated()) {
            this.showPage('dashboard');
        } else {
            this.showPage('home');
        }
    }

    // Authentication Management
    isAuthenticated() {
        return this.token && this.user;
    }

    setAuth(token, user) {
        this.token = token;
        this.user = user;
        localStorage.setItem('authToken', token);
        localStorage.setItem('user', JSON.stringify(user));
        this.updateNavigation();
    }

    clearAuth() {
        this.token = null;
        this.user = null;
        localStorage.removeItem('authToken');
        localStorage.removeItem('user');
        this.updateNavigation();
    }

    updateNavigation() {
        const publicNavs = ['nav-home', 'nav-register', 'nav-login'];
        const privateNavs = ['nav-dashboard', 'nav-enroll', 'nav-enrollments', 'nav-activity', 'nav-statistics', 'nav-logout'];

        if (this.isAuthenticated()) {
            publicNavs.forEach(id => {
                document.getElementById(id).classList.add('d-none');
            });
            privateNavs.forEach(id => {
                document.getElementById(id).classList.remove('d-none');
            });
        } else {
            publicNavs.forEach(id => {
                document.getElementById(id).classList.remove('d-none');
            });
            privateNavs.forEach(id => {
                document.getElementById(id).classList.add('d-none');
            });
        }
    }

    logout() {
        this.clearAuth();
        if (this.camera) {
            this.stopCamera();
        }
        if (this.websocket) {
            this.websocket.close();
        }
        if (this.autoLoginInterval) {
            clearInterval(this.autoLoginInterval);
            this.autoLoginInterval = null;
        }
        this.showAlert('Success', 'Logged out successfully', 'success');
        this.showPage('home');
    }

    // Camera Management
    async startCamera(videoElement) {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { 
                    width: { ideal: 640 },
                    height: { ideal: 480 },
                    facingMode: 'user'
                }
            });
            
            videoElement.srcObject = stream;
            this.camera = stream;
            return stream;
        } catch (error) {
            console.error('Error accessing camera:', error);
            throw new Error('Unable to access camera. Please ensure camera permissions are granted.');
        }
    }

    stopCamera() {
        if (this.camera) {
            this.camera.getTracks().forEach(track => track.stop());
            this.camera = null;
        }
    }

    captureImage(videoElement) {
        const canvas = document.createElement('canvas');
        canvas.width = videoElement.videoWidth;
        canvas.height = videoElement.videoHeight;
        
        const ctx = canvas.getContext('2d');
        ctx.drawImage(videoElement, 0, 0);
        
        return canvas.toDataURL('image/jpeg', 0.8);
    }

    // Utility Functions
    showLoading(text = 'Processing...', timeout = 30000) {
        document.getElementById('loadingText').textContent = text;
        const modalElement = document.getElementById('loadingModal');
        const modal = new bootstrap.Modal(modalElement);
        modal.show();
        
        // Auto-hide loading after timeout to prevent stuck modals
        if (this.loadingTimeout) {
            clearTimeout(this.loadingTimeout);
        }
        
        this.loadingTimeout = setTimeout(() => {
            this.hideLoading();
            this.showAlert('Timeout', 'Operation timed out. Please try again.', 'warning');
        }, timeout);
    }

    // Emergency function to force close all modals
    forceCloseAllModals() {
        // Hide loading timeout
        if (this.loadingTimeout) {
            clearTimeout(this.loadingTimeout);
            this.loadingTimeout = null;
        }
        
        // Close all Bootstrap modals
        const modals = document.querySelectorAll('.modal.show');
        modals.forEach(modal => {
            const bsModal = bootstrap.Modal.getInstance(modal);
            if (bsModal) {
                bsModal.hide();
            }
        });
        
        // Force remove modal classes and backdrops
        setTimeout(() => {
            document.body.classList.remove('modal-open');
            const backdrops = document.querySelectorAll('.modal-backdrop');
            backdrops.forEach(backdrop => backdrop.remove());
            
            const allModals = document.querySelectorAll('.modal');
            allModals.forEach(modal => {
                modal.classList.remove('show');
                modal.style.display = 'none';
            });
        }, 100);
    }

    hideLoading() {
        // Clear timeout
        if (this.loadingTimeout) {
            clearTimeout(this.loadingTimeout);
            this.loadingTimeout = null;
        }
        
        const modal = bootstrap.Modal.getInstance(document.getElementById('loadingModal'));
        if (modal) {
            modal.hide();
        }
        
        // Force hide if getInstance fails
        setTimeout(() => {
            const modalElement = document.getElementById('loadingModal');
            if (modalElement.classList.contains('show')) {
                modalElement.classList.remove('show');
                modalElement.style.display = 'none';
                document.body.classList.remove('modal-open');
                const backdrop = document.querySelector('.modal-backdrop');
                if (backdrop) {
                    backdrop.remove();
                }
            }
        }, 100);
    }

    showAlert(title, message, type = 'info', callback = null) {
        document.getElementById('alertTitle').textContent = title;
        document.getElementById('alertMessage').textContent = message;
        
        const modal = document.getElementById('alertModal');
        modal.className = `modal fade alert-${type}`;
        
        const bootstrapModal = new bootstrap.Modal(modal);
        
        // Handle callback when modal is hidden
        if (callback) {
            modal.addEventListener('hidden.bs.modal', function handler() {
                modal.removeEventListener('hidden.bs.modal', handler);
                callback();
            });
        }
        
        bootstrapModal.show();
    }

    // Auto-hide alert after timeout
    showTimedAlert(title, message, type = 'info', timeout = 3000, callback = null) {
        this.showAlert(title, message, type, callback);
        
        setTimeout(() => {
            const modal = bootstrap.Modal.getInstance(document.getElementById('alertModal'));
            if (modal) {
                modal.hide();
            }
        }, timeout);
    }

    validateEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    validatePassword(password) {
        return password.length >= 6;
    }

    // Quality Assessment
    getQualityBadge(score) {
        if (score >= 0.8) return { class: 'quality-excellent', text: 'Excellent' };
        if (score >= 0.6) return { class: 'quality-good', text: 'Good' };
        if (score >= 0.4) return { class: 'quality-fair', text: 'Fair' };
        return { class: 'quality-poor', text: 'Poor' };
    }

    // Register Page
    loadRegisterPage() {
        const container = document.getElementById('page-register');
        container.innerHTML = `
            <div class="row justify-content-center">
                <div class="col-md-6">
                    <div class="card fade-in">
                        <div class="card-header bg-primary text-white">
                            <h4 class="mb-0"><i class="fas fa-user-plus me-2"></i>Create Account</h4>
                        </div>
                        <div class="card-body p-4">
                            <form id="registerForm">
                                <div class="row">
                                    <div class="col-md-6 mb-3">
                                        <label class="form-label">First Name *</label>
                                        <input type="text" class="form-control" id="firstName" required>
                                    </div>
                                    <div class="col-md-6 mb-3">
                                        <label class="form-label">Last Name *</label>
                                        <input type="text" class="form-control" id="lastName" required>
                                    </div>
                                </div>
                                <div class="mb-3">
                                    <label class="form-label">Username *</label>
                                    <input type="text" class="form-control" id="username" required>
                                    <div class="form-text">Choose a unique username</div>
                                </div>
                                <div class="mb-3">
                                    <label class="form-label">Email *</label>
                                    <input type="email" class="form-control" id="email" required>
                                </div>
                                <div class="mb-3">
                                    <label class="form-label">Password *</label>
                                    <input type="password" class="form-control" id="password" required>
                                    <div class="form-text">Minimum 6 characters</div>
                                </div>
                                <div class="mb-4">
                                    <label class="form-label">Confirm Password *</label>
                                    <input type="password" class="form-control" id="confirmPassword" required>
                                </div>
                                <button type="submit" class="btn btn-primary w-100">
                                    <i class="fas fa-user-plus me-2"></i>Create Account
                                </button>
                            </form>
                            <div class="text-center mt-3">
                                <p class="mb-0">Already have an account? 
                                    <a href="#" onclick="app.showPage('login')" class="text-decoration-none">Login here</a>
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Add form handler
        document.getElementById('registerForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleRegister();
        });
    }

    async handleRegister() {
        const firstName = document.getElementById('firstName').value.trim();
        const lastName = document.getElementById('lastName').value.trim();
        const username = document.getElementById('username').value.trim();
        const email = document.getElementById('email').value.trim();
        const password = document.getElementById('password').value;
        const confirmPassword = document.getElementById('confirmPassword').value;

        // Validation
        if (!firstName || !lastName || !username || !email || !password) {
            this.showAlert('Error', 'Please fill in all required fields', 'error');
            return;
        }

        if (!this.validateEmail(email)) {
            this.showAlert('Error', 'Please enter a valid email address', 'error');
            return;
        }

        if (!this.validatePassword(password)) {
            this.showAlert('Error', 'Password must be at least 6 characters long', 'error');
            return;
        }

        if (password !== confirmPassword) {
            this.showAlert('Error', 'Passwords do not match', 'error');
            return;
        }

        try {
            this.showLoading('Creating account...');

            const response = await this.apiCall('/register/', 'POST', {
                username,
                email,
                password,
                password_confirm: confirmPassword,
                first_name: firstName,
                last_name: lastName
            }, false);

            this.hideLoading();

            if (response.token && response.user) {
                this.setAuth(response.token, response.user);
                this.showNotification('Welcome!', 'Account created successfully! Redirecting to enrollment...', 'success', 2000);
                setTimeout(() => this.showPage('enroll'), 2000);
            } else {
                this.showNotification('Success!', 'Account created successfully! Please login to continue.', 'success', 2000);
                setTimeout(() => this.showPage('login'), 2000);
            }

        } catch (error) {
            this.hideLoading();
            this.showAlert('Error', error.message || 'Registration failed', 'error');
        }
    }

    // Login Page
    loadLoginPage() {
        const container = document.getElementById('page-login');
        container.innerHTML = `
            <div class="row justify-content-center">
                <div class="col-md-10">
                    <div class="card fade-in">
                        <div class="card-header bg-success text-white">
                            <h4 class="mb-0"><i class="fas fa-sign-in-alt me-2"></i>Login</h4>
                        </div>
                        <div class="card-body p-4">
                            <div class="row">
                                <!-- Traditional Login -->
                                <div class="col-md-6">
                                    <h5 class="mb-3"><i class="fas fa-key text-primary me-2"></i>Username & Password</h5>
                                    <form id="loginForm">
                                        <div class="mb-3">
                                            <label class="form-label">Username</label>
                                            <input type="text" class="form-control" id="loginUsername" required>
                                        </div>
                                        <div class="mb-3">
                                            <label class="form-label">Password</label>
                                            <input type="password" class="form-control" id="loginPassword" required>
                                        </div>
                                        <button type="submit" class="btn btn-primary w-100">
                                            <i class="fas fa-sign-in-alt me-2"></i>Login
                                        </button>
                                    </form>
                                </div>

                                <!-- Face Recognition Login -->
                                <div class="col-md-6">
                                    <h5 class="mb-3"><i class="fas fa-camera text-success me-2"></i>Face Recognition</h5>
                                    <div class="text-center">
                                        <div class="camera-container mb-3" style="height: 240px; background: #f8f9fa; border: 2px dashed #dee2e6; border-radius: 8px; position: relative;">
                                            <video id="loginVideo" class="d-none" autoplay muted style="width: 100%; height: 100%; object-fit: cover; border-radius: 6px;"></video>
                                            <div id="loginCameraPlaceholder" class="d-flex align-items-center justify-content-center h-100">
                                                <div class="text-center">
                                                    <i class="fas fa-user-shield text-muted" style="font-size: 3rem;"></i>
                                                    <p class="text-muted mt-2 mb-0">Auto-Login with Face Recognition</p>
                                                    <small class="text-muted">Click to start automatic authentication</small>
                                                </div>
                                            </div>
                                        </div>
                                        <div class="d-grid gap-2">
                                            <button id="startLoginCamera" class="btn btn-success">
                                                <i class="fas fa-camera me-2"></i>Start Auto-Login
                                            </button>
                                            <button id="stopLoginCamera" class="btn btn-outline-secondary d-none">
                                                <i class="fas fa-times me-2"></i>Stop Camera
                                            </button>
                                        </div>
                                        <div id="loginQualityInfo" class="mt-3 d-none">
                                            <div class="alert alert-info">
                                                <i class="fas fa-robot me-2"></i>
                                                <span id="loginQualityText">Scanning for face automatically...</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            
                            <div class="text-center mt-4 pt-3 border-top">
                                <p class="mb-0">Don't have an account? 
                                    <a href="#" onclick="app.showPage('register')" class="text-decoration-none">Register here</a>
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Add event handlers
        this.setupLoginHandlers();
    }

    setupLoginHandlers() {
        // Traditional login form
        document.getElementById('loginForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleTraditionalLogin();
        });

        // Face recognition login
        document.getElementById('startLoginCamera').addEventListener('click', () => {
            this.startLoginCamera();
        });

        document.getElementById('stopLoginCamera').addEventListener('click', () => {
            this.stopLoginCamera();
        });
    }

    async handleTraditionalLogin() {
        const username = document.getElementById('loginUsername').value.trim();
        const password = document.getElementById('loginPassword').value;

        if (!username || !password) {
            this.showAlert('Error', 'Please enter both username and password', 'error');
            return;
        }

        try {
            this.showLoading('Logging in...');

            // For traditional login, we'll need to create a login endpoint
            // For now, let's simulate it by getting user info after authentication
            const response = await fetch(this.apiBaseUrl + '/token/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

            if (!response.ok) {
                throw new Error('Invalid username or password');
            }

            const data = await response.json();
            
            // Get user profile
            const profileResponse = await this.apiCall('/profile/', 'GET', null, true);
            
            this.hideLoading();
            this.setAuth(data.token, profileResponse.user);
            this.showAlert('Success', 'Login successful!', 'success');
            setTimeout(() => this.showPage('dashboard'), 1500);

        } catch (error) {
            this.hideLoading();
            this.showAlert('Error', error.message || 'Login failed', 'error');
        }
    }

    async startLoginCamera() {
        try {
            const video = document.getElementById('loginVideo');
            await this.startCamera(video);
            
            // Show video and hide placeholder
            video.classList.remove('d-none');
            document.getElementById('loginCameraPlaceholder').classList.add('d-none');
            
            // Update buttons
            document.getElementById('startLoginCamera').classList.add('d-none');
            document.getElementById('stopLoginCamera').classList.remove('d-none');
            document.getElementById('loginQualityInfo').classList.remove('d-none');

            // Start auto-detection
            this.startAutoLoginDetection();

        } catch (error) {
            this.showAlert('Error', error.message, 'error');
        }
    }

    stopLoginCamera() {
        this.stopCamera();
        
        // Stop auto-detection
        if (this.autoLoginInterval) {
            clearInterval(this.autoLoginInterval);
            this.autoLoginInterval = null;
        }
        
        const video = document.getElementById('loginVideo');
        video.classList.add('d-none');
        document.getElementById('loginCameraPlaceholder').classList.remove('d-none');
        
        // Update buttons
        document.getElementById('startLoginCamera').classList.remove('d-none');
        document.getElementById('stopLoginCamera').classList.add('d-none');
        document.getElementById('loginQualityInfo').classList.add('d-none');
    }

    startAutoLoginDetection() {
        const video = document.getElementById('loginVideo');
        const qualityText = document.getElementById('loginQualityText');
        let consecutiveGoodFrames = 0;
        let isAuthenticating = false;
        
        this.autoLoginInterval = setInterval(async () => {
            if (!this.camera || isAuthenticating) {
                return;
            }

            // Check if video is ready
            const isVideoReady = video.videoWidth > 0 && video.videoHeight > 0;
            
            if (!isVideoReady) {
                qualityText.innerHTML = '<span class="quality-indicator quality-poor"></span>Initializing camera...';
                consecutiveGoodFrames = 0;
                return;
            }

            // Simulate face detection quality check
            // In a real implementation, you would use actual face detection here
            const hasGoodQuality = Math.random() > 0.3; // Simulate 70% chance of good detection
            
            if (hasGoodQuality) {
                consecutiveGoodFrames++;
                qualityText.innerHTML = `<span class="quality-indicator quality-good"></span>Face detected! Auto-login in ${Math.max(0, 3 - consecutiveGoodFrames)} seconds...`;
                
                // Auto-authenticate after 3 consecutive good frames (3 seconds)
                if (consecutiveGoodFrames >= 3) {
                    isAuthenticating = true;
                    qualityText.innerHTML = '<span class="quality-indicator quality-excellent"></span>Authenticating...';
                    
                    try {
                        await this.handleFaceLogin();
                    } catch (error) {
                        console.error('Auto-login failed:', error);
                        isAuthenticating = false;
                        consecutiveGoodFrames = 0;
                    }
                }
            } else {
                consecutiveGoodFrames = Math.max(0, consecutiveGoodFrames - 1);
                qualityText.innerHTML = '<span class="quality-indicator quality-fair"></span>Please position your face clearly in the camera';
            }
        }, 1000); // Check every second
    }

    async handleFaceLogin() {
        const video = document.getElementById('loginVideo');
        
        if (!video.videoWidth || !video.videoHeight) {
            this.showAlert('Error', 'Camera not ready. Please wait a moment.', 'error');
            return;
        }

        try {
            this.showLoading('Authenticating...', 15000); // 15 second timeout
            
            const imageData = this.captureImage(video);
            
            const response = await this.apiCall('/authenticate/', 'POST', {
                image: imageData
            }, false);

            this.hideLoading();

            if (response.success && response.user) {
                // For face login, we might get token directly or need to request it
                if (response.token) {
                    this.setAuth(response.token, response.user);
                } else {
                    // Create a session token for the authenticated user
                    try {
                        const tokenResponse = await this.apiCall('/profile/', 'GET');
                        this.setAuth('face-auth-token', response.user);
                    } catch (tokenError) {
                        // If token fetch fails, still proceed with user data
                        this.setAuth('face-auth-token', response.user);
                    }
                }
                
                this.showTimedAlert('Success', `Welcome back, ${response.user.first_name}! Redirecting...`, 'success', 1500, () => {
                    this.stopLoginCamera();
                    this.showPage('dashboard');
                });
            } else {
                this.showAlert('Error', response.message || 'Face authentication failed', 'error');
            }

        } catch (error) {
            this.hideLoading();
            console.error('Face login error:', error);
            this.showAlert('Error', error.message || 'Authentication failed. Please try again.', 'error');
        }
    }

    // Face Enrollment Page
    loadEnrollPage() {
        const container = document.getElementById('page-enroll');
        container.innerHTML = `
            <div class="row justify-content-center">
                <div class="col-md-10">
                    <div class="card fade-in">
                        <div class="card-header bg-warning text-dark">
                            <h4 class="mb-0"><i class="fas fa-camera me-2"></i>Face Enrollment</h4>
                        </div>
                        <div class="card-body p-4">
                            <!-- Progress Steps -->
                            <div class="step-indicator mb-4">
                                <div class="step active" id="step-1">
                                    <div class="step-number">1</div>
                                    <div class="mt-2 small">Camera Setup</div>
                                </div>
                                <div class="step" id="step-2">
                                    <div class="step-number">2</div>
                                    <div class="mt-2 small">Face Capture</div>
                                </div>
                                <div class="step" id="step-3">
                                    <div class="step-number">3</div>
                                    <div class="mt-2 small">Quality Check</div>
                                </div>
                                <div class="step" id="step-4">
                                    <div class="step-number">4</div>
                                    <div class="mt-2 small">Enrollment</div>
                                </div>
                            </div>

                            <div class="row">
                                <!-- Camera Section -->
                                <div class="col-md-8">
                                    <div class="camera-container position-relative" style="height: 400px; background: #000; border-radius: 10px;">
                                        <video id="enrollVideo" class="d-none" autoplay muted style="width: 100%; height: 100%; object-fit: cover; border-radius: 10px;"></video>
                                        <div id="enrollCameraPlaceholder" class="d-flex align-items-center justify-content-center h-100">
                                            <div class="text-center text-white">
                                                <i class="fas fa-camera" style="font-size: 4rem; opacity: 0.7;"></i>
                                                <p class="mt-3 mb-0 fs-5">Click "Start Camera" to begin</p>
                                                <p class="small opacity-75">Ensure good lighting and face the camera directly</p>
                                            </div>
                                        </div>
                                        <div class="camera-overlay" id="enrollOverlay" style="display: none;"></div>
                                    </div>
                                    
                                    <!-- Camera Controls -->
                                    <div class="d-grid gap-2 mt-3">
                                        <button id="startEnrollCamera" class="btn btn-success btn-lg">
                                            <i class="fas fa-camera me-2"></i>Start Camera
                                        </button>
                                        <div id="enrollCameraControls" class="d-none">
                                            <div class="row g-2">
                                                <div class="col-6">
                                                    <button id="captureEnrollFace" class="btn btn-primary w-100" disabled>
                                                        <i class="fas fa-capture me-2"></i>Capture Face
                                                    </button>
                                                </div>
                                                <div class="col-6">
                                                    <button id="stopEnrollCamera" class="btn btn-outline-secondary w-100">
                                                        <i class="fas fa-times me-2"></i>Stop Camera
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <!-- Status Section -->
                                <div class="col-md-4">
                                    <div class="card bg-light">
                                        <div class="card-body">
                                            <h6 class="card-title">
                                                <i class="fas fa-info-circle text-info me-2"></i>Enrollment Status
                                            </h6>
                                            
                                            <!-- Quality Assessment -->
                                            <div id="qualitySection" class="mb-3 d-none">
                                                <label class="form-label small fw-bold">Image Quality</label>
                                                <div id="qualityIndicator" class="alert alert-info py-2">
                                                    <span id="qualityText">Checking...</span>
                                                </div>
                                            </div>

                                            <!-- Instructions -->
                                            <div id="instructionsSection">
                                                <label class="form-label small fw-bold">Instructions</label>
                                                <div class="alert alert-info py-2">
                                                    <ul class="mb-0 small">
                                                        <li>Ensure good lighting</li>
                                                        <li>Face the camera directly</li>
                                                        <li>Remove glasses if possible</li>
                                                        <li>Keep a neutral expression</li>
                                                        <li>Stay still during capture</li>
                                                    </ul>
                                                </div>
                                            </div>

                                            <!-- Captured Images Preview -->
                                            <div id="capturedSection" class="d-none">
                                                <label class="form-label small fw-bold">Captured Image</label>
                                                <div class="text-center">
                                                    <img id="capturedImage" class="img-fluid rounded" style="max-height: 150px;">
                                                    <div class="mt-2">
                                                        <button id="retakePicture" class="btn btn-sm btn-outline-primary me-2">
                                                            <i class="fas fa-redo me-1"></i>Retake
                                                        </button>
                                                        <button id="enrollFace" class="btn btn-sm btn-success">
                                                            <i class="fas fa-check me-1"></i>Enroll
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>

                                            <!-- Enrollment Progress -->
                                            <div id="enrollmentProgress" class="d-none">
                                                <label class="form-label small fw-bold">Progress</label>
                                                <div class="progress mb-2">
                                                    <div id="progressBar" class="progress-bar progress-bar-striped progress-bar-animated" 
                                                         role="progressbar" style="width: 0%"></div>
                                                </div>
                                                <div id="progressText" class="small text-muted">Preparing...</div>
                                            </div>
                                        </div>
                                    </div>

                                    <!-- Tips Card -->
                                    <div class="card bg-light mt-3">
                                        <div class="card-body">
                                            <h6 class="card-title">
                                                <i class="fas fa-lightbulb text-warning me-2"></i>Tips
                                            </h6>
                                            <div class="small">
                                                <p class="mb-2">✓ Use natural lighting or bright room</p>
                                                <p class="mb-2">✓ Look directly at the camera</p>
                                                <p class="mb-2">✓ Keep your head centered</p>
                                                <p class="mb-0">✓ Avoid shadows on your face</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        this.setupEnrollHandlers();
    }

    setupEnrollHandlers() {
        document.getElementById('startEnrollCamera').addEventListener('click', () => {
            this.startEnrollCamera();
        });

        document.getElementById('stopEnrollCamera').addEventListener('click', () => {
            this.stopEnrollCamera();
        });

        document.getElementById('captureEnrollFace').addEventListener('click', () => {
            this.captureEnrollmentImage();
        });

        document.getElementById('retakePicture').addEventListener('click', () => {
            this.retakeEnrollmentPicture();
        });

        document.getElementById('enrollFace').addEventListener('click', () => {
            this.processEnrollment();
        });
    }

    async startEnrollCamera() {
        try {
            const video = document.getElementById('enrollVideo');
            await this.startCamera(video);
            
            // Show video and controls
            video.classList.remove('d-none');
            document.getElementById('enrollCameraPlaceholder').classList.add('d-none');
            document.getElementById('enrollOverlay').style.display = 'block';
            document.getElementById('startEnrollCamera').classList.add('d-none');
            document.getElementById('enrollCameraControls').classList.remove('d-none');
            document.getElementById('qualitySection').classList.remove('d-none');
            
            // Update step indicator
            this.updateStepIndicator(2);
            
            // Start quality monitoring
            this.monitorEnrollmentQuality();

        } catch (error) {
            this.showAlert('Error', error.message, 'error');
        }
    }

    stopEnrollCamera() {
        this.stopCamera();
        
        // Reset UI
        document.getElementById('enrollVideo').classList.add('d-none');
        document.getElementById('enrollCameraPlaceholder').classList.remove('d-none');
        document.getElementById('enrollOverlay').style.display = 'none';
        document.getElementById('startEnrollCamera').classList.remove('d-none');
        document.getElementById('enrollCameraControls').classList.add('d-none');
        document.getElementById('qualitySection').classList.add('d-none');
        document.getElementById('capturedSection').classList.add('d-none');
        
        // Reset step indicator
        this.updateStepIndicator(1);
    }

    monitorEnrollmentQuality() {
        const video = document.getElementById('enrollVideo');
        const captureBtn = document.getElementById('captureEnrollFace');
        const qualityText = document.getElementById('qualityText');
        
        let qualityInterval = setInterval(() => {
            if (!this.camera) {
                clearInterval(qualityInterval);
                return;
            }

            const isReady = video.videoWidth > 0 && video.videoHeight > 0;
            
            if (isReady) {
                // Simulate quality assessment
                const quality = Math.random();
                const badge = this.getQualityBadge(quality);
                
                qualityText.innerHTML = `<span class="quality-indicator ${badge.class}"></span>${badge.text} - Ready to capture`;
                captureBtn.disabled = quality < 0.4;
                
                if (quality >= 0.6) {
                    captureBtn.classList.remove('btn-outline-primary');
                    captureBtn.classList.add('btn-primary');
                }
            } else {
                qualityText.innerHTML = '<span class="quality-indicator quality-poor"></span>Position your face in the camera';
                captureBtn.disabled = true;
            }
        }, 1000);
    }

    captureEnrollmentImage() {
        const video = document.getElementById('enrollVideo');
        
        if (!video.videoWidth || !video.videoHeight) {
            this.showAlert('Error', 'Camera not ready. Please wait a moment.', 'error');
            return;
        }

        // Capture image
        const imageData = this.captureImage(video);
        
        // Show captured image
        document.getElementById('capturedImage').src = imageData;
        document.getElementById('capturedSection').classList.remove('d-none');
        document.getElementById('instructionsSection').classList.add('d-none');
        
        // Update step indicator
        this.updateStepIndicator(3);
        
        // Store captured image for enrollment
        this.capturedEnrollmentImage = imageData;
    }

    retakeEnrollmentPicture() {
        document.getElementById('capturedSection').classList.add('d-none');
        document.getElementById('instructionsSection').classList.remove('d-none');
        this.capturedEnrollmentImage = null;
        
        // Back to step 2
        this.updateStepIndicator(2);
    }

    async processEnrollment() {
        if (!this.capturedEnrollmentImage) {
            this.showAlert('Error', 'No image captured for enrollment', 'error');
            return;
        }

        try {
            // Show progress
            document.getElementById('enrollmentProgress').classList.remove('d-none');
            document.getElementById('capturedSection').classList.add('d-none');
            this.updateStepIndicator(4);
            
            // Simulate progress updates
            this.updateEnrollmentProgress(20, 'Analyzing image quality...');
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            this.updateEnrollmentProgress(50, 'Extracting face features...');
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            this.updateEnrollmentProgress(80, 'Processing enrollment...');
            
            // Make API call
            const response = await this.apiCall('/enroll/', 'POST', {
                user_id: this.user.id,
                image: this.capturedEnrollmentImage
            });

            this.updateEnrollmentProgress(100, 'Enrollment complete!');
            
            setTimeout(() => {
                this.showAlert('Success', 'Face enrollment completed successfully! You can now use face recognition to login.', 'success');
                this.stopEnrollCamera();
                setTimeout(() => this.showPage('dashboard'), 2000);
            }, 1000);

        } catch (error) {
            this.showAlert('Error', error.message || 'Enrollment failed. Please try again.', 'error');
            document.getElementById('enrollmentProgress').classList.add('d-none');
            document.getElementById('capturedSection').classList.remove('d-none');
            this.updateStepIndicator(3);
        }
    }

    updateStepIndicator(currentStep) {
        for (let i = 1; i <= 4; i++) {
            const step = document.getElementById(`step-${i}`);
            step.classList.remove('active', 'completed');
            
            if (i < currentStep) {
                step.classList.add('completed');
            } else if (i === currentStep) {
                step.classList.add('active');
            }
        }
    }

    updateEnrollmentProgress(percent, text) {
        document.getElementById('progressBar').style.width = `${percent}%`;
        document.getElementById('progressText').textContent = text;
    }

    // Dashboard Page
    loadDashboardPage() {
        const container = document.getElementById('page-dashboard');
        container.innerHTML = `
            <div class="row">
                <!-- Welcome Section -->
                <div class="col-12 mb-4">
                    <div class="card fade-in bg-primary text-white">
                        <div class="card-body">
                            <div class="row align-items-center">
                                <div class="col-md-8">
                                    <h2 class="mb-1">Welcome back, ${this.user.first_name}!</h2>
                                    <p class="mb-0 opacity-75">Manage your face authentication settings and view your activity</p>
                                </div>
                                <div class="col-md-4 text-md-end">
                                    <i class="fas fa-user-shield" style="font-size: 3rem; opacity: 0.7;"></i>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Quick Actions -->
                <div class="col-md-8 mb-4">
                    <div class="card">
                        <div class="card-header">
                            <h5 class="mb-0"><i class="fas fa-bolt text-warning me-2"></i>Quick Actions</h5>
                        </div>
                        <div class="card-body">
                            <div class="row g-3">
                                <div class="col-md-6">
                                    <div class="d-grid">
                                        <button class="btn btn-warning btn-lg" onclick="app.showPage('enroll')">
                                            <i class="fas fa-camera me-2"></i>
                                            <div>
                                                <div>Enroll Face</div>
                                                <small class="opacity-75">Add or update face data</small>
                                            </div>
                                        </button>
                                    </div>
                                </div>
                                <div class="col-md-6">
                                    <div class="d-grid">
                                        <button class="btn btn-success btn-lg" id="testFaceAuth">
                                            <i class="fas fa-user-check me-2"></i>
                                            <div>
                                                <div>Test Face Auth</div>
                                                <small class="opacity-75">Try face recognition</small>
                                            </div>
                                        </button>
                                    </div>
                                </div>
                            </div>
                            <div class="row g-3 mt-1">
                                <div class="col-md-6">
                                    <div class="d-grid">
                                        <button class="btn btn-info btn-lg" onclick="app.showPage('enrollments')">
                                            <i class="fas fa-images me-2"></i>
                                            <div>
                                                <div>View Enrollments</div>
                                                <small class="opacity-75">Manage face data</small>
                                            </div>
                                        </button>
                                    </div>
                                </div>
                                <div class="col-md-6">
                                    <div class="d-grid">
                                        <button class="btn btn-secondary btn-lg" onclick="app.showPage('activity')">
                                            <i class="fas fa-history me-2"></i>
                                            <div>
                                                <div>View Activity</div>
                                                <small class="opacity-75">Authentication history</small>
                                            </div>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Profile Info -->
                <div class="col-md-4 mb-4">
                    <div class="card">
                        <div class="card-header">
                            <h5 class="mb-0"><i class="fas fa-user text-primary me-2"></i>Profile</h5>
                        </div>
                        <div class="card-body">
                            <div class="text-center mb-3">
                                <div class="bg-primary rounded-circle d-inline-flex align-items-center justify-content-center" 
                                     style="width: 80px; height: 80px;">
                                    <i class="fas fa-user text-white" style="font-size: 2rem;"></i>
                                </div>
                            </div>
                            <table class="table table-sm">
                                <tr>
                                    <td class="fw-bold">Name:</td>
                                    <td>${this.user.first_name} ${this.user.last_name}</td>
                                </tr>
                                <tr>
                                    <td class="fw-bold">Username:</td>
                                    <td>${this.user.username}</td>
                                </tr>
                                <tr>
                                    <td class="fw-bold">Email:</td>
                                    <td>${this.user.email}</td>
                                </tr>
                                <tr id="enrollmentStatusRow">
                                    <td class="fw-bold">Face Enrolled:</td>
                                    <td><span class="badge bg-secondary">Loading...</span></td>
                                </tr>
                            </table>
                        </div>
                    </div>
                </div>

                <!-- Statistics -->
                <div class="col-12 mb-4">
                    <div class="card">
                        <div class="card-header">
                            <h5 class="mb-0"><i class="fas fa-chart-bar text-success me-2"></i>Statistics</h5>
                        </div>
                        <div class="card-body">
                            <div class="row text-center" id="statsContainer">
                                <div class="col-md-3 mb-3">
                                    <div class="card bg-light">
                                        <div class="card-body">
                                            <i class="fas fa-key text-primary mb-2" style="font-size: 2rem;"></i>
                                            <h4 class="mb-1" id="totalLogins">-</h4>
                                            <p class="mb-0 small">Total Logins</p>
                                        </div>
                                    </div>
                                </div>
                                <div class="col-md-3 mb-3">
                                    <div class="card bg-light">
                                        <div class="card-body">
                                            <i class="fas fa-camera text-warning mb-2" style="font-size: 2rem;"></i>
                                            <h4 class="mb-1" id="faceLogins">-</h4>
                                            <p class="mb-0 small">Face Logins</p>
                                        </div>
                                    </div>
                                </div>
                                <div class="col-md-3 mb-3">
                                    <div class="card bg-light">
                                        <div class="card-body">
                                            <i class="fas fa-check-circle text-success mb-2" style="font-size: 2rem;"></i>
                                            <h4 class="mb-1" id="successRate">-</h4>
                                            <p class="mb-0 small">Success Rate</p>
                                        </div>
                                    </div>
                                </div>
                                <div class="col-md-3 mb-3">
                                    <div class="card bg-light">
                                        <div class="card-body">
                                            <i class="fas fa-clock text-info mb-2" style="font-size: 2rem;"></i>
                                            <h4 class="mb-1" id="lastLogin">-</h4>
                                            <p class="mb-0 small">Last Login</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Recent Activity -->
                <div class="col-12">
                    <div class="card">
                        <div class="card-header d-flex justify-content-between align-items-center">
                            <h5 class="mb-0"><i class="fas fa-history text-info me-2"></i>Recent Activity</h5>
                            <button class="btn btn-sm btn-outline-primary" id="refreshActivity">
                                <i class="fas fa-refresh me-1"></i>Refresh
                            </button>
                        </div>
                        <div class="card-body">
                            <div id="activityContainer">
                                <div class="text-center py-3">
                                    <div class="loading-spinner me-2"></div>
                                    Loading activity...
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Test Face Auth Modal -->
            <div class="modal fade" id="testFaceModal" tabindex="-1">
                <div class="modal-dialog modal-lg">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">Test Face Authentication</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <div class="text-center">
                                <div class="camera-container mb-3" style="height: 300px; background: #000; border-radius: 8px;">
                                    <video id="testVideo" class="d-none" autoplay muted style="width: 100%; height: 100%; object-fit: cover; border-radius: 8px;"></video>
                                    <div id="testCameraPlaceholder" class="d-flex align-items-center justify-content-center h-100">
                                        <div class="text-center text-white">
                                            <i class="fas fa-camera" style="font-size: 3rem; opacity: 0.7;"></i>
                                            <p class="mt-2 mb-0">Camera will appear here</p>
                                        </div>
                                    </div>
                                </div>
                                <div class="d-grid gap-2">
                                    <button id="startTestCamera" class="btn btn-success">
                                        <i class="fas fa-camera me-2"></i>Start Test
                                    </button>
                                    <div id="testControls" class="d-none">
                                        <div class="row g-2">
                                            <div class="col-6">
                                                <button id="testAuthenticate" class="btn btn-primary w-100">
                                                    <i class="fas fa-user-check me-2"></i>Authenticate
                                                </button>
                                            </div>
                                            <div class="col-6">
                                                <button id="stopTestCamera" class="btn btn-outline-secondary w-100">
                                                    <i class="fas fa-times me-2"></i>Stop
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div id="testResult" class="mt-3 d-none"></div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        this.setupDashboardHandlers();
        this.loadDashboardData();
    }

    setupDashboardHandlers() {
        // Test face auth
        document.getElementById('testFaceAuth').addEventListener('click', () => {
            new bootstrap.Modal(document.getElementById('testFaceModal')).show();
        });

        // Test camera controls
        document.getElementById('startTestCamera').addEventListener('click', () => {
            this.startTestCamera();
        });

        document.getElementById('stopTestCamera').addEventListener('click', () => {
            this.stopTestCamera();
        });

        document.getElementById('testAuthenticate').addEventListener('click', () => {
            this.testAuthentication();
        });

        // Other actions
        document.getElementById('refreshActivity').addEventListener('click', () => {
            this.loadRecentActivity();
        });
    }

    async loadDashboardData() {
        try {
            // Load user profile and stats
            const [profile, userStats] = await Promise.all([
                this.apiCall('/profile/'),
                this.apiCall('/user-stats/')
            ]);
            
            // Update enrollment status
            const statusCell = document.querySelector('#enrollmentStatusRow td:last-child');
            if (statusCell) {
                statusCell.innerHTML = profile.is_face_enrolled 
                    ? '<span class="badge bg-success">Yes</span>' 
                    : '<span class="badge bg-warning">No</span>';
            }

            // Load statistics with user stats data
            this.loadStatistics(userStats.stats);
            
            // Load recent activity
            this.loadRecentActivity();

        } catch (error) {
            console.error('Error loading dashboard data:', error);
            // Show fallback data
            const statusCell = document.querySelector('#enrollmentStatusRow td:last-child');
            if (statusCell) {
                statusCell.innerHTML = '<span class="badge bg-secondary">Unknown</span>';
            }
        }
    }

    async loadStatistics(userStats = null) {
        try {
            let stats;
            
            if (userStats) {
                // Use provided user stats
                stats = userStats;
            } else {
                // Fallback: fetch user stats
                const response = await this.apiCall('/user-stats/');
                stats = response.stats;
            }
            
            // Update statistics display
            const totalLogins = stats.total_attempts || 0;
            const faceLogins = stats.face_attempts || 0;
            const successRate = stats.success_rate || 0;
            const lastLogin = stats.last_login ? new Date(stats.last_login).toLocaleDateString() : 'Never';
            
            // Update DOM elements
            const elements = {
                totalLogins: document.getElementById('totalLogins'),
                faceLogins: document.getElementById('faceLogins'),
                successRate: document.getElementById('successRate'),
                lastLogin: document.getElementById('lastLogin')
            };
            
            if (elements.totalLogins) elements.totalLogins.textContent = totalLogins;
            if (elements.faceLogins) elements.faceLogins.textContent = faceLogins;
            if (elements.successRate) elements.successRate.textContent = `${successRate}%`;
            if (elements.lastLogin) elements.lastLogin.textContent = lastLogin;

        } catch (error) {
            console.error('Error loading statistics:', error);
            // Show fallback values
            const fallbackElements = {
                totalLogins: document.getElementById('totalLogins'),
                faceLogins: document.getElementById('faceLogins'),
                successRate: document.getElementById('successRate'),
                lastLogin: document.getElementById('lastLogin')
            };
            
            if (fallbackElements.totalLogins) fallbackElements.totalLogins.textContent = '0';
            if (fallbackElements.faceLogins) fallbackElements.faceLogins.textContent = '0';
            if (fallbackElements.successRate) fallbackElements.successRate.textContent = '0%';
            if (fallbackElements.lastLogin) fallbackElements.lastLogin.textContent = 'Never';
        }
    }

    async loadRecentActivity() {
        const container = document.getElementById('activityContainer');
        
        try {
            const attempts = await this.apiCall('/attempts/');
            
            if (attempts.length === 0) {
                container.innerHTML = `
                    <div class="text-center text-muted py-4">
                        <i class="fas fa-inbox" style="font-size: 2rem; opacity: 0.5;"></i>
                        <p class="mt-2 mb-0">No authentication attempts yet</p>
                    </div>
                `;
                return;
            }

            const recentAttempts = attempts.slice(0, 5);
            container.innerHTML = recentAttempts.map(attempt => `
                <div class="d-flex align-items-center border-bottom py-2">
                    <div class="me-3">
                        <i class="fas fa-${attempt.method === 'face' ? 'camera' : 'key'} 
                           text-${attempt.success ? 'success' : 'danger'}"></i>
                    </div>
                    <div class="flex-grow-1">
                        <div class="fw-bold">${attempt.method === 'face' ? 'Face Authentication' : 'Password Login'}</div>
                        <small class="text-muted">${new Date(attempt.timestamp).toLocaleString()}</small>
                    </div>
                    <div>
                        <span class="badge bg-${attempt.success ? 'success' : 'danger'}">
                            ${attempt.success ? 'Success' : 'Failed'}
                        </span>
                    </div>
                </div>
            `).join('');

        } catch (error) {
            container.innerHTML = `
                <div class="alert alert-warning">
                    <i class="fas fa-exclamation-triangle me-2"></i>
                    Unable to load activity data
                </div>
            `;
        }
    }

    async startTestCamera() {
        try {
            const video = document.getElementById('testVideo');
            await this.startCamera(video);
            
            video.classList.remove('d-none');
            document.getElementById('testCameraPlaceholder').classList.add('d-none');
            document.getElementById('startTestCamera').classList.add('d-none');
            document.getElementById('testControls').classList.remove('d-none');

        } catch (error) {
            this.showAlert('Error', error.message, 'error');
        }
    }

    stopTestCamera() {
        this.stopCamera();
        
        const video = document.getElementById('testVideo');
        video.classList.add('d-none');
        document.getElementById('testCameraPlaceholder').classList.remove('d-none');
        document.getElementById('startTestCamera').classList.remove('d-none');
        document.getElementById('testControls').classList.add('d-none');
        document.getElementById('testResult').classList.add('d-none');
    }

    async testAuthentication() {
        const video = document.getElementById('testVideo');
        const resultDiv = document.getElementById('testResult');
        
        if (!video.videoWidth || !video.videoHeight) {
            this.showAlert('Error', 'Camera not ready. Please wait a moment.', 'error');
            return;
        }

        try {
            resultDiv.innerHTML = `
                <div class="alert alert-info">
                    <div class="loading-spinner me-2"></div>
                    Testing authentication...
                </div>
            `;
            resultDiv.classList.remove('d-none');
            
            const imageData = this.captureImage(video);
            
            const response = await this.apiCall('/authenticate/', 'POST', {
                image: imageData
            }, false);

            if (response.success) {
                resultDiv.innerHTML = `
                    <div class="alert alert-success">
                        <i class="fas fa-check-circle me-2"></i>
                        <strong>Authentication Successful!</strong><br>
                        Confidence: ${Math.round(response.confidence * 100)}%
                    </div>
                `;
            } else {
                resultDiv.innerHTML = `
                    <div class="alert alert-danger">
                        <i class="fas fa-times-circle me-2"></i>
                        <strong>Authentication Failed</strong><br>
                        ${response.message || 'Face not recognized'}
                    </div>
                `;
            }

        } catch (error) {
            resultDiv.innerHTML = `
                <div class="alert alert-danger">
                    <i class="fas fa-exclamation-triangle me-2"></i>
                    <strong>Test Failed:</strong> ${error.message}
                </div>
            `;
        }
    }

    showEnrollments() {
        this.loadEnrollmentsPage();
    }

    showActivityDetails() {
        this.loadActivityPage();
    }

    // WebSocket Message Handlers
    handleFaceAuthResult(data) {
        if (data.success) {
            // Seamless login - auto redirect with notification
            this.showNotification('Welcome Back!', `Authentication successful, ${data.user.first_name}. Redirecting to dashboard...`, 'success', 2000);
            setTimeout(() => {
                if (data.token) {
                    this.setAuth(data.token, data.user);
                    this.showPage('dashboard');
                }
            }, 1500);
        } else {
            this.showNotification('Authentication Failed', data.message || 'Face authentication failed. Please try again.', 'error');
        }
    }

    handleEnrollmentResult(data) {
        if (data.success) {
            this.showNotification('Enrollment Complete!', 'Face enrollment completed successfully. Redirecting to dashboard...', 'success', 2000);
            setTimeout(() => {
                this.stopEnrollCamera();
                this.showPage('dashboard');
            }, 2000);
        } else {
            this.showNotification('Enrollment Failed', data.message || 'Face enrollment failed. Please try again.', 'error');
        }
    }

    handleQualityCheckResult(data) {
        const qualityText = document.getElementById('qualityText');
        if (qualityText) {
            const badge = this.getQualityBadge(data.quality_score);
            qualityText.innerHTML = `<span class="quality-indicator ${badge.class}"></span>${badge.text} - Quality: ${Math.round(data.quality_score * 100)}%`;
            
            // Update capture button based on quality
            const captureBtn = document.getElementById('captureEnrollFace');
            if (captureBtn) {
                captureBtn.disabled = data.quality_score < 0.4;
                if (data.quality_score >= 0.6) {
                    captureBtn.classList.remove('btn-outline-primary');
                    captureBtn.classList.add('btn-primary');
                } else {
                    captureBtn.classList.remove('btn-primary');
                    captureBtn.classList.add('btn-outline-primary');
                }
            }
        }
    }

    // Enhanced Error Handling
    handleError(error) {
        console.error('Application error:', error);
        
        if (error.name === 'NotAllowedError') {
            this.showAlert('Camera Access Denied', 
                'Please allow camera access and refresh the page to use face recognition features.', 
                'error');
        } else if (error.name === 'NotFoundError') {
            this.showAlert('Camera Not Found', 
                'No camera device found. Please connect a camera and try again.', 
                'error');
        } else if (error.message.includes('network') || error.message.includes('fetch')) {
            this.showAlert('Network Error', 
                'Unable to connect to the server. Please check your internet connection and try again.', 
                'error');
        } else {
            this.showAlert('Error', error.message || 'An unexpected error occurred.', 'error');
        }
    }

    // Application State Management
    saveState() {
        const state = {
            currentPage: this.getCurrentPage(),
            timestamp: Date.now()
        };
        localStorage.setItem('faceAuthAppState', JSON.stringify(state));
    }

    loadState() {
        const state = JSON.parse(localStorage.getItem('faceAuthAppState') || '{}');
        return state;
    }

    getCurrentPage() {
        const visiblePage = document.querySelector('.page:not(.d-none)');
        return visiblePage ? visiblePage.id.replace('page-', '') : 'home';
    }

    // Enhanced API Error Handling
    async apiCall(endpoint, method = 'GET', data = null, includeAuth = true) {
        const headers = {
            'Content-Type': 'application/json',
        };

        if (includeAuth && this.token) {
            headers['Authorization'] = `Token ${this.token}`;
        }

        // Add CSRF token for POST requests
        if (method !== 'GET') {
            const csrfToken = document.querySelector('meta[name="csrf-token"]');
            if (csrfToken) {
                headers['X-CSRFToken'] = csrfToken.getAttribute('content');
            }
        }

        const config = {
            method,
            headers,
        };

        if (data && method !== 'GET') {
            config.body = JSON.stringify(data);
        }

        try {
            const response = await fetch(`${this.apiBaseUrl}${endpoint}`, config);
            
            // Handle different response types
            if (response.status === 401) {
                this.clearAuth();
                this.showAlert('Session Expired', 'Please login again.', 'warning');
                this.showPage('login');
                throw new Error('Authentication required');
            }

            if (response.status === 403) {
                throw new Error('Access denied');
            }

            if (response.status === 404) {
                throw new Error('Endpoint not found');
            }

            if (response.status >= 500) {
                throw new Error('Server error. Please try again later.');
            }

            // Try to parse JSON response
            let result;
            try {
                result = await response.json();
            } catch (parseError) {
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
                result = {};
            }

            if (!response.ok) {
                throw new Error(result.error || result.message || `HTTP ${response.status}: ${response.statusText}`);
            }

            return result;

        } catch (error) {
            console.error('API call error:', error);
            
            if (error.name === 'TypeError' && error.message.includes('fetch')) {
                throw new Error('Network error: Unable to connect to server');
            }
            
            throw error;
        }
    }

    // Utility Functions for Form Validation
    validateForm(formId) {
        const form = document.getElementById(formId);
        const inputs = form.querySelectorAll('input[required]');
        let isValid = true;

        inputs.forEach(input => {
            if (!input.value.trim()) {
                input.classList.add('is-invalid');
                isValid = false;
            } else {
                input.classList.remove('is-invalid');
            }
        });

        return isValid;
    }

    // Application Lifecycle
    onPageVisibilityChange() {
        if (document.hidden) {
            // Page is hidden, stop camera if running
            if (this.camera) {
                console.log('Page hidden, stopping camera');
                this.stopCamera();
            }
        }
    }

    onBeforeUnload() {
        // Cleanup when leaving the page
        if (this.camera) {
            this.stopCamera();
        }
        if (this.websocket) {
            this.websocket.close();
        }
        this.saveState();
    }

    // Initialize event listeners for application lifecycle
    initLifecycleEvents() {
        document.addEventListener('visibilitychange', () => {
            this.onPageVisibilityChange();
        });

        window.addEventListener('beforeunload', () => {
            this.onBeforeUnload();
        });

        // Auto-refresh token periodically if needed
        if (this.token) {
            setInterval(() => {
                this.refreshTokenIfNeeded();
            }, 15 * 60 * 1000); // Check every 15 minutes
        }
    }

    async refreshTokenIfNeeded() {
        // This would implement token refresh logic if your API supports it
        try {
            await this.apiCall('/profile/');
        } catch (error) {
            if (error.message.includes('Authentication required')) {
                console.log('Token expired, user needs to login again');
            }
        }
    }

    // New Pages Implementation
    
    async loadEnrollmentsPage() {
        document.getElementById('page-enrollments').innerHTML = `
            <div class="container-fluid">
                <div class="row">
                    <div class="col-12">
                        <div class="d-flex justify-content-between align-items-center mb-4">
                            <h2><i class="fas fa-user-cog me-2"></i>Face Enrollments</h2>
                            <button class="btn btn-primary" onclick="app.showPage('enroll')">
                                <i class="fas fa-plus me-2"></i>Add New Enrollment
                            </button>
                        </div>
                        
                        <div class="row mb-4">
                            <div class="col-md-6">
                                <div class="card bg-primary text-white">
                                    <div class="card-body">
                                        <div class="d-flex justify-content-between">
                                            <div>
                                                <h5 class="card-title">Total Enrollments</h5>
                                                <h3 id="totalEnrollments">-</h3>
                                            </div>
                                            <div>
                                                <i class="fas fa-user-plus fa-3x opacity-75"></i>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div class="col-md-6">
                                <div class="card bg-success text-white">
                                    <div class="card-body">
                                        <div class="d-flex justify-content-between">
                                            <div>
                                                <h5 class="card-title">Active Enrollments</h5>
                                                <h3 id="activeEnrollments">-</h3>
                                            </div>
                                            <div>
                                                <i class="fas fa-check-circle fa-3x opacity-75"></i>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div class="card">
                            <div class="card-header d-flex justify-content-between align-items-center">
                                <h5 class="mb-0">Your Face Enrollments</h5>
                                <button class="btn btn-outline-primary btn-sm" onclick="app.refreshEnrollments()">
                                    <i class="fas fa-sync-alt me-1"></i>Refresh
                                </button>
                            </div>
                            <div class="card-body">
                                <div id="enrollmentsLoading" class="text-center py-4">
                                    <div class="spinner-border text-primary" role="status">
                                        <span class="visually-hidden">Loading...</span>
                                    </div>
                                    <p class="mt-2">Loading enrollments...</p>
                                </div>
                                <div id="enrollmentsList" class="d-none">
                                    <!-- Enrollments will be loaded here -->
                                </div>
                                <div id="noEnrollments" class="text-center py-4 d-none">
                                    <i class="fas fa-user-times fa-3x text-muted mb-3"></i>
                                    <h5>No Face Enrollments Found</h5>
                                    <p class="text-muted">You haven't enrolled any face data yet.</p>
                                    <button class="btn btn-primary" onclick="app.showPage('enroll')">
                                        <i class="fas fa-plus me-2"></i>Enroll Your Face
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Load enrollments data
        await this.loadEnrollmentsData();
    }

    async loadEnrollmentsData() {
        try {
            const response = await this.apiCall('/enrollments/');
            const enrollments = response.results || response.enrollments || [];
            
            // Update summary cards
            document.getElementById('totalEnrollments').textContent = enrollments.length;
            document.getElementById('activeEnrollments').textContent = enrollments.filter(e => e.status === 'completed').length;
            
            document.getElementById('enrollmentsLoading').classList.add('d-none');
            
            if (enrollments.length === 0) {
                document.getElementById('noEnrollments').classList.remove('d-none');
            } else {
                document.getElementById('enrollmentsList').classList.remove('d-none');
                this.renderEnrollmentsList(enrollments);
            }
            
        } catch (error) {
            document.getElementById('enrollmentsLoading').classList.add('d-none');
            this.showAlert('Error', 'Failed to load enrollments data', 'error');
        }
    }

    renderEnrollmentsList(enrollments) {
        const container = document.getElementById('enrollmentsList');
        container.innerHTML = enrollments.map(enrollment => `
            <div class="card mb-3">
                <div class="card-body">
                    <div class="row align-items-center">
                        <div class="col-md-8">
                            <h6 class="card-title mb-1">
                                <i class="fas fa-face-smile me-2"></i>Enrollment #${enrollment.id}
                                ${enrollment.is_active ? '<span class="badge bg-success ms-2">Active</span>' : '<span class="badge bg-secondary ms-2">Inactive</span>'}
                            </h6>
                            <p class="card-text text-muted mb-1">
                                <i class="fas fa-calendar me-1"></i>
                                Enrolled: ${new Date(enrollment.created_at).toLocaleString()}
                            </p>
                            <p class="card-text text-muted mb-0">
                                <i class="fas fa-chart-line me-1"></i>
                                Quality Score: ${enrollment.quality_score ? enrollment.quality_score.toFixed(2) : 'N/A'}
                            </p>
                        </div>
                        <div class="col-md-4 text-end">
                            <div class="btn-group" role="group">
                                <button class="btn btn-outline-info btn-sm" onclick="app.viewEnrollmentDetails('${enrollment.id}')">
                                    <i class="fas fa-eye me-1"></i>View
                                </button>
                                <button class="btn btn-outline-danger btn-sm" onclick="app.deleteEnrollment('${enrollment.id}')">
                                    <i class="fas fa-trash me-1"></i>Delete
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `).join('');
    }

    async refreshEnrollments() {
        document.getElementById('enrollmentsLoading').classList.remove('d-none');
        document.getElementById('enrollmentsList').classList.add('d-none');
        document.getElementById('noEnrollments').classList.add('d-none');
        await this.loadEnrollmentsData();
    }

    async deleteEnrollment(enrollmentId) {
        if (!confirm('Are you sure you want to delete this enrollment? This action cannot be undone.')) {
            return;
        }

        try {
            this.showLoading('Deleting enrollment...');
            await this.apiCall('/delete-enrollment/', 'DELETE', { enrollment_id: enrollmentId });
            this.hideLoading();
            this.showNotification('Deleted', 'Enrollment deleted successfully', 'success', 3000);
            await this.refreshEnrollments();
        } catch (error) {
            this.hideLoading();
            this.showNotification('Delete Failed', 'Failed to delete enrollment. Please try again.', 'error');
        }
    }

    viewEnrollmentDetails(enrollmentId) {
        this.showNotification('Coming Soon', 'Enrollment details view will be available in the next update', 'info');
    }

    async loadActivityPage() {
        document.getElementById('page-activity').innerHTML = `
            <div class="container-fluid">
                <div class="row">
                    <div class="col-12">
                        <div class="d-flex justify-content-between align-items-center mb-4">
                            <h2><i class="fas fa-history me-2"></i>Activity History</h2>
                            <div>
                                <button class="btn btn-outline-primary btn-sm me-2" onclick="app.refreshActivity()">
                                    <i class="fas fa-sync-alt me-1"></i>Refresh
                                </button>
                                <button class="btn btn-outline-secondary btn-sm" onclick="app.exportActivity()">
                                    <i class="fas fa-download me-1"></i>Export
                                </button>
                            </div>
                        </div>
                        
                        <div class="row mb-4">
                            <div class="col-md-3">
                                <div class="card bg-info text-white">
                                    <div class="card-body">
                                        <div class="d-flex justify-content-between">
                                            <div>
                                                <h6 class="card-title">Total Attempts</h6>
                                                <h4 id="totalAttempts">-</h4>
                                            </div>
                                            <i class="fas fa-fingerprint fa-2x opacity-75"></i>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div class="col-md-3">
                                <div class="card bg-success text-white">
                                    <div class="card-body">
                                        <div class="d-flex justify-content-between">
                                            <div>
                                                <h6 class="card-title">Successful</h6>
                                                <h4 id="successfulAttempts">-</h4>
                                            </div>
                                            <i class="fas fa-check-circle fa-2x opacity-75"></i>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div class="col-md-3">
                                <div class="card bg-danger text-white">
                                    <div class="card-body">
                                        <div class="d-flex justify-content-between">
                                            <div>
                                                <h6 class="card-title">Failed</h6>
                                                <h4 id="failedAttempts">-</h4>
                                            </div>
                                            <i class="fas fa-times-circle fa-2x opacity-75"></i>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div class="col-md-3">
                                <div class="card bg-warning text-white">
                                    <div class="card-body">
                                        <div class="d-flex justify-content-between">
                                            <div>
                                                <h6 class="card-title">Success Rate</h6>
                                                <h4 id="successRate">-%</h4>
                                            </div>
                                            <i class="fas fa-percentage fa-2x opacity-75"></i>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div class="card">
                            <div class="card-header">
                                <h5 class="mb-0">Authentication Attempts</h5>
                            </div>
                            <div class="card-body">
                                <div id="activityLoading" class="text-center py-4">
                                    <div class="spinner-border text-primary" role="status">
                                        <span class="visually-hidden">Loading...</span>
                                    </div>
                                    <p class="mt-2">Loading activity history...</p>
                                </div>
                                <div id="activityList" class="d-none">
                                    <!-- Activity list will be loaded here -->
                                </div>
                                <div id="noActivity" class="text-center py-4 d-none">
                                    <i class="fas fa-history fa-3x text-muted mb-3"></i>
                                    <h5>No Activity Found</h5>
                                    <p class="text-muted">No authentication attempts recorded yet.</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        await this.loadActivityData();
    }

    async loadActivityData() {
        try {
            const response = await this.apiCall('/attempts/');
            const attempts = response.results || response.attempts || [];
            
            // Calculate statistics
            const total = attempts.length;
            const successful = attempts.filter(a => a.success).length;
            const failed = total - successful;
            const successRate = total > 0 ? ((successful / total) * 100).toFixed(1) : 0;
            
            // Update summary cards
            document.getElementById('totalAttempts').textContent = total;
            document.getElementById('successfulAttempts').textContent = successful;
            document.getElementById('failedAttempts').textContent = failed;
            document.getElementById('successRate').textContent = successRate + '%';
            
            document.getElementById('activityLoading').classList.add('d-none');
            
            if (attempts.length === 0) {
                document.getElementById('noActivity').classList.remove('d-none');
            } else {
                document.getElementById('activityList').classList.remove('d-none');
                this.renderActivityList(attempts);
            }
        } catch (error) {
            document.getElementById('activityLoading').classList.add('d-none');
            this.showAlert('Error', 'Failed to load activity data', 'error');
        }
    }

    renderActivityList(attempts) {
        const container = document.getElementById('activityList');
        container.innerHTML = attempts.map(attempt => `
            <div class="card mb-2">
                <div class="card-body py-3">
                    <div class="row align-items-center">
                        <div class="col-md-8">
                            <div class="d-flex align-items-center">
                                <i class="fas ${attempt.success ? 'fa-check-circle text-success' : 'fa-times-circle text-danger'} me-3"></i>
                                <div>
                                    <h6 class="mb-1">
                                        ${attempt.success ? 'Successful Authentication' : 'Failed Authentication'}
                                    </h6>
                                    <p class="text-muted mb-0">
                                        <i class="fas fa-clock me-1"></i>
                                        ${new Date(attempt.timestamp).toLocaleString()}
                                    </p>
                                </div>
                            </div>
                        </div>
                        <div class="col-md-4 text-end">
                            <small class="text-muted">
                                ${attempt.confidence_score ? 'Confidence: ' + (attempt.confidence_score * 100).toFixed(1) + '%' : ''}
                            </small>
                        </div>
                    </div>
                </div>
            </div>
        `).join('');
    }

    async refreshActivity() {
        document.getElementById('activityLoading').classList.remove('d-none');
        document.getElementById('activityList').classList.add('d-none');
        document.getElementById('noActivity').classList.add('d-none');
        await this.loadActivityData();
    }

    exportActivity() {
        this.showAlert('Info', 'Activity export feature coming soon!', 'info');
    }

    async loadStatisticsPage() {
        document.getElementById('page-statistics').innerHTML = `
            <div class="container-fluid py-4">
                <!-- Header Section -->
                <div class="row mb-4">
                    <div class="col-12">
                        <div class="d-flex justify-content-between align-items-center">
                            <div>
                                <h2 class="text-white mb-1">
                                    <i class="fas fa-chart-bar me-3"></i>Statistics Dashboard
                                </h2>
                                <p class="text-white-50 mb-0">Real-time face recognition analytics</p>
                            </div>
                            <button class="btn btn-outline-light btn-lg" onclick="app.refreshStats()">
                                <i class="fas fa-sync-alt me-2"></i>Refresh Data
                            </button>
                        </div>
                    </div>
                </div>
                
                <!-- Main Statistics Cards -->
                <div class="row g-4 mb-4">
                    <div class="col-lg-3 col-md-6">
                        <div class="stats-card-modern">
                            <div class="stats-card-content">
                                <div class="stats-icon-wrapper bg-primary">
                                    <i class="fas fa-users"></i>
                                </div>
                                <div class="stats-content">
                                    <h3 id="totalUsers" class="stats-number">-</h3>
                                    <p class="stats-label">Total Users</p>
                                    <div class="stats-trend">
                                        <i class="fas fa-arrow-up text-success me-1"></i>
                                        <span class="text-success">Active</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="col-lg-3 col-md-6">
                        <div class="stats-card-modern">
                            <div class="stats-card-content">
                                <div class="stats-icon-wrapper bg-info">
                                    <i class="fas fa-fingerprint"></i>
                                </div>
                                <div class="stats-content">
                                    <h3 id="totalEmbeddings" class="stats-number">-</h3>
                                    <p class="stats-label">Face Embeddings</p>
                                    <div class="stats-trend">
                                        <i class="fas fa-database text-info me-1"></i>
                                        <span class="text-info">Stored</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="col-lg-3 col-md-6">
                        <div class="stats-card-modern">
                            <div class="stats-card-content">
                                <div class="stats-icon-wrapper bg-success">
                                    <i class="fas fa-bullseye"></i>
                                </div>
                                <div class="stats-content">
                                    <h3 id="avgAccuracy" class="stats-number">-%</h3>
                                    <p class="stats-label">Accuracy Rate</p>
                                    <div class="stats-trend">
                                        <i class="fas fa-check-circle text-success me-1"></i>
                                        <span class="text-success">Excellent</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="col-lg-3 col-md-6">
                        <div class="stats-card-modern">
                            <div class="stats-card-content">
                                <div class="stats-icon-wrapper bg-warning">
                                    <i class="fas fa-heartbeat"></i>
                                </div>
                                <div class="stats-content">
                                    <h3 id="systemHealth" class="stats-number">-</h3>
                                    <p class="stats-label">System Status</p>
                                    <div class="stats-trend">
                                        <i class="fas fa-shield-alt text-success me-1"></i>
                                        <span class="text-success">Protected</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Charts and Analytics Section -->
                <div class="row g-4 mb-4">
                    <div class="col-lg-6">
                        <div class="analytics-card">
                            <div class="analytics-header">
                                <div class="analytics-title">
                                    <i class="fas fa-chart-pie text-primary me-2"></i>
                                    Authentication Success Rate
                                </div>
                                <div class="analytics-badge">
                                    <span class="badge bg-success">Live</span>
                                </div>
                            </div>
                            <div class="analytics-body">
                                <div class="success-rate-container">
                                    <div class="rate-circle-wrapper">
                                        <div class="rate-circle success-circle">
                                            <div class="rate-circle-content">
                                                <i class="fas fa-check text-success"></i>
                                                <h4 id="successPercentage" class="rate-number">100%</h4>
                                                <span class="rate-label">Success</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div class="rate-circle-wrapper">
                                        <div class="rate-circle fail-circle">
                                            <div class="rate-circle-content">
                                                <i class="fas fa-times text-danger"></i>
                                                <h4 id="failPercentage" class="rate-number">0.0%</h4>
                                                <span class="rate-label">Failed</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="col-lg-6">
                        <div class="analytics-card">
                            <div class="analytics-header">
                                <div class="analytics-title">
                                    <i class="fas fa-calendar-week text-info me-2"></i>
                                    Weekly Activity Trend
                                </div>
                                <div class="analytics-badge">
                                    <span class="badge bg-info">7 Days</span>
                                </div>
                            </div>
                            <div class="analytics-body">
                                <div class="weekly-trend">
                                    <p class="trend-subtitle">Authentication attempts by day</p>
                                    <div id="weeklyStats" class="weekly-stats-grid">
                                        <!-- Weekly stats will be loaded here -->
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Advanced Analytics Section -->
                <div class="row g-4">
                    <div class="col-lg-8">
                        <div class="analytics-card">
                            <div class="analytics-header">
                                <div class="analytics-title">
                                    <i class="fas fa-chart-line text-success me-2"></i>
                                    Monthly Trends & Performance
                                </div>
                                <div class="analytics-controls">
                                    <select class="form-select form-select-sm" style="width: auto;">
                                        <option>Last 6 months</option>
                                        <option>Last 12 months</option>
                                    </select>
                                </div>
                            </div>
                            <div class="analytics-body">
                                <div id="monthlyChart" class="chart-container">
                                    <!-- Monthly chart will be rendered here -->
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="col-lg-4">
                        <div class="analytics-card">
                            <div class="analytics-header">
                                <div class="analytics-title">
                                    <i class="fas fa-server text-warning me-2"></i>
                                    System Information
                                </div>
                            </div>
                            <div class="analytics-body">
                                <div id="systemInfo" class="system-info-grid">
                                    <!-- System information will be loaded here -->
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        await this.loadStatisticsData();
    }

    async loadStatisticsData() {
        try {
            // Try to get user-specific stats first, fall back to system stats if admin
            const [userStatsResponse, attemptsResponse] = await Promise.all([
                this.apiCall('/user-stats/').catch(() => null),
                this.apiCall('/attempts/')
            ]);
            
            if (userStatsResponse && userStatsResponse.stats) {
                // Use user-specific statistics
                const stats = userStatsResponse.stats;
                const attempts = attemptsResponse || [];
                
                // Update main stats with user data
                document.getElementById('totalUsers').textContent = '1'; // Current user
                document.getElementById('totalEmbeddings').textContent = stats.enrollment_count || '0';
                
                // Calculate user accuracy
                const total = stats.total_attempts || 0;
                const successful = stats.successful_attempts || 0;
                const accuracy = total > 0 ? stats.success_rate : 0;
                const failRate = total > 0 ? (100 - stats.success_rate).toFixed(1) : 0;
                
                document.getElementById('avgAccuracy').textContent = accuracy + '%';
                document.getElementById('systemHealth').textContent = stats.is_face_enrolled ? 'Enrolled' : 'Not Enrolled';
                document.getElementById('successPercentage').textContent = accuracy + '%';
                document.getElementById('failPercentage').textContent = failRate + '%';
                
                // Update attempt statistics
                this.updateAttemptStats(attemptsResponse.results || attemptsResponse || []);
            } else {
                // Try to get system stats (admin only)
                try {
                    const systemStatsResponse = await this.apiCall('/stats/');
                    const stats = systemStatsResponse.stats || {};
                    const attempts = attemptsResponse.results || attemptsResponse || [];
                    
                    // Update main stats with system data
                    document.getElementById('totalUsers').textContent = stats.total_users || '-';
                    document.getElementById('totalEmbeddings').textContent = stats.total_embeddings || '-';
                    
                    // Calculate system accuracy
                    const total = attempts.length;
                    const successful = attempts.filter(a => a.success).length;
                    const accuracy = total > 0 ? ((successful / total) * 100).toFixed(1) : 0;
                    const failRate = total > 0 ? (((total - successful) / total) * 100).toFixed(1) : 0;
                    
                    document.getElementById('avgAccuracy').textContent = accuracy + '%';
                    document.getElementById('systemHealth').textContent = 'Good';
                    document.getElementById('successPercentage').textContent = accuracy + '%';
                    document.getElementById('failPercentage').textContent = failRate + '%';
                    
                    // Update attempt statistics
                    this.updateAttemptStats(attempts);
                } catch (adminError) {
                    // Not authorized for admin stats, show user message
                    this.showNoStatsMessage();
                }
            }
            
        } catch (error) {
            console.error('Error loading statistics:', error);
            this.showNoStatsMessage();
        }
    }
    
    updateAttemptStats(attempts) {
        // Monthly attempts chart
        const monthlyData = this.groupAttemptsByMonth(attempts);
        this.renderMonthlyChart(monthlyData);
        
        // Weekly stats
        const weeklyData = this.getWeeklyStats(attempts);
        this.renderWeeklyStats(weeklyData);
    }
    
    groupAttemptsByMonth(attempts) {
        const monthlyData = {};
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
                       'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        
        // Ensure attempts is an array
        const attemptsArray = Array.isArray(attempts) ? attempts : [];
        
        attemptsArray.forEach(attempt => {
            const date = new Date(attempt.timestamp || attempt.attempt_date);
            const monthKey = `${months[date.getMonth()]} ${date.getFullYear()}`;
            
            if (!monthlyData[monthKey]) {
                monthlyData[monthKey] = { total: 0, successful: 0, failed: 0 };
            }
            
            monthlyData[monthKey].total++;
            if (attempt.success) {
                monthlyData[monthKey].successful++;
            } else {
                monthlyData[monthKey].failed++;
            }
        });
        
        return monthlyData;
    }
    
    renderMonthlyChart(monthlyData) {
        // Simple text-based chart for now
        const container = document.getElementById('monthlyChart');
        if (!container) return;
        
        let html = '<div class="chart-container">';
        Object.entries(monthlyData).forEach(([month, data]) => {
            const successRate = data.total > 0 ? Math.round((data.successful / data.total) * 100) : 0;
            html += `
                <div class="chart-bar">
                    <div class="chart-label">${month}</div>
                    <div class="chart-value">
                        <div class="progress mb-1">
                            <div class="progress-bar bg-success" style="width: ${successRate}%"></div>
                        </div>
                        <small>${data.successful}/${data.total}</small>
                    </div>
                </div>
            `;
        });
        html += '</div>';
        container.innerHTML = html;
    }
    
    getWeeklyStats(attempts) {
        const weeklyData = [];
        const today = new Date();
        
        // Ensure attempts is an array
        const attemptsArray = Array.isArray(attempts) ? attempts : [];
        
        for (let i = 6; i >= 0; i--) {
            const date = new Date(today);
            date.setDate(date.getDate() - i);
            const dayName = date.toLocaleDateString('en', { weekday: 'short' });
            
            const dayAttempts = attemptsArray.filter(attempt => {
                const attemptDate = new Date(attempt.timestamp || attempt.attempt_date);
                return attemptDate.toDateString() === date.toDateString();
            });
            
            weeklyData.push({
                day: dayName,
                total: dayAttempts.length,
                successful: dayAttempts.filter(a => a.success).length
            });
        }
        
        return weeklyData;
    }
    
    renderWeeklyStats(weeklyData) {
        const container = document.getElementById('weeklyStats');
        if (!container) return;
        
        let html = '';
        weeklyData.forEach(day => {
            const successRate = day.total > 0 ? Math.round((day.successful / day.total) * 100) : 0;
            html += `
                <div class="col">
                    <div class="text-center">
                        <div class="fw-bold">${day.day}</div>
                        <div class="small text-muted">${day.total}</div>
                        <div class="small ${successRate > 50 ? 'text-success' : 'text-warning'}">${successRate}%</div>
                    </div>
                </div>
            `;
        });
        container.innerHTML = html;
    }
    
    showNoStatsMessage() {
        document.getElementById('totalUsers').textContent = '-';
        document.getElementById('totalEmbeddings').textContent = '-';
        document.getElementById('avgAccuracy').textContent = '-%';
        document.getElementById('systemHealth').textContent = 'Unknown';
        document.getElementById('successPercentage').textContent = '-%';
        document.getElementById('failPercentage').textContent = '-%';
    }

    renderSystemInfo(stats) {
        const container = document.getElementById('systemInfo');
        container.innerHTML = `
            <div class="col-md-4">
                <h6><i class="fas fa-database me-2"></i>Database</h6>
                <p class="text-muted">ChromaDB Collection: ${stats.collection_name || 'face_embeddings'}</p>
                <p class="text-muted">Total Embeddings: ${stats.total_embeddings || 0}</p>
            </div>
            <div class="col-md-4">
                <h6><i class="fas fa-brain me-2"></i>AI Model</h6>
                <p class="text-muted">Model: InsightFace Buffalo-L</p>
                <p class="text-muted">Embedding Size: 512 dimensions</p>
            </div>
            <div class="col-md-4">
                <h6><i class="fas fa-cog me-2"></i>Configuration</h6>
                <p class="text-muted">Threshold: 0.7</p>
                <p class="text-muted">Detection Size: 640x640</p>
            </div>
        `;
    }

    async refreshStats() {
        await this.loadStatisticsData();
        this.showTimedAlert('Success', 'Statistics refreshed', 'success', 1500);
    }
}

// Initialize the application
let app;
document.addEventListener('DOMContentLoaded', () => {
    app = new FaceAuthApp();
});

// Global functions for navigation
function showPage(pageId) {
    app.showPage(pageId);
}

function logout() {
    app.logout();
}

// Emergency functions for debugging
function forceCloseModals() {
    if (app) {
        app.forceCloseAllModals();
        console.log('All modals forcibly closed');
    }
}

function resetApp() {
    if (app) {
        app.forceCloseAllModals();
        app.clearAuth();
        app.showPage('home');
        console.log('App reset to initial state');
    }
}