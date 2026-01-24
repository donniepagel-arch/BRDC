/**
 * Physics Engine
 * Phase 1 - MVP
 * Converts swipe data to dart landing position
 */

class Physics {
    constructor(dartboard) {
        this.dartboard = dartboard;
        this.centerX = CONFIG.CANVAS.BOARD_CENTER_X;
        this.centerY = CONFIG.CANVAS.BOARD_CENTER_Y;
    }

    /**
     * Calculate where a dart lands based on swipe data and target
     * @param {Object} swipeData - Raw swipe data from SwipeDetector
     * @param {Object} target - Target position { x, y }
     * @param {Object} baseline - Player's baseline (optional, for calibration)
     * @returns {Object} Landing position and hit info
     */
    calculateThrow(swipeData, target, baseline = null) {
        // Normalize swipe values
        const normalized = SwipeDetector.normalizeSwipe(swipeData);
        const difficulty = getDifficulty();

        // Calculate errors based on swipe quality
        const errors = this.calculateErrors(normalized, difficulty, baseline);

        // Apply errors to target position
        const landingX = target.x + errors.horizontal;
        const landingY = target.y + errors.vertical;

        // Calculate what was hit
        const hit = this.dartboard.calculateHit(landingX, landingY);

        return {
            x: landingX,
            y: landingY,
            hit,
            errors,
            swipeQuality: this.calculateSwipeQuality(normalized)
        };
    }

    /**
     * Calculate errors based on swipe quality and difficulty
     */
    calculateErrors(normalized, difficulty, baseline) {
        // Speed error: too fast or too slow = more error
        // Optimal speed is around 0.5-0.7 normalized
        const optimalSpeed = 0.6;
        const speedDeviation = Math.abs(normalized.speed - optimalSpeed);
        const speedError = speedDeviation / difficulty.speedTolerance;

        // Length error: affects vertical position
        // Short swipe (< 0.5) = dart goes HIGH (negative Y error)
        // Long swipe (> 0.5) = dart goes LOW (positive Y error)
        const optimalLength = 0.5;
        const lengthDeviation = normalized.length - optimalLength;
        const verticalError = (lengthDeviation / difficulty.releaseTolerance) * CONFIG.PHYSICS.RELEASE_ERROR_SCALE;

        // Straightness error: affects horizontal position
        // Deviation to the right (positive) = dart goes right
        // Deviation to the left (negative) = dart goes left
        const horizontalError = (normalized.horizontalDeviation * CONFIG.PHYSICS.STRAIGHTNESS_PENALTY) / difficulty.straightnessTolerance;

        // Random error based on difficulty
        const randomX = (Math.random() - 0.5) * 2 * difficulty.randomError;
        const randomY = (Math.random() - 0.5) * 2 * difficulty.randomError;

        // Apply baseline correction if available
        let baselineCorrection = { x: 0, y: 0 };
        if (baseline) {
            // Adjust for player's natural drift
            baselineCorrection.x = baseline.naturalDrift || 0;
            baselineCorrection.y = baseline.verticalBias || 0;
        }

        // Combine all errors
        const totalHorizontal = horizontalError + randomX - baselineCorrection.x;
        const totalVertical = verticalError + randomY - baselineCorrection.y;

        // Add speed-based scatter (poor speed = more random scatter)
        const speedScatter = speedError * difficulty.randomError;
        const scatterX = (Math.random() - 0.5) * speedScatter;
        const scatterY = (Math.random() - 0.5) * speedScatter;

        return {
            horizontal: totalHorizontal + scatterX,
            vertical: totalVertical + scatterY,
            speedError,
            lengthError: Math.abs(lengthDeviation),
            straightnessError: normalized.straightness
        };
    }

    /**
     * Calculate overall swipe quality (0-100)
     */
    calculateSwipeQuality(normalized) {
        // Ideal values
        const idealSpeed = 0.6;
        const idealLength = 0.5;

        // Calculate how close to ideal
        const speedScore = 1 - Math.min(1, Math.abs(normalized.speed - idealSpeed) * 2);
        const lengthScore = 1 - Math.min(1, Math.abs(normalized.length - idealLength) * 2);
        const straightScore = 1 - Math.min(1, normalized.straightness);

        // Weight the scores
        const quality = (speedScore * 0.3 + lengthScore * 0.35 + straightScore * 0.35) * 100;

        return Math.round(quality);
    }

    /**
     * Calculate trajectory animation points
     * @param {Object} startPos - Starting position of throw
     * @param {Object} endPos - Landing position
     * @param {number} frames - Number of animation frames
     */
    calculateTrajectory(startPos, endPos, frames = 30) {
        const points = [];
        const dx = endPos.x - startPos.x;
        const dy = endPos.y - startPos.y;

        // Arc height (higher for longer throws)
        const distance = Math.sqrt(dx * dx + dy * dy);
        const arcHeight = Math.min(150, distance * 0.3);

        for (let i = 0; i <= frames; i++) {
            const t = i / frames;

            // Ease-out for deceleration
            const easeT = 1 - Math.pow(1 - t, 2);

            // Linear interpolation for x
            const x = startPos.x + dx * easeT;

            // Parabolic arc for y
            // Arc peaks at t=0.5
            const arcOffset = -4 * arcHeight * t * (1 - t);
            const y = startPos.y + dy * easeT + arcOffset;

            points.push({ x, y, t: easeT });
        }

        return points;
    }

    /**
     * Simulate a throw without user input (for AI/demo)
     * @param {Object} target - Target position
     * @param {number} skill - Skill level 0-100
     */
    simulateThrow(target, skill = 50) {
        // Convert skill to error range
        const errorRange = (100 - skill) * 1.5; // 0 skill = 150px error, 100 skill = 0 error

        // Random errors based on skill
        const errorX = (Math.random() - 0.5) * 2 * errorRange;
        const errorY = (Math.random() - 0.5) * 2 * errorRange;

        const landingX = target.x + errorX;
        const landingY = target.y + errorY;

        const hit = this.dartboard.calculateHit(landingX, landingY);

        return {
            x: landingX,
            y: landingY,
            hit
        };
    }

    /**
     * Calculate the probability of hitting a target based on difficulty
     * Used for showing expected accuracy to the player
     */
    calculateHitProbability(target, ring) {
        const difficulty = getDifficulty();

        // Ring sizes (approximate in pixels)
        const ringSizes = {
            'double-bull': CONFIG.BOARD.BULL_INNER * 2,
            'single-bull': (CONFIG.BOARD.BULL_OUTER - CONFIG.BOARD.BULL_INNER) * 2,
            'treble': (CONFIG.BOARD.TREBLE_OUTER - CONFIG.BOARD.TREBLE_INNER),
            'double': (CONFIG.BOARD.DOUBLE_OUTER - CONFIG.BOARD.DOUBLE_INNER),
            'single': (CONFIG.BOARD.DOUBLE_INNER - CONFIG.BOARD.TREBLE_OUTER)
        };

        const ringSize = ringSizes[ring] || 50;

        // Expected error based on difficulty
        const expectedError = difficulty.randomError * 2;

        // Simple probability model
        // Higher ring size relative to error = higher probability
        const probability = Math.min(95, (ringSize / expectedError) * 30);

        return Math.round(probability);
    }

    /**
     * Get adjacent segments for miss analysis
     */
    getAdjacentSegments(segment) {
        const segments = CONFIG.SEGMENTS;
        const index = segments.indexOf(segment);

        if (index === -1) return { left: null, right: null };

        const leftIndex = (index - 1 + 20) % 20;
        const rightIndex = (index + 1) % 20;

        return {
            left: segments[leftIndex],
            right: segments[rightIndex]
        };
    }

    /**
     * Analyze a miss and provide feedback
     */
    analyzeMiss(intended, actual) {
        const feedback = {
            horizontalMiss: '',
            verticalMiss: '',
            suggestion: ''
        };

        const dx = actual.x - intended.x;
        const dy = actual.y - intended.y;

        // Horizontal analysis
        if (Math.abs(dx) > 20) {
            feedback.horizontalMiss = dx > 0 ? 'right' : 'left';
            feedback.suggestion = dx > 0
                ? 'Try keeping your swipe straighter - you drifted right'
                : 'Try keeping your swipe straighter - you drifted left';
        }

        // Vertical analysis
        if (Math.abs(dy) > 20) {
            feedback.verticalMiss = dy > 0 ? 'low' : 'high';
            if (dy > 0) {
                feedback.suggestion += feedback.suggestion ? '. Also, ' : '';
                feedback.suggestion += 'Your swipe was too long - try a shorter release for higher throws';
            } else {
                feedback.suggestion += feedback.suggestion ? '. Also, ' : '';
                feedback.suggestion += 'Your swipe was too short - try a longer release for lower throws';
            }
        }

        return feedback;
    }
}

// Export for module use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Physics;
}
