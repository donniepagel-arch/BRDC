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

function auditMatch(matchDetails) {
    const issues = [];
    const warnings = [];

    // Check basic info
    if (!matchDetails.homeTeam) issues.push('Missing home team name');
    if (!matchDetails.awayTeam) issues.push('Missing away team name');
    if (!matchDetails.status) issues.push('Missing status');
    if (matchDetails.homeScore === undefined) issues.push('Missing home score');
    if (matchDetails.awayScore === undefined) issues.push('Missing away score');

    // Check games array
    if (!matchDetails.games || matchDetails.gamesCount === 0) {
        issues.push('No games array');
        return { issues, warnings, stats: null };
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
        if (game.hasThrows) gamesWithThrows++;
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

    // Check if all games have data
    if (gamesWithThrows < matchDetails.gamesCount) {
        issues.push(`Only ${gamesWithThrows}/${matchDetails.gamesCount} games have throw data`);
    }

    return { issues, warnings, stats };
}

async function runAudit() {
    console.log('=== MATCH IMPORT AUDIT ===\n');
    console.log(`League ID: ${LEAGUE_ID}`);
    console.log(`Expected: ${EXPECTED_GAMES} sets per match, best of ${EXPECTED_LEGS_PER_GAME} legs\n`);

    // Get list of all matches
    console.log('Fetching match list...\n');
    const matchListResponse = await listMatches();

    if (!matchListResponse.success) {
        console.error('Failed to get match list:', matchListResponse.error);
        process.exit(1);
    }

    const matches = matchListResponse.matches;
    console.log(`Found ${matches.length} total matches\n`);

    // Separate by status
    const completedMatches = matches.filter(m => m.status === 'completed');
    const scheduledMatches = matches.filter(m => m.status === 'scheduled');

    console.log(`Completed: ${completedMatches.length}`);
    console.log(`Scheduled: ${scheduledMatches.length}\n`);

    // Audit each completed match
    const results = [];

    for (const match of completedMatches) {
        console.log(`Auditing ${match.id}...`);

        try {
            const details = await getMatchDetails(match.id);

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
                    rtfFile: MATCH_RTF_MAP[match.id]?.file || null
                });
                continue;
            }

            const audit = auditMatch(details);

            results.push({
                id: match.id,
                week: match.week,
                homeTeam: details.homeTeam,
                awayTeam: details.awayTeam,
                score: `${details.homeScore}-${details.awayScore}`,
                status: audit.issues.length === 0 ? 'PASS' : 'FAIL',
                issues: audit.issues,
                warnings: audit.warnings,
                stats: audit.stats,
                rtfFile: MATCH_RTF_MAP[match.id]?.file || null
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
                rtfFile: MATCH_RTF_MAP[match.id]?.file || null
            });
        }
    }

    // Generate report
    const report = generateReport(results, matches.length, completedMatches.length, scheduledMatches.length);

    // Print to console
    console.log('\n' + report);

    // Save to file
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
| **FAIL** | ${failCount} |
| **ERROR** | ${errorCount} |

---

## Expected Match Structure

- **9 sets** per match (5 singles + 4 doubles)
- **Best of 3 legs** per set (1-3 legs depending on winner)
- Each leg should have:
  - \`throws[]\` array with actual throw data
  - \`player_stats\` with player names
  - \`winner\` field

---

`;

    // Failed matches first
    const failedMatches = results.filter(r => r.status === 'FAIL' || r.status === 'ERROR');
    if (failedMatches.length > 0) {
        report += `## FAILED MATCHES - ${failedMatches.length} items\n\n`;
        report += `These matches need to be reimported:\n\n`;

        // Group by week
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

    // Passed matches
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

    // RTF files available for reimport
    report += `## RTF Files Available for Reimport\n\n`;
    report += `Located in \`temp/trips league/\`:\n\n`;
    report += `### Week 1\n`;
    report += `- pagel v pagel MATCH.rtf\n`;
    report += `- yasenchak v kull.rtf\n`;
    report += `- partlo v olschansky.rtf\n`;
    report += `- mezlak v russano.rtf\n`;
    report += `- massimiani v ragnoni.rtf\n\n`;
    report += `### Week 2\n`;
    report += `- dpartlo v mpagel.rtf\n`;
    report += `- massimiani v yasenchak.rtf\n`;
    report += `- mezlak V e.o.rtf\n`;
    report += `- pagel v kull.rtf\n`;
    report += `- russano v ragnoni.rtf\n\n`;

    return report;
}

runAudit().catch(err => {
    console.error('Error:', err);
    process.exit(1);
});
