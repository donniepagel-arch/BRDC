const {parseRTFMatch} = require('./parse-rtf.js');

const games = parseRTFMatch('trips league/week 2/dpartlo v mpagel.rtf');
const stats = {};

games.forEach(g => {
    g.legs.forEach(l => {
        if (l.type.includes('501')) {
            Object.entries(l.player_stats || {}).forEach(([name, st]) => {
                if (!stats[name]) stats[name] = {darts: 0, points: 0};
                stats[name].darts += st.darts || 0;
                stats[name].points += st.points || 0;
            });
        }
    });
});

console.log('Stats calculated directly from RTF parse:');
console.log('(This should match DartConnect exactly)\n');

['Dan Partlo', 'Joe Donley', 'Kevin Mckelvey', 'Matt Pagel', 'Joe Peters', 'John Linden'].forEach(name => {
    if (stats[name]) {
        const avg = ((stats[name].points / stats[name].darts) * 3).toFixed(2);
        console.log(name + ':', avg, `(${stats[name].darts} darts, ${stats[name].points} points)`);
    }
});

console.log('\nDartConnect values for comparison:');
console.log('Dan Partlo: 51.43');
console.log('Joe Donley: 56.03');
console.log('Kevin Mckelvey: 38.50');
