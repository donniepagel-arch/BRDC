/**
 * Test Partlo v Olschansky
 */
const { parseRTFMatch } = require('./parse-rtf.js');
const path = require('path');

const TEAM_ROSTERS = {
    'D. Partlo': ['Dan Partlo', 'Joe Donley', 'Kevin Mckelvey'],
    'E. Olschansky': ['Eddie Olschansky', 'Eddie Olschanskey', 'Jeff Boss', 'Michael Gonzalez', 'Mike Gonzalez', 'Mike Gonzales']
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

const rtfPath = path.join(__dirname, 'trips league', 'partlo v olschansky.rtf');
const games = parseRTFMatch(rtfPath);

console.log('PARTLO v OLSCHANSKY\n');
console.log('Parsed', games.length, 'sets');

let homeWins = 0, awayWins = 0;
for (const g of games) {
    let homeLegWins = 0, awayLegWins = 0;
    for (const leg of g.legs) {
        let winner = null;
        const throws = leg.throws || [];
        const legType = (leg.type || g.type || '').toLowerCase();

        for (const t of throws) {
            if (t.remaining === 0) {
                winner = getTeamForPlayer(t.player, 'D. Partlo', 'E. Olschansky');
                break;
            }
        }

        if (!winner && legType.includes('cricket') && leg.winner) {
            for (const [name, stats] of Object.entries(leg.player_stats || {})) {
                if (stats.side === leg.winner) {
                    winner = getTeamForPlayer(name, 'D. Partlo', 'E. Olschansky');
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

    console.log('Set ' + g.gameNumber + ': ' + homeLegWins + '-' + awayLegWins + ' -> ' + setWinner);
}

console.log('\nFINAL: D. Partlo', homeWins, '-', awayWins, 'E. Olschansky');
