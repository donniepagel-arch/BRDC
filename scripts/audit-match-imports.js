/**
 * Audit Match Imports Script
 *
 * Audits all imported matches in the triples league for data completeness.
 * Uses the deployed getMatchDetails function to retrieve full match data.
 *
 * Usage: node scripts/audit-match-imports.js
 */

const https = require('https');
const fs = require('fs');
const path = require('path');
const admin = require('../functions/node_modules/firebase-admin');

const LEAGUE_ID = 'aOq4Y0ETxPZ66tM1uUtP';
const BASE_URL = 'https://us-central1-brdc-v2.cloudfunctions.net';

// Expected structure for a triples league match
const EXPECTED_GAMES = 9; // 9 sets per match
const EXPECTED_LEGS_PER_GAME = 3; // Best of 3 legs

// Match ID to RTF file mapping for reimport reference
const MATCH_RTF_MAP = {
    // Week 1
    'sgmoL4GyVUYP67aOS7wm': { file: 'week 1/pagel v pagel MATCH.rtf', name: 'M. Pagel vs D. Pagel' },
    'JqiWABEBS7Bqk8n7pKxD': { file: 'week 1/yasenchak v kull.rtf', name: 'Yasenchak vs Kull' },
    '0lxEeuAa7fEDSVeY3uCG': { file: 'week 1/partlo v olschansky.rtf', name: 'Partlo vs Olschansky' },
    'nYv1XeGTWbaxBepI6F5u': { file: 'week 1/mezlak v russano.rtf', name: 'Mezlak vs Russano' },
    'OTYlCe3NNbinKlpZccwS': { file: 'week 1/massimiani v ragnoni.rtf', name: 'Massimiani vs Ragnoni' },
    // Week 2
    'ixNMXr2jT5f7hDD6qFDj': { file: 'week 2/dpartlo v mpagel.rtf', name: 'Partlo vs M.Pagel' },
    'YFpeyQPYEQQjMLEu1eVp': { file: 'week 2/massimiani v yasenchak.rtf', name: 'Massimiani vs Yasenchak' },
    'tcI1eFfOlHaTyhjaCGOj': { file: 'week 2/mezlak V e.o.rtf', name: 'Mezlak vs E.O' },
    'Iychqt7Wto8S9m7proeH': { file: 'week 2/pagel v kull.rtf', name: 'D.Pagel vs Kull' },
    '9unWmN7TmQgNEhFlhpuB': { file: 'week 2/russano v ragnoni.rtf', name: 'Russano vs Ragnoni' }
};

let firestore = null;

async function httpGet(url) {
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    reject(new Error(`Failed to parse response: ${data.substring(0, 200)}`));
                }
            });
        }).on('error', reject);
    });
}

async function httpPost(url, body) {
    return new Promise((resolve, reject) => {
        const postData = JSON.stringify(body);
        const urlObj = new URL(url);

        const options = {
            hostname: urlObj.hostname,
            path: urlObj.pathname,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData)
            }
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    reject(new Error(`Failed to parse response: ${data.substring(0, 200)}`));
                }
            });
        });

        req.on('error', reject);
        req.write(postData);
        req.end();
    });
}

async function getMatchDetails(matchId) {
    const url = `${BASE_URL}/getMatchDetails?leagueId=${LEAGUE_ID}&matchId=${matchId}`;
    return httpGet(url);
}

async function listMatches() {
    const url = `${BASE_URL}/listLeagueMatches`;
    return httpPost(url, { league_id: LEAGUE_ID });
}

async function getRawMatch(matchId) {
    const snap = await firestore.collection('leagues').doc(LEAGUE_ID).collection('matches').doc(matchId).get();
    return snap.exists ? snap.data() : null;
}

function isLegacySummaryMatch(rawMatch) {
    if (!rawMatch) return false;
    if (rawMatch.legacy_summary_only === true) return true;
    if (rawMatch.import_truth_source === 'legacy_summary_stats') return true;
    if (typeof rawMatch.import_review_status === 'string' && rawMatch.import_review_status.startsWith('legacy_summary')) {
        return true;
    }
    return false;
}

function getLegacyMissingThrowGames(rawMatch) {
    if (!rawMatch || !Array.isArray(rawMatch.legacy_summary_missing_throw_games)) {
        return [];
    }
    return rawMatch.legacy_summary_missing_throw_games;
}

function auditMatch(matchDetails) {
    const issues = [];
    const warnings = [];
    const metadata = {
        missingThrowGames: []
    };

    // Check basic info
    if (!matchDetails.homeTeam) issues.push('Missing home team name');
    if (!matchDetails.awayTeam) issues.push('Missing away team name');
    if (!matchDetails.status) issues.push('Missing status');
    if (matchDetails.homeScore === undefined) issues.push('Missing home score');
    if (matchDetails.awayScore === undefined) issues.push('Missing away score');

    // Check games array
    if (!matchDetails.games || matchDetails.gamesCount === 0) {
        issues.push('No games array');
        return { issues, warnings, stats: null, metadata };
    }

    if (matchDetails.gamesCount < EXPECTED_GAMES) {
        issues.push(`Only ${matchDetails.gamesCount} games (expected ${EXPECTED_GAMES})`);
    } else if (matchDetails.gamesCount > EXPECTED_GAMES) {
        warnings.push(`${matchDetails.gamesCount} games (expected ${EXPECTED_GAMES})`);
    }

    // Check each game
    let gamesWithThrows = 0;
    let gamesWithPlayerStats = 0;
    let gamesWithWinner = 0;
    let totalLegs = 0;

    for (const game of matchDetails.games) {
        if (game.hasThrows) {
            gamesWithThrows++;
        } else {
            metadata.missingThrowGames.push(game.game);
        }

        if (game.hasPlayerStats) gamesWithPlayerStats++;
        if (game.winner) gamesWithWinner++;
        if (game.legsCount) totalLegs += game.legsCount;

        if (!game.winner && matchDetails.status === 'completed') {
            issues.push(`Game ${game.game} missing winner`);
        }

        if (!game.hasThrows) {
            issues.push(`Game ${game.game} missing throws data`);
        }

        if (!game.hasPlayerStats) {
            warnings.push(`Game ${game.game} missing player stats`);
        }

        if (game.legsCount === 0) {
            issues.push(`Game ${game.game} has no legs`);
        }

        // Check sample leg for player names
        if (game.sampleLeg) {
            const playerKeys = game.sampleLeg.playerStatsKeys || [];
            const hasUndefined = playerKeys.some(k => !k || k === 'undefined' || k === 'null');
            if (hasUndefined) {
                issues.push(`Game ${game.game} has undefined/null player names`);
            }
            if (playerKeys.length === 0 && game.hasThrows) {
                issues.push(`Game ${game.game} has throws but no player names`);
            }
        }
    }

    const stats = {
        gamesCount: matchDetails.gamesCount,
        gamesWithThrows,
        gamesWithPlayerStats,
        gamesWithWinner,
        totalLegs,
        totalDarts: matchDetails.totalDarts || 0
    };

    if (gamesWithThrows < matchDetails.gamesCount) {
        issues.push(`Only ${gamesWithThrows}/${matchDetails.gamesCount} games have throw data`);
    }

    return { issues, warnings, stats, metadata };
}

function summarizeLegacyNote(rawMatch) {
    if (!rawMatch) return null;
    return rawMatch.legacy_summary_note || 'Stored match retains leg winners and player stats, but not full throw-by-throw detail.';
}

function determineStatus(audit, rawMatch) {
    if (audit.issues.length === 0) {
        return 'PASS';
    }

    if (isLegacySummaryMatch(rawMatch)) {
        const nonThrowIssues = audit.issues.filter(issue => (
            !issue.includes('missing throws data') &&
            !issue.includes('games have throw data')
        ));

        if (nonThrowIssues.length === 0) {
            return 'LEGACY_SUMMARY';
        }
    }

    return 'FAIL';
}

async function runAudit() {
    console.log('=== MATCH IMPORT AUDIT ===\n');
    console.log(`League ID: ${LEAGUE_ID}`);
    console.log(`Expected: ${EXPECTED_GAMES} sets per match, best of ${EXPECTED_LEGS_PER_GAME} legs\n`);

    if (!admin.apps.length) {
        admin.initializeApp({ projectId: 'brdc-v2' });
    }
    firestore = admin.firestore();

    console.log('Fetching match list...\n');
    const matchListResponse = await listMatches();

    if (!matchListResponse.success) {
        console.error('Failed to get match list:', matchListResponse.error);
        process.exit(1);
    }

    const matches = matchListResponse.matches;
    console.log(`Found ${matches.length} total matches\n`);

    const completedMatches = matches.filter(m => m.status === 'completed');
    const scheduledMatches = matches.filter(m => m.status === 'scheduled');

    console.log(`Completed: ${completedMatches.length}`);
    console.log(`Scheduled: ${scheduledMatches.length}\n`);

    const results = [];

    for (const match of completedMatches) {
        console.log(`Auditing ${match.id}...`);

        try {
            const [details, rawMatch] = await Promise.all([
                getMatchDetails(match.id),
                getRawMatch(match.id)
            ]);

            if (details.error) {
                results.push({
                    id: match.id,
                    week: match.week,
                    homeTeam: 'Unknown',
                    awayTeam: 'Unknown',
                    status: 'ERROR',
                    issues: [`API Error: ${details.error}`],
                    warnings: [],
                    stats: null,
                    rtfFile: MATCH_RTF_MAP[match.id]?.file || null,
                    legacy: false,
                    rawMatch
                });
                continue;
            }

            const audit = auditMatch(details);
            const status = determineStatus(audit, rawMatch);

            results.push({
                id: match.id,
                week: match.week,
                homeTeam: details.homeTeam,
                awayTeam: details.awayTeam,
                score: `${details.homeScore}-${details.awayScore}`,
                status,
                issues: audit.issues,
                warnings: audit.warnings,
                stats: audit.stats,
                metadata: audit.metadata,
                rtfFile: MATCH_RTF_MAP[match.id]?.file || null,
                legacy: status === 'LEGACY_SUMMARY',
                legacyNote: summarizeLegacyNote(rawMatch),
                rawMatch
            });

        } catch (error) {
            results.push({
                id: match.id,
                week: match.week,
                homeTeam: 'Unknown',
                awayTeam: 'Unknown',
                status: 'ERROR',
                issues: [`Exception: ${error.message}`],
                warnings: [],
                stats: null,
                rtfFile: MATCH_RTF_MAP[match.id]?.file || null,
                legacy: false
            });
        }
    }

    const report = generateReport(results, matches.length, completedMatches.length, scheduledMatches.length);

    console.log('\n' + report);

    const reportPath = path.join(__dirname, '..', 'docs', 'work-tracking', 'MATCH-IMPORT-AUDIT.md');
    fs.writeFileSync(reportPath, report);
    console.log(`\nReport saved to: ${reportPath}`);

    process.exit(0);
}

function generateReport(results, totalMatches, completedCount, scheduledCount) {
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });

    const passCount = results.filter(r => r.status === 'PASS').length;
    const legacyCount = results.filter(r => r.status === 'LEGACY_SUMMARY').length;
    const failCount = results.filter(r => r.status === 'FAIL').length;
    const errorCount = results.filter(r => r.status === 'ERROR').length;

    let report = `# Match Import Audit Report

Generated: ${dateStr}
League ID: ${LEAGUE_ID}

## Summary

| Metric | Count |
|--------|-------|
| Total Matches | ${totalMatches} |
| Completed | ${completedCount} |
| Scheduled | ${scheduledCount} |
| **PASS** | ${passCount} |
| **LEGACY SUMMARY** | ${legacyCount} |
| **FAIL** | ${failCount} |
| **ERROR** | ${errorCount} |

---

## Expected Match Structure

- **9 sets** per match (5 singles + 4 doubles)
- **Best of 3 legs** per set (1-3 legs depending on winner)
- Preferred source-of-truth:
  - \`throws[]\` array with actual throw data
  - \`player_stats\` with player names
  - \`winner\` field
- Legacy-summary matches are separated instead of being counted as clean throw-complete imports.

---

`;

    const failedMatches = results.filter(r => r.status === 'FAIL' || r.status === 'ERROR');
    if (failedMatches.length > 0) {
        report += `## FAILED MATCHES - ${failedMatches.length} items\n\n`;
        report += `These matches still need source recovery or import repair:\n\n`;

        const byWeek = {};
        failedMatches.forEach(m => {
            const week = m.week || 'unknown';
            if (!byWeek[week]) byWeek[week] = [];
            byWeek[week].push(m);
        });

        Object.keys(byWeek).sort((a, b) => a - b).forEach(week => {
            report += `### Week ${week}\n\n`;

            byWeek[week].forEach(match => {
                report += `#### ${match.homeTeam} vs ${match.awayTeam}\n\n`;
                report += `- **Match ID:** \`${match.id}\`\n`;
                report += `- **Score:** ${match.score || 'N/A'}\n`;
                report += `- **Status:** ${match.status}\n`;

                if (match.rtfFile) {
                    report += `- **RTF File:** \`temp/trips league/${match.rtfFile}\`\n`;
                }

                if (match.stats) {
                    report += `- **Games:** ${match.stats.gamesCount} (${match.stats.gamesWithThrows} with throws)\n`;
                    report += `- **Total Legs:** ${match.stats.totalLegs}\n`;
                    report += `- **Total Darts:** ${match.stats.totalDarts}\n`;
                }

                report += `\n**Issues:**\n`;
                match.issues.forEach(issue => {
                    report += `- ${issue}\n`;
                });

                if (match.warnings.length > 0) {
                    report += `\n**Warnings:**\n`;
                    match.warnings.forEach(warn => {
                        report += `- ${warn}\n`;
                    });
                }

                report += '\n---\n\n';
            });
        });
    }

    const legacyMatches = results.filter(r => r.status === 'LEGACY_SUMMARY');
    if (legacyMatches.length > 0) {
        report += `## LEGACY SUMMARY MATCHES - ${legacyMatches.length} items\n\n`;
        report += `These matches preserve winners and player stats, but stored source no longer contains full turn-by-turn throws. They were normalized and tagged so they no longer masquerade as throw-complete imports.\n\n`;

        legacyMatches.forEach(match => {
            report += `### Week ${match.week}: ${match.homeTeam} vs ${match.awayTeam}\n\n`;
            report += `- **Match ID:** \`${match.id}\`\n`;
            report += `- **Score:** ${match.score}\n`;
            report += `- **Status:** LEGACY SUMMARY\n`;

            if (match.stats) {
                report += `- **Games:** ${match.stats.gamesCount} (${match.stats.gamesWithThrows} with throws)\n`;
                report += `- **Total Legs:** ${match.stats.totalLegs}\n`;
                report += `- **Total Darts:** ${match.stats.totalDarts}\n`;
            }

            const missingGames = match.rawMatch ? getLegacyMissingThrowGames(match.rawMatch) : [];
            if (missingGames.length > 0) {
                report += `- **Missing Throw Games:** ${missingGames.join(', ')}\n`;
            }

            if (match.legacyNote) {
                report += `- **Legacy Note:** ${match.legacyNote}\n`;
            }

            if (match.warnings.length > 0) {
                report += `\n**Warnings:**\n`;
                match.warnings.forEach(warn => {
                    report += `- ${warn}\n`;
                });
            }

            report += '\n';
        });
    }

    const passedMatches = results.filter(r => r.status === 'PASS');
    if (passedMatches.length > 0) {
        report += `## PASSED MATCHES - ${passedMatches.length} items\n\n`;

        passedMatches.forEach(match => {
            report += `### Week ${match.week}: ${match.homeTeam} vs ${match.awayTeam}\n\n`;
            report += `- **Match ID:** \`${match.id}\`\n`;
            report += `- **Score:** ${match.score}\n`;

            if (match.stats) {
                report += `- **Games:** ${match.stats.gamesCount}\n`;
                report += `- **Total Legs:** ${match.stats.totalLegs}\n`;
                report += `- **Total Darts:** ${match.stats.totalDarts}\n`;
            }

            if (match.warnings.length > 0) {
                report += `\n**Warnings:**\n`;
                match.warnings.forEach(warn => {
                    report += `- ${warn}\n`;
                });
            }

            report += '\n';
        });
    }

    return report;
}

runAudit().catch(err => {
    console.error('Error:', err);
    process.exit(1);
});
