/**
 * Luu Travels & Logistics - Authentication Manager
 * Handles user registration, login, logout, and session management
 */

class AuthManager {
    constructor() {
        // Initialize Supabase client
        this.supabase = supabase.createClient(
            SUPABASE_CONFIG.url,
            SUPABASE_CONFIG.anonKey
        );
        
        this.currentUser = null;
        this.currentSession = null;
        this.authListeners = [];
        this.isInitialized = false;
        
        // Initialize authentication
        this.init();
    }

    /**
     * Initialize authentication manager
     */
    async init() {
        try {
            // Check for existing session
            await this.checkSession();
            
            // Set up auth state change listener
            this.setupAuthListener();
            
            // Set up DOM event listeners
            this.setupEventListeners();
            
            this.isInitialized = true;
            console.log('Authentication manager initialized');
        } catch (error) {
            console.error('Error initializing auth manager:', error);
        }
    }

    /**
     * Check for existing session on page load
     */
    async checkSession() {
        try {
            const { data: { session }, error } = await this.supabase.auth.getSession();
            
            if (error) {
                console.error('Error getting session:', error);
                return;
            }
            
            if (session) {
                this.currentSession = session;
                this.currentUser = session.user;
                this.updateUIForLoggedIn();
                this.notifyListeners('login', this.currentUser);
            } else {
                this.currentUser = null;
                this.currentSession = null;
                this.updateUIForLoggedOut();
            }
        } catch (error) {
            console.error('Error checking session:', error);
        }
    }

    /**
     * Set up auth state change listener
     */
    setupAuthListener() {
        this.supabase.auth.onAuthStateChange((event, session) => {
            console.log('Auth state changed:', event);
            
            switch (event) {
                case 'SIGNED_IN':
                    this.currentSession = session;
                    this.currentUser = session.user;
                    this.updateUIForLoggedIn();
                    this.notifyListeners('login', this.currentUser);
                    break;
                    
                case 'SIGNED_OUT':
                    this.currentSession = null;
                    this.currentUser = null;
                    this.updateUIForLoggedOut();
                    this.notifyListeners('logout', null);
                    break;
                    
                case 'TOKEN_REFRESHED':
                    this.currentSession = session;
                    this.currentUser = session.user;
                    break;
                    
                case 'USER_UPDATED':
                    this.currentUser = session.user;
                    this.notifyListeners('update', this.currentUser);
                    break;
                    
                default:
                    break;
            }
        });
    }

    /**
     * Set up DOM event listeners
     */
    setupEventListeners() {
        // Login button
        const loginBtn = document.getElementById('loginBtn');
        if (loginBtn) {
            loginBtn.addEventListener('click', () => {
                window.location.href = 'pages/login.html';
            });
        }
        
        // Register button
        const registerBtn = document.getElementById('registerBtn');
        if (registerBtn) {
            registerBtn.addEventListener('click', () => {
                window.location.href = 'pages/register.html';
            });
        }
        
        // Logout button (if exists on any page)
        const logoutBtns = document.querySelectorAll('#logoutBtn, .logout-btn');
        logoutBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                this.signOut();
            });
        });
        
        // Login form
        const loginForm = document.getElementById('loginForm');
        if (loginForm) {
            loginForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleLoginForm(e);
            });
        }
        
        // Register form
        const registerForm = document.getElementById('registerForm');
        if (registerForm) {
            registerForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleRegisterForm(e);
            });
        }
    }

    /**
     * Handle login form submission
     */
    async handleLoginForm(e) {
        const form = e.target;
        const email = document.getElementById('loginEmail')?.value;
        const password = document.getElementById('loginPassword')?.value;
        const errorDiv = document.getElementById('loginError');
        
        // Clear previous error
        if (errorDiv) {
            errorDiv.style.display = 'none';
            errorDiv.textContent = '';
        }
        
        // Validate inputs
        if (!email || !password) {
            this.showError(errorDiv, 'Please fill in all fields');
            return;
        }
        
        // Show loading state
        const submitBtn = form.querySelector('button[type="submit"]');
        const originalText = submitBtn?.textContent || 'Login';
        if (submitBtn) {
            submitBtn.textContent = 'Logging in...';
            submitBtn.disabled = true;
        }
        
        try {
            const result = await this.signIn(email, password);
            
            if (result.success) {
                // Redirect to dashboard or previous page
                const redirectUrl = sessionStorage.getItem('redirectAfterLogin') || 'dashboard.html';
                sessionStorage.removeItem('redirectAfterLogin');
                window.location.href = redirectUrl;
            } else {
                this.showError(errorDiv, result.error || 'Login failed. Please try again.');
            }
        } catch (error) {
            this.showError(errorDiv, 'An unexpected error occurred. Please try again.');
            console.error('Login error:', error);
        } finally {
            // Restore button state
            if (submitBtn) {
                submitBtn.textContent = originalText;
                submitBtn.disabled = false;
            }
        }
    }

    /**
     * Handle registration form submission
     */
    async handleRegisterForm(e) {
        const form = e.target;
        const fullName = document.getElementById('registerFullName')?.value;
        const email = document.getElementById('registerEmail')?.value;
        const phone = document.getElementById('registerPhone')?.value;
        const idNumber = document.getElementById('registerIdNumber')?.value;
        const passportNumber = document.getElementById('registerPassport')?.value;
        const password = document.getElementById('registerPassword')?.value;
        const confirmPassword = document.getElementById('registerConfirmPassword')?.value;
        const errorDiv = document.getElementById('registerError');
        
        // Clear previous error
        if (errorDiv) {
            errorDiv.style.display = 'none';
            errorDiv.textContent = '';
        }
        
        // Validate inputs
        if (!fullName || !email || !phone || !idNumber || !password) {
            this.showError(errorDiv, 'Please fill in all required fields');
            return;
        }
        
        if (password !== confirmPassword) {
            this.showError(errorDiv, 'Passwords do not match');
            return;
        }
        
        if (password.length < 6) {
            this.showError(errorDiv, 'Password must be at least 6 characters long');
            return;
        }
        
        if (!VALIDATION.phoneRegex.test(phone.replace(/\s/g, ''))) {
            this.showError(errorDiv, 'Please enter a valid 10-digit phone number');
            return;
        }
        
        if (!VALIDATION.idRegex.test(idNumber)) {
            this.showError(errorDiv, 'Please enter a valid 13-digit ID number');
            return;
        }
        
        // Show loading state
        const submitBtn = form.querySelector('button[type="submit"]');
        const originalText = submitBtn?.textContent || 'Register';
        if (submitBtn) {
            submitBtn.textContent = 'Registering...';
            submitBtn.disabled = true;
        }
        
        try {
            const userData = {
                fullName: fullName.trim(),
                email: email.trim(),
                phone: phone.trim(),
                idNumber: idNumber.trim(),
                passportNumber: passportNumber ? passportNumber.trim() : null
            };
            
            const result = await this.signUp(email.trim(), password, userData);
            
            if (result.success) {
                // Show success message
                alert('Registration successful! Please check your email to confirm your account.');
                window.location.href = 'login.html';
            } else {
                this.showError(errorDiv, result.error || 'Registration failed. Please try again.');
            }
        } catch (error) {
            this.showError(errorDiv, 'An unexpected error occurred. Please try again.');
            console.error('Registration error:', error);
        } finally {
            // Restore button state
            if (submitBtn) {
                submitBtn.textContent = originalText;
                submitBtn.disabled = false;
            }
        }
    }

    /**
     * Sign up a new user
     */
    async signUp(email, password, userData) {
        try {
            // Create auth user
            const { data, error } = await this.supabase.auth.signUp({
                email: email,
                password: password,
                options: {
                    data: {
                        full_name: userData.fullName,
                        phone: userData.phone
                    }
                }
            });

            if (error) {
                throw error;
            }

            // Save user profile data
            if (data.user) {
                await this.saveUserProfile(data.user.id, userData);
            }

            return { 
                success: true, 
                data: data,
                message: 'Registration successful! Please verify your email.'
            };
        } catch (error) {
            console.error('Sign up error:', error);
            return { 
                success: false, 
                error: error.message || 'Registration failed' 
            };
        }
    }

    /**
     * Save user profile to database
     */
    async saveUserProfile(userId, userData) {
        try {
            const { error } = await this.supabase
                .from('users')
                .insert([{
                    id: userId,
                    email: userData.email,
                    full_name: userData.fullName,
                    phone: userData.phone,
                    id_number: userData.idNumber,
                    passport_number: userData.passportNumber || null
                }]);

            if (error) {
                console.error('Error saving user profile:', error);
                throw error;
            }
            
            console.log('User profile saved successfully');
        } catch (error) {
            console.error('Error in saveUserProfile:', error);
            throw error;
        }
    }

    /**
     * Sign in a user
     */
    async signIn(email, password) {
        try {
            const { data, error } = await this.supabase.auth.signInWithPassword({
                email: email,
                password: password
            });

            if (error) {
                throw error;
            }

            this.currentUser = data.user;
            this.currentSession = data.session;
            this.updateUIForLoggedIn();
            this.notifyListeners('login', this.currentUser);

            return { 
                success: true, 
                data: data,
                user: data.user
            };
        } catch (error) {
            console.error('Sign in error:', error);
            return { 
                success: false, 
                error: error.message || 'Login failed' 
            };
        }
    }

    /**
     * Sign out the current user
     */
    async signOut() {
        try {
            const { error } = await this.supabase.auth.signOut();
            
            if (error) {
                throw error;
            }
            
            this.currentUser = null;
            this.currentSession = null;
            this.updateUIForLoggedOut();
            this.notifyListeners('logout', null);
            
            // Redirect to home page
            window.location.href = '../index.html';
        } catch (error) {
            console.error('Sign out error:', error);
            alert('Error signing out: ' + error.message);
        }
    }

    /**
     * Update user profile
     */
    async updateProfile(userData) {
        try {
            const { error } = await this.supabase
                .from('users')
                .update({
                    full_name: userData.fullName,
                    phone: userData.phone,
                    id_number: userData.idNumber,
                    passport_number: userData.passportNumber,
                    updated_at: new Date().toISOString()
                })
                .eq('id', this.currentUser.id);

            if (error) {
                throw error;
            }

            // Update user metadata in auth
            const { error: authError } = await this.supabase.auth.updateUser({
                data: {
                    full_name: userData.fullName,
                    phone: userData.phone
                }
            });

            if (authError) {
                throw authError;
            }

            // Refresh user data
            await this.checkSession();
            
            return { success: true };
        } catch (error) {
            console.error('Update profile error:', error);
            return { 
                success: false, 
                error: error.message || 'Update failed' 
            };
        }
    }

    /**
     * Reset password
     */
    async resetPassword(email) {
        try {
            const { error } = await this.supabase.auth.resetPasswordForEmail(email, {
                redirectTo: window.location.origin + '/pages/reset-password.html'
            });

            if (error) {
                throw error;
            }

            return { 
                success: true, 
                message: 'Password reset email sent! Please check your inbox.' 
            };
        } catch (error) {
            console.error('Reset password error:', error);
            return { 
                success: false, 
                error: error.message || 'Reset password failed' 
            };
        }
    }

    /**
     * Check if user is authenticated
     */
    isAuthenticated() {
        return !!this.currentUser;
    }

    /**
     * Check if user is admin
     */
    isAdmin() {
        if (!this.currentUser) return false;
        return this.currentUser.email === ADMIN_CREDENTIALS.email;
    }

    /**
     * Get current user
     */
    getCurrentUser() {
        return this.currentUser;
    }

    /**
     * Get current session
     */
    getCurrentSession() {
        return this.currentSession;
    }

    /**
     * Get user profile
     */
    async getUserProfile(userId) {
        try {
            const { data, error } = await this.supabase
                .from('users')
                .select('*')
                .eq('id', userId || this.currentUser?.id)
                .single();

            if (error) {
                throw error;
            }

            return { success: true, data };
        } catch (error) {
            console.error('Get user profile error:', error);
            return { 
                success: false, 
                error: error.message || 'Failed to get user profile' 
            };
        }
    }

    /**
     * Update UI for logged in state
     */
    updateUIForLoggedIn() {
        const loginBtn = document.getElementById('loginBtn');
        const registerBtn = document.getElementById('registerBtn');
        const userMenu = document.getElementById('userMenu');
        
        if (loginBtn) {
            loginBtn.textContent = 'Dashboard';
            loginBtn.onclick = () => {
                window.location.href = 'pages/dashboard.html';
            };
            loginBtn.className = 'btn-dashboard';
        }
        
        if (registerBtn) {
            registerBtn.textContent = 'Logout';
            registerBtn.onclick = () => {
                this.signOut();
            };
            registerBtn.className = 'btn-logout';
        }
        
        // Show user menu if exists
        if (userMenu) {
            userMenu.style.display = 'flex';
        }
    }

    /**
     * Update UI for logged out state
     */
    updateUIForLoggedOut() {
        const loginBtn = document.getElementById('loginBtn');
        const registerBtn = document.getElementById('registerBtn');
        const userMenu = document.getElementById('userMenu');
        
        if (loginBtn) {
            loginBtn.textContent = 'Login';
            loginBtn.onclick = () => {
                window.location.href = 'pages/login.html';
            };
            loginBtn.className = 'btn-login';
        }
        
        if (registerBtn) {
            registerBtn.textContent = 'Register';
            registerBtn.onclick = () => {
                window.location.href = 'pages/register.html';
            };
            registerBtn.className = 'btn-register';
        }
        
        // Hide user menu if exists
        if (userMenu) {
            userMenu.style.display = 'none';
        }
    }

    /**
     * Show error message
     */
    showError(element, message) {
        if (element) {
            element.textContent = message;
            element.style.display = 'block';
        }
    }

    /**
     * Add auth state listener
     */
    addListener(callback) {
        this.authListeners.push(callback);
    }

    /**
     * Notify all listeners of auth state change
     */
    notifyListeners(event, data) {
        this.authListeners.forEach(callback => {
            try {
                callback(event, data);
            } catch (error) {
                console.error('Error in auth listener:', error);
            }
        });
    }

    /**
     * Require authentication for protected pages
     */
    requireAuth(redirectUrl = 'login.html') {
        if (!this.isAuthenticated()) {
            sessionStorage.setItem('redirectAfterLogin', window.location.pathname);
            window.location.href = redirectUrl;
            return false;
        }
        return true;
    }

    /**
     * Require admin for protected admin pages
     */
    requireAdmin(redirectUrl = 'admin-login.html') {
        if (!this.isAuthenticated()) {
            sessionStorage.setItem('redirectAfterLogin', window.location.pathname);
            window.location.href = redirectUrl;
            return false;
        }
        
        if (!this.isAdmin()) {
            alert('You do not have permission to access this page.');
            window.location.href = '../index.html';
            return false;
        }
        
        return true;
    }
}

// Initialize authentication manager
const auth = new AuthManager();

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { auth };
}