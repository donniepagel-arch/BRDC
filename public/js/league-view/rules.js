// rules.js - Rules tab functionality for league-view
import { state } from './app.js';

export function renderRules() {
    if (!state.leagueData) return '<div class="empty-state"><div class="empty-state-icon">&#128220;</div><div>No rules data available</div></div>';
    const rules = state.leagueData.rules || {};
    const teamSize = state.leagueData.team_size || state.leagueData.min_players || 3;
    const rounds = Array.isArray(state.leagueData.match_format) ? state.leagueData.match_format : [];

    // Label mappings
    const inRuleLabels = { straight: 'Straight In', double: 'Double In', free: 'Straight In' };
    const outRuleLabels = { straight: 'Straight Out', double: 'Double Out', master: 'Master Out', free: 'Straight Out' };
    const pointSystemLabels = { game_based: 'Game-Based (1 point per game won)', match_based: 'Match-Based (2 points for win, 1 for draw)' };
    const playoffLabels = { none: 'No Playoffs', top_4_single: 'Top 4 Single Elimination', top_4_double: 'Top 4 Double Elimination', top_6_single: 'Top 6 Single Elimination', top_8_single: 'Top 8 Single Elimination' };
    const scheduleLabels = { round_robin: 'Round Robin', double_round_robin: 'Double Round Robin (Home & Away)' };
    const startRuleLabels = {
        cork_every_leg: 'Cork every leg',
        alternate_cork_first_deciding: 'Alternate, cork first & deciding',
        loser_starts_cork_first_deciding: 'Loser starts, cork first & deciding',
        winner_starts_cork_first_deciding: 'Winner starts, cork first & deciding'
    };
    const corkOptionLabels = {
        alternate_random_first_last: 'Alternate, randomize first & last',
        random_every_leg: 'Randomize every leg',
        away_team_option: 'Away team option',
        home_team_option: 'Home team option',
        loser_option: 'Loser option',
        winner_option: 'Winner option'
    };

    // Calculate total points from rounds
    const totalPoints = rounds.length > 0 ? rounds.reduce((sum, r) => sum + (r.points || 1), 0) : (state.leagueData.games_per_match || 9);

    // Render rounds detail
    function renderRoundsDetail() {
        if (rounds.length === 0) {
            // Fallback to basic format display
            const format = state.leagueData.format || '501';
            const bestOf = state.leagueData.best_of || 3;
            const inRule = inRuleLabels[state.leagueData.in_rule] || 'Straight In';
            const outRule = outRuleLabels[state.leagueData.checkout || state.leagueData.out_rule] || 'Double Out';
            return `
                <div class="rules-item">
                    <span class="rules-label">Default Format</span>
                    <span class="rules-value">${format.toUpperCase()} - Best of ${bestOf} - ${inRule} / ${outRule}</span>
                </div>
            `;
        }

        // Helper for game short names
        function getGameShortName(gameType, x01Value, short = false) {
            if (gameType === 'cricket') return short ? 'CRKT' : 'CRICKET';
            if (gameType === 'corks_choice') return short ? 'CHOICE' : "CORK'S CHOICE";
            if (gameType === 'x01') return x01Value || 'X01';
            return (gameType || '501').toUpperCase();
        }

        return rounds.map((r, idx) => {
            let gameType;
            if (r.game_type === 'mixed' && r.legs && r.legs.length > 0) {
                // Show actual games: "501/CRKT/CHOICE" (short names for mixed)
                const gameList = r.legs.map(leg => getGameShortName(leg.game_type, leg.x01_value, true));
                gameType = gameList.join(' / ');
            } else {
                gameType = getGameShortName(r.game_type, r.x01_value);
            }

            const bestOf = r.best_of || 3;
            const level = r.player_level || 'A';
            const players = r.num_players === 2 ? 'Doubles' : 'Singles';
            const points = r.points || 1;
            const isMixed = r.game_type === 'mixed';
            const inRule = (r.game_type === 'cricket' || isMixed) ? '' : (inRuleLabels[r.in_rule] || 'Straight In');
            const outRule = (r.game_type === 'cricket' || isMixed) ? '' : (outRuleLabels[r.out_rule] || 'Double Out');
            const rulesStr = (r.game_type === 'cricket' || isMixed) ? '' : ` (${inRule} / ${outRule})`;

            return `
                <div style="display: flex; align-items: center; gap: 12px; padding: 10px 12px; background: rgba(0,0,0,0.2); border-radius: 8px; margin-bottom: 8px;">
                    <div style="width: 32px; height: 32px; background: linear-gradient(135deg, var(--pink), #d63384); border-radius: 8px; display: flex; align-items: center; justify-content: center; font-family: 'Bebas Neue', cursive; font-size: 16px; font-weight: bold; flex-shrink: 0;">${idx + 1}</div>
                    <div style="flex: 1;">
                        <div style="font-weight: 600; color: var(--text-light);">${gameType} - Best of ${bestOf}${rulesStr}</div>
                        <div style="font-size: 12px; color: var(--text-dim);">${players} • ${level} Level • ${points} pt${points > 1 ? 's' : ''}</div>
                    </div>
                </div>
            `;
        }).join('');
    }

    // Render tiebreakers
    function renderTiebreakers() {
        const tiebreakers = state.leagueData.tiebreakers || [
            { value: 'head_to_head', enabled: true },
            { value: 'point_diff', enabled: true },
            { value: 'total_points', enabled: true }
        ];
        const tbLabels = {
            head_to_head: 'Head-to-Head',
            point_diff: 'Point Differential',
            total_points: 'Total Points Scored',
            cork_off: 'Cork-Off'
        };
        const enabled = tiebreakers.filter(t => t.enabled);
        if (enabled.length === 0) return 'Standard tiebreaker rules';
        return enabled.map((t, i) => `${i + 1}. ${tbLabels[t.value] || t.value}`).join(', ');
    }

    return `
        <div class="rules-container">
            <!-- League Overview -->
            <div class="rules-card">
                <div class="rules-card-header">LEAGUE OVERVIEW</div>
                <div class="rules-card-body">
                    <div class="rules-item">
                        <span class="rules-label">League Type</span>
                        <span class="rules-value">${state.leagueData.league_mode === 'team' ? 'Team League' : 'Draft League'}</span>
                    </div>
                    <div class="rules-item">
                        <span class="rules-label">Team Size</span>
                        <span class="rules-value">${teamSize} players per team${state.leagueData.max_roster ? ` (max ${state.leagueData.max_roster} on roster)` : ''}</span>
                    </div>
                    <div class="rules-item">
                        <span class="rules-label">Schedule</span>
                        <span class="rules-value">${scheduleLabels[state.leagueData.schedule_format] || 'Round Robin'}</span>
                    </div>
                    ${state.leagueData.entry_fee ? `
                    <div class="rules-item">
                        <span class="rules-label">Entry Fee</span>
                        <span class="rules-value">$${state.leagueData.entry_fee} per player</span>
                    </div>
                    ` : ''}
                    ${state.leagueData.allow_fillins ? `
                    <div class="rules-item">
                        <span class="rules-label">Fill-ins</span>
                        <span class="rules-value">Allowed during active season</span>
                    </div>
                    ` : ''}
                </div>
            </div>

            <!-- Match Format -->
            <div class="rules-card">
                <div class="rules-card-header">MATCH FORMAT (${rounds.length || state.leagueData.games_per_match || 9} ROUNDS • ${totalPoints} POINTS)</div>
                <div class="rules-card-body">
                    ${renderRoundsDetail()}
                </div>
            </div>

            <!-- Cork & Start Rules -->
            <div class="rules-card">
                <div class="rules-card-header">CORK & START RULES</div>
                <div class="rules-card-body">
                    <div class="rules-item">
                        <span class="rules-label">Start Rules</span>
                        <span class="rules-value">${startRuleLabels[state.leagueData.start_rules || state.leagueData.cork_rule] || 'Cork every leg'}</span>
                    </div>
                    <div class="rules-item">
                        <span class="rules-label">Cork Option</span>
                        <span class="rules-value">${corkOptionLabels[state.leagueData.cork_option] || 'Alternate'}</span>
                    </div>
                    ${state.leagueData.cork_winner_gets ? `
                    <div class="rules-item">
                        <span class="rules-label">Cork Winner Gets</span>
                        <span class="rules-value">${state.leagueData.cork_winner_gets === 'choose-and-start' ? 'Choose game AND start' : 'Choose game only'}</span>
                    </div>
                    ` : ''}
                </div>
            </div>

            <!-- Standings & Playoffs -->
            <div class="rules-card">
                <div class="rules-card-header">STANDINGS & PLAYOFFS</div>
                <div class="rules-card-body">
                    <div class="rules-item">
                        <span class="rules-label">Point System</span>
                        <span class="rules-value">${pointSystemLabels[state.leagueData.point_system] || 'Game-Based'}</span>
                    </div>
                    <div class="rules-item">
                        <span class="rules-label">Tiebreakers</span>
                        <span class="rules-value">${renderTiebreakers()}</span>
                    </div>
                    <div class="rules-item">
                        <span class="rules-label">Playoffs</span>
                        <span class="rules-value">${playoffLabels[state.leagueData.playoff_format] || 'No Playoffs'}</span>
                    </div>
                    ${state.leagueData.level_rules ? `
                    <div class="rules-item">
                        <span class="rules-label">Level Rules</span>
                        <span class="rules-value">${state.leagueData.level_rules === 'strict' ? 'Strict (must match level)' : state.leagueData.level_rules === 'play_up' ? 'Can play up, not down' : 'Flexible'}</span>
                    </div>
                    ` : ''}
                </div>
            </div>

            <!-- Additional Rules -->
            ${state.leagueData.league_rules ? `
            <div class="rules-card">
                <div class="rules-card-header">ADDITIONAL RULES</div>
                <div class="rules-card-body">
                    <p style="color: var(--text-dim); white-space: pre-wrap; line-height: 1.6;">${state.leagueData.league_rules}</p>
                </div>
            </div>
            ` : ''}
        </div>
    `;
}
