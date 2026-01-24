/**
 * Dartboard Renderer
 * Phase 1 - MVP
 * Handles drawing the dartboard and calculating hit segments
 */

class Dartboard {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.centerX = CONFIG.CANVAS.BOARD_CENTER_X;
        this.centerY = CONFIG.CANVAS.BOARD_CENTER_Y;

        // Segment order (clockwise from top, starting at 20)
        this.segments = CONFIG.SEGMENTS;

        // Segment angle (18 degrees each)
        this.segmentAngle = (2 * Math.PI) / 20;

        // Starting angle offset (20 is at top, segments start at -9 degrees from vertical)
        this.startAngle = -Math.PI / 2 - (this.segmentAngle / 2);

        // Darts currently on the board
        this.darts = [];
    }

    /**
     * Draw the complete dartboard
     */
    draw() {
        const ctx = this.ctx;

        // Clear canvas
        ctx.fillStyle = CONFIG.COLORS.BACKGROUND;
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw board background circle
        ctx.beginPath();
        ctx.arc(this.centerX, this.centerY, CONFIG.BOARD.DOUBLE_OUTER + 20, 0, 2 * Math.PI);
        ctx.fillStyle = '#1a1a1a';
        ctx.fill();

        // Draw each segment
        for (let i = 0; i < 20; i++) {
            this.drawSegment(i);
        }

        // Draw bull
        this.drawBull();

        // Draw wires
        this.drawWires();

        // Draw numbers
        this.drawNumbers();

        // Draw any darts on the board
        this.drawDarts();
    }

    /**
     * Draw a single segment (all rings)
     */
    drawSegment(index) {
        const ctx = this.ctx;
        const startAngle = this.startAngle + (index * this.segmentAngle);
        const endAngle = startAngle + this.segmentAngle;

        // Determine colors based on segment index
        const isEven = index % 2 === 0;
        const singleColor = isEven ? CONFIG.COLORS.BLACK : CONFIG.COLORS.WHITE;
        const multiColor = isEven ? CONFIG.COLORS.RED : CONFIG.COLORS.GREEN;

        // Outer single (between double and treble)
        this.drawRing(startAngle, endAngle, CONFIG.BOARD.DOUBLE_INNER, CONFIG.BOARD.TREBLE_OUTER, singleColor);

        // Double ring
        this.drawRing(startAngle, endAngle, CONFIG.BOARD.DOUBLE_OUTER, CONFIG.BOARD.DOUBLE_INNER, multiColor);

        // Treble ring
        this.drawRing(startAngle, endAngle, CONFIG.BOARD.TREBLE_OUTER, CONFIG.BOARD.TREBLE_INNER, multiColor);

        // Inner single (between treble and bull)
        this.drawRing(startAngle, endAngle, CONFIG.BOARD.TREBLE_INNER, CONFIG.BOARD.BULL_OUTER, singleColor);
    }

    /**
     * Draw a ring segment
     */
    drawRing(startAngle, endAngle, outerRadius, innerRadius, color) {
        const ctx = this.ctx;

        ctx.beginPath();
        ctx.arc(this.centerX, this.centerY, outerRadius, startAngle, endAngle);
        ctx.arc(this.centerX, this.centerY, innerRadius, endAngle, startAngle, true);
        ctx.closePath();

        ctx.fillStyle = color;
        ctx.fill();
    }

    /**
     * Draw the bull (outer bull and inner bull)
     */
    drawBull() {
        const ctx = this.ctx;

        // Outer bull (25)
        ctx.beginPath();
        ctx.arc(this.centerX, this.centerY, CONFIG.BOARD.BULL_OUTER, 0, 2 * Math.PI);
        ctx.fillStyle = CONFIG.COLORS.BULL_GREEN;
        ctx.fill();

        // Inner bull (50)
        ctx.beginPath();
        ctx.arc(this.centerX, this.centerY, CONFIG.BOARD.BULL_INNER, 0, 2 * Math.PI);
        ctx.fillStyle = CONFIG.COLORS.BULL_RED;
        ctx.fill();
    }

    /**
     * Draw wire separators
     */
    drawWires() {
        const ctx = this.ctx;
        ctx.strokeStyle = CONFIG.COLORS.WIRE;
        ctx.lineWidth = CONFIG.BOARD.WIRE_WIDTH;

        // Radial wires (segment separators)
        for (let i = 0; i < 20; i++) {
            const angle = this.startAngle + (i * this.segmentAngle);

            ctx.beginPath();
            ctx.moveTo(
                this.centerX + Math.cos(angle) * CONFIG.BOARD.BULL_OUTER,
                this.centerY + Math.sin(angle) * CONFIG.BOARD.BULL_OUTER
            );
            ctx.lineTo(
                this.centerX + Math.cos(angle) * CONFIG.BOARD.DOUBLE_OUTER,
                this.centerY + Math.sin(angle) * CONFIG.BOARD.DOUBLE_OUTER
            );
            ctx.stroke();
        }

        // Circular wires (ring separators)
        const rings = [
            CONFIG.BOARD.DOUBLE_OUTER,
            CONFIG.BOARD.DOUBLE_INNER,
            CONFIG.BOARD.TREBLE_OUTER,
            CONFIG.BOARD.TREBLE_INNER,
            CONFIG.BOARD.BULL_OUTER,
            CONFIG.BOARD.BULL_INNER
        ];

        for (const radius of rings) {
            ctx.beginPath();
            ctx.arc(this.centerX, this.centerY, radius, 0, 2 * Math.PI);
            ctx.stroke();
        }
    }

    /**
     * Draw segment numbers
     */
    drawNumbers() {
        const ctx = this.ctx;
        const numberRadius = CONFIG.BOARD.DOUBLE_OUTER + 25;

        ctx.font = 'bold 24px "Bebas Neue", sans-serif';
        ctx.fillStyle = CONFIG.COLORS.NUMBER;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        for (let i = 0; i < 20; i++) {
            const angle = this.startAngle + (i * this.segmentAngle) + (this.segmentAngle / 2);
            const x = this.centerX + Math.cos(angle) * numberRadius;
            const y = this.centerY + Math.sin(angle) * numberRadius;

            ctx.fillText(this.segments[i].toString(), x, y);
        }
    }

    /**
     * Draw darts on the board
     */
    drawDarts() {
        for (const dart of this.darts) {
            this.drawDart(dart.x, dart.y, dart.color || '#ff6600');
        }
    }

    /**
     * Draw a single dart
     */
    drawDart(x, y, color = '#ff6600') {
        const ctx = this.ctx;

        // Dart point
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, 2 * Math.PI);
        ctx.fillStyle = color;
        ctx.fill();

        // Dart outline
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Inner highlight
        ctx.beginPath();
        ctx.arc(x, y, 2, 0, 2 * Math.PI);
        ctx.fillStyle = '#fff';
        ctx.fill();
    }

    /**
     * Add a dart to the board
     */
    addDart(x, y, color) {
        this.darts.push({ x, y, color });
        this.draw();
    }

    /**
     * Clear all darts from the board
     */
    clearDarts() {
        this.darts = [];
        this.draw();
    }

    /**
     * Calculate what segment a point hit
     * Returns: { segment: number, multiplier: 1|2|3, ring: string, score: number }
     */
    calculateHit(x, y) {
        const dx = x - this.centerX;
        const dy = y - this.centerY;
        const distance = Math.sqrt(dx * dx + dy * dy);

        // Check if outside the board
        if (distance > CONFIG.BOARD.DOUBLE_OUTER) {
            return { segment: 0, multiplier: 0, ring: 'miss', score: 0 };
        }

        // Check bull
        if (distance <= CONFIG.BOARD.BULL_INNER) {
            return { segment: 50, multiplier: 1, ring: 'double-bull', score: 50 };
        }
        if (distance <= CONFIG.BOARD.BULL_OUTER) {
            return { segment: 25, multiplier: 1, ring: 'single-bull', score: 25 };
        }

        // Calculate angle to determine segment
        let angle = Math.atan2(dy, dx);

        // Normalize angle relative to start
        angle = angle - this.startAngle;
        if (angle < 0) angle += 2 * Math.PI;

        // Determine segment index
        const segmentIndex = Math.floor(angle / this.segmentAngle) % 20;
        const segment = this.segments[segmentIndex];

        // Determine ring
        let multiplier = 1;
        let ring = 'single';

        if (distance >= CONFIG.BOARD.DOUBLE_INNER && distance <= CONFIG.BOARD.DOUBLE_OUTER) {
            multiplier = 2;
            ring = 'double';
        } else if (distance >= CONFIG.BOARD.TREBLE_INNER && distance <= CONFIG.BOARD.TREBLE_OUTER) {
            multiplier = 3;
            ring = 'treble';
        } else if (distance < CONFIG.BOARD.TREBLE_INNER) {
            ring = 'inner-single';
        } else {
            ring = 'outer-single';
        }

        return {
            segment,
            multiplier,
            ring,
            score: segment * multiplier
        };
    }

    /**
     * Get the center point of a target
     * @param {number} segment - The segment number (1-20, 25, or 50)
     * @param {string} ring - 'double', 'treble', 'single', 'inner-single', 'outer-single', 'bull'
     */
    getTargetCenter(segment, ring = 'treble') {
        // Handle bull
        if (segment === 50 || segment === 25 || ring === 'bull' || ring === 'double-bull' || ring === 'single-bull') {
            return { x: this.centerX, y: this.centerY };
        }

        // Find segment index
        const segmentIndex = this.segments.indexOf(segment);
        if (segmentIndex === -1) return null;

        // Calculate angle to center of segment
        const angle = this.startAngle + (segmentIndex * this.segmentAngle) + (this.segmentAngle / 2);

        // Determine radius based on ring
        let radius;
        switch (ring) {
            case 'double':
                radius = (CONFIG.BOARD.DOUBLE_OUTER + CONFIG.BOARD.DOUBLE_INNER) / 2;
                break;
            case 'treble':
                radius = (CONFIG.BOARD.TREBLE_OUTER + CONFIG.BOARD.TREBLE_INNER) / 2;
                break;
            case 'inner-single':
                radius = (CONFIG.BOARD.TREBLE_INNER + CONFIG.BOARD.BULL_OUTER) / 2;
                break;
            case 'outer-single':
            case 'single':
            default:
                radius = (CONFIG.BOARD.DOUBLE_INNER + CONFIG.BOARD.TREBLE_OUTER) / 2;
                break;
        }

        return {
            x: this.centerX + Math.cos(angle) * radius,
            y: this.centerY + Math.sin(angle) * radius
        };
    }

    /**
     * Highlight a target on the board
     */
    highlightTarget(segment, ring, color = 'rgba(255, 255, 0, 0.3)') {
        const target = this.getTargetCenter(segment, ring);
        if (!target) return;

        const ctx = this.ctx;

        // Draw highlight circle
        ctx.beginPath();
        ctx.arc(target.x, target.y, 15, 0, 2 * Math.PI);
        ctx.fillStyle = color;
        ctx.fill();
        ctx.strokeStyle = 'rgba(255, 255, 0, 0.8)';
        ctx.lineWidth = 2;
        ctx.stroke();
    }

    /**
     * Draw crosshair at position
     */
    drawCrosshair(x, y, color = '#ffff00') {
        const ctx = this.ctx;
        const size = 20;

        ctx.strokeStyle = color;
        ctx.lineWidth = 2;

        // Horizontal line
        ctx.beginPath();
        ctx.moveTo(x - size, y);
        ctx.lineTo(x + size, y);
        ctx.stroke();

        // Vertical line
        ctx.beginPath();
        ctx.moveTo(x, y - size);
        ctx.lineTo(x, y + size);
        ctx.stroke();

        // Center dot
        ctx.beginPath();
        ctx.arc(x, y, 3, 0, 2 * Math.PI);
        ctx.fillStyle = color;
        ctx.fill();
    }
}

// Export for module use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Dartboard;
}
