/**
 * Collision System
 * Phase 3 - Advanced Features
 * Dart-to-dart collision detection and deflection physics
 */

class CollisionSystem {
    constructor(dartboard) {
        this.dartboard = dartboard;

        // Dart dimensions (in pixels at board scale)
        this.dartDimensions = {
            tipRadius: 2,      // Point tip
            barrelLength: 18,  // Metal barrel
            barrelRadius: 4,
            shaftLength: 25,   // Shaft between barrel and flight
            shaftRadius: 2,
            flightRadius: 12   // Flight fins
        };

        // Collision probabilities
        this.collisionChances = {
            robinHood: 0.02,    // Hit shaft directly (2%)
            wireDeflect: 0.08, // Hit wire (8%)
            barrelContact: 0.20, // Barrel glance when grouped (20% if close)
            flightClip: 0.10   // Flight interference (10%)
        };
    }

    /**
     * Check for collision with existing darts
     * @param {Object} incomingDart - Landing position { x, y }
     * @param {Array} existingDarts - Darts already on board
     * @returns {Object} Collision result
     */
    checkCollision(incomingDart, existingDarts) {
        const result = {
            collided: false,
            type: null,
            deflected: false,
            newX: incomingDart.x,
            newY: incomingDart.y,
            description: null
        };

        if (!existingDarts || existingDarts.length === 0) {
            return result;
        }

        // Check each existing dart
        for (const dart of existingDarts) {
            const collision = this.checkDartCollision(incomingDart, dart);

            if (collision.collided) {
                result.collided = true;
                result.type = collision.type;
                result.deflected = true;
                result.description = collision.description;

                // Calculate deflection
                const deflection = this.calculateDeflection(incomingDart, dart, collision.type);
                result.newX = deflection.x;
                result.newY = deflection.y;

                break; // Only handle first collision
            }
        }

        return result;
    }

    /**
     * Check collision between incoming dart and single existing dart
     */
    checkDartCollision(incoming, existing) {
        const dx = incoming.x - existing.x;
        const dy = incoming.y - existing.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        // Check each collision zone

        // 1. Robin Hood (hitting shaft) - very close
        if (distance < this.dartDimensions.shaftRadius * 2) {
            if (Math.random() < this.collisionChances.robinHood) {
                return {
                    collided: true,
                    type: 'robinHood',
                    description: 'Robin Hood! Dart stuck in shaft!',
                    distance
                };
            }
        }

        // 2. Barrel contact - moderate distance
        if (distance < this.dartDimensions.barrelRadius * 3) {
            if (Math.random() < this.collisionChances.barrelContact) {
                return {
                    collided: true,
                    type: 'barrel',
                    description: 'Barrel contact - glancing deflection',
                    distance
                };
            }
        }

        // 3. Flight clip - larger distance
        if (distance < this.dartDimensions.flightRadius * 2) {
            if (Math.random() < this.collisionChances.flightClip) {
                return {
                    collided: true,
                    type: 'flight',
                    description: 'Flight interference',
                    distance
                };
            }
        }

        return { collided: false };
    }

    /**
     * Calculate deflection based on collision type
     */
    calculateDeflection(incoming, existing, collisionType) {
        const dx = incoming.x - existing.x;
        const dy = incoming.y - existing.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        // Normalize direction
        const nx = distance > 0 ? dx / distance : 1;
        const ny = distance > 0 ? dy / distance : 0;

        let deflectionMagnitude;
        let randomAngle;

        switch (collisionType) {
            case 'robinHood':
                // Robin hood - dart bounces randomly
                deflectionMagnitude = 30 + Math.random() * 50;
                randomAngle = Math.random() * Math.PI * 2;
                return {
                    x: existing.x + Math.cos(randomAngle) * deflectionMagnitude,
                    y: existing.y + Math.sin(randomAngle) * deflectionMagnitude
                };

            case 'barrel':
                // Barrel contact - slight deflection away
                deflectionMagnitude = 15 + Math.random() * 25;
                // Add some randomness to the deflection angle
                randomAngle = Math.atan2(ny, nx) + (Math.random() - 0.5) * 0.5;
                return {
                    x: existing.x + Math.cos(randomAngle) * deflectionMagnitude,
                    y: existing.y + Math.sin(randomAngle) * deflectionMagnitude
                };

            case 'flight':
                // Flight clip - minor deflection
                deflectionMagnitude = 10 + Math.random() * 15;
                randomAngle = Math.atan2(ny, nx) + (Math.random() - 0.5) * 0.3;
                return {
                    x: incoming.x + Math.cos(randomAngle) * deflectionMagnitude,
                    y: incoming.y + Math.sin(randomAngle) * deflectionMagnitude
                };

            default:
                return { x: incoming.x, y: incoming.y };
        }
    }

    /**
     * Check for wire deflection (bouncing off wire)
     */
    checkWireDeflection(position) {
        // Check if position is very close to a wire
        const hit = this.dartboard.calculateHit(position.x, position.y);

        if (hit.score === 0) {
            // Off the board - no wire collision possible
            return { deflected: false };
        }

        // Calculate distance to nearest wire
        const wireDistance = this.getDistanceToWire(position);

        if (wireDistance < CONFIG.BOARD.WIRE_WIDTH) {
            // Very close to wire - chance of bounce
            if (Math.random() < this.collisionChances.wireDeflect) {
                const deflection = this.calculateWireDeflection(position, wireDistance);
                return {
                    deflected: true,
                    type: 'wire',
                    newX: deflection.x,
                    newY: deflection.y,
                    description: 'Wire bounce!'
                };
            }
        }

        return { deflected: false };
    }

    /**
     * Get distance to nearest wire
     */
    getDistanceToWire(position) {
        const centerX = CONFIG.CANVAS.BOARD_CENTER_X;
        const centerY = CONFIG.CANVAS.BOARD_CENTER_Y;

        const dx = position.x - centerX;
        const dy = position.y - centerY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const angle = Math.atan2(dy, dx);

        // Distance to circular wires (rings)
        const rings = [
            CONFIG.BOARD.DOUBLE_OUTER,
            CONFIG.BOARD.DOUBLE_INNER,
            CONFIG.BOARD.TREBLE_OUTER,
            CONFIG.BOARD.TREBLE_INNER,
            CONFIG.BOARD.BULL_OUTER,
            CONFIG.BOARD.BULL_INNER
        ];

        let minRingDist = Infinity;
        for (const ring of rings) {
            const distToRing = Math.abs(distance - ring);
            if (distToRing < minRingDist) {
                minRingDist = distToRing;
            }
        }

        // Distance to radial wires (segment separators)
        const segmentAngle = (2 * Math.PI) / 20;
        const startAngle = -Math.PI / 2 - (segmentAngle / 2);

        let minRadialDist = Infinity;
        for (let i = 0; i < 20; i++) {
            const wireAngle = startAngle + (i * segmentAngle);
            let angleDiff = Math.abs(angle - wireAngle);
            if (angleDiff > Math.PI) angleDiff = 2 * Math.PI - angleDiff;

            const distToWire = distance * Math.sin(angleDiff);
            if (distToWire < minRadialDist) {
                minRadialDist = distToWire;
            }
        }

        return Math.min(minRingDist, minRadialDist);
    }

    /**
     * Calculate wire deflection
     */
    calculateWireDeflection(position, wireDistance) {
        const centerX = CONFIG.CANVAS.BOARD_CENTER_X;
        const centerY = CONFIG.CANVAS.BOARD_CENTER_Y;

        // Deflect perpendicular to the wire
        const dx = position.x - centerX;
        const dy = position.y - centerY;
        const angle = Math.atan2(dy, dx);

        // Add random deflection angle
        const deflectAngle = angle + (Math.random() > 0.5 ? 0.3 : -0.3);
        const deflectDist = 15 + Math.random() * 20;

        return {
            x: position.x + Math.cos(deflectAngle) * deflectDist,
            y: position.y + Math.sin(deflectAngle) * deflectDist
        };
    }

    /**
     * Get collision risk at position (for UI indicator)
     * @returns {number} Risk level 0-100
     */
    getCollisionRisk(targetPosition, existingDarts) {
        if (!existingDarts || existingDarts.length === 0) {
            return 0;
        }

        let maxRisk = 0;

        for (const dart of existingDarts) {
            const dx = targetPosition.x - dart.x;
            const dy = targetPosition.y - dart.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            // Calculate risk based on distance
            let risk = 0;
            if (distance < 10) risk = 90;
            else if (distance < 20) risk = 70;
            else if (distance < 30) risk = 50;
            else if (distance < 40) risk = 30;
            else if (distance < 50) risk = 10;

            maxRisk = Math.max(maxRisk, risk);
        }

        return maxRisk;
    }

    /**
     * Get suggested alternative target to avoid collisions
     */
    getSafeAlternative(targetPosition, existingDarts) {
        const risk = this.getCollisionRisk(targetPosition, existingDarts);

        if (risk < 30) {
            return null; // Low risk, no alternative needed
        }

        // Find a safe nearby position
        const angles = [0, Math.PI / 4, Math.PI / 2, 3 * Math.PI / 4,
                       Math.PI, -3 * Math.PI / 4, -Math.PI / 2, -Math.PI / 4];
        const distances = [15, 25, 35];

        let safest = null;
        let lowestRisk = risk;

        for (const dist of distances) {
            for (const angle of angles) {
                const altX = targetPosition.x + Math.cos(angle) * dist;
                const altY = targetPosition.y + Math.sin(angle) * dist;

                const altRisk = this.getCollisionRisk({ x: altX, y: altY }, existingDarts);

                // Check it's still on the board
                const hit = this.dartboard.calculateHit(altX, altY);
                if (hit.score > 0 && altRisk < lowestRisk) {
                    lowestRisk = altRisk;
                    safest = { x: altX, y: altY, risk: altRisk, hit };
                }
            }
        }

        return safest;
    }

    /**
     * Draw collision warning indicator
     */
    drawCollisionWarning(ctx, position, risk) {
        if (risk < 30) return;

        const alpha = risk / 100;
        const radius = 20 + (risk / 5);

        ctx.beginPath();
        ctx.arc(position.x, position.y, radius, 0, 2 * Math.PI);
        ctx.fillStyle = `rgba(255, 0, 0, ${alpha * 0.3})`;
        ctx.fill();
        ctx.strokeStyle = `rgba(255, 0, 0, ${alpha})`;
        ctx.lineWidth = 2;
        ctx.stroke();

        // Warning text
        if (risk > 50) {
            ctx.font = '10px Arial';
            ctx.fillStyle = '#ff0000';
            ctx.textAlign = 'center';
            ctx.fillText('HIGH RISK', position.x, position.y - radius - 5);
        }
    }
}

// Export for module use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CollisionSystem;
}
