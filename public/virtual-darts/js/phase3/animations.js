/**
 * Animation System
 * Phase 3 - Advanced Features
 * Smooth animations for dart throws, deflections, and UI
 */

class AnimationSystem {
    constructor(canvas, dartboard) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.dartboard = dartboard;

        // Active animations
        this.animations = [];

        // Animation state
        this.isRunning = false;
        this.lastFrameTime = 0;

        // Sound manager reference (will be set externally)
        this.soundManager = null;
    }

    /**
     * Start the animation loop
     */
    start() {
        if (this.isRunning) return;
        this.isRunning = true;
        this.lastFrameTime = performance.now();
        this.loop();
    }

    /**
     * Stop the animation loop
     */
    stop() {
        this.isRunning = false;
    }

    /**
     * Main animation loop
     */
    loop() {
        if (!this.isRunning) return;

        const now = performance.now();
        const deltaTime = (now - this.lastFrameTime) / 1000; // Convert to seconds
        this.lastFrameTime = now;

        // Update all animations
        this.update(deltaTime);

        // Render
        this.render();

        // Continue loop
        requestAnimationFrame(() => this.loop());
    }

    /**
     * Update all active animations
     */
    update(deltaTime) {
        // Update each animation
        for (let i = this.animations.length - 1; i >= 0; i--) {
            const anim = this.animations[i];

            anim.elapsed += deltaTime * 1000; // Convert to ms
            anim.progress = Math.min(1, anim.elapsed / anim.duration);

            // Apply easing
            anim.easedProgress = this.applyEasing(anim.progress, anim.easing);

            // Update animation-specific values
            if (anim.onUpdate) {
                anim.onUpdate(anim);
            }

            // Check if complete
            if (anim.progress >= 1) {
                if (anim.onComplete) {
                    anim.onComplete(anim);
                }
                this.animations.splice(i, 1);
            }
        }
    }

    /**
     * Render animations
     */
    render() {
        // Clear and redraw dartboard
        this.dartboard.draw();

        // Render each animation
        for (const anim of this.animations) {
            if (anim.render) {
                anim.render(this.ctx, anim);
            }
        }
    }

    /**
     * Apply easing function
     */
    applyEasing(t, easing) {
        switch (easing) {
            case 'linear':
                return t;
            case 'easeIn':
                return t * t;
            case 'easeOut':
                return 1 - Math.pow(1 - t, 2);
            case 'easeInOut':
                return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
            case 'easeOutBounce':
                return this.easeOutBounce(t);
            case 'easeOutElastic':
                return this.easeOutElastic(t);
            default:
                return t;
        }
    }

    /**
     * Bounce easing
     */
    easeOutBounce(t) {
        const n1 = 7.5625;
        const d1 = 2.75;

        if (t < 1 / d1) {
            return n1 * t * t;
        } else if (t < 2 / d1) {
            return n1 * (t -= 1.5 / d1) * t + 0.75;
        } else if (t < 2.5 / d1) {
            return n1 * (t -= 2.25 / d1) * t + 0.9375;
        } else {
            return n1 * (t -= 2.625 / d1) * t + 0.984375;
        }
    }

    /**
     * Elastic easing
     */
    easeOutElastic(t) {
        const c4 = (2 * Math.PI) / 3;

        return t === 0
            ? 0
            : t === 1
            ? 1
            : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
    }

    /**
     * Create dart throw animation
     */
    animateThrow(startPos, endPos, onComplete) {
        const trajectory = this.calculateTrajectory(startPos, endPos, 25);

        const anim = {
            type: 'throw',
            duration: 400,
            elapsed: 0,
            progress: 0,
            easedProgress: 0,
            easing: 'easeOut',
            trajectory,
            currentPoint: 0,
            startPos,
            endPos,
            render: (ctx, anim) => {
                const pointIndex = Math.floor(anim.easedProgress * (trajectory.length - 1));
                const point = trajectory[pointIndex];

                // Draw trail
                ctx.beginPath();
                ctx.strokeStyle = 'rgba(255, 200, 0, 0.4)';
                ctx.lineWidth = 2;
                for (let i = 0; i <= pointIndex; i++) {
                    if (i === 0) {
                        ctx.moveTo(trajectory[i].x, trajectory[i].y);
                    } else {
                        ctx.lineTo(trajectory[i].x, trajectory[i].y);
                    }
                }
                ctx.stroke();

                // Draw dart
                this.drawAnimatedDart(ctx, point.x, point.y, anim.easedProgress);
            },
            onComplete: () => {
                // Play sound
                if (this.soundManager) {
                    this.soundManager.play('dartHit');
                }
                if (onComplete) onComplete();
            }
        };

        this.animations.push(anim);
        this.start();

        return anim;
    }

    /**
     * Calculate parabolic trajectory
     */
    calculateTrajectory(start, end, steps) {
        const points = [];
        const dx = end.x - start.x;
        const dy = end.y - start.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const arcHeight = Math.min(100, distance * 0.2);

        for (let i = 0; i <= steps; i++) {
            const t = i / steps;
            const x = start.x + dx * t;
            const arcOffset = -4 * arcHeight * t * (1 - t);
            const y = start.y + dy * t + arcOffset;
            points.push({ x, y, t });
        }

        return points;
    }

    /**
     * Draw animated dart with rotation
     */
    drawAnimatedDart(ctx, x, y, progress) {
        const rotation = progress * Math.PI * 2; // Spin during flight
        const scale = 0.8 + progress * 0.2; // Slight scale effect

        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(rotation * 0.1);
        ctx.scale(scale, scale);

        // Dart body
        ctx.beginPath();
        ctx.arc(0, 0, 5, 0, 2 * Math.PI);
        ctx.fillStyle = '#ff6600';
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Highlight
        ctx.beginPath();
        ctx.arc(-1, -1, 2, 0, 2 * Math.PI);
        ctx.fillStyle = '#ffaa00';
        ctx.fill();

        ctx.restore();
    }

    /**
     * Create deflection animation
     */
    animateDeflection(startPos, endPos, deflectionType, onComplete) {
        // First animate to collision point
        const midPoint = {
            x: (startPos.x + endPos.x) / 2,
            y: (startPos.y + endPos.y) / 2 - 30 // Arc up
        };

        const anim = {
            type: 'deflection',
            duration: 600,
            elapsed: 0,
            progress: 0,
            easedProgress: 0,
            easing: 'easeOutBounce',
            startPos,
            midPoint,
            endPos,
            deflectionType,
            render: (ctx, anim) => {
                let currentX, currentY;

                if (anim.progress < 0.3) {
                    // First phase - approach
                    const t = anim.progress / 0.3;
                    currentX = startPos.x + (midPoint.x - startPos.x) * t;
                    currentY = startPos.y + (midPoint.y - startPos.y) * t;
                } else {
                    // Second phase - deflection
                    const t = (anim.progress - 0.3) / 0.7;
                    const easedT = this.applyEasing(t, 'easeOutBounce');
                    currentX = midPoint.x + (endPos.x - midPoint.x) * easedT;
                    currentY = midPoint.y + (endPos.y - midPoint.y) * easedT;
                }

                // Draw collision effect at midpoint
                if (anim.progress > 0.25 && anim.progress < 0.5) {
                    const flashAlpha = 1 - (anim.progress - 0.25) / 0.25;
                    ctx.beginPath();
                    ctx.arc(midPoint.x, midPoint.y, 15, 0, 2 * Math.PI);
                    ctx.fillStyle = `rgba(255, 255, 0, ${flashAlpha * 0.5})`;
                    ctx.fill();
                }

                // Draw dart
                this.drawAnimatedDart(ctx, currentX, currentY, anim.progress);
            },
            onComplete: () => {
                if (this.soundManager) {
                    this.soundManager.play('deflection');
                }
                if (onComplete) onComplete();
            }
        };

        this.animations.push(anim);
        this.start();

        return anim;
    }

    /**
     * Create score popup animation
     */
    animateScorePopup(x, y, score, isHighScore = false) {
        const anim = {
            type: 'scorePopup',
            duration: 1000,
            elapsed: 0,
            progress: 0,
            easedProgress: 0,
            easing: 'easeOut',
            x,
            y,
            score,
            isHighScore,
            render: (ctx, anim) => {
                const offsetY = -anim.easedProgress * 50;
                const alpha = 1 - anim.progress;
                const scale = 1 + anim.easedProgress * 0.3;

                ctx.save();
                ctx.globalAlpha = alpha;
                ctx.font = `bold ${24 * scale}px Arial`;
                ctx.textAlign = 'center';

                // Shadow
                ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
                ctx.fillText(score.toString(), x + 2, y + offsetY + 2);

                // Text
                ctx.fillStyle = isHighScore ? '#ffff00' : '#ffffff';
                ctx.fillText(score.toString(), x, y + offsetY);

                ctx.restore();
            }
        };

        this.animations.push(anim);
        this.start();
    }

    /**
     * Create highlight ring animation
     */
    animateHighlight(x, y, radius, color = '#ffff00') {
        const anim = {
            type: 'highlight',
            duration: 500,
            elapsed: 0,
            progress: 0,
            easedProgress: 0,
            easing: 'easeOut',
            x,
            y,
            radius,
            color,
            render: (ctx, anim) => {
                const currentRadius = anim.radius * (0.5 + anim.easedProgress * 0.5);
                const alpha = 1 - anim.progress;

                ctx.beginPath();
                ctx.arc(anim.x, anim.y, currentRadius, 0, 2 * Math.PI);
                ctx.strokeStyle = anim.color.replace(')', `, ${alpha})`).replace('rgb', 'rgba');
                ctx.lineWidth = 3;
                ctx.stroke();
            }
        };

        this.animations.push(anim);
        this.start();
    }

    /**
     * Create burst particles animation
     */
    animateParticleBurst(x, y, count = 10, color = '#ffff00') {
        const particles = [];

        for (let i = 0; i < count; i++) {
            const angle = (Math.PI * 2 * i) / count + Math.random() * 0.5;
            const speed = 50 + Math.random() * 100;
            particles.push({
                angle,
                speed,
                x,
                y,
                size: 3 + Math.random() * 3
            });
        }

        const anim = {
            type: 'particles',
            duration: 800,
            elapsed: 0,
            progress: 0,
            easedProgress: 0,
            easing: 'easeOut',
            particles,
            color,
            render: (ctx, anim) => {
                const alpha = 1 - anim.progress;

                for (const p of anim.particles) {
                    const dist = p.speed * anim.easedProgress;
                    const px = p.x + Math.cos(p.angle) * dist;
                    const py = p.y + Math.sin(p.angle) * dist;

                    ctx.beginPath();
                    ctx.arc(px, py, p.size * (1 - anim.progress), 0, 2 * Math.PI);
                    ctx.fillStyle = anim.color.replace(')', `, ${alpha})`).replace('rgb', 'rgba');
                    ctx.fill();
                }
            }
        };

        this.animations.push(anim);
        this.start();
    }

    /**
     * Create checkout celebration animation
     */
    animateCheckout(x, y) {
        // Multiple effects combined
        this.animateHighlight(x, y, 50, 'rgb(255, 215, 0)');
        this.animateParticleBurst(x, y, 20, 'rgb(255, 215, 0)');
        this.animateScorePopup(x, y - 30, 'CHECKOUT!', true);

        if (this.soundManager) {
            this.soundManager.play('checkout');
        }
    }

    /**
     * Create 180 celebration animation
     */
    animate180(x, y) {
        this.animateHighlight(x, y, 60, 'rgb(255, 0, 0)');
        this.animateParticleBurst(x, y, 30, 'rgb(255, 0, 0)');
        this.animateScorePopup(x, y - 30, '180!', true);

        if (this.soundManager) {
            this.soundManager.play('oneEighty');
        }
    }

    /**
     * Clear all animations
     */
    clearAnimations() {
        this.animations = [];
    }

    /**
     * Check if any animations are running
     */
    hasActiveAnimations() {
        return this.animations.length > 0;
    }
}

/**
 * Simple Sound Manager
 */
class SoundManager {
    constructor() {
        this.sounds = {};
        this.enabled = true;
        this.volume = 0.5;
    }

    /**
     * Load a sound
     */
    load(name, url) {
        const audio = new Audio(url);
        audio.volume = this.volume;
        this.sounds[name] = audio;
    }

    /**
     * Play a sound
     */
    play(name) {
        if (!this.enabled || !this.sounds[name]) return;

        const sound = this.sounds[name];
        sound.currentTime = 0;
        sound.play().catch(() => {}); // Ignore autoplay errors
    }

    /**
     * Toggle sound
     */
    toggle() {
        this.enabled = !this.enabled;
        return this.enabled;
    }

    /**
     * Set volume
     */
    setVolume(vol) {
        this.volume = Math.max(0, Math.min(1, vol));
        for (const sound of Object.values(this.sounds)) {
            sound.volume = this.volume;
        }
    }
}

// Export for module use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { AnimationSystem, SoundManager };
}
