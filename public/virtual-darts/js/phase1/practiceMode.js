/**
 * Practice Mode
 * Phase 1 - MVP
 * Calibration system to establish player's throw baseline
 */

class PracticeMode {
    constructor(dartboard, physics, onComplete) {
        this.dartboard = dartboard;
        this.physics = physics;
        this.onComplete = onComplete;

        // Practice state
        this.throws = [];
        this.throwsRequired = CONFIG.PRACTICE.THROWS_REQUIRED;
        this.isActive = false;

        // Target for practice (center of board initially)
        this.target = {
            x: CONFIG.CANVAS.BOARD_CENTER_X,
            y: CONFIG.CANVAS.BOARD_CENTER_Y
        };
    }

    /**
     * Start practice mode
     */
    start() {
        this.isActive = true;
        this.throws = [];
        this.dartboard.clearDarts();
        this.updateUI();
    }

    /**
     * Stop practice mode
     */
    stop() {
        this.isActive = false;
    }

    /**
     * Record a throw
     * @param {Object} swipeData - Data from swipe detector
     * @param {Object} landing - Landing position { x, y }
     */
    recordThrow(swipeData, landing) {
        if (!this.isActive) return;

        const throwData = {
            swipe: {
                speed: swipeData.speed,
                length: swipeData.length,
                straightness: swipeData.straightness,
                horizontalDeviation: swipeData.horizontalDeviation,
                duration: swipeData.duration
            },
            landing: {
                x: landing.x,
                y: landing.y
            },
            hit: this.dartboard.calculateHit(landing.x, landing.y),
            timestamp: Date.now()
        };

        this.throws.push(throwData);

        // Add dart to board
        this.dartboard.addDart(landing.x, landing.y);

        // Update UI
        this.updateUI();

        // Check if practice is complete
        if (this.throws.length >= this.throwsRequired) {
            this.complete();
        }
    }

    /**
     * Update the practice UI
     */
    updateUI() {
        const progressEl = document.getElementById('practiceProgress');
        const countEl = document.getElementById('practiceCount');

        if (progressEl) {
            const progress = (this.throws.length / this.throwsRequired) * 100;
            progressEl.style.width = `${progress}%`;
        }

        if (countEl) {
            countEl.textContent = `${this.throws.length} / ${this.throwsRequired}`;
        }
    }

    /**
     * Complete practice mode and analyze results
     */
    complete() {
        this.isActive = false;

        // Analyze throws to create baseline
        const baseline = this.analyzeThrows();

        // Call completion callback
        if (this.onComplete) {
            this.onComplete(baseline);
        }

        return baseline;
    }

    /**
     * Analyze all throws and create player baseline
     */
    analyzeThrows() {
        if (this.throws.length === 0) {
            return this.getDefaultBaseline();
        }

        // Extract landing points
        const landingPoints = this.throws.map(t => t.landing);

        // Calculate centroid (average landing position)
        const centroid = this.calculateCentroid(landingPoints);

        // Calculate grouping radius (standard deviation from centroid)
        const groupingRadius = this.calculateGroupingRadius(landingPoints, centroid);

        // Calculate natural drift (offset from target)
        const naturalDrift = centroid.x - this.target.x;
        const verticalBias = centroid.y - this.target.y;

        // Analyze swipe patterns
        const swipeAnalysis = this.analyzeSwipes();

        // Calculate consistency score (0-100)
        const consistency = this.calculateConsistency(groupingRadius);

        // Identify strengths and weaknesses
        const analysis = this.identifyStrengthsWeaknesses(swipeAnalysis, groupingRadius, naturalDrift, verticalBias);

        const baseline = {
            // Core metrics
            avgSpeed: swipeAnalysis.avgSpeed,
            avgLength: swipeAnalysis.avgLength,
            avgStraightness: swipeAnalysis.avgStraightness,

            // Drift and bias
            naturalDrift,
            verticalBias,

            // Grouping
            groupingRadius,
            centroid,
            consistency,

            // Speed consistency
            speedVariance: swipeAnalysis.speedVariance,

            // Analysis
            analysis,

            // Recommendations
            recommendations: this.generateRecommendations(analysis),

            // Raw data for reference
            throwCount: this.throws.length,
            timestamp: Date.now()
        };

        return baseline;
    }

    /**
     * Calculate centroid of landing points
     */
    calculateCentroid(points) {
        const sumX = points.reduce((sum, p) => sum + p.x, 0);
        const sumY = points.reduce((sum, p) => sum + p.y, 0);

        return {
            x: sumX / points.length,
            y: sumY / points.length
        };
    }

    /**
     * Calculate standard deviation from centroid (grouping radius)
     */
    calculateGroupingRadius(points, centroid) {
        const squaredDistances = points.map(p => {
            const dx = p.x - centroid.x;
            const dy = p.y - centroid.y;
            return dx * dx + dy * dy;
        });

        const avgSquaredDist = squaredDistances.reduce((sum, d) => sum + d, 0) / points.length;
        return Math.sqrt(avgSquaredDist);
    }

    /**
     * Analyze swipe patterns
     */
    analyzeSwipes() {
        const speeds = this.throws.map(t => t.swipe.speed);
        const lengths = this.throws.map(t => t.swipe.length);
        const straightnesses = this.throws.map(t => t.swipe.straightness);

        const avgSpeed = speeds.reduce((a, b) => a + b, 0) / speeds.length;
        const avgLength = lengths.reduce((a, b) => a + b, 0) / lengths.length;
        const avgStraightness = straightnesses.reduce((a, b) => a + b, 0) / straightnesses.length;

        // Calculate variance
        const speedVariance = this.calculateVariance(speeds, avgSpeed);
        const lengthVariance = this.calculateVariance(lengths, avgLength);

        return {
            avgSpeed,
            avgLength,
            avgStraightness,
            speedVariance,
            lengthVariance
        };
    }

    /**
     * Calculate variance
     */
    calculateVariance(values, mean) {
        const squaredDiffs = values.map(v => Math.pow(v - mean, 2));
        return Math.sqrt(squaredDiffs.reduce((a, b) => a + b, 0) / values.length);
    }

    /**
     * Calculate consistency score (0-100)
     */
    calculateConsistency(groupingRadius) {
        // Smaller grouping radius = higher consistency
        // Excellent: < 30px, Poor: > 100px
        const maxRadius = 100;
        const score = Math.max(0, 100 - (groupingRadius / maxRadius) * 100);
        return Math.round(score);
    }

    /**
     * Identify strengths and weaknesses
     */
    identifyStrengthsWeaknesses(swipeAnalysis, groupingRadius, drift, verticalBias) {
        const analysis = {
            strengths: [],
            weaknesses: [],
            tendencies: []
        };

        // Grouping analysis
        if (groupingRadius < 30) {
            analysis.strengths.push('Excellent grouping - your throws are very consistent');
        } else if (groupingRadius < 50) {
            analysis.strengths.push('Good grouping - decent consistency');
        } else if (groupingRadius > 80) {
            analysis.weaknesses.push('Wide grouping - work on consistency');
        }

        // Drift analysis
        if (Math.abs(drift) > 30) {
            analysis.tendencies.push(drift > 0
                ? 'You tend to drift RIGHT of your target'
                : 'You tend to drift LEFT of your target');
        }

        // Vertical bias analysis
        if (Math.abs(verticalBias) > 30) {
            analysis.tendencies.push(verticalBias > 0
                ? 'You tend to throw LOW (try shorter swipes)'
                : 'You tend to throw HIGH (try longer swipes)');
        }

        // Speed consistency
        if (swipeAnalysis.speedVariance < 200) {
            analysis.strengths.push('Consistent speed - your swipe power is steady');
        } else if (swipeAnalysis.speedVariance > 400) {
            analysis.weaknesses.push('Inconsistent speed - try to maintain steady power');
        }

        // Straightness
        if (swipeAnalysis.avgStraightness < 10) {
            analysis.strengths.push('Straight swipes - good lateral control');
        } else if (swipeAnalysis.avgStraightness > 25) {
            analysis.weaknesses.push('Curved swipes - work on keeping swipes straighter');
        }

        return analysis;
    }

    /**
     * Generate recommendations based on analysis
     */
    generateRecommendations(analysis) {
        const recommendations = [];

        // Add recommendations based on weaknesses
        for (const weakness of analysis.weaknesses) {
            if (weakness.includes('grouping')) {
                recommendations.push({
                    priority: 'high',
                    text: 'Focus on repeating the same swipe motion each time',
                    drill: 'Try 10 throws aiming at the same spot, ignoring where they land'
                });
            }
            if (weakness.includes('speed')) {
                recommendations.push({
                    priority: 'medium',
                    text: 'Practice with a metronome rhythm to your throws',
                    drill: 'Count "1-2-throw" at a steady pace for 20 throws'
                });
            }
            if (weakness.includes('swipes')) {
                recommendations.push({
                    priority: 'medium',
                    text: 'Keep your swipe in a straight line toward the target',
                    drill: 'Imagine a laser from your finger to the target'
                });
            }
        }

        // Add recommendations based on tendencies
        for (const tendency of analysis.tendencies) {
            if (tendency.includes('RIGHT')) {
                recommendations.push({
                    priority: 'medium',
                    text: 'The game will compensate for your rightward drift',
                    note: 'Just throw naturally - your baseline is saved'
                });
            }
            if (tendency.includes('LEFT')) {
                recommendations.push({
                    priority: 'medium',
                    text: 'The game will compensate for your leftward drift',
                    note: 'Just throw naturally - your baseline is saved'
                });
            }
            if (tendency.includes('LOW')) {
                recommendations.push({
                    priority: 'low',
                    text: 'Try releasing slightly earlier (shorter swipe) for height',
                    note: 'Or just let the game compensate'
                });
            }
            if (tendency.includes('HIGH')) {
                recommendations.push({
                    priority: 'low',
                    text: 'Try releasing slightly later (longer swipe) to lower throws',
                    note: 'Or just let the game compensate'
                });
            }
        }

        // If no specific recommendations, add general tips
        if (recommendations.length === 0) {
            recommendations.push({
                priority: 'low',
                text: 'Great baseline! Just keep throwing naturally',
                note: 'Your profile has been saved'
            });
        }

        return recommendations;
    }

    /**
     * Get default baseline for new players
     */
    getDefaultBaseline() {
        return {
            avgSpeed: 1500,
            avgLength: 250,
            avgStraightness: 15,
            naturalDrift: 0,
            verticalBias: 0,
            groupingRadius: 50,
            centroid: { x: this.target.x, y: this.target.y },
            consistency: 50,
            speedVariance: 300,
            analysis: {
                strengths: [],
                weaknesses: [],
                tendencies: []
            },
            recommendations: [{
                priority: 'medium',
                text: 'Complete practice mode to calibrate your throws',
                note: 'This will improve accuracy'
            }],
            throwCount: 0,
            timestamp: Date.now()
        };
    }

    /**
     * Get current practice status
     */
    getStatus() {
        return {
            isActive: this.isActive,
            throwCount: this.throws.length,
            throwsRequired: this.throwsRequired,
            progress: (this.throws.length / this.throwsRequired) * 100
        };
    }

    /**
     * Reset practice mode
     */
    reset() {
        this.throws = [];
        this.isActive = false;
        this.dartboard.clearDarts();
        this.updateUI();
    }
}

// Export for module use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PracticeMode;
}
