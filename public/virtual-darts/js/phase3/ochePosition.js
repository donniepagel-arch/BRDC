/**
 * Oche Position System
 * Phase 3 - Advanced Features
 * Allows player to throw from different positions along the oche
 */

class OchePosition {
    constructor() {
        // Oche dimensions (in game units - feet converted to relative scale)
        this.ocheWidth = 200;      // Width of throwing area (px)
        this.baseDistance = 400;    // Base distance to board (px, represents 7'9.25")

        // Current position (0 = center, negative = left, positive = right)
        this.position = 0;

        // Position limits
        this.minPosition = -this.ocheWidth / 2;
        this.maxPosition = this.ocheWidth / 2;

        // Physics adjustments
        this.distancePenalty = 0.005;  // Penalty per pixel of offset (affects required power)
        this.anglePenalty = 0.003;     // Angle error magnification
    }

    /**
     * Set position along the oche
     * @param {number} position - Position in pixels from center (-100 to 100)
     */
    setPosition(position) {
        this.position = Math.max(this.minPosition, Math.min(this.maxPosition, position));
    }

    /**
     * Get current position
     */
    getPosition() {
        return this.position;
    }

    /**
     * Get normalized position (-1 to 1)
     */
    getNormalizedPosition() {
        return this.position / (this.ocheWidth / 2);
    }

    /**
     * Calculate actual distance to board center based on position
     * Uses Pythagorean theorem
     */
    getDistanceToBoard() {
        // Distance = sqrt(baseDistance^2 + position^2)
        return Math.sqrt(this.baseDistance * this.baseDistance + this.position * this.position);
    }

    /**
     * Get distance factor (multiplier for throw power)
     */
    getDistanceFactor() {
        const actualDistance = this.getDistanceToBoard();
        return actualDistance / this.baseDistance;
    }

    /**
     * Calculate angle to board center
     * Returns angle in radians (0 = straight, positive = aiming right)
     */
    getAngleToCenter() {
        return Math.atan2(-this.position, this.baseDistance);
    }

    /**
     * Calculate physics adjustments for throw from current position
     * @returns {Object} Adjustments to apply to throw calculations
     */
    getThrowAdjustments() {
        const distanceFactor = this.getDistanceFactor();
        const angle = this.getAngleToCenter();
        const normalizedPos = this.getNormalizedPosition();

        return {
            // Power multiplier - further distance needs more power
            powerMultiplier: distanceFactor,

            // Angle adjustment - throws need to angle toward board
            angleAdjustment: angle,

            // Error magnification - off-center increases error
            errorMultiplier: 1 + Math.abs(normalizedPos) * this.anglePenalty * 10,

            // Horizontal bias - throws from left tend to drift right and vice versa
            horizontalBias: -this.position * 0.1,

            // Current position data
            position: this.position,
            normalizedPosition: normalizedPos,
            distance: this.getDistanceToBoard()
        };
    }

    /**
     * Apply position adjustments to a throw result
     */
    applyAdjustments(throwResult, swipeData) {
        const adjustments = this.getThrowAdjustments();

        // Adjust landing position based on angle
        const angleOffset = Math.tan(adjustments.angleAdjustment) * 50;

        // Apply horizontal bias
        const biasedX = throwResult.x + adjustments.horizontalBias + angleOffset;

        // Apply error magnification
        const centerX = CONFIG.CANVAS.BOARD_CENTER_X;
        const centerY = CONFIG.CANVAS.BOARD_CENTER_Y;

        const dx = throwResult.x - centerX;
        const dy = throwResult.y - centerY;

        const magnifiedDx = dx * adjustments.errorMultiplier;
        const magnifiedDy = dy * adjustments.errorMultiplier;

        return {
            x: centerX + magnifiedDx + adjustments.horizontalBias,
            y: centerY + magnifiedDy,
            adjustments
        };
    }

    /**
     * Get suggested target adjustment for current position
     * When throwing from the side, you may want to aim at different targets
     */
    getSuggestedTargetAdjustment(targetSegment, targetRing) {
        const normalizedPos = this.getNormalizedPosition();

        if (Math.abs(normalizedPos) < 0.2) {
            // Close to center - no adjustment needed
            return null;
        }

        // Suggest aiming slightly to compensate for angle
        const adjustment = {
            horizontal: -this.position * 0.15, // Aim opposite to position
            reason: normalizedPos > 0
                ? 'Throwing from right - aim slightly left of target'
                : 'Throwing from left - aim slightly right of target'
        };

        return adjustment;
    }

    /**
     * Get advantages/disadvantages of current position
     */
    getPositionAnalysis() {
        const normalizedPos = this.getNormalizedPosition();
        const analysis = {
            advantages: [],
            disadvantages: [],
            tips: []
        };

        if (Math.abs(normalizedPos) < 0.1) {
            analysis.advantages.push('Optimal center position');
            analysis.advantages.push('Shortest distance to board');
            return analysis;
        }

        // Disadvantages of off-center
        const extraDistance = this.getDistanceToBoard() - this.baseDistance;
        analysis.disadvantages.push(`${extraDistance.toFixed(1)}px further from board`);
        analysis.disadvantages.push('Requires more power');
        analysis.disadvantages.push('Angle magnifies aiming errors');

        // Potential advantages
        if (normalizedPos > 0) {
            // Throwing from right
            analysis.advantages.push('Better angle to left side of board');
            analysis.advantages.push('Can avoid darts in T20 area');
            analysis.tips.push('Consider D16 if T20 is crowded');
        } else {
            // Throwing from left
            analysis.advantages.push('Better angle to right side of board');
            analysis.advantages.push('Easier to hit D20 area');
            analysis.tips.push('Good for finishing on tops');
        }

        return analysis;
    }

    /**
     * Draw oche position indicator
     */
    drawPositionIndicator(ctx, canvasWidth, canvasHeight) {
        const ocheY = canvasHeight - 50;
        const ocheStartX = (canvasWidth - this.ocheWidth) / 2;
        const ocheEndX = ocheStartX + this.ocheWidth;

        // Draw oche line
        ctx.strokeStyle = '#555';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(ocheStartX, ocheY);
        ctx.lineTo(ocheEndX, ocheY);
        ctx.stroke();

        // Draw center marker
        ctx.strokeStyle = '#888';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(canvasWidth / 2, ocheY - 10);
        ctx.lineTo(canvasWidth / 2, ocheY + 10);
        ctx.stroke();

        // Draw player position
        const playerX = canvasWidth / 2 + this.position;
        const playerRadius = 12;

        ctx.beginPath();
        ctx.arc(playerX, ocheY, playerRadius, 0, 2 * Math.PI);
        ctx.fillStyle = '#00ff00';
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Draw position label
        ctx.font = '12px Arial';
        ctx.fillStyle = '#fff';
        ctx.textAlign = 'center';

        let posLabel;
        if (Math.abs(this.position) < 5) {
            posLabel = 'CENTER';
        } else if (this.position > 0) {
            posLabel = `RIGHT ${Math.abs(Math.round(this.position))}`;
        } else {
            posLabel = `LEFT ${Math.abs(Math.round(this.position))}`;
        }

        ctx.fillText(posLabel, playerX, ocheY + 25);

        // Draw distance indicator
        const distance = this.getDistanceToBoard();
        const distancePercent = ((distance / this.baseDistance) * 100 - 100).toFixed(1);
        if (distancePercent > 0) {
            ctx.fillStyle = '#ff8800';
            ctx.fillText(`+${distancePercent}% distance`, playerX, ocheY + 40);
        }
    }

    /**
     * Draw aim line from current position to target
     */
    drawAimLine(ctx, targetX, targetY, canvasWidth, canvasHeight) {
        const playerX = canvasWidth / 2 + this.position;
        const playerY = canvasHeight - 50;

        ctx.strokeStyle = 'rgba(255, 255, 0, 0.3)';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);

        ctx.beginPath();
        ctx.moveTo(playerX, playerY);
        ctx.lineTo(targetX, targetY);
        ctx.stroke();

        ctx.setLineDash([]);
    }

    /**
     * Create position slider UI
     */
    createSliderUI() {
        return `
            <div class="oche-slider-container">
                <label>Oche Position</label>
                <input type="range"
                       id="ocheSlider"
                       min="${this.minPosition}"
                       max="${this.maxPosition}"
                       value="${this.position}"
                       step="5"
                       onchange="game.ochePosition.setPosition(parseInt(this.value)); game.updateOcheDisplay();">
                <div class="oche-labels">
                    <span>LEFT</span>
                    <span>CENTER</span>
                    <span>RIGHT</span>
                </div>
                <div id="ocheInfo" class="oche-info"></div>
            </div>
        `;
    }

    /**
     * Update slider display
     */
    updateSliderDisplay() {
        const infoEl = document.getElementById('ocheInfo');
        if (!infoEl) return;

        const analysis = this.getPositionAnalysis();
        let html = '';

        if (analysis.advantages.length > 0) {
            html += '<div class="advantages">';
            analysis.advantages.forEach(a => {
                html += `<span class="advantage">+ ${a}</span>`;
            });
            html += '</div>';
        }

        if (analysis.disadvantages.length > 0) {
            html += '<div class="disadvantages">';
            analysis.disadvantages.forEach(d => {
                html += `<span class="disadvantage">- ${d}</span>`;
            });
            html += '</div>';
        }

        infoEl.innerHTML = html;
    }
}

// Export for module use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = OchePosition;
}
