/**
 * Haptic Feedback Manager
 * Provides vibration feedback for dart throws and game events
 */

class HapticManager {
    constructor() {
        // Load enabled state from localStorage
        const saved = localStorage.getItem('brdc-haptic-enabled');
        this.enabled = saved !== null ? JSON.parse(saved) : true; // Default enabled

        // Check if vibration API is supported
        this.supported = 'vibrate' in navigator;
    }

    /**
     * Enable haptic feedback
     */
    enable() {
        this.enabled = true;
        localStorage.setItem('brdc-haptic-enabled', 'true');
    }

    /**
     * Disable haptic feedback
     */
    disable() {
        this.enabled = false;
        localStorage.setItem('brdc-haptic-enabled', 'false');
    }

    /**
     * Toggle haptic feedback on/off
     * @returns {boolean} New enabled state
     */
    toggle() {
        if (this.enabled) {
            this.disable();
        } else {
            this.enable();
        }
        return this.enabled;
    }

    /**
     * Check if haptic feedback is enabled
     * @returns {boolean}
     */
    isEnabled() {
        return this.enabled && this.supported;
    }

    /**
     * Trigger a haptic pattern
     * @param {string} pattern - Pattern name ('light', 'medium', 'heavy', 'double', 'triple')
     */
    vibrate(pattern = 'medium') {
        if (!this.isEnabled()) return;

        const patterns = {
            light: 10,
            medium: 30,
            heavy: 50,
            double: [30, 50, 30],
            triple: [30, 50, 30, 50, 30],
            success: [50, 100, 50],
            error: [100, 50, 100]
        };

        const vibratePattern = patterns[pattern] || patterns.medium;
        navigator.vibrate(vibratePattern);
    }

    /**
     * Haptic feedback for dart throw
     */
    dartThrow() {
        this.vibrate('light');
    }

    /**
     * Haptic feedback for dart hit
     */
    dartHit() {
        this.vibrate('medium');
    }

    /**
     * Haptic feedback for double/treble hit
     */
    specialHit() {
        this.vibrate('heavy');
    }

    /**
     * Haptic feedback for checkout
     */
    checkout() {
        this.vibrate('success');
    }

    /**
     * Haptic feedback for 180
     */
    oneEighty() {
        this.vibrate('triple');
    }

    /**
     * Haptic feedback for bust
     */
    bust() {
        this.vibrate('error');
    }
}

// Export for module use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = HapticManager;
}
