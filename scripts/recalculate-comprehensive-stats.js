const admin = require('firebase-admin');

// Initialize Firebase Admin
admin.initializeApp({ projectId: 'brdc-v2' });
const db = admin.firestore();

const LEAGUE_ID = 'aOq4Y0ETxPZ66tM1uUtP';

// Player name to ID mapping
const PLAYER_IDS = {
    'Matt Pagel': 'maH2vUZbuVLBbBQwoIqW',
    'Joe Peters': 'pERxbhcN3VNAvu6wFN9o',
    'John Linden': '06IoctkB8mTTSPBGRbu5',
    'Donnie Pagel': 'X2DMb9bP4Q8fy9yr5Fam',
    'Jennifer Malek': '7Hj4KWNpm0GviTYbwfbM',
    'Jenn M': '7Hj4KWNpm0GviTYbwfbM',
    'Jenn Malek': '7Hj4KWNpm0GviTYbwfbM',
    'Matthew Wentz': 'TJ3uwMdslbtpjtq17xW4',
    'Matt Wentz': 'TJ3uwMdslbtpjtq17xW4',
    'Christian Ketchum': '89RkfFLOhvUwV83ZS5J4',
    'Christian Ketchem': '89RkfFLOhvUwV83ZS5J4',
    'Nathan Kull': 'bsAlnR7Ii1pWmMvsWzrS',
    'Nate Kull': 'bsAlnR7Ii1pWmMvsWzrS',
    'Michael Jarvis': '7GH1SWRR3dAyAVxgMqvf',
    'Stephanie Kull': '4sly23nOXhC475q95R4L',
    'Steph Kull': '4sly23nOXhC475q95R4L',
    'Kevin Yasenchak': 'dr4ML1i9ZeMI7SNisX6E',
    'Kevin Y': 'dr4ML1i9ZeMI7SNisX6E',
    'Brian Smith': 'bIv2rga3jBSvzsQ2khne',
    'Brian S': 'bIv2rga3jBSvzsQ2khne',
    'Cesar Andino': 'Dag2lYDtqoo4kc3cRHHa',
    'Cesar A': 'Dag2lYDtqoo4kc3cRHHa',
    'Dan Partlo': 'xtgPtBokzUj3nli61AKq',
    'Joe Donley': 'JxFXNWdd2dFMja3rI0jf',
    'Anthony Donley': 'JxFXNWdd2dFMja3rI0jf',  // Joe's son, same player ID
    'Kevin Mckelvey': 'Gmxl5I2CtVXYns4b4AeU',
    'Kevin McKelvey': 'Gmxl5I2CtVXYns4b4AeU',
    'Eddie Olschansky': 'wLMJoz1GylfVCMM32nWm',
    'Eddie Olschanskey': 'wLMJoz1GylfVCMM32nWm',
    'Eddie O': 'wLMJoz1GylfVCMM32nWm',
    'Jeff Boss': 'Tj1LsOtRiJwHW4r4sgWa',
    'Michael Gonzalez': 'FfODZtkFiGUEzptzD8tH',
    'Mike Gonzalez': 'FfODZtkFiGUEzptzD8tH',
    'Mike Gonzales': 'FfODZtkFiGUEzptzD8tH',
    'John Ragnoni': 'SwnH8GUBmrcdmOAs07Vp',
    'Marc Tate': 'ZwdiN0qfmIY5MMCOLJps',
    'David Brunner': 'ctnV5Je72HAIyVpE5zjS',
    'Dave Brunner': 'ctnV5Je72HAIyVpE5zjS',
    'Derek Fess': 'vVR4AOITXYzhR2H4GqzI',
    'Derek': 'vVR4AOITXYzhR2H4GqzI',
    'DF': 'vVR4AOITXYzhR2H4GqzI',
    'Josh Kelly': '34GDgRRFk0uFmOvyykHE',
    'Joshua kelly': '34GDgRRFk0uFmOvyykHE',
    'JK': '34GDgRRFk0uFmOvyykHE',
    'Tony Massimiani': 'gqhzEQLifL402lQwDMpH',
    'TM': 'gqhzEQLifL402lQwDMpH',
    'Dominick Russano': 'pL9CGc688ZpxbPKJ11cZ',
    'Dom Russano': 'pL9CGc688ZpxbPKJ11cZ',
    'DR': 'pL9CGc688ZpxbPKJ11cZ',
    'Chris Benco': 'rZ57ofUYFXPSrrhyBVkz',
    'Chris B': 'rZ57ofUYFXPSrrhyBVkz',
    'Nick Mezlak': 'yGcBLDcTwgHtWmZEg3TG',
    'Cory Jacobs': '8f52A1dwRB4eIU5UyQZo',
    'Dillon Ulisses': 'dFmalrT5BMdaTOUUVTOZ',
    'Dillon U': 'dFmalrT5BMdaTOUUVTOZ',
    'Dillon Ullises': 'dFmalrT5BMdaTOUUVTOZ',
    'Danny Russano': 'gmZ8d6De0ZlqPVV0V9Q6',
    'Chris Russano': 'NJgDQ0d4RzpDVuCnqYZO',
    'Eric Duale': 'NCeaIaMXsXVN135pX91L',
    'Eric D': 'NCeaIaMXsXVN135pX91L',
    'Eric': 'NCeaIaMXsXVN135pX91L',
    'Luke Kollias': 'mFyX9sv1l95V0czECUKu',
    'Luke Keller': 'mFyX9sv1l95V0czECUKu',
    'Peter Porto': 'yPBqFjH9X7W8J7Kl3jLe',
    'Pete Porto': 'yPBqFjH9X7W8J7Kl3jLe',
    'Dave Bonness': 'nDPDqXbEBJvUgGl2iXF3',
    'David Bonness': 'nDPDqXbEBJvUgGl2iXF3'
};

function createEmptyStats() {
    return {
        // Basic X01 stats
        x01_legs_played: 0,
        x01_legs_won: 0,
        x01_total_darts: 0,
        x01_total_points: 0,
        x01_three_dart_avg: 0,

        // Tons tracking (by range)
        x01_ton_80: 0,  // 180
        x01_ton_60: 0,  // 160-179
        x01_ton_40: 0,  // 140-159
        x01_ton_20: 0,  // 120-139
        x01_ton_00: 0,  // 100-119
        x01_tons: 0,    // Total 100+
        x01_high_score: 0,

        // First 9 darts
        x01_first9_darts: 0,
        x01_first9_points: 0,

        // Checkout tracking
        x01_checkouts_hit: 0,
        x01_checkout_attempts: 0,
        x01_total_checkout_points: 0,
        x01_high_checkout: 0,
        x01_best_leg: 999,

        // Checkout by range
        x01_co_80_hits: 0,
        x01_co_80_attempts: 0,
        x01_co_120_hits: 0,
        x01_co_120_attempts: 0,
        x01_co_140_hits: 0,
        x01_co_140_attempts: 0,
        x01_co_161_hits: 0,
        x01_co_161_attempts: 0,

        // With/against darts (cork tracking)
        x01_legs_with_darts: 0,
        x01_legs_with_darts_won: 0,
        x01_legs_against_darts: 0,
        x01_legs_against_darts_won: 0,

        // Basic Cricket stats
        cricket_legs_played: 0,
        cricket_legs_won: 0,
        cricket_total_darts: 0,
        cricket_total_marks: 0,
        cricket_mpr: 0,

        // Cricket mark rounds
        cricket_nine_mark_rounds: 0,
        cricket_eight_mark_rounds: 0,
        cricket_seven_mark_rounds: 0,
        cricket_six_mark_rounds: 0,
        cricket_five_mark_rounds: 0,
        cricket_high_mark_round: 0,
        cricket_hat_tricks: 0,

        // Cricket with/against darts
        cricket_legs_with_darts: 0,
        cricket_legs_with_darts_won: 0,
        cricket_legs_against_darts: 0,
        cricket_legs_against_darts_won: 0
    };
}

function getPlayerId(playerName) {
    return PLAYER_IDS[playerName] || null;
}

function isX01Format(format) {
    return ['501', '301', '701'].includes(format);
}

function isCricketFormat(format) {
    return format === 'cricket';
}

function processX01Leg(leg, playerStats, debugInfo = null) {
    const throws = leg.throws || [];
    const format = leg.format;
    const gameValue = parseInt(format) || 501;

    // === FIRST PASS: Compute actual per-round scores from side-level remaining differences ===
    // The `score` field is sometimes cumulative (broken data). The `remaining` field is ground truth.
    // In doubles, remaining decrements by both players' scores, so we must compute at the side level
    // BEFORE grouping by player.
    const sideLastRemaining = { home: gameValue, away: gameValue };
    const processedThrows = [];

    throws.forEach((throwData, throwIdx) => {
        const processed = {};
        ['home', 'away'].forEach(side => {
            const throwInfo = throwData[side];
            if (!throwInfo || !throwInfo.player) {
                processed[side] = null;
                return;
            }

            const remaining = throwInfo.remaining;
            const rawScore = throwInfo.score || 0;
            const remainingAtStart = sideLastRemaining[side];
            let actualScore;

            if (remaining !== undefined && remaining !== null) {
                // Ground truth: compute from remaining difference
                actualScore = remainingAtStart - remaining;
                sideLastRemaining[side] = remaining;
            } else {
                // remaining is undefined - data is corrupt
                // Use raw score only if it's plausible (≤180 for X01)
                actualScore = (rawScore > 0 && rawScore <= 180) ? rawScore : null;
            }

            // Sanity check: no X01 round can score > 180 or < 0
            if (actualScore !== null && (actualScore > 180 || actualScore < 0)) {
                actualScore = null;
            }

            processed[side] = {
                ...throwInfo,
                actualScore,
                remainingAtStart,
                throwIdx,
                side
            };
        });
        processedThrows.push(processed);
    });

    // Determine who won this leg
    let winningPlayerId = null;
    const lastProcessed = processedThrows[processedThrows.length - 1];
    if (lastProcessed) {
        ['home', 'away'].forEach(side => {
            if (lastProcessed[side] && lastProcessed[side].remaining === 0) {
                winningPlayerId = getPlayerId(lastProcessed[side].player);
            }
        });
    }

    // === CORK INFERENCE from final round ===
    // If only one side threw in the final round → that side had cork (checked out before opponent threw)
    // If both sides threw → loser had cork (threw first, didn't finish, opponent finished second)
    let corkSide = null;
    if (lastProcessed) {
        const hasHome = lastProcessed.home !== null;
        const hasAway = lastProcessed.away !== null;

        if (hasHome && !hasAway) {
            corkSide = 'home';
        } else if (hasAway && !hasHome) {
            corkSide = 'away';
        } else if (hasHome && hasAway) {
            // Both threw — loser had cork (threw first, didn't check out)
            if (lastProcessed.home.remaining === 0) corkSide = 'away';
            else if (lastProcessed.away.remaining === 0) corkSide = 'home';
        }
    }

    // === SECOND PASS: Group by player and accumulate stats ===
    const playerThrowsMap = {};
    processedThrows.forEach(throwData => {
        ['home', 'away'].forEach(side => {
            const info = throwData[side];
            if (!info) return;

            const playerId = getPlayerId(info.player);
            if (!playerId) {
                console.log(`Warning: Unknown player "${info.player}"`);
                return;
            }

            if (!playerThrowsMap[playerId]) {
                playerThrowsMap[playerId] = [];
            }
            playerThrowsMap[playerId].push(info);
        });
    });

    Object.keys(playerThrowsMap).forEach(playerId => {
        const pThrows = playerThrowsMap[playerId];
        const stats = playerStats[playerId];

        stats.x01_legs_played++;

        let totalDarts = 0;
        let totalPoints = 0;
        let first9Points = 0;

        pThrows.forEach((throwInfo, idx) => {
            const actualScore = throwInfo.actualScore;
            const remaining = throwInfo.remaining;
            const isCheckout = (remaining === 0);
            const checkoutDarts = throwInfo.checkout_darts || 3;
            const remainingAtStart = throwInfo.remainingAtStart;

            // Determine darts used this round
            let dartsThisRound = 3;
            if (isCheckout) {
                dartsThisRound = checkoutDarts;
            }

            totalDarts += dartsThisRound;
            if (actualScore !== null) {
                totalPoints += actualScore;
            }

            // First 9 tracking (first 3 of THIS player's throws = their first 9 darts)
            if (idx < 3 && actualScore !== null) {
                first9Points += actualScore;
            }

            // Tons tracking (only with verified scores)
            if (actualScore !== null) {
                if (actualScore >= 180) {
                    stats.x01_ton_80++;
                    if (debugInfo) debugInfo.tons.push({ player: throwInfo.player, score: 180, round: throwInfo.throwIdx + 1 });
                } else if (actualScore >= 160) {
                    stats.x01_ton_60++;
                    if (debugInfo) debugInfo.tons.push({ player: throwInfo.player, score: `160-179 (${actualScore})`, round: throwInfo.throwIdx + 1 });
                } else if (actualScore >= 140) {
                    stats.x01_ton_40++;
                    if (debugInfo) debugInfo.tons.push({ player: throwInfo.player, score: `140-159 (${actualScore})`, round: throwInfo.throwIdx + 1 });
                } else if (actualScore >= 120) {
                    stats.x01_ton_20++;
                    if (debugInfo) debugInfo.tons.push({ player: throwInfo.player, score: `120-139 (${actualScore})`, round: throwInfo.throwIdx + 1 });
                } else if (actualScore >= 100) {
                    stats.x01_ton_00++;
                    if (debugInfo) debugInfo.tons.push({ player: throwInfo.player, score: `100-119 (${actualScore})`, round: throwInfo.throwIdx + 1 });
                }

                if (actualScore >= 100) {
                    stats.x01_tons++;
                }

                if (actualScore > stats.x01_high_score) {
                    stats.x01_high_score = actualScore;
                }
            }

            // Checkout tracking (only when remainingAtStart is valid)
            if (remainingAtStart !== undefined && remainingAtStart !== null && remainingAtStart <= 170) {
                stats.x01_checkout_attempts++;

                if (remainingAtStart >= 161) {
                    stats.x01_co_161_attempts++;
                    if (isCheckout) {
                        stats.x01_co_161_hits++;
                        if (debugInfo) debugInfo.checkouts.push({ player: throwInfo.player, remaining: remainingAtStart, hit: true });
                    }
                } else if (remainingAtStart >= 140) {
                    stats.x01_co_140_attempts++;
                    if (isCheckout) {
                        stats.x01_co_140_hits++;
                        if (debugInfo) debugInfo.checkouts.push({ player: throwInfo.player, remaining: remainingAtStart, hit: true });
                    }
                } else if (remainingAtStart >= 120) {
                    stats.x01_co_120_attempts++;
                    if (isCheckout) {
                        stats.x01_co_120_hits++;
                        if (debugInfo) debugInfo.checkouts.push({ player: throwInfo.player, remaining: remainingAtStart, hit: true });
                    }
                } else if (remainingAtStart >= 80) {
                    stats.x01_co_80_attempts++;
                    if (isCheckout) {
                        stats.x01_co_80_hits++;
                        if (debugInfo) debugInfo.checkouts.push({ player: throwInfo.player, remaining: remainingAtStart, hit: true });
                    }
                }
            }

            // Checkout hit
            if (isCheckout) {
                stats.x01_checkouts_hit++;
                const checkoutValue = remainingAtStart;
                stats.x01_total_checkout_points += checkoutValue;

                if (checkoutValue > stats.x01_high_checkout) {
                    stats.x01_high_checkout = checkoutValue;
                }

                if (totalDarts < stats.x01_best_leg) {
                    stats.x01_best_leg = totalDarts;
                }
            }
        });

        // Update totals
        stats.x01_total_darts += totalDarts;
        stats.x01_total_points += totalPoints;
        stats.x01_first9_darts += Math.min(pThrows.length * 3, 9);
        stats.x01_first9_points += first9Points;

        // Check if this player won the leg
        if (playerId === winningPlayerId) {
            stats.x01_legs_won++;
        }

        // With/against darts tracking
        if (corkSide) {
            const playerSide = pThrows[0].side;
            if (playerSide === corkSide) {
                stats.x01_legs_with_darts++;
                if (playerId === winningPlayerId) stats.x01_legs_with_darts_won++;
            } else {
                stats.x01_legs_against_darts++;
                if (playerId === winningPlayerId) stats.x01_legs_against_darts_won++;
            }
        }
    });
}

function processCricketLeg(leg, playerStats, debugInfo = null) {
    const throws = leg.throws || [];
    const winningSide = leg.winner; // 'home' or 'away'

    // Determine who won this leg (find the player on winning side who closed)
    let winningPlayerId = null;
    const lastThrow = throws[throws.length - 1];
    if (lastThrow && winningSide) {
        const winningPlayer = lastThrow[winningSide]?.player;
        if (winningPlayer) {
            winningPlayerId = getPlayerId(winningPlayer);
        }
    }

    // Cork inference from final round (same logic as X01)
    let corkSide = null;
    if (lastThrow) {
        const hasHome = lastThrow.home !== null && lastThrow.home !== undefined && lastThrow.home.player;
        const hasAway = lastThrow.away !== null && lastThrow.away !== undefined && lastThrow.away.player;

        if (hasHome && !hasAway) {
            corkSide = 'home';
        } else if (hasAway && !hasHome) {
            corkSide = 'away';
        } else if (hasHome && hasAway) {
            // Both threw — loser had cork (threw first)
            const losingSide = winningSide === 'home' ? 'away' : 'home';
            corkSide = losingSide;
        }
    }

    // Track players in this leg
    const playerThrows = {};

    throws.forEach((throwData, throwIdx) => {
        ['home', 'away'].forEach(side => {
            const throwInfo = throwData[side];
            if (!throwInfo || !throwInfo.player) return;

            const playerName = throwInfo.player;
            const playerId = getPlayerId(playerName);
            if (!playerId) {
                console.log(`Warning: Unknown player "${playerName}"`);
                return;
            }

            if (!playerThrows[playerId]) {
                playerThrows[playerId] = [];
            }
            playerThrows[playerId].push({ ...throwInfo, throwIdx, side });
        });
    });

    // Process each player's throws
    Object.keys(playerThrows).forEach(playerId => {
        const throws = playerThrows[playerId];
        const stats = playerStats[playerId];

        // Legs played
        stats.cricket_legs_played++;

        let totalDarts = 0;
        let totalMarks = 0;
        let legWon = false;

        throws.forEach((throwInfo, idx) => {
            const marks = throwInfo.marks || 0;
            const hit = throwInfo.hit || '';
            const closeout = throwInfo.closed_out || throwInfo.closeout || false;
            const closeoutDarts = throwInfo.closeout_darts || 3;

            // Determine darts used this round
            let dartsThisRound = 3;
            if (closeout) {
                dartsThisRound = closeoutDarts;
                legWon = true;
            }

            totalDarts += dartsThisRound;
            totalMarks += marks;

            // Mark rounds tracking
            if (marks === 9) {
                stats.cricket_nine_mark_rounds++;
                if (debugInfo) debugInfo.cricketMarks.push({ player: throwInfo.player, marks: 9 });
            } else if (marks === 8) {
                stats.cricket_eight_mark_rounds++;
                if (debugInfo) debugInfo.cricketMarks.push({ player: throwInfo.player, marks: 8 });
            } else if (marks === 7) {
                stats.cricket_seven_mark_rounds++;
                if (debugInfo) debugInfo.cricketMarks.push({ player: throwInfo.player, marks: 7 });
            } else if (marks === 6) {
                stats.cricket_six_mark_rounds++;
                if (debugInfo) debugInfo.cricketMarks.push({ player: throwInfo.player, marks: 6 });
            } else if (marks === 5) {
                stats.cricket_five_mark_rounds++;
                if (debugInfo) debugInfo.cricketMarks.push({ player: throwInfo.player, marks: 5 });
            }

            if (marks > stats.cricket_high_mark_round) {
                stats.cricket_high_mark_round = marks;
            }

            // Hat tricks (3+ bull marks)
            const hitLower = hit.toLowerCase();
            const bullCount = (hitLower.match(/\bb\b|bull/g) || []).length;
            if (bullCount >= 3) {
                stats.cricket_hat_tricks++;
                if (debugInfo) debugInfo.cricketHatTricks.push({ player: throwInfo.player, hit });
            }
        });

        // Update totals
        stats.cricket_total_darts += totalDarts;
        stats.cricket_total_marks += totalMarks;

        // Check if this player won the leg
        if (playerId === winningPlayerId) {
            stats.cricket_legs_won++;
        }

        // With/against darts tracking
        if (corkSide) {
            const playerSide = throws[0].side;
            if (playerSide === corkSide) {
                stats.cricket_legs_with_darts++;
                if (playerId === winningPlayerId) stats.cricket_legs_with_darts_won++;
            } else {
                stats.cricket_legs_against_darts++;
                if (playerId === winningPlayerId) stats.cricket_legs_against_darts_won++;
            }
        }
    });
}

async function recalculateAllStats() {
    console.log('Starting comprehensive stats recalculation...\n');

    // Initialize stats for all players
    const playerStats = {};
    Object.values(PLAYER_IDS).forEach(playerId => {
        playerStats[playerId] = createEmptyStats();
    });

    // Fetch all matches
    const matchesRef = db.collection('leagues').doc(LEAGUE_ID).collection('matches');
    const matchesSnap = await matchesRef.get();

    console.log(`Found ${matchesSnap.size} matches to process\n`);

    let firstMatchDebug = null;
    let matchCount = 0;

    for (const matchDoc of matchesSnap.docs) {
        const matchData = matchDoc.data();
        const matchId = matchDoc.id;
        matchCount++;

        const isFirstMatch = matchCount === 1;
        const debugInfo = isFirstMatch ? {
            matchId,
            tons: [],
            checkouts: [],
            cricketMarks: [],
            cricketHatTricks: []
        } : null;

        if (isFirstMatch) {
            console.log(`[DEBUG] Processing first match: ${matchId}\n`);
            firstMatchDebug = debugInfo;
        }

        const games = matchData.games || [];

        games.forEach(game => {
            const legs = game.legs || [];
            const format = game.format;

            legs.forEach(leg => {
                if (isX01Format(format)) {
                    processX01Leg(leg, playerStats, debugInfo);
                } else if (isCricketFormat(format)) {
                    processCricketLeg(leg, playerStats, debugInfo);
                }
            });
        });
    }

    // Calculate averages
    Object.keys(playerStats).forEach(playerId => {
        const stats = playerStats[playerId];

        // X01 3DA
        if (stats.x01_total_darts > 0) {
            stats.x01_three_dart_avg = (stats.x01_total_points / stats.x01_total_darts) * 3;
        }

        // Cricket MPR
        if (stats.cricket_total_darts > 0) {
            stats.cricket_mpr = stats.cricket_total_marks / (stats.cricket_total_darts / 3);
        }

        // Reset best_leg if no legs won
        if (stats.x01_best_leg === 999) {
            stats.x01_best_leg = 0;
        }
    });

    // Write stats to Firestore
    console.log('\nWriting stats to Firestore...\n');
    const batch = db.batch();
    let updateCount = 0;

    Object.keys(playerStats).forEach(playerId => {
        const stats = playerStats[playerId];
        const statsRef = db.collection('leagues').doc(LEAGUE_ID).collection('stats').doc(playerId);
        batch.set(statsRef, stats, { merge: false }); // Replace, don't merge
        updateCount++;
    });

    await batch.commit();
    console.log(`Updated ${updateCount} player stat documents\n`);

    // Print summary
    console.log('=== RECALCULATION SUMMARY ===\n');
    console.log(`Matches processed: ${matchCount}`);
    console.log(`Players updated: ${updateCount}\n`);

    // Print first match debug info
    if (firstMatchDebug) {
        console.log(`=== FIRST MATCH DEBUG (${firstMatchDebug.matchId}) ===\n`);

        console.log('Tons found:');
        firstMatchDebug.tons.forEach(t => {
            console.log(`  ${t.player}: ${t.score} (Round ${t.round})`);
        });
        console.log(`Total tons: ${firstMatchDebug.tons.length}\n`);

        console.log('Checkouts found:');
        firstMatchDebug.checkouts.forEach(c => {
            console.log(`  ${c.player}: ${c.remaining} (${c.hit ? 'HIT' : 'MISS'})`);
        });
        console.log(`Total checkout hits: ${firstMatchDebug.checkouts.length}\n`);

        console.log('Cricket 5+ mark rounds:');
        firstMatchDebug.cricketMarks.forEach(m => {
            console.log(`  ${m.player}: ${m.marks} marks`);
        });
        console.log(`Total 5+ mark rounds: ${firstMatchDebug.cricketMarks.length}\n`);

        console.log('Cricket hat tricks:');
        firstMatchDebug.cricketHatTricks.forEach(h => {
            console.log(`  ${h.player}: ${h.hit}`);
        });
        console.log(`Total hat tricks: ${firstMatchDebug.cricketHatTricks.length}\n`);
    }

    // Print sample player stats
    console.log('=== SAMPLE PLAYER STATS ===\n');
    const samplePlayers = [
        { name: 'Matt Pagel', id: PLAYER_IDS['Matt Pagel'] },
        { name: 'Jennifer Malek', id: PLAYER_IDS['Jennifer Malek'] },
        { name: 'Christian Ketchum', id: PLAYER_IDS['Christian Ketchum'] }
    ];

    samplePlayers.forEach(({ name, id }) => {
        const stats = playerStats[id];
        console.log(`${name}:`);
        console.log(`  X01: ${stats.x01_legs_won}/${stats.x01_legs_played} legs, ${stats.x01_three_dart_avg.toFixed(2)} avg`);
        console.log(`  Tons: ${stats.x01_tons} (180:${stats.x01_ton_80}, 60+:${stats.x01_ton_60}, 40+:${stats.x01_ton_40})`);
        console.log(`  Checkouts: ${stats.x01_checkouts_hit}/${stats.x01_checkout_attempts} (${stats.x01_checkout_attempts > 0 ? ((stats.x01_checkouts_hit/stats.x01_checkout_attempts)*100).toFixed(1) : 0}%)`);
        console.log(`  Best leg: ${stats.x01_best_leg} darts`);
        console.log(`  Cricket: ${stats.cricket_legs_won}/${stats.cricket_legs_played} legs, ${stats.cricket_mpr.toFixed(2)} MPR`);
        console.log(`  Cricket 5+ marks: ${stats.cricket_five_mark_rounds + stats.cricket_six_mark_rounds + stats.cricket_seven_mark_rounds + stats.cricket_eight_mark_rounds + stats.cricket_nine_mark_rounds}`);
        console.log('');
    });

    console.log('Recalculation complete!');
}

// Run the script
recalculateAllStats()
    .then(() => {
        console.log('\nScript finished successfully');
        process.exit(0);
    })
    .catch(error => {
        console.error('\nError:', error);
        process.exit(1);
    });
