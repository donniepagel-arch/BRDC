/**
 * Stats Verification Functions
 *
 * Handles player stat verification for the BRDC system.
 * Players complete 5 legs of 501 and/or 5 legs of Cricket vs bots.
 * The best 3 legs of each game type are used for the verified average.
 * Player must win at least 2 of the 3 counting legs.
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const cors = require('cors')({ origin: true });

const db = admin.firestore();

/**
 * Submit verification results
 * Called after player completes 5 legs of either 501 or Cricket (or both)
 * Now supports submitting just one game type at a time
 */
exports.submitVerification = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
        try {
            const {
                player_id,
                player_pin,
                x01_legs,      // Array of { leg, darts, avg, won } - optional
                cricket_legs,  // Array of { leg, rounds, marks, mpr, won } - optional
            } = req.body;

            // Validate required fields
            if (!player_id && !player_pin) {
                return res.status(400).json({
                    success: false,
                    error: 'player_id or player_pin required'
                });
            }

            // Must have at least one game type
            const hasX01 = x01_legs && x01_legs.length === 5;
            const hasCricket = cricket_legs && cricket_legs.length === 5;

            if (!hasX01 && !hasCricket) {
                return res.status(400).json({
                    success: false,
                    error: 'At least 5 x01 legs or 5 cricket legs required'
                });
            }

            // Look up player
            let playerId = player_id;
            if (!playerId && player_pin) {
                const playerQuery = await db.collection('players')
                    .where('pin', '==', player_pin)
                    .limit(1)
                    .get();

                if (playerQuery.empty) {
                    return res.status(404).json({
                        success: false,
                        error: 'Player not found'
                    });
                }
                playerId = playerQuery.docs[0].id;
            }

            // Verify player exists
            const playerRef = db.collection('players').doc(playerId);
            const playerDoc = await playerRef.get();

            if (!playerDoc.exists) {
                return res.status(404).json({
                    success: false,
                    error: 'Player not found'
                });
            }

            // Get existing verification data (if any)
            const existingVerDoc = await db.collection('players').doc(playerId)
                .collection('verification').doc('current').get();
            const existingVer = existingVerDoc.exists ? existingVerDoc.data() : {};

            // Calculate verified averages for submitted game types
            let verified3DA = existingVer.x01_top3_avg || null;
            let verifiedMPR = existingVer.cricket_top3_mpr || null;
            let x01Data = existingVer.x01_legs ? { legs: existingVer.x01_legs } : null;
            let cricketData = existingVer.cricket_legs ? { legs: existingVer.cricket_legs } : null;

            // Process X01 if provided
            if (hasX01) {
                // X01: Sort by avg descending, take top 3
                const x01Sorted = [...x01_legs].sort((a, b) => b.avg - a.avg);
                const x01Top3 = x01Sorted.slice(0, 3);
                const x01DroppedLegs = x01Sorted.slice(3).map(r => r.leg);
                verified3DA = x01Top3.reduce((sum, r) => sum + r.avg, 0) / 3;

                const x01TotalDarts = x01_legs.reduce((sum, r) => sum + r.darts, 0);

                x01Data = {
                    legs: x01_legs.map(leg => ({
                        ...leg,
                        dropped: x01DroppedLegs.includes(leg.leg)
                    })),
                    top3_avg: verified3DA,
                    total_darts: x01TotalDarts,
                    dropped_legs: x01DroppedLegs,
                    verified_at: admin.firestore.FieldValue.serverTimestamp()
                };
            }

            // Process Cricket if provided
            if (hasCricket) {
                // Cricket: Sort by MPR descending, take top 3
                const cricketSorted = [...cricket_legs].sort((a, b) => b.mpr - a.mpr);
                const cricketTop3 = cricketSorted.slice(0, 3);
                const cricketDroppedLegs = cricketSorted.slice(3).map(r => r.leg);
                verifiedMPR = cricketTop3.reduce((sum, r) => sum + r.mpr, 0) / 3;

                const cricketTotalRounds = cricket_legs.reduce((sum, r) => sum + r.rounds, 0);
                const cricketTotalMarks = cricket_legs.reduce((sum, r) => sum + r.marks, 0);

                cricketData = {
                    legs: cricket_legs.map(leg => ({
                        ...leg,
                        dropped: cricketDroppedLegs.includes(leg.leg)
                    })),
                    top3_mpr: verifiedMPR,
                    total_rounds: cricketTotalRounds,
                    total_marks: cricketTotalMarks,
                    dropped_legs: cricketDroppedLegs,
                    verified_at: admin.firestore.FieldValue.serverTimestamp()
                };
            }

            // Determine overall status - verified if either game type is now verified
            const isVerified = verified3DA !== null || verifiedMPR !== null;

            // Set expiration (90 days from now)
            const expiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);

            // Build verification record
            const verificationData = {
                status: isVerified ? 'verified' : 'partial',

                // X01 results
                ...(x01Data && {
                    x01_legs: x01Data.legs,
                    x01_top3_avg: x01Data.top3_avg,
                    x01_total_darts: x01Data.total_darts,
                    x01_dropped_legs: x01Data.dropped_legs,
                    x01_verified_at: x01Data.verified_at
                }),

                // Cricket results
                ...(cricketData && {
                    cricket_legs: cricketData.legs,
                    cricket_top3_mpr: cricketData.top3_mpr,
                    cricket_total_rounds: cricketData.total_rounds,
                    cricket_total_marks: cricketData.total_marks,
                    cricket_dropped_legs: cricketData.dropped_legs,
                    cricket_verified_at: cricketData.verified_at
                }),

                // Timestamps
                updated_at: admin.firestore.FieldValue.serverTimestamp(),
                expires_at: expiresAt,

                // Method
                verification_method: 'brdc_scorer_vs_bot'
            };

            // Save to player's verification subcollection
            await db.collection('players').doc(playerId)
                .collection('verification').doc('current')
                .set(verificationData, { merge: true });

            // Also save to history
            await db.collection('players').doc(playerId)
                .collection('verification').doc('history')
                .collection('attempts').add({
                    ...verificationData,
                    game_type: hasX01 && hasCricket ? 'both' : (hasX01 ? 'x01' : 'cricket'),
                    created_at: admin.firestore.FieldValue.serverTimestamp()
                });

            // Update player's main stats with verified flag
            const playerUpdate = {
                'stats.verification_status': isVerified ? 'verified' : 'partial',
                'stats.verification_updated_at': admin.firestore.FieldValue.serverTimestamp(),
                'stats.verification_expires_at': expiresAt
            };

            if (verified3DA !== null) {
                playerUpdate['stats.verified_3da'] = verified3DA;
            }
            if (verifiedMPR !== null) {
                playerUpdate['stats.verified_mpr'] = verifiedMPR;
            }

            await playerRef.update(playerUpdate);

            console.log(`Verification updated for player ${playerId}: 3DA=${verified3DA?.toFixed(1) || 'N/A'}, MPR=${verifiedMPR?.toFixed(2) || 'N/A'}`);

            res.json({
                success: true,
                message: 'Stats verified successfully',
                verified_3da: verified3DA,
                verified_mpr: verifiedMPR,
                expires_at: expiresAt.toISOString()
            });

        } catch (error) {
            console.error('Submit verification error:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    });
});

/**
 * Get player's verification status
 */
exports.getVerificationStatus = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
        try {
            const { player_id, player_pin } = req.body;

            if (!player_id && !player_pin) {
                return res.status(400).json({
                    success: false,
                    error: 'player_id or player_pin required'
                });
            }

            // Look up player
            let playerId = player_id;
            if (!playerId && player_pin) {
                const playerQuery = await db.collection('players')
                    .where('pin', '==', player_pin)
                    .limit(1)
                    .get();

                if (playerQuery.empty) {
                    return res.status(404).json({
                        success: false,
                        error: 'Player not found'
                    });
                }
                playerId = playerQuery.docs[0].id;
            }

            // Get current verification
            const verDoc = await db.collection('players').doc(playerId)
                .collection('verification').doc('current')
                .get();

            if (!verDoc.exists) {
                return res.json({
                    success: true,
                    status: 'unverified',
                    message: 'No verification on file'
                });
            }

            const verification = verDoc.data();

            // Check if expired
            const expiresAt = verification.expires_at?.toDate ?
                verification.expires_at.toDate() :
                new Date(verification.expires_at);

            const isExpired = expiresAt < new Date();

            if (isExpired) {
                return res.json({
                    success: true,
                    status: 'expired',
                    message: 'Verification has expired',
                    verified_3da: verification.x01_top3_avg,
                    verified_mpr: verification.cricket_top3_mpr,
                    verified_at: verification.updated_at,
                    expires_at: expiresAt.toISOString()
                });
            }

            res.json({
                success: true,
                status: verification.status || 'verified',
                verified_3da: verification.x01_top3_avg,
                verified_mpr: verification.cricket_top3_mpr,
                verified_at: verification.updated_at,
                expires_at: expiresAt.toISOString(),
                verification_method: verification.verification_method
            });

        } catch (error) {
            console.error('Get verification status error:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    });
});

/**
 * Self-report stats (when player doesn't want to verify)
 */
exports.selfReportStats = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
        try {
            const { player_id, player_pin, estimated_3da, estimated_mpr } = req.body;

            if (!player_id && !player_pin) {
                return res.status(400).json({
                    success: false,
                    error: 'player_id or player_pin required'
                });
            }

            if (!estimated_3da && !estimated_mpr) {
                return res.status(400).json({
                    success: false,
                    error: 'At least one stat (estimated_3da or estimated_mpr) required'
                });
            }

            // Look up player
            let playerId = player_id;
            if (!playerId && player_pin) {
                const playerQuery = await db.collection('players')
                    .where('pin', '==', player_pin)
                    .limit(1)
                    .get();

                if (playerQuery.empty) {
                    return res.status(404).json({
                        success: false,
                        error: 'Player not found'
                    });
                }
                playerId = playerQuery.docs[0].id;
            }

            const playerRef = db.collection('players').doc(playerId);

            // Update player stats as self-reported
            const updateData = {
                'stats.verification_status': 'self_reported',
                'stats.self_reported_at': admin.firestore.FieldValue.serverTimestamp()
            };

            if (estimated_3da) {
                updateData['stats.self_reported_3da'] = parseFloat(estimated_3da);
            }
            if (estimated_mpr) {
                updateData['stats.self_reported_mpr'] = parseFloat(estimated_mpr);
            }

            await playerRef.update(updateData);

            res.json({
                success: true,
                message: 'Self-reported stats saved',
                status: 'self_reported'
            });

        } catch (error) {
            console.error('Self-report stats error:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    });
});

module.exports = exports;
