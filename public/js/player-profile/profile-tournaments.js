/**
 * Player Profile - Tournaments Module
 *
 * Handles:
 * - Loading tournaments player participated in
 * - Rendering tournament cards
 * - Tournament stats display
 */

import { db, doc, getDoc, collection, getDocs } from '/js/firebase-config.js';

async function loadTournaments(state) {
    const playerId = state.currentPlayer.player_id || state.currentPlayer.id;
    const container = document.getElementById('tournamentsContent');

    try {
        // Query tournaments where this player participated
        const tournamentsSnap = await getDocs(collection(db, 'tournaments'));
        const participatedTournaments = [];

        for (const tDoc of tournamentsSnap.docs) {
            const tournament = tDoc.data();
            // Check if player is in participants array
            const isParticipant = tournament.participants?.some(p => p.player_id === playerId || p.id === playerId);
            // Also check registrations
            const registrationsSnap = await getDocs(collection(db, 'tournaments', tDoc.id, 'registrations'));
            const isRegistered = registrationsSnap.docs.some(r => r.data().player_id === playerId);

            if (isParticipant || isRegistered) {
                // Get player's stats for this tournament
                let stats = { x01_three_dart_avg: '-', cricket_mpr: '-' };
                try {
                    const statsDoc = await getDoc(doc(db, 'tournaments', tDoc.id, 'stats', playerId));
                    if (statsDoc.exists()) {
                        const s = statsDoc.data();
                        // Calculate 3DA from components if available
                        if (s.x01_total_darts > 0) {
                            stats.x01_three_dart_avg = (s.x01_total_points / s.x01_total_darts * 3).toFixed(1);
                        } else if (s.x01_three_dart_avg != null) {
                            stats.x01_three_dart_avg = Number(s.x01_three_dart_avg).toFixed(1);
                        } else if (s.x01_avg != null) {
                            stats.x01_three_dart_avg = Number(s.x01_avg).toFixed(1);
                        }
                        // Calculate MPR from components if available
                        if (s.cricket_total_rounds > 0) {
                            stats.cricket_mpr = (s.cricket_total_marks / s.cricket_total_rounds).toFixed(2);
                        } else if (s.cricket_mpr != null) {
                            stats.cricket_mpr = Number(s.cricket_mpr).toFixed(2);
                        } else if (s.mpr != null) {
                            stats.cricket_mpr = Number(s.mpr).toFixed(2);
                        }
                    }
                } catch (e) { /* ignore */ }

                participatedTournaments.push({
                    id: tDoc.id,
                    name: tournament.tournament_name || tournament.name || 'Unnamed Tournament',
                    date: tournament.start_date || tournament.created_at?.toDate?.() || null,
                    status: tournament.status || 'active',
                    format: tournament.format || tournament.game_type || '501',
                    ...stats
                });
            }
        }

        if (participatedTournaments.length === 0) {
            container.innerHTML = '<div style="text-align: center; color: #aaa; padding: 20px;">No tournament history</div>';
            return;
        }

        // Sort by date (newest first)
        participatedTournaments.sort((a, b) => {
            if (!a.date) return 1;
            if (!b.date) return -1;
            return b.date - a.date;
        });

        // Render tournament cards
        let html = participatedTournaments.map(t => `
            <div class="tournament-card">
                <div class="tournament-header">
                    <h3>${t.name}</h3>
                    <span class="status-badge ${t.status}">${t.status.toUpperCase()}</span>
                </div>
                <div class="tournament-info">
                    <div class="info-row">
                        <span class="label">Format:</span>
                        <span>${t.format}</span>
                    </div>
                    ${t.date ? `<div class="info-row">
                        <span class="label">Date:</span>
                        <span>${t.date.toLocaleDateString()}</span>
                    </div>` : ''}
                    <div class="info-row">
                        <span class="label">Stats:</span>
                        <span>${t.x01_three_dart_avg} avg / ${t.cricket_mpr} MPR</span>
                    </div>
                </div>
                <div class="tournament-actions">
                    <a href="/pages/tournament-view.html?tournament_id=${t.id}" class="action-btn">View Tournament</a>
                </div>
            </div>
        `).join('');

        container.innerHTML = html;
    } catch (error) {
        console.error('Error loading tournaments:', error);
        container.innerHTML = '<div style="text-align: center; color: #aaa; padding: 20px;">Error loading tournaments</div>';
    }
}

// ===== INITIALIZATION =====

function initTournamentsTab(state) {
    // Tab will load on first activation
}

// ===== EXPORTS =====

export {
    initTournamentsTab,
    loadTournaments
};
