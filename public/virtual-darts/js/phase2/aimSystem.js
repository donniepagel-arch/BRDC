/**
 * Aim System
 * Phase 2 - Aim & Strategy
 * Two-step targeting with zoom functionality
 */

class AimSystem {
    constructor(dartboard, onTargetSelected) {
        this.dartboard = dartboard;
        this.canvas = dartboard.canvas;
        this.ctx = dartboard.ctx;
        this.onTargetSelected = onTargetSelected;

        // Aim state
        this.state = {
            isZoomed: false,
            zoomLevel: 3,
            zoomCenter: null,
            selectedSegment: null,
            selectedRing: null,
            targetPosition: null
        };

        // Animation state
        this.zoomAnimation = {
            active: false,
            startTime: 0,
            duration: 300,
            from: 1,
            to: 1
        };

        // Bind handlers
        this.handleClick = this.handleClick.bind(this);
        this.handleTouchStart = this.handleTouchStart.bind(this);

        // Initialize listeners
        this.initListeners();
    }

    /**
     * Initialize event listeners
     */
    initListeners() {
        this.canvas.addEventListener('click', this.handleClick);
        this.canvas.addEventListener('touchstart', this.handleTouchStart, { passive: false });
    }

    /**
     * Handle click for aiming
     */
    handleClick(e) {
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;

        const x = (e.clientX - rect.left) * scaleX;
        const y = (e.clientY - rect.top) * scaleY;

        this.handleTap(x, y);
    }

    /**
     * Handle touch for aiming
     */
    handleTouchStart(e) {
        if (e.touches.length !== 1) return;

        const rect = this.canvas.getBoundingClientRect();
        const touch = e.touches[0];
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;

        const x = (touch.clientX - rect.left) * scaleX;
        const y = (touch.clientY - rect.top) * scaleY;

        // Check if this is a tap (not a swipe start)
        // We'll let swipe detector handle swipes
        // This only triggers on quick taps
    }

    /**
     * Handle tap at position
     */
    handleTap(x, y) {
        if (this.state.isZoomed) {
            // Second tap - select exact target
            this.selectTarget(x, y);
        } else {
            // First tap - zoom into area
            this.zoomToArea(x, y);
        }
    }

    /**
     * Zoom into an area of the board
     * @param {Object|number} area - Either an area object {segment, ring, x, y} or x coordinate
     * @param {number} [y] - Y coordinate (only used if area is x coordinate)
     */
    zoomToArea(area, y) {
        let x, segment, ring;

        // Handle both old (x, y) signature and new (area) signature
        if (typeof area === 'object' && area !== null) {
            // New signature: area object with segment/ring info
            segment = area.segment;
            ring = area.ring || 'treble';

            // Get center coordinates for the target area
            const targetCenter = this.dartboard.getTargetCenter(segment, ring);
            if (targetCenter) {
                x = targetCenter.x;
                y = targetCenter.y;
            } else {
                // Fallback to provided coordinates or board center
                x = area.x || CONFIG.CANVAS.BOARD_CENTER_X;
                y = area.y || CONFIG.CANVAS.BOARD_CENTER_Y;
            }
        } else {
            // Old signature: direct x, y coordinates
            x = area;
            // y is already set from parameter

            // Determine which segment/ring was tapped
            const hit = this.dartboard.calculateHit(x, y);

            if (hit.score === 0) {
                // Tapped outside board - ignore
                return;
            }

            segment = hit.segment;
            ring = hit.ring;
        }

        // Store zoom center and selected area
        this.state.zoomCenter = { x, y };
        this.state.selectedSegment = segment;
        this.state.selectedRing = ring;

        // Start zoom animation
        this.animateZoom(1, this.state.zoomLevel, () => {
            this.state.isZoomed = true;
            this.drawZoomedView();
        });
    }

    /**
     * Select exact target in zoomed view
     * Handles both coordinate-based selection (x, y) and target data objects
     * @param {Object|number} targetData - Either {segment, ring, x, y} object or x coordinate
     * @param {number} [y] - Y coordinate (only used if targetData is x coordinate)
     */
    selectTarget(targetData, y) {
        let boardCoords;

        if (typeof targetData === 'object' && targetData !== null) {
            // New signature: targetData object with segment/ring info
            if (targetData.segment !== undefined && targetData.ring !== undefined) {
                // Get center coordinates for the specific target
                const targetCenter = this.dartboard.getTargetCenter(targetData.segment, targetData.ring);
                if (targetCenter) {
                    boardCoords = targetCenter;
                    // Update selected segment/ring state
                    this.state.selectedSegment = targetData.segment;
                    this.state.selectedRing = targetData.ring;
                } else {
                    // Fallback to provided coordinates
                    boardCoords = { x: targetData.x, y: targetData.y };
                }
            } else if (targetData.x !== undefined && targetData.y !== undefined) {
                // Object with just x, y coordinates
                if (this.state.isZoomed) {
                    boardCoords = this.zoomedToBoard(targetData.x, targetData.y);
                } else {
                    boardCoords = { x: targetData.x, y: targetData.y };
                }
            } else {
                console.warn('selectTarget: Invalid targetData object', targetData);
                return;
            }
        } else if (typeof targetData === 'number' && typeof y === 'number') {
            // Old signature: direct x, y coordinates
            if (this.state.isZoomed) {
                boardCoords = this.zoomedToBoard(targetData, y);
            } else {
                boardCoords = { x: targetData, y: y };
            }
        } else {
            console.warn('selectTarget: Invalid parameters', targetData, y);
            return;
        }

        // Set as target
        this.state.targetPosition = boardCoords;

        // Calculate what segment/ring was actually selected if not already known
        if (!this.state.selectedSegment) {
            const hit = this.dartboard.calculateHit(boardCoords.x, boardCoords.y);
            this.state.selectedSegment = hit.segment;
            this.state.selectedRing = hit.ring;
        }

        // If zoomed, animate zoom out
        if (this.state.isZoomed) {
            this.animateZoom(this.state.zoomLevel, 1, () => {
                this.state.isZoomed = false;
                this.state.zoomCenter = null;

                // Notify callback with enhanced target info
                if (this.onTargetSelected) {
                    this.onTargetSelected({
                        ...boardCoords,
                        segment: this.state.selectedSegment,
                        ring: this.state.selectedRing
                    });
                }
            });
        } else {
            // Not zoomed - direct selection, notify immediately
            if (this.onTargetSelected) {
                this.onTargetSelected({
                    ...boardCoords,
                    segment: this.state.selectedSegment,
                    ring: this.state.selectedRing
                });
            }
        }
    }

    /**
     * Convert zoomed coordinates to board coordinates
     */
    zoomedToBoard(x, y) {
        const center = this.state.zoomCenter;
        const zoom = this.state.zoomLevel;

        // Calculate offset from canvas center
        const canvasCenterX = this.canvas.width / 2;
        const canvasCenterY = this.canvas.height / 2;

        const offsetX = (x - canvasCenterX) / zoom;
        const offsetY = (y - canvasCenterY) / zoom;

        return {
            x: center.x + offsetX,
            y: center.y + offsetY
        };
    }

    /**
     * Animate zoom transition
     */
    animateZoom(from, to, onComplete) {
        this.zoomAnimation = {
            active: true,
            startTime: performance.now(),
            duration: 300,
            from,
            to,
            onComplete
        };

        this.animateZoomFrame();
    }

    /**
     * Animation frame for zoom
     */
    animateZoomFrame() {
        if (!this.zoomAnimation.active) return;

        const elapsed = performance.now() - this.zoomAnimation.startTime;
        const progress = Math.min(1, elapsed / this.zoomAnimation.duration);

        // Ease out cubic
        const eased = 1 - Math.pow(1 - progress, 3);

        const currentZoom = this.zoomAnimation.from +
            (this.zoomAnimation.to - this.zoomAnimation.from) * eased;

        // Draw at current zoom level
        this.drawAtZoom(currentZoom);

        if (progress < 1) {
            requestAnimationFrame(() => this.animateZoomFrame());
        } else {
            this.zoomAnimation.active = false;
            if (this.zoomAnimation.onComplete) {
                this.zoomAnimation.onComplete();
            }
        }
    }

    /**
     * Draw board at specific zoom level
     */
    drawAtZoom(zoom) {
        const ctx = this.ctx;
        const center = this.state.zoomCenter || {
            x: CONFIG.CANVAS.BOARD_CENTER_X,
            y: CONFIG.CANVAS.BOARD_CENTER_Y
        };

        ctx.save();

        // Clear canvas
        ctx.fillStyle = CONFIG.COLORS.BACKGROUND;
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Translate to center, zoom, translate back
        ctx.translate(this.canvas.width / 2, this.canvas.height / 2);
        ctx.scale(zoom, zoom);
        ctx.translate(-center.x, -center.y);

        // Draw dartboard
        this.drawBoardElements();

        ctx.restore();

        // Draw zoom indicator if zooming
        if (zoom > 1.1) {
            this.drawZoomIndicator(zoom);
        }
    }

    /**
     * Draw zoomed view with targeting grid
     */
    drawZoomedView() {
        this.drawAtZoom(this.state.zoomLevel);

        // Draw targeting overlay
        this.drawTargetingOverlay();
    }

    /**
     * Draw targeting overlay on zoomed view
     */
    drawTargetingOverlay() {
        const ctx = this.ctx;
        const centerX = this.canvas.width / 2;
        const centerY = this.canvas.height / 2;

        // Draw crosshair
        ctx.strokeStyle = 'rgba(255, 255, 0, 0.5)';
        ctx.lineWidth = 1;

        // Horizontal line
        ctx.beginPath();
        ctx.moveTo(0, centerY);
        ctx.lineTo(this.canvas.width, centerY);
        ctx.stroke();

        // Vertical line
        ctx.beginPath();
        ctx.moveTo(centerX, 0);
        ctx.lineTo(centerX, this.canvas.height);
        ctx.stroke();

        // Center circle
        ctx.beginPath();
        ctx.arc(centerX, centerY, 30, 0, 2 * Math.PI);
        ctx.stroke();

        // Instructions
        ctx.font = '16px Arial';
        ctx.fillStyle = '#fff';
        ctx.textAlign = 'center';
        ctx.fillText('Tap to select exact target', centerX, 50);
    }

    /**
     * Draw zoom indicator
     */
    drawZoomIndicator(zoom) {
        const ctx = this.ctx;

        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(10, 10, 80, 30);

        ctx.font = '14px Arial';
        ctx.fillStyle = '#fff';
        ctx.textAlign = 'left';
        ctx.fillText(`${zoom.toFixed(1)}x`, 20, 30);
    }

    /**
     * Draw board elements (used during zoom)
     */
    drawBoardElements() {
        // Redraw the dartboard at current transform
        // This is a simplified version - in practice, you'd call dartboard methods
        const ctx = this.ctx;
        const centerX = CONFIG.CANVAS.BOARD_CENTER_X;
        const centerY = CONFIG.CANVAS.BOARD_CENTER_Y;

        // Draw each segment
        for (let i = 0; i < 20; i++) {
            this.drawSegmentZoomed(i);
        }

        // Draw bull
        ctx.beginPath();
        ctx.arc(centerX, centerY, CONFIG.BOARD.BULL_OUTER, 0, 2 * Math.PI);
        ctx.fillStyle = CONFIG.COLORS.BULL_GREEN;
        ctx.fill();

        ctx.beginPath();
        ctx.arc(centerX, centerY, CONFIG.BOARD.BULL_INNER, 0, 2 * Math.PI);
        ctx.fillStyle = CONFIG.COLORS.BULL_RED;
        ctx.fill();

        // Draw wires
        this.drawWiresZoomed();
    }

    /**
     * Draw a segment (for zoom view)
     */
    drawSegmentZoomed(index) {
        const ctx = this.ctx;
        const centerX = CONFIG.CANVAS.BOARD_CENTER_X;
        const centerY = CONFIG.CANVAS.BOARD_CENTER_Y;
        const segmentAngle = (2 * Math.PI) / 20;
        const startAngle = -Math.PI / 2 - (segmentAngle / 2) + (index * segmentAngle);
        const endAngle = startAngle + segmentAngle;

        const isEven = index % 2 === 0;
        const singleColor = isEven ? CONFIG.COLORS.BLACK : CONFIG.COLORS.WHITE;
        const multiColor = isEven ? CONFIG.COLORS.RED : CONFIG.COLORS.GREEN;

        // Outer single
        this.drawRingZoomed(startAngle, endAngle, CONFIG.BOARD.DOUBLE_INNER, CONFIG.BOARD.TREBLE_OUTER, singleColor);

        // Double
        this.drawRingZoomed(startAngle, endAngle, CONFIG.BOARD.DOUBLE_OUTER, CONFIG.BOARD.DOUBLE_INNER, multiColor);

        // Treble
        this.drawRingZoomed(startAngle, endAngle, CONFIG.BOARD.TREBLE_OUTER, CONFIG.BOARD.TREBLE_INNER, multiColor);

        // Inner single
        this.drawRingZoomed(startAngle, endAngle, CONFIG.BOARD.TREBLE_INNER, CONFIG.BOARD.BULL_OUTER, singleColor);
    }

    /**
     * Draw a ring segment (for zoom view)
     */
    drawRingZoomed(startAngle, endAngle, outerRadius, innerRadius, color) {
        const ctx = this.ctx;
        const centerX = CONFIG.CANVAS.BOARD_CENTER_X;
        const centerY = CONFIG.CANVAS.BOARD_CENTER_Y;

        ctx.beginPath();
        ctx.arc(centerX, centerY, outerRadius, startAngle, endAngle);
        ctx.arc(centerX, centerY, innerRadius, endAngle, startAngle, true);
        ctx.closePath();

        ctx.fillStyle = color;
        ctx.fill();
    }

    /**
     * Draw wires (for zoom view)
     */
    drawWiresZoomed() {
        const ctx = this.ctx;
        const centerX = CONFIG.CANVAS.BOARD_CENTER_X;
        const centerY = CONFIG.CANVAS.BOARD_CENTER_Y;
        const segmentAngle = (2 * Math.PI) / 20;
        const startAngleOffset = -Math.PI / 2 - (segmentAngle / 2);

        ctx.strokeStyle = CONFIG.COLORS.WIRE;
        ctx.lineWidth = CONFIG.BOARD.WIRE_WIDTH;

        // Radial wires
        for (let i = 0; i < 20; i++) {
            const angle = startAngleOffset + (i * segmentAngle);
            ctx.beginPath();
            ctx.moveTo(
                centerX + Math.cos(angle) * CONFIG.BOARD.BULL_OUTER,
                centerY + Math.sin(angle) * CONFIG.BOARD.BULL_OUTER
            );
            ctx.lineTo(
                centerX + Math.cos(angle) * CONFIG.BOARD.DOUBLE_OUTER,
                centerY + Math.sin(angle) * CONFIG.BOARD.DOUBLE_OUTER
            );
            ctx.stroke();
        }

        // Circular wires
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
            ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
            ctx.stroke();
        }
    }

    /**
     * Cancel zoom and return to normal view
     */
    cancelZoom() {
        if (!this.state.isZoomed) return;

        this.animateZoom(this.state.zoomLevel, 1, () => {
            this.state.isZoomed = false;
            this.state.zoomCenter = null;
            this.dartboard.draw();
        });
    }

    /**
     * Get suggested target for a segment/ring
     */
    getSuggestedTarget(segment, ring) {
        return this.dartboard.getTargetCenter(segment, ring);
    }

    /**
     * Check if currently zoomed
     */
    isZoomed() {
        return this.state.isZoomed;
    }

    /**
     * Get current target
     */
    getTarget() {
        return this.state.targetPosition;
    }

    /**
     * Set target directly (for auto-suggest)
     */
    setTarget(segment, ring) {
        const target = this.dartboard.getTargetCenter(segment, ring);
        if (target) {
            this.state.targetPosition = target;
            this.state.selectedSegment = segment;
            this.state.selectedRing = ring;

            if (this.onTargetSelected) {
                this.onTargetSelected(target);
            }
        }
    }

    /**
     * Zoom to a specific target area for precision aiming
     * This provides a combined workflow: zoom in, then user can fine-tune target
     * @param {Object} targetData - Target info {segment, ring} or {x, y}
     * @param {boolean} [autoSelect=false] - If true, automatically select center after zoom
     */
    zoomToTarget(targetData, autoSelect = false) {
        if (!targetData) {
            console.warn('zoomToTarget: No target data provided');
            return;
        }

        // Determine target center coordinates
        let targetCenter;
        let segment, ring;

        if (targetData.segment !== undefined) {
            segment = targetData.segment;
            ring = targetData.ring || 'treble';
            targetCenter = this.dartboard.getTargetCenter(segment, ring);
        } else if (targetData.x !== undefined && targetData.y !== undefined) {
            targetCenter = { x: targetData.x, y: targetData.y };
            const hit = this.dartboard.calculateHit(targetData.x, targetData.y);
            segment = hit.segment;
            ring = hit.ring;
        }

        if (!targetCenter) {
            console.warn('zoomToTarget: Could not determine target center');
            return;
        }

        // If already zoomed to this area, just update selection
        if (this.state.isZoomed &&
            this.state.selectedSegment === segment &&
            this.state.selectedRing === ring) {
            if (autoSelect) {
                this.selectTarget(targetData);
            }
            return;
        }

        // Cancel any existing zoom first
        if (this.state.isZoomed) {
            this.cancelZoom();
            // Small delay before new zoom
            setTimeout(() => this._performZoomToTarget(targetCenter, segment, ring, autoSelect), 350);
        } else {
            this._performZoomToTarget(targetCenter, segment, ring, autoSelect);
        }
    }

    /**
     * Internal method to perform zoom to target
     * @private
     */
    _performZoomToTarget(targetCenter, segment, ring, autoSelect) {
        // Store zoom center and selected area
        this.state.zoomCenter = targetCenter;
        this.state.selectedSegment = segment;
        this.state.selectedRing = ring;

        // Start zoom animation
        this.animateZoom(1, this.state.zoomLevel, () => {
            this.state.isZoomed = true;
            this.drawZoomedView();

            // Highlight the specific target area
            this.highlightTargetInZoom(segment, ring);

            // If autoSelect, select the target after a brief moment
            if (autoSelect) {
                setTimeout(() => {
                    this.selectTarget({ segment, ring });
                }, 100);
            }
        });
    }

    /**
     * Highlight a specific target area in the zoomed view
     * @param {number} segment - Segment number
     * @param {string} ring - Ring type
     */
    highlightTargetInZoom(segment, ring) {
        const ctx = this.ctx;
        const target = this.dartboard.getTargetCenter(segment, ring);
        if (!target) return;

        // Convert to screen coordinates in zoomed view
        const zoom = this.state.zoomLevel;
        const center = this.state.zoomCenter;
        const canvasCenterX = this.canvas.width / 2;
        const canvasCenterY = this.canvas.height / 2;

        const screenX = canvasCenterX + (target.x - center.x) * zoom;
        const screenY = canvasCenterY + (target.y - center.y) * zoom;

        // Draw pulsing highlight circle
        ctx.save();
        ctx.beginPath();
        ctx.arc(screenX, screenY, 25 * zoom, 0, 2 * Math.PI);
        ctx.strokeStyle = 'rgba(255, 255, 0, 0.8)';
        ctx.lineWidth = 3;
        ctx.stroke();

        // Inner target dot
        ctx.beginPath();
        ctx.arc(screenX, screenY, 5, 0, 2 * Math.PI);
        ctx.fillStyle = 'rgba(255, 255, 0, 0.9)';
        ctx.fill();
        ctx.restore();
    }

    /**
     * Get the current state of the aim system
     * @returns {Object} Current state including zoom status and selected target
     */
    getState() {
        return {
            isZoomed: this.state.isZoomed,
            zoomLevel: this.state.zoomLevel,
            zoomCenter: this.state.zoomCenter,
            selectedSegment: this.state.selectedSegment,
            selectedRing: this.state.selectedRing,
            targetPosition: this.state.targetPosition
        };
    }

    /**
     * Reset the aim system to default state
     */
    reset() {
        if (this.state.isZoomed) {
            this.cancelZoom();
        }
        this.state.targetPosition = null;
        this.state.selectedSegment = null;
        this.state.selectedRing = null;
    }

    /**
     * Destroy and clean up
     */
    destroy() {
        this.canvas.removeEventListener('click', this.handleClick);
        this.canvas.removeEventListener('touchstart', this.handleTouchStart);
    }
}

// Export for module use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AimSystem;
}
