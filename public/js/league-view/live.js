// live.js - Live matches functionality for league-view
import { state } from './app.js';

export function renderLive() {
    // Get matches currently in progress
    const liveMatches = state.matches.filter(m => m.status === 'in_progress');

    if (liveMatches.length === 0) {
        return `
            <div class="empty-state">
                <div class="empty-state-icon">📺</div>
                <div>No live matches right now</div>
                <p style="color: var(--text-dim); margin-top: 10px;">Check back during match nights!</p>
            </div>
        `;
    }

    return `
        <div style="display: grid; gap: 15px;">
            ${liveMatches.map(m => `
                <div class="stats-card live-match-card" data-match-id="${m.id}">
                    <div class="stats-card-header" style="background: linear-gradient(135deg, #10b981, #059669); display: flex; justify-content: space-between; align-items: center;">
                        <span style="display: flex; align-items: center; gap: 8px;">
                            <span style="width: 10px; height: 10px; background: #fff; border-radius: 50%; animation: pulse 1.5s infinite;"></span>
                            LIVE
                        </span>
                        <span style="font-size: 14px; opacity: 0.9;">Round ${m.current_round || 1}</span>
                    </div>
                    <div class="stats-card-body" style="padding: 15px;">
                        <div style="display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; text-align: center; gap: 10px;">
                            <div>
                                <div style="font-weight: 700; font-size: 16px;">${m.home_team_name || 'Home'}</div>
                                <div style="font-family: 'Archivo Black', sans-serif; font-size: 36px; color: var(--teal);">${m.home_score || 0}</div>
                            </div>
                            <div style="font-family: 'Bebas Neue', cursive; font-size: 20px; color: var(--text-dim);">VS</div>
                            <div>
                                <div style="font-weight: 700; font-size: 16px;">${m.away_team_name || 'Away'}</div>
                                <div style="font-family: 'Archivo Black', sans-serif; font-size: 36px; color: var(--pink);">${m.away_score || 0}</div>
                            </div>
                        </div>
                        ${m.current_game ? `
                            <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid rgba(255,255,255,0.1);">
                                <div style="text-align: center; font-size: 12px; color: var(--text-dim); margin-bottom: 8px;">CURRENT GAME</div>
                                <div style="display: flex; justify-content: space-around; align-items: center;">
                                    <div style="text-align: center;">
                                        <div style="font-size: 12px; color: var(--text-dim);">${m.current_game.home_player || '-'}</div>
                                        <div style="font-family: 'Bebas Neue', cursive; font-size: 28px; color: var(--yellow);">${m.current_game.home_score || 501}</div>
                                    </div>
                                    <div style="font-family: 'Bebas Neue', cursive; color: var(--text-dim);">${m.current_game.game_type || '501'}</div>
                                    <div style="text-align: center;">
                                        <div style="font-size: 12px; color: var(--text-dim);">${m.current_game.away_player || '-'}</div>
                                        <div style="font-family: 'Bebas Neue', cursive; font-size: 28px; color: var(--yellow);">${m.current_game.away_score || 501}</div>
                                    </div>
                                </div>
                            </div>
                        ` : ''}
                        <button onclick="expandMatch('${m.id}')" style="width: 100%; margin-top: 15px; padding: 10px; background: rgba(255,255,255,0.1); border: 2px solid var(--teal); color: var(--teal); font-family: 'Bebas Neue', cursive; font-size: 16px; letter-spacing: 1px; cursor: pointer; transition: all 0.2s;">
                            EXPAND SCORER
                        </button>
                    </div>
                </div>
            `).join('')}
        </div>
        <style>
            @keyframes pulse {
                0%, 100% { opacity: 1; }
                50% { opacity: 0.4; }
            }
        </style>
    `;
}

export function expandMatch(matchId) {
    // Open match in expanded scorer view
    window.open(`/pages/league-scoreboard.html?match_id=${matchId}&league_id=${state.leagueId}`, '_blank');
}

export function renderFillins() {
    const fillinSettings = state.leagueData.fillin_settings || {};

    return `
        <div class="stats-card" style="margin-bottom: 20px;">
            <div class="stats-card-header" style="background: linear-gradient(135deg, var(--teal), #5ab8d4);">
                <span style="color: var(--black);">🔄 SIGN UP AS A FILL-IN</span>
            </div>
            <div class="stats-card-body" style="padding: 20px;">
                <p style="margin-bottom: 15px; color: var(--text-dim);">Fill-ins substitute for unavailable players. Captains will contact you when needed.</p>
                <button class="register-btn" style="font-size: 18px; padding: 15px;" onclick="openFillinModal()">SIGN UP AS FILL-IN</button>
            </div>
        </div>

        <div class="stats-card">
            <div class="stats-card-header">
                AVAILABLE FILL-INS <span style="background: var(--teal); color: var(--black); padding: 2px 10px; border-radius: 10px; margin-left: 10px; font-size: 14px;">${state.fillins.length}</span>
            </div>
            <div class="stats-card-body">
                ${state.fillins.length === 0 ? `
                    <div class="empty-state" style="padding: 30px;">
                        <div class="empty-state-icon">👤</div>
                        <div>No fill-ins registered yet. Be the first!</div>
                    </div>
                ` : state.fillins.map(f => `
                    <div class="leaderboard-item">
                        <div class="leaderboard-name">
                            ${f.full_name}
                            ${f.preferred_level ? `<span class="signup-level" style="margin-left: 8px;">${f.preferred_level}</span>` : ''}
                        </div>
                        <div style="text-align: right; font-size: 12px; color: var(--text-dim);">
                            ${fillinSettings.collect_501_avg && f.avg_501 ? `<div>501: ${f.avg_501}</div>` : ''}
                            ${fillinSettings.collect_cricket_avg && f.avg_cricket ? `<div>MPR: ${f.avg_cricket}</div>` : ''}
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
}
