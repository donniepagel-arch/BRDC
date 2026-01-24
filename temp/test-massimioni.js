/**
 * Test Massimioni v Ragnoni conversion
 */
const { parseRTFMatch } = require('./parse-rtf.js');
const path = require('path');

const TEAM_ROSTERS = {
    'T. Massimiani': ['Tony Massimiani', 'Dominick Russano', 'Dom Russano', 'Chris Benco'],
    'J. Ragnoni': ['John Ragnoni', 'Marc Tate', 'David Brunner', 'Derek Fess', 'Josh Kelly', 'Joshua kelly']
};

function getTeamForPlayer(playerName, homeTeam, awayTeam) {
    const name = playerName.trim().toLowerCase();
    const homeRoster = TEAM_ROSTERS[homeTeam] || [];
    const awayRoster = TEAM_ROSTERS[awayTeam] || [];
    for (const p of homeRoster) {
        if (name.includes(p.toLowerCase()) || p.toLowerCase().includes(name)) return 'home';
    }
    for (const p of awayRoster) {
        if (name.includes(p.toLowerCase()) || p.toLowerCase().includes(name)) return 'away';
    }
    return null;
}

function getPlayerCombo(game) {
    const players = new Set();
    for (const leg of game.legs) {
        Object.keys(leg.player_stats || {}).forEach(p => players.add(p.toLowerCase()));
    }
    const playerList = Array.from(players);
    const hasT = playerList.some(p => p.includes('tony'));
    const hasC = playerList.some(p => p.includes('chris') || p.includes('benco'));
    const hasD = playerList.some(p => p.includes('dom') || p.includes('russano'));

    if (hasT && hasC && !hasD) return 'tony/chris';
    if (hasT && hasD && !hasC) return 'tony/dom';
    if (hasC && hasD && !hasT) return 'chris/dom';
    if (hasT && !hasC && !hasD) return 'tony';
    if (hasC && !hasT && !hasD) return 'chris';
    if (hasD && !hasT && !hasC) return 'dom';
    return '???';
}

function reorderGames(games, expectedOrder) {
    const byCombo = {};
    for (const g of games) {
        const combo = getPlayerCombo(g);
        if (!byCombo[combo]) byCombo[combo] = [];
        byCombo[combo].push(g);
    }
    const reordered = [];
    const used = {};
    for (const combo of expectedOrder) {
        if (!used[combo]) used[combo] = 0;
        if (byCombo[combo] && byCombo[combo][used[combo]]) {
            const game = byCombo[combo][used[combo]];
            game.gameNumber = reordered.length + 1;
            reordered.push(game);
            used[combo]++;
        }
    }
    return reordered;
}

const rtfPath = path.join(__dirname, 'trips league', 'massimiani v ragnoni.rtf');
let games = parseRTFMatch(rtfPath);

const expectedOrder = ['tony/chris', 'dom', 'tony', 'chris/dom', 'chris', 'tony', 'tony/dom', 'chris', 'dom'];
games = reorderGames(games, expectedOrder);

console.log('MASSIMIONI v RAGNONI - Test Conversion\n');

let homeWins = 0, awayWins = 0;
for (const g of games) {
    let homeLegWins = 0, awayLegWins = 0;

    for (const leg of g.legs) {
        let winner = null;
        const throws = leg.throws || [];
        const legType = (leg.type || g.type || '').toLowerCase();

        // Check for checkout
        for (const t of throws) {
            if (t.remaining === 0) {
                winner = getTeamForPlayer(t.player, 'T. Massimiani', 'J. Ragnoni');
                break;
            }
        }

        // Cricket - use parser winner
        if (!winner && legType.includes('cricket') && leg.winner) {
            for (const [name, stats] of Object.entries(leg.player_stats || {})) {
                if (stats.side === leg.winner) {
                    winner = getTeamForPlayer(name, 'T. Massimiani', 'J. Ragnoni');
                    break;
                }
            }
        }

        if (winner === 'home') homeLegWins++;
        else if (winner === 'away') awayLegWins++;
    }

    const setWinner = homeLegWins > awayLegWins ? 'home' : awayLegWins > homeLegWins ? 'away' : 'tie';
    if (setWinner === 'home') homeWins++;
    else if (setWinner === 'away') awayWins++;

    console.log('Set ' + g.gameNumber + ' (' + getPlayerCombo(g) + ', ' + g.type + '): ' + homeLegWins + '-' + awayLegWins + ' -> ' + setWinner);
}

console.log('\nFINAL: T. Massimiani ' + homeWins + ' - ' + awayWins + ' J. Ragnoni');
