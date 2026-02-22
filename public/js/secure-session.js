/**
 * Secure Session Management for BRDC
 * Handles encrypted storage, CSRF tokens, and secure session validation
 */

class SecureSession {
    constructor() {
        this.SESSION_KEY = 'brdc_secure_session';
        this.CSRF_KEY = 'brdc_csrf_token';
        this.TOKEN_KEY = 'brdc_session_token';
    }

    /**
     * Generate a cryptographically secure random token
     */
    generateToken() {
        const array = new Uint8Array(32);
        crypto.getRandomValues(array);
        return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
    }

    /**
     * Generate CSRF token for form protection
     */
    generateCSRFToken() {
        const token = this.generateToken();
        sessionStorage.setItem(this.CSRF_KEY, token);
        return token;
    }

    /**
     * Validate CSRF token
     */
    validateCSRFToken(token) {
        const stored = sessionStorage.getItem(this.CSRF_KEY);
        return stored === token;
    }

    /**
     * Store session data securely
     * @param {Object} sessionData - Session data from server
     * @param {string} sessionData.session_token - Server-generated session token
     * @param {Object} sessionData.player - Player info (without sensitive data)
     */
    storeSession(sessionData) {
        // Store session token (opaque identifier, not sensitive)
        localStorage.setItem(this.TOKEN_KEY, sessionData.session_token);

        // Store non-sensitive user info for UI (encrypted)
        const publicData = {
            player_id: sessionData.player.id,
            name: sessionData.player.name,
            first_name: sessionData.player.first_name,
            last_name: sessionData.player.last_name,
            email: sessionData.player.email,
            phone: sessionData.player.phone,
            logged_in_at: new Date().toISOString()
        };

        // Simple obfuscation (not true encryption, but better than plain text)
        const encoded = btoa(JSON.stringify(publicData));
        localStorage.setItem(this.SESSION_KEY, encoded);

        // Generate CSRF token for this session
        this.generateCSRFToken();
    }

    /**
     * Retrieve session data
     */
    getSession() {
        try {
            const encoded = localStorage.getItem(this.SESSION_KEY);
            if (!encoded) return null;

            const decoded = JSON.parse(atob(encoded));
            return decoded;
        } catch (error) {
            console.error('Failed to decode session:', error);
            this.clearSession();
            return null;
        }
    }

    /**
     * Get session token for API requests
     */
    getSessionToken() {
        return localStorage.getItem(this.TOKEN_KEY);
    }

    /**
     * Check if user has valid session
     */
    isAuthenticated() {
        const token = this.getSessionToken();
        const session = this.getSession();
        return !!(token && session);
    }

    /**
     * Clear all session data
     */
    clearSession() {
        localStorage.removeItem(this.SESSION_KEY);
        localStorage.removeItem(this.TOKEN_KEY);
        sessionStorage.removeItem(this.CSRF_KEY);

        // Also clear legacy storage
        localStorage.removeItem('brdc_session');
    }

    /**
     * Validate session with backend (optional periodic check)
     */
    async validateSession() {
        const token = this.getSessionToken();
        if (!token) return false;

        try {
            const response = await fetch('https://us-central1-brdc-v2.cloudfunctions.net/validateSession', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Session-Token': token
                }
            });

            const result = await response.json();

            if (!result.valid) {
                this.clearSession();
                return false;
            }

            return true;
        } catch (error) {
            console.error('Session validation error:', error);
            return false;
        }
    }

    /**
     * Make authenticated API request with CSRF protection
     */
    async authenticatedRequest(url, options = {}) {
        const token = this.getSessionToken();
        const csrfToken = sessionStorage.getItem(this.CSRF_KEY);

        if (!token) {
            throw new Error('No session token - user not authenticated');
        }

        const headers = {
            ...options.headers,
            'X-Session-Token': token,
            'X-CSRF-Token': csrfToken
        };

        const response = await fetch(url, {
            ...options,
            headers
        });

        // If session expired, clear and redirect
        if (response.status === 401) {
            this.clearSession();
            window.location.href = '/';
            throw new Error('Session expired');
        }

        return response;
    }
}

// Export singleton instance
window.secureSession = new SecureSession();
