/**
 * Luu Travels & Logistics - Main JavaScript
 * Handles landing page functionality, navigation, and general UI interactions
 */

class MainManager {
    constructor() {
        this.navbar = document.querySelector('.navbar');
        this.hamburger = document.getElementById('hamburger');
        this.navLinks = document.querySelector('.nav-links');
        this.isMenuOpen = false;
        this.scrollThreshold = 50;
        this.lastScrollY = 0;
        
        this.init();
    }

    /**
     * Initialize main manager
     */
    init() {
        // Check authentication state
        this.checkAuthState();
        
        // Set up navigation
        this.setupNavigation();
        
        // Set up scroll effects
        this.setupScrollEffects();
        
        // Set up hero section
        this.setupHero();
        
        // Set up smooth scrolling
        this.setupSmoothScroll();
        
        // Set up animations
        this.setupAnimations();
        
        // Set up book now button
        this.setupBookNowButton();
        
        console.log('Main manager initialized');
    }

    /**
     * Check authentication state and update UI
     */
    checkAuthState() {
        // Auth state is handled by auth.js
        // We just need to check if we should show/hide elements
        const isLoggedIn = auth.isAuthenticated();
        
        // Update book now button based on auth state
        const bookNowBtn = document.getElementById('bookNowBtn');
        if (bookNowBtn) {
            if (isLoggedIn) {
                bookNowBtn.textContent = 'Book Now';
                bookNowBtn.onclick = () => {
                    window.location.href = 'pages/booking.html';
                };
            } else {
                bookNowBtn.textContent = 'Login to Book';
                bookNowBtn.onclick = () => {
                    window.location.href = 'pages/login.html';
                };
            }
        }
    }

    /**
     * Set up navigation
     */
    setupNavigation() {
        // Hamburger menu toggle
        if (this.hamburger) {
            this.hamburger.addEventListener('click', () => {
                this.toggleMobileMenu();
            });
        }
        
        // Close menu on link click (mobile)
        const navLinks = document.querySelectorAll('.nav-links a');
        navLinks.forEach(link => {
            link.addEventListener('click', () => {
                if (window.innerWidth <= 768) {
                    this.closeMobileMenu();
                }
            });
        });
        
        // Close menu on outside click
        document.addEventListener('click', (e) => {
            if (this.isMenuOpen && 
                !this.navbar.contains(e.target) && 
                !this.hamburger.contains(e.target)) {
                this.closeMobileMenu();
            }
        });
        
        // Handle window resize
        window.addEventListener('resize', () => {
            if (window.innerWidth > 768 && this.isMenuOpen) {
                this.closeMobileMenu();
            }
        });
    }

    /**
     * Toggle mobile menu
     */
    toggleMobileMenu() {
        this.isMenuOpen = !this.isMenuOpen;
        
        if (this.isMenuOpen) {
            this.openMobileMenu();
        } else {
            this.closeMobileMenu();
        }
    }

    /**
     * Open mobile menu
     */
    openMobileMenu() {
        if (this.navLinks) {
            this.navLinks.classList.add('active');
        }
        if (this.hamburger) {
            this.hamburger.textContent = '✕';
            this.hamburger.style.fontSize = '1.8rem';
        }
        this.isMenuOpen = true;
        document.body.style.overflow = 'hidden';
    }

    /**
     * Close mobile menu
     */
    closeMobileMenu() {
        if (this.navLinks) {
            this.navLinks.classList.remove('active');
        }
        if (this.hamburger) {
            this.hamburger.textContent = '☰';
            this.hamburger.style.fontSize = '1.5rem';
        }
        this.isMenuOpen = false;
        document.body.style.overflow = '';
    }

    /**
     * Set up scroll effects
     */
    setupScrollEffects() {
        window.addEventListener('scroll', () => {
            this.handleScroll();
        }, { passive: true });
    }

    /**
     * Handle scroll events
     */
    handleScroll() {
        const currentScrollY = window.scrollY;
        
        // Navbar shadow and background
        if (currentScrollY > this.scrollThreshold) {
            this.navbar?.classList.add('scrolled');
        } else {
            this.navbar?.classList.remove('scrolled');
        }
        
        // Show/hide navbar on scroll (optional)
        if (currentScrollY > this.lastScrollY && currentScrollY > 200) {
            // Scrolling down - hide navbar
            // this.navbar.style.transform = 'translateY(-100%)';
        } else {
            // Scrolling up - show navbar
            // this.navbar.style.transform = 'translateY(0)';
        }
        
        this.lastScrollY = currentScrollY;
    }

    /**
     * Set up hero section
     */
    setupHero() {
        const hero = document.querySelector('.hero');
        if (!hero) return;
        
        // Parallax effect
        window.addEventListener('scroll', () => {
            const scrolled = window.scrollY;
            if (scrolled < hero.offsetHeight) {
                const rate = scrolled * 0.5;
                hero.style.backgroundPositionY = `-${rate}px`;
            }
        }, { passive: true });
    }

    /**
     * Set up smooth scrolling for anchor links
     */
    setupSmoothScroll() {
        const anchorLinks = document.querySelectorAll('a[href^="#"]');
        anchorLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                const targetId = link.getAttribute('href');
                if (targetId === '#') return;
                
                const targetElement = document.querySelector(targetId);
                if (targetElement) {
                    e.preventDefault();
                    const navHeight = this.navbar?.offsetHeight || 70;
                    const targetPosition = targetElement.getBoundingClientRect().top + window.scrollY - navHeight;
                    
                    window.scrollTo({
                        top: targetPosition,
                        behavior: 'smooth'
                    });
                }
            });
        });
    }

    /**
     * Set up animations
     */
    setupAnimations() {
        // Intersection Observer for fade-in animations
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('animate-in');
                }
            });
        }, {
            threshold: 0.1,
            rootMargin: '0px 0px -50px 0px'
        });
        
        // Observe service cards
        document.querySelectorAll('.service-card, .about-item, .stat-item, .contact-item').forEach(el => {
            observer.observe(el);
        });
        
        // Add CSS for animations
        const style = document.createElement('style');
        style.textContent = `
            .service-card, .about-item, .stat-item, .contact-item {
                opacity: 0;
                transform: translateY(30px);
                transition: all 0.6s cubic-bezier(0.4, 0, 0.2, 1);
            }
            
            .service-card.animate-in, 
            .about-item.animate-in, 
            .stat-item.animate-in, 
            .contact-item.animate-in {
                opacity: 1;
                transform: translateY(0);
            }
            
            .service-card:nth-child(2) { transition-delay: 0.1s; }
            .service-card:nth-child(3) { transition-delay: 0.2s; }
            .service-card:nth-child(4) { transition-delay: 0.3s; }
            .service-card:nth-child(5) { transition-delay: 0.4s; }
            .service-card:nth-child(6) { transition-delay: 0.5s; }
        `;
        document.head.appendChild(style);
    }

    /**
     * Set up book now button
     */
    setupBookNowButton() {
        const bookNowBtn = document.getElementById('bookNowBtn');
        if (bookNowBtn) {
            // Additional functionality if needed
            bookNowBtn.addEventListener('mouseenter', () => {
                bookNowBtn.style.transform = 'scale(1.05)';
            });
            
            bookNowBtn.addEventListener('mouseleave', () => {
                bookNowBtn.style.transform = 'scale(1)';
            });
        }
    }

    /**
     * Show notification
     */
    showNotification(message, type = 'info', duration = 5000) {
        const existing = document.querySelector('.notification');
        if (existing) {
            existing.remove();
        }
        
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.style.opacity = '0';
            notification.style.transform = 'translateX(100px)';
            setTimeout(() => {
                notification.remove();
            }, 300);
        }, duration);
    }

    /**
     * Scroll to element with offset
     */
    scrollToElement(element, offset = 70) {
        if (!element) return;
        
        const rect = element.getBoundingClientRect();
        const position = rect.top + window.scrollY - offset;
        
        window.scrollTo({
            top: position,
            behavior: 'smooth'
        });
    }
}

// Initialize main manager when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    const main = new MainManager();
});

// Add CSS for notifications
const notificationStyle = document.createElement('style');
notificationStyle.textContent = `
    .notification {
        position: fixed;
        top: 90px;
        right: 20px;
        padding: 15px 25px;
        border-radius: 8px;
        color: white;
        font-weight: 600;
        z-index: 9999;
        box-shadow: 0 4px 20px rgba(0,0,0,0.2);
        animation: slideInRight 0.5s ease;
        max-width: 400px;
        transition: all 0.3s ease;
    }
    
    .notification.success {
        background: #28a745;
    }
    
    .notification.error {
        background: #dc3545;
    }
    
    .notification.info {
        background: #17a2b8;
    }
    
    .notification.warning {
        background: #ffc107;
        color: #333;
    }
    
    @keyframes slideInRight {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes fadeInUp {
        from {
            opacity: 0;
            transform: translateY(30px);
        }
        to {
            opacity: 1;
            transform: translateY(0);
        }
    }
`;
document.head.appendChild(notificationStyle);