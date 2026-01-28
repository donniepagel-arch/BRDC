/**
 * CORS Utility for Firebase Cloud Functions
 * Centralized CORS configuration for security
 */

// Allowed origins - add your production domains here
const ALLOWED_ORIGINS = [
    'https://brdc-v2.web.app',
    'https://brdc-v2.firebaseapp.com',
    'https://burningriverdarts.com',
    'https://www.burningriverdarts.com',
    'http://localhost:5000',
    'http://localhost:3000',
    'http://127.0.0.1:5000'
];

/**
 * Set CORS headers on response
 * @param {Object} res - Express response object
 * @param {Object} req - Express request object (optional, for origin checking)
 */
function setCorsHeaders(res, req = null) {
    // Check if request origin is in allowed list
    const origin = req?.headers?.origin;

    if (origin && ALLOWED_ORIGINS.includes(origin)) {
        res.set('Access-Control-Allow-Origin', origin);
    } else {
        // Default to the main production domain
        res.set('Access-Control-Allow-Origin', 'https://brdc-v2.web.app');
    }

    res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.set('Access-Control-Max-Age', '3600');
}

/**
 * CORS middleware for handling OPTIONS preflight
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {boolean} - True if request was an OPTIONS preflight (handled)
 */
function handleCors(req, res) {
    setCorsHeaders(res, req);

    if (req.method === 'OPTIONS') {
        res.status(204).send('');
        return true;
    }

    return false;
}

module.exports = {
    setCorsHeaders,
    handleCors,
    ALLOWED_ORIGINS
};
