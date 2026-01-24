/**
 * Swipe Detector
 * Phase 1 - MVP
 * Handles touch/mouse input and calculates swipe metrics
 */

class SwipeDetector {
    constructor(canvas, onSwipeComplete) {
        this.canvas = canvas;
        this.onSwipeComplete = onSwipeComplete;

        // Swipe state
        this.isTracking = false;
        this.startX = 0;
        this.startY = 0;
        this.startTime = 0;
        this.points = [];

        // Mobile detection
        this.isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        this.isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

        // Touch tracking for multi-touch prevention
        this.activeTouchId = null;

        // Jitter filter settings
        this.jitterFilterSize = 4;  // Number of points to average
        this.jitterThreshold = 3;   // Minimum px movement to record
        this.recentPositions = [];  // Buffer for moving average

        // Bind event handlers
        this.handleStart = this.handleStart.bind(this);
        this.handleMove = this.handleMove.bind(this);
        this.handleEnd = this.handleEnd.bind(this);

        // Initialize listeners
        this.initListeners();
    }

    /**
     * Initialize event listeners for touch and mouse
     */
    initListeners() {
        // Touch events
        this.canvas.addEventListener('touchstart', this.handleStart, { passive: false });
        this.canvas.addEventListener('touchmove', this.handleMove, { passive: false });
        this.canvas.addEventListener('touchend', this.handleEnd);
        this.canvas.addEventListener('touchcancel', this.handleEnd);

        // Mouse events (for desktop testing)
        this.canvas.addEventListener('mousedown', this.handleStart);
        this.canvas.addEventListener('mousemove', this.handleMove);
        this.canvas.addEventListener('mouseup', this.handleEnd);
        this.canvas.addEventListener('mouseleave', this.handleEnd);
    }

    /**
     * Remove event listeners
     */
    destroy() {
        this.canvas.removeEventListener('touchstart', this.handleStart);
        this.canvas.removeEventListener('touchmove', this.handleMove);
        this.canvas.removeEventListener('touchend', this.handleEnd);
        this.canvas.removeEventListener('touchcancel', this.handleEnd);
        this.canvas.removeEventListener('mousedown', this.handleStart);
        this.canvas.removeEventListener('mousemove', this.handleMove);
        this.canvas.removeEventListener('mouseup', this.handleEnd);
        this.canvas.removeEventListener('mouseleave', this.handleEnd);
    }

    /**
     * Get position from event (handles both touch and mouse)
     */
    getPosition(e) {
        const rect = this.canvas.getBoundingClientRect();
        let clientX, clientY;

        if (e.touches && e.touches.length > 0) {
            clientX = e.touches[0].clientX;
            clientY = e.touches[0].clientY;
        } else if (e.changedTouches && e.changedTouches.length > 0) {
            clientX = e.changedTouches[0].clientX;
            clientY = e.changedTouches[0].clientY;
        } else {
            clientX = e.clientX;
            clientY = e.clientY;
        }

        // Scale for canvas resolution
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;

        return {
            x: (clientX - rect.left) * scaleX,
            y: (clientY - rect.top) * scaleY
        };
    }

    /**
     * Handle swipe start
     */
    handleStart(e) {
        e.preventDefault();

        // For touch events, only track the first touch
        if (e.touches) {
            // If we're already tracking a touch, ignore new touches
            if (this.activeTouchId !== null) return;
            this.activeTouchId = e.touches[0].identifier;
        }

        const pos = this.getPosition(e);

        this.isTracking = true;
        this.startX = pos.x;
        this.startY = pos.y;
        this.startTime = performance.now();
        this.points = [{ x: pos.x, y: pos.y, time: this.startTime }];

        // Reset jitter filter on new touch
        this.recentPositions = [{ x: pos.x, y: pos.y }];
    }

    /**
     * Handle swipe move
     */
    handleMove(e) {
        if (!this.isTracking) return;

        // For touch events, only track the original touch
        if (e.touches && this.activeTouchId !== null) {
            const touch = Array.from(e.touches).find(t => t.identifier === this.activeTouchId);
            if (!touch) return;
        }

        e.preventDefault();

        const rawPos = this.getPosition(e);

        // Apply jitter filter: use moving average to smooth touch input
        const filteredPos = this.applyJitterFilter(rawPos);

        // Only record point if movement exceeds jitter threshold
        if (this.points.length > 0) {
            const lastPoint = this.points[this.points.length - 1];
            const dx = filteredPos.x - lastPoint.x;
            const dy = filteredPos.y - lastPoint.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            // Skip tiny movements (jitter) but always record intentional swipes
            if (distance < this.jitterThreshold) {
                return;
            }
        }

        this.points.push({ x: filteredPos.x, y: filteredPos.y, time: performance.now() });
    }

    /**
     * Apply moving average filter to smooth out touch sensor noise
     * @param {Object} rawPos - Raw touch position {x, y}
     * @returns {Object} Filtered position {x, y}
     */
    applyJitterFilter(rawPos) {
        // Add new position to buffer
        this.recentPositions.push({ x: rawPos.x, y: rawPos.y });

        // Keep only the last N positions
        if (this.recentPositions.length > this.jitterFilterSize) {
            this.recentPositions.shift();
        }

        // Calculate moving average
        let sumX = 0, sumY = 0;
        for (const pos of this.recentPositions) {
            sumX += pos.x;
            sumY += pos.y;
        }

        return {
            x: sumX / this.recentPositions.length,
            y: sumY / this.recentPositions.length
        };
    }

    /**
     * Handle swipe end
     */
    handleEnd(e) {
        if (!this.isTracking) return;

        // For touch events, only respond to the tracked touch ending
        if (e.changedTouches && this.activeTouchId !== null) {
            const touch = Array.from(e.changedTouches).find(t => t.identifier === this.activeTouchId);
            if (!touch) return;
        }

        this.isTracking = false;
        this.activeTouchId = null;

        const pos = this.getPosition(e);
        const endTime = performance.now();

        // Add final point
        this.points.push({ x: pos.x, y: pos.y, time: endTime });

        // Calculate swipe metrics
        const swipeData = this.analyzeSwipe();

        // Call callback if swipe is valid
        if (swipeData && swipeData.isValid) {
            this.onSwipeComplete(swipeData);
        }
    }

    /**
     * Analyze the swipe and return metrics
     */
    analyzeSwipe() {
        if (this.points.length < 2) return null;

        const startPoint = this.points[0];
        const endPoint = this.points[this.points.length - 1];

        // Calculate total length (straight line)
        const dx = endPoint.x - startPoint.x;
        const dy = endPoint.y - startPoint.y;
        const straightLength = Math.sqrt(dx * dx + dy * dy);

        // Calculate actual path length (sum of segments)
        let pathLength = 0;
        for (let i = 1; i < this.points.length; i++) {
            const segDx = this.points[i].x - this.points[i - 1].x;
            const segDy = this.points[i].y - this.points[i - 1].y;
            pathLength += Math.sqrt(segDx * segDx + segDy * segDy);
        }

        // Calculate duration
        const duration = endPoint.time - startPoint.time;

        // Check if swipe is long enough
        if (pathLength < CONFIG.PHYSICS.MIN_SWIPE_LENGTH * 0.5) {
            return { isValid: false, reason: 'Swipe too short' };
        }

        // Calculate speed (pixels per second)
        const speed = (pathLength / duration) * 1000;

        // Calculate straightness (how much the path deviates from straight line)
        // 0 = perfectly straight, higher = more curved
        const straightness = this.calculateStraightness();

        // Calculate horizontal deviation (for left/right error)
        const horizontalDeviation = endPoint.x - startPoint.x;

        // Determine direction (should be mostly upward for a throw)
        const angle = Math.atan2(-dy, dx) * (180 / Math.PI); // Negative dy because y increases downward
        const isUpwardSwipe = dy < 0; // y decreases = upward

        return {
            isValid: true,
            startX: startPoint.x,
            startY: startPoint.y,
            endX: endPoint.x,
            endY: endPoint.y,
            length: pathLength,
            straightLength,
            duration,
            speed,
            straightness,
            horizontalDeviation,
            angle,
            isUpwardSwipe,
            points: this.points
        };
    }

    /**
     * Calculate how straight the swipe was
     * Returns average perpendicular distance from the straight line
     */
    calculateStraightness() {
        if (this.points.length < 3) return 0;

        const startPoint = this.points[0];
        const endPoint = this.points[this.points.length - 1];

        // Line from start to end
        const lineLength = Math.sqrt(
            Math.pow(endPoint.x - startPoint.x, 2) +
            Math.pow(endPoint.y - startPoint.y, 2)
        );

        if (lineLength < 1) return 0;

        // Calculate perpendicular distance for each point
        let totalDeviation = 0;

        for (let i = 1; i < this.points.length - 1; i++) {
            const point = this.points[i];

            // Calculate perpendicular distance from point to line
            const dist = Math.abs(
                (endPoint.y - startPoint.y) * point.x -
                (endPoint.x - startPoint.x) * point.y +
                endPoint.x * startPoint.y -
                endPoint.y * startPoint.x
            ) / lineLength;

            totalDeviation += dist;
        }

        // Return average deviation
        return totalDeviation / (this.points.length - 2);
    }

    /**
     * Get normalized swipe values (0-1 range for physics calculation)
     */
    static normalizeSwipe(swipeData) {
        const physics = CONFIG.PHYSICS;

        // Normalize speed (0-1)
        const speedNorm = Math.max(0, Math.min(1,
            (swipeData.speed - physics.MIN_SWIPE_SPEED) /
            (physics.MAX_SWIPE_SPEED - physics.MIN_SWIPE_SPEED)
        ));

        // Normalize length (0-1)
        const lengthNorm = Math.max(0, Math.min(1,
            (swipeData.length - physics.MIN_SWIPE_LENGTH) /
            (physics.MAX_SWIPE_LENGTH - physics.MIN_SWIPE_LENGTH)
        ));

        // Normalize straightness (0 = perfect, 1 = very curved)
        // Higher values = more error
        const straightnessNorm = Math.min(1, swipeData.straightness / 50);

        return {
            speed: speedNorm,
            length: lengthNorm,
            straightness: straightnessNorm,
            horizontalDeviation: swipeData.horizontalDeviation
        };
    }
}

// Export for module use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SwipeDetector;
}
