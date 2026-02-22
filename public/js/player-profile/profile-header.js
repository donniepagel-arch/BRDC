/**
 * Player Profile - Header Module
 *
 * Handles:
 * - Loading player data from backend
 * - Rendering profile header (photo, name, badges, contact info)
 * - Login/logout functionality
 * - Director links
 */

import { callFunction, db, storage, doc, getDoc, updateDoc, collection, getDocs, query, where, ref, uploadBytes, getDownloadURL, auth, signInWithEmailAndPassword, sendPasswordResetEmail, signInWithPopup, GoogleAuthProvider } from '/js/firebase-config.js';

// ===== DATA LOADING =====

async function detectIfFillIn(playerId, leagueId) {
    if (!leagueId) return false;

    try {
        // Check if player exists in league players collection
        const leaguePlayerDoc = await getDoc(doc(db, 'leagues', leagueId, 'players', playerId));

        if (!leaguePlayerDoc.exists()) {
            return true; // Not in league roster = fill-in
        }

        const playerData = leaguePlayerDoc.data();

        // Check if they have a permanent team
        if (!playerData.team_id || playerData.team_id === null) {
            return true; // No team = fill-in
        }

        return false;
    } catch (error) {
        console.error('Error detecting fill-in status:', error);
        return false;
    }
}

async function loadPlayerData(state, playerId, leagueId) {
    try {
        const result = await callFunction('getDashboardData', {
            player_id: playerId,
            source_type: leagueId ? 'league' : 'global',
            league_id: leagueId
        });

        if (result.success) {
            state.currentPlayer = result.dashboard.player;
            state.currentPlayer.player_id = state.currentPlayer.id;
            state.currentLeagueId = leagueId;
            // Store captaining teams from dashboard roles
            state.captainingTeams = result.dashboard.roles?.captaining || [];
            state.currentPlayer.is_captain = state.captainingTeams.length > 0;

            // Populate team_id and league_id from roles if not set
            const playingRoles = result.dashboard.roles?.playing_on || result.dashboard.roles?.playing || [];
            state.playingRoles = playingRoles; // Store all roles for multi-team display
            if (!state.currentPlayer.team_id && playingRoles.length > 0) {
                // Use first playing role's team_id
                state.currentPlayer.team_id = playingRoles[0].team_id;
            }
            if (!state.currentPlayer.team_name && playingRoles.length > 0) {
                state.currentPlayer.team_name = playingRoles[0].team_name;
            }
            if (!state.currentLeagueId && playingRoles.length > 0) {
                // Use first playing role's league_id
                state.currentLeagueId = playingRoles[0].id || playingRoles[0].league_id;
            }
            // Also check captaining teams for team_id
            if (!state.currentPlayer.team_id && state.captainingTeams.length > 0) {
                state.currentPlayer.team_id = state.captainingTeams[0].team_id;
                if (!state.currentLeagueId) {
                    state.currentLeagueId = state.captainingTeams[0].league_id;
                }
            }
            if (!state.currentPlayer.team_name && state.captainingTeams.length > 0) {
                state.currentPlayer.team_name = state.captainingTeams[0].team_name;
            }

            await showProfile(state);
        } else {
            // Show login if we couldn't load data
            document.getElementById('loadingOverlay').style.display = 'none';
            document.getElementById('loginOverlay').style.display = 'flex';
        }
    } catch (error) {
        console.error('Failed to load player:', error);
        document.getElementById('loadingOverlay').style.display = 'none';
        document.getElementById('loginOverlay').style.display = 'flex';
    }
}

async function showProfile(state) {
    document.getElementById('loadingOverlay').style.display = 'none';
    document.getElementById('loginOverlay').style.display = 'none';
    document.getElementById('profileContent').style.display = 'block';

    const currentPlayer = state.currentPlayer;

    // Detect if this is a fill-in player
    const playerId = currentPlayer.player_id || currentPlayer.id;
    state.isFilInPlayer = await detectIfFillIn(playerId, state.currentLeagueId);

    // Basic info
    document.getElementById('playerName').textContent = currentPlayer.name;

    // Team name — show all teams joined, separated by " - "
    const teamEl = document.getElementById('playerTeam');
    if (teamEl) {
        const roles = (state.playingRoles || []).filter(r => r.team_name);
        if (roles.length > 0) {
            teamEl.innerHTML = roles.map(r => {
                const lid = r.id || r.league_id;
                const tid = r.team_id;
                return (lid && tid)
                    ? `<a href="/pages/team-profile.html?league_id=${lid}&team_id=${tid}">${r.team_name}</a>`
                    : r.team_name;
            }).join(' <span style="opacity:0.4"> - </span> ');
        } else if (currentPlayer.team_name) {
            teamEl.textContent = currentPlayer.team_name;
        } else {
            teamEl.innerHTML = '';
        }
    }

    // Photo
    if (currentPlayer.photo_url) {
        document.getElementById('profilePhoto').src = currentPlayer.photo_url;
        document.getElementById('profilePhoto').style.display = 'block';
        document.getElementById('photoPlaceholder').style.display = 'none';
    } else {
        document.getElementById('photoPlaceholder').textContent = currentPlayer.name.charAt(0).toUpperCase();
    }

    // Badges
    const badgesContainer = document.getElementById('playerBadges');
    badgesContainer.innerHTML = '';

    // Fill-in badge (highest priority)
    if (state.isFilInPlayer) {
        badgesContainer.innerHTML += '<span class="badge fill-in" style="background: var(--yellow); color: var(--bg-dark);">FILL-IN PLAYER</span>';
    }

    // Captain tab removed — captains use /pages/captain-dashboard.html
    if (currentPlayer.is_sub && !state.isFilInPlayer) {
        badgesContainer.innerHTML += '<span class="badge sub">SUBSTITUTE</span>';
    }
    // Level badge (A, B, C)
    if (currentPlayer.level) {
        badgesContainer.innerHTML += `<span class="badge level-${currentPlayer.level}">LEVEL ${currentPlayer.level}</span>`;
    } else if (currentPlayer.skill_level) {
        badgesContainer.innerHTML += `<span class="badge">${currentPlayer.skill_level.toUpperCase()}</span>`;
    }

    // Start presence heartbeat (skip for fill-ins - they don't have global player accounts)
    if (window.brdcPresence && !state.isFilInPlayer) {
        window.brdcPresence.startPresenceHeartbeat('profile');
    }

    // Load director links
    await loadDirectorLinks(state);

    // Load stats for the default-active profile tab
    if (window.triggerProfileStatsLoad) window.triggerProfileStatsLoad();
    if (window.triggerFeedLoad) window.triggerFeedLoad();

    // Check for live match (async, non-blocking)
    checkLiveMatch(state).catch(e => console.error('checkLiveMatch:', e));
}

async function loadDirectorLinks(state) {
    const playerId = state.currentPlayer.player_id || state.currentPlayer.id;
    if (!playerId) return;

    const section = document.getElementById('managementLinksSection');
    const linksList = document.getElementById('directorLinksList');
    const links = [];

    try {
        // Check if player is director of any leagues
        const leaguesSnap = await getDocs(collection(db, 'leagues'));
        leaguesSnap.forEach(leagueDoc => {
            const league = leagueDoc.data();
            if (league.director_id === playerId) {
                links.push({
                    text: `Manage ${league.name}`,
                    href: `/pages/league-director.html?league_id=${leagueDoc.id}`
                });
            }
        });

        // Check if player is admin
        if (state.currentPlayer.is_admin || state.currentPlayer.is_master_admin) {
            links.push({
                text: 'Admin Dashboard',
                href: '/pages/admin.html'
            });
        }

        // Show section if there are links
        if (links.length > 0) {
            linksList.innerHTML = links.map(link =>
                `<li><a href="${link.href}" class="director-link">${link.text}</a></li>`
            ).join('');
            section.style.display = 'block';
        } else {
            section.style.display = 'none';
        }
    } catch (error) {
        console.error('Error loading director links:', error);
        section.style.display = 'none';
    }
}

// ===== LIVE MATCH DETECTION =====

async function checkLiveMatch(state) {
    const liveBtn = document.getElementById('liveBtn');
    if (!liveBtn) return;

    const playerId = state.currentPlayer.player_id || state.currentPlayer.id;
    const playingRoles = state.currentPlayer.playing_on || state.currentPlayer.playing || [];

    // Also check captainingTeams for league IDs
    const allRoles = [...playingRoles, ...(state.captainingTeams || [])];
    const leagueIds = [...new Set(allRoles.map(r => r.id || r.league_id).filter(Boolean))];

    if (leagueIds.length === 0) return;

    try {
        for (const leagueId of leagueIds) {
            const snap = await getDocs(
                query(collection(db, 'leagues', leagueId, 'matches'), where('status', '==', 'in_progress'))
            );
            for (const matchDoc of snap.docs) {
                const match = matchDoc.data();
                // Check if this player appears in the match lineups
                const homeIds = (match.home_lineup || []).map(p => p.player_id || p.id);
                const awayIds = (match.away_lineup || []).map(p => p.player_id || p.id);
                const homePlayers = (match.home_players || []);
                const awayPlayers = (match.away_players || []);
                const playerName = state.currentPlayer.name || '';
                const inLineup = [...homeIds, ...awayIds].includes(playerId);
                const inRoster = [...homePlayers, ...awayPlayers].some(n => n && playerName && n.toLowerCase().includes(playerName.split(' ')[0].toLowerCase()));
                if (inLineup || inRoster) {
                    liveBtn.classList.add('is-live');
                    liveBtn.title = 'Live match in progress — tap to view';
                    liveBtn.onclick = () => {
                        window.location.href = `/pages/match-hub.html?league_id=${leagueId}&match_id=${matchDoc.id}`;
                    };
                    return;
                }
            }
        }
    } catch (e) {
        console.error('Live match check error:', e);
    }
}

window.addFriend = function() {
    if (window.toastWarning) {
        window.toastWarning('Friend requests coming soon!');
    }
};

// ===== LOGIN =====

window.login = async function() {
    const email = (document.getElementById('loginEmail')?.value || '').trim();
    const password = document.getElementById('loginPassword')?.value || '';

    if (!email || !password) {
        if (window.toastWarning) {
            window.toastWarning('Please enter your email and password');
        } else {
            alert('Please enter your email and password');
        }
        return;
    }

    try {
        await signInWithEmailAndPassword(auth, email, password);
        const result = await callFunction('getPlayerSession', {});

        if (result.success) {
            const state = window.playerProfileState || {
                currentPlayer: null,
                currentLeagueId: null,
                captainingTeams: [],
                isFilInPlayer: false
            };

            state.currentPlayer = result.player;
            state.currentLeagueId = result.player?.league_id || null;

            localStorage.setItem('brdc_session', JSON.stringify(result.player));
            localStorage.removeItem('brdc_player_pin');

            await showProfile(state);
        } else {
            if (window.toastError) {
                window.toastError(result.error || 'Login failed. Please try again.');
            } else {
                alert(result.error || 'Login failed. Please try again.');
            }
        }
    } catch (error) {
        console.error('Login error:', error);
        let msg = 'Login failed. Please try again.';
        if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
            msg = 'Invalid email or password.';
        } else if (error.code === 'auth/too-many-requests') {
            msg = 'Too many attempts. Please try again later.';
        }
        if (window.toastError) {
            window.toastError(msg);
        } else {
            alert(msg);
        }
    }
};

window.recoverPin = async function() {
    const email = (document.getElementById('recoveryEmail')?.value || '').trim().toLowerCase();

    if (!email) {
        if (window.toastWarning) {
            window.toastWarning('Please enter your email address');
        } else {
            alert('Please enter your email address');
        }
        return;
    }

    try {
        await sendPasswordResetEmail(auth, email);
        if (window.toastSuccess) {
            window.toastSuccess('Password reset email sent! Check your inbox.');
        } else {
            alert('Password reset email sent! Check your inbox.');
        }
        window.showLoginCard();
    } catch (error) {
        console.error('Recovery error:', error);
        if (window.toastError) {
            window.toastError('Could not send reset email. Check the address and try again.');
        } else {
            alert('Could not send reset email. Check the address and try again.');
        }
    }
};

// ===== GOOGLE SIGN-IN =====

window.loginWithGoogle = async function() {
    try {
        const provider = new GoogleAuthProvider();
        await signInWithPopup(auth, provider);
        const result = await callFunction('getPlayerSession', {});

        if (result.success) {
            const state = window.playerProfileState || {
                currentPlayer: null,
                currentLeagueId: null,
                captainingTeams: [],
                isFilInPlayer: false
            };

            state.currentPlayer = result.player;
            state.currentLeagueId = result.player?.league_id || null;

            localStorage.setItem('brdc_session', JSON.stringify(result.player));
            localStorage.removeItem('brdc_player_pin');

            await showProfile(state);
        } else {
            if (window.toastError) {
                window.toastError(result.error || 'Login failed. Please try again.');
            } else {
                alert(result.error || 'Login failed. Please try again.');
            }
        }
    } catch (error) {
        if (error.code === 'auth/popup-closed-by-user' || error.code === 'auth/cancelled-popup-request') return;
        let msg = 'Google sign-in failed. Please try again.';
        if (error.code === 'auth/popup-blocked') {
            msg = 'Popup was blocked. Please allow popups for this site and try again.';
        } else if (error.message) {
            msg = error.message;
        }
        if (window.toastError) {
            window.toastError(msg);
        } else {
            alert(msg);
        }
    }
};

// ===== PHOTO UPLOAD =====

window.uploadPhoto = async function(input) {
    const file = input.files[0];
    if (!file) return;

    // Validate
    if (!file.type.startsWith('image/')) {
        if (window.toastError) window.toastError('Please select an image file');
        return;
    }
    if (file.size > 5 * 1024 * 1024) {
        if (window.toastError) window.toastError('Image must be under 5MB');
        return;
    }

    const state = window.playerProfileState;
    if (!state || !state.currentPlayer) {
        if (window.toastError) window.toastError('Not logged in');
        return;
    }

    const playerId = state.currentPlayer.player_id || state.currentPlayer.id;
    const btn = document.querySelector('.upload-btn');

    try {
        if (btn) btn.textContent = 'UPLOADING...';

        // Upload to players/{playerId}_{timestamp}.{ext}
        const ext = file.name.split('.').pop().toLowerCase() || 'jpg';
        const storagePath = `players/${playerId}_${Date.now()}.${ext}`;
        const storageRef = ref(storage, storagePath);

        const snapshot = await uploadBytes(storageRef, file);
        const photoUrl = await getDownloadURL(snapshot.ref);

        // Save to global /players/{id}
        try {
            await updateDoc(doc(db, 'players', playerId), { photo_url: photoUrl });
        } catch (e) {
            // Player may only exist in league collection — that's fine
        }

        // Save to league player doc if applicable
        if (state.currentLeagueId) {
            try {
                await updateDoc(doc(db, 'leagues', state.currentLeagueId, 'players', playerId), { photo_url: photoUrl });
            } catch (e) { /* may not exist */ }
        }

        // Update session
        const session = JSON.parse(localStorage.getItem('brdc_session') || '{}');
        if (session.player_id) {
            session.photo_url = photoUrl;
            localStorage.setItem('brdc_session', JSON.stringify(session));
        }

        // Update UI immediately
        state.currentPlayer.photo_url = photoUrl;
        const photoEl = document.getElementById('profilePhoto');
        const placeholderEl = document.getElementById('photoPlaceholder');
        if (photoEl) {
            photoEl.src = photoUrl;
            photoEl.style.display = 'block';
        }
        if (placeholderEl) placeholderEl.style.display = 'none';

        // Also update photos tab avatar if rendered
        const photosTabAvatar = document.querySelector('#photosContent img[alt="Profile photo"]');
        if (photosTabAvatar) photosTabAvatar.src = photoUrl;

        if (window.toastSuccess) window.toastSuccess('Photo updated!');
    } catch (err) {
        console.error('Photo upload error:', err);
        if (window.toastError) window.toastError('Upload failed: ' + err.message);
    } finally {
        if (btn) btn.textContent = 'CHANGE PHOTO';
        // Clear input so same file can be re-selected if needed
        input.value = '';
    }
};

// ===== INITIALIZATION =====

function initProfileHeader(state) {
    // Make state accessible to window functions
    window.playerProfileState = state;
}

// ===== EXPORTS =====

export {
    initProfileHeader,
    loadPlayerData,
    showProfile,
    loadDirectorLinks,
    detectIfFillIn
};
