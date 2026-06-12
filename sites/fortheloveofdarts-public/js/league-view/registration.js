// registration.js - Registration tab and forms functionality for league-view
// v6: PIN login removed; email/Google OAuth is the only login path.
import { state } from './app.js?v=4';
import { db, doc, getDoc, collection, getDocs, callFunction, uploadImage, showLoading, hideLoading } from '/js/firebase-config.js';

// ===== Email / OAuth login helpers =====

/**
 * Shared: populate state.memberData from a getPlayerSession player object.
 */
function _setMemberDataFromSession(player) {
    state.memberData = {
        id: player.id,
        name: player.name,
        email: player.email || '',
        phone: player.phone || '',
        preferred_level: player.preferred_level || null,
        avg_501: player.avg_501 || null,
        avg_cricket: player.avg_cricket || null,
        pin: null
    };
}

function _fillRegForm() {
    const m = state.memberData;
    if (!m) return;
    const safe = (id, val) => { const el = document.getElementById(id); if (el && val) el.value = val; };
    safe('regName', m.name);
    safe('regEmail', m.email);
    safe('regPhone', m.phone);
    if (m.preferred_level) { const el = document.getElementById('regLevel'); if (el) el.value = m.preferred_level; }
    if (typeof toastSuccess === 'function') toastSuccess('Welcome back, ' + m.name + '! Your info has been filled in.');
}

function _fillFillinForm() {
    const m = state.memberData;
    if (!m) return;
    const safe = (id, val) => { const el = document.getElementById(id); if (el && val) el.value = val; };
    safe('fillinName', m.name);
    safe('fillinEmail', m.email);
    safe('fillinPhone', m.phone);
    if (m.preferred_level) { const el = document.getElementById('fillinLevel'); if (el) el.value = m.preferred_level; }
    if (typeof toastSuccess === 'function') toastSuccess('Welcome back, ' + m.name + '! Your info has been filled in.');
}

function _fillSubForm() {
    const m = state.memberData;
    if (!m) return;
    const safe = (id, val) => { const el = document.getElementById(id); if (el && val) el.value = val; };
    safe('subName', m.name);
    safe('subEmail', m.email);
    safe('subPhone', m.phone);
    if (m.preferred_level) { const el = document.getElementById('subLevel'); if (el) el.value = m.preferred_level; }
    if (m.avg_501) { const el = document.getElementById('sub501'); if (el) el.value = m.avg_501; }
    if (m.avg_cricket) { const el = document.getElementById('subMPR'); if (el) el.value = m.avg_cricket; }
    if (typeof toastSuccess === 'function') toastSuccess('Welcome back, ' + m.name + '! Your info has been filled in.');
}

export async function loginEmailForReg(formType) {
    const ids = {
        reg: { email: 'regLoginEmail', pass: 'regLoginPassword', err: 'regLoginError' },
        fillin: { email: 'fillinLoginEmail', pass: 'fillinLoginPassword', err: 'fillinLoginError' },
        sub: { email: 'subLoginEmail', pass: 'subLoginPassword', err: 'subLoginError' }
    };
    const cfg = ids[formType] || ids.reg;
    const email = (document.getElementById(cfg.email)?.value || '').trim();
    const password = document.getElementById(cfg.pass)?.value || '';
    const errEl = document.getElementById(cfg.err);
    if (errEl) errEl.textContent = '';
    if (!email || !password) { if (errEl) errEl.textContent = 'Enter email and password.'; return; }
    try {
        const { auth, signInWithEmailAndPassword } = await import('/js/firebase-config.js');
        await signInWithEmailAndPassword(auth, email, password);
        const result = await callFunction('getPlayerSession', {});
        if (!result || !result.success) throw new Error(result?.error || 'Could not load player data');
        _setMemberDataFromSession(result.player);
        if (formType === 'fillin') _fillFillinForm();
        else if (formType === 'sub') _fillSubForm();
        else _fillRegForm();
    } catch (err) {
        let msg = 'Sign-in failed.';
        if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') msg = 'Invalid email or password.';
        else if (err.code === 'auth/invalid-email') msg = 'Invalid email address.';
        else if (err.message) msg = err.message;
        if (errEl) errEl.textContent = msg;
    }
}

export async function loginGoogleForReg(formType) {
    const errIds = { reg: 'regLoginError', fillin: 'fillinLoginError', sub: 'subLoginError' };
    const errEl = document.getElementById(errIds[formType] || 'regLoginError');
    if (errEl) errEl.textContent = '';
    try {
        const { auth, signInWithPopup, GoogleAuthProvider } = await import('/js/firebase-config.js');
        await signInWithPopup(auth, new GoogleAuthProvider());
        const result = await callFunction('getPlayerSession', {});
        if (!result || !result.success) throw new Error(result?.error || 'Could not load player data');
        _setMemberDataFromSession(result.player);
        if (formType === 'fillin') _fillFillinForm();
        else if (formType === 'sub') _fillSubForm();
        else _fillRegForm();
    } catch (err) {
        if (err.code === 'auth/popup-closed-by-user' || err.code === 'auth/cancelled-popup-request') return;
        let msg = 'Google sign-in failed.';
        if (err.code === 'auth/popup-blocked') msg = 'Popup blocked — allow popups and try again.';
        else if (err.message) msg = err.message;
        if (errEl) errEl.textContent = msg;
    }
}

export async function loginEmailForDirector() {
    const email = (document.getElementById('directorEmailInput')?.value || '').trim();
    const password = document.getElementById('directorPasswordInput')?.value || '';
    const errEl = document.getElementById('directorAuthError');
    if (errEl) errEl.textContent = '';
    if (!email || !password) { if (errEl) errEl.textContent = 'Enter email and password.'; return; }
    try {
        const { auth, signInWithEmailAndPassword } = await import('/js/firebase-config.js');
        await signInWithEmailAndPassword(auth, email, password);
        const result = await callFunction('getPlayerSession', {});
        if (!result || !result.success) throw new Error(result?.error || 'Could not load player data');
        if (!result.player.is_director && !result.player.is_admin && !result.player.is_master_admin) {
            throw new Error('Your account does not have director access for this league.');
        }
        window.location.href = `/pages/league-director.html?league_id=${state.leagueId}`;
    } catch (err) {
        let msg = 'Sign-in failed.';
        if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') msg = 'Invalid email or password.';
        else if (err.message) msg = err.message;
        if (errEl) errEl.textContent = msg;
    }
}

export async function loginGoogleForDirector() {
    const errEl = document.getElementById('directorAuthError');
    if (errEl) errEl.textContent = '';
    try {
        const { auth, signInWithPopup, GoogleAuthProvider } = await import('/js/firebase-config.js');
        await signInWithPopup(auth, new GoogleAuthProvider());
        const result = await callFunction('getPlayerSession', {});
        if (!result || !result.success) throw new Error(result?.error || 'Could not load player data');
        if (!result.player.is_director && !result.player.is_admin && !result.player.is_master_admin) {
            throw new Error('Your account does not have director access for this league.');
        }
        window.location.href = `/pages/league-director.html?league_id=${state.leagueId}`;
    } catch (err) {
        if (err.code === 'auth/popup-closed-by-user' || err.code === 'auth/cancelled-popup-request') return;
        let msg = 'Google sign-in failed.';
        if (err.code === 'auth/popup-blocked') msg = 'Popup blocked — allow popups and try again.';
        else if (err.message) msg = err.message;
        if (errEl) errEl.textContent = msg;
    }
}

export function renderRegistrationTab() {
    const fillinSettings = state.leagueData.fillin_settings || {};
    const isDraftLeague = state.leagueData.league_type === 'triples_draft' || state.leagueData.league_type === 'doubles_draft' || state.leagueData.draft_enabled;
    const totalSpots = (state.leagueData.num_teams || state.leagueData.max_teams || 8) * (state.leagueData.team_size || state.leagueData.players_per_team || 3);
    const currentPlayers = state.registrations.length;
    const spotsRemaining = totalSpots - currentPlayers;

    return `
        <div class="stats-grid" style="margin-bottom: 20px;">
            <!-- General Registration Card -->
            <div class="stats-card">
                <div class="stats-card-header" style="background: linear-gradient(135deg, var(--pink), #cc3879);">
                    JOIN THE LEAGUE
                </div>
                <div class="stats-card-body" style="padding: 20px;">
                    <p style="margin-bottom: 15px; color: var(--text-dim);">
                        ${isDraftLeague ?
                'Register to be drafted onto a team. Teams are formed through a draft process.' :
                'Register to join the league. You\'ll be assigned to a team or can form your own.'}
                    </p>
                    <div class="spots-display" style="margin-bottom: 15px;">
                        <div class="spots-count">${currentPlayers} / ${totalSpots}</div>
                        <div class="spots-label">${spotsRemaining <= 0 ? 'WAITLIST OPEN' : `${spotsRemaining} SPOTS REMAINING`}</div>
                    </div>
                    <button class="register-btn" style="font-size: 18px; padding: 15px;" onclick="openModal()">
                        ${spotsRemaining <= 0 ? 'JOIN WAITLIST' : 'REGISTER NOW'}
                    </button>
                </div>
            </div>

            <!-- Fill-in Registration Card -->
            <div class="stats-card">
                <div class="stats-card-header" style="background: linear-gradient(135deg, var(--teal), #5ab8d4);">
                    <span style="color: var(--black);">SIGN UP AS FILL-IN</span>
                </div>
                <div class="stats-card-body" style="padding: 20px;">
                    <p style="margin-bottom: 15px; color: var(--text-dim);">
                        Fill-ins substitute for unavailable players. Captains will contact you when needed.
                    </p>
                    <div style="background: rgba(145, 215, 235, 0.2); padding: 15px; margin-bottom: 15px; border: 2px solid var(--teal); text-align: center;">
                        <div style="font-family: 'Archivo Black', sans-serif; font-size: 24px; color: var(--teal);">${state.fillins.length}</div>
                        <div style="font-size: 12px; color: var(--text-dim);">FILL-INS AVAILABLE</div>
                    </div>
                    <button class="register-btn" style="font-size: 18px; padding: 15px; background: linear-gradient(135deg, var(--teal), #5ab8d4); color: var(--black);" onclick="openFillinModal()">
                        SIGN UP AS FILL-IN
                    </button>
                </div>
            </div>
        </div>

        <!-- Current Registrations List -->
        <div class="stats-card">
            <div class="stats-card-header">
                REGISTERED PLAYERS <span style="background: var(--pink); padding: 2px 10px; border-radius: 10px; margin-left: 10px; font-size: 14px;">${state.registrations.length}</span>
            </div>
            <div class="stats-card-body">
                ${renderSignupsList()}
            </div>
        </div>

        <!-- Fill-ins List -->
        ${state.fillins.length > 0 ? `
        <div class="stats-card" style="margin-top: 20px;">
            <div class="stats-card-header">
                AVAILABLE FILL-INS <span style="background: var(--teal); color: var(--black); padding: 2px 10px; border-radius: 10px; margin-left: 10px; font-size: 14px;">${state.fillins.length}</span>
            </div>
            <div class="stats-card-body">
                ${state.fillins.map(f => `
                    <div class="leaderboard-item">
                        <div class="leaderboard-name">
                            ${f.full_name}
                            ${f.preferred_level ? `<span class="signup-level" style="margin-left: 8px;">${f.preferred_level}</span>` : ''}
                        </div>
                        <div style="text-align: right; font-size: 12px; color: var(--text-dim);">
                            ${state.leagueData.fillin_settings?.collect_501_avg && f.avg_501 ? `<div>501: ${f.avg_501}</div>` : ''}
                            ${state.leagueData.fillin_settings?.collect_cricket_avg && f.avg_cricket ? `<div>MPR: ${f.avg_cricket}</div>` : ''}
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
        ` : ''}
    `;
}

export function renderSignupsList() {
    if (state.registrations.length === 0) {
        return '<div class="empty-state" style="padding: 30px;"><div class="empty-state-icon">👥</div><div>No players registered yet. Be the first!</div></div>';
    }

    return state.registrations.slice(0, 20).map(r => `
        <div class="leaderboard-item">
            <div class="leaderboard-name">
                ${r.full_name || r.name}
                ${r.skill_level || r.preferred_level ? `<span class="signup-level" style="margin-left: 8px;">${r.skill_level || r.preferred_level}</span>` : ''}
            </div>
            <span class="signup-status ${r.payment_status === 'paid' ? 'confirmed' : 'pending'}">
                ${r.payment_status === 'paid' ? 'Confirmed' : 'Pending'}
            </span>
        </div>
    `).join('') + (state.registrations.length > 20 ? `<div style="text-align: center; padding: 10px; color: var(--text-dim);">+ ${state.registrations.length - 20} more</div>` : '');
}

// Director Login
export function showDirectorLogin() {
    const html = `
        <div style="text-align: center;">
            <p style="margin-bottom: 20px; color: var(--text-dim);">Sign in with your director account to access the league management dashboard.</p>
            <input type="email" id="directorEmailInput" placeholder="Email address" autocomplete="email"
                style="width:100%;max-width:280px;padding:12px;border:2px solid rgba(255,255,255,0.2);border-radius:8px;background:rgba(0,0,0,0.3);color:#FDD835;font-family:'JetBrains Mono',monospace;font-size:14px;box-sizing:border-box;margin-bottom:8px;">
            <input type="password" id="directorPasswordInput" placeholder="Password" autocomplete="current-password"
                style="width:100%;max-width:280px;padding:12px;border:2px solid rgba(255,255,255,0.2);border-radius:8px;background:rgba(0,0,0,0.3);color:#FDD835;font-family:'JetBrains Mono',monospace;font-size:14px;box-sizing:border-box;margin-bottom:8px;">
            <div id="directorAuthError" style="color:#ef4444;font-size:12px;min-height:16px;margin-bottom:8px;"></div>
            <button class="submit-btn" onclick="loginEmailForDirector()" style="width:100%;max-width:280px;margin-bottom:8px;">SIGN IN WITH EMAIL</button>
            <button class="submit-btn" onclick="loginGoogleForDirector()" style="width:100%;max-width:280px;background:rgba(255,255,255,0.1);border:2px solid rgba(255,255,255,0.3);">SIGN IN WITH GOOGLE</button>
        </div>
    `;
    document.getElementById('modalBody').innerHTML = html;
    document.querySelector('.modal-title').textContent = '🎯 DIRECTOR LOGIN';
    document.getElementById('registerModal').classList.add('active');
    setTimeout(() => document.getElementById('directorEmailInput').focus(), 100);
}

// verifyDirectorPin removed — PIN login retired. Use loginEmailForDirector/loginGoogleForDirector.

export function openFillinModal() {
    renderFillinForm();
    document.getElementById('registerModal').classList.add('active');
}

export function openSubSignupModal() {
    renderSubSignupForm();
    document.getElementById('registerModal').classList.add('active');
}

async function getLevelRanges() {
    const levelStats = { A: [], B: [], C: [] };

    try {
        // Import from app.js instead of calling on state object
const { ensurePlayersLoaded, ensureStatsLoaded } = await import('./app.js?v=4');
        await ensurePlayersLoaded();
        await ensureStatsLoaded();

        const playerLevels = {};
        Object.entries(state.allPlayersById).forEach(([id, p]) => {
            if (p.level && ['A', 'B', 'C'].includes(p.level)) {
                playerLevels[id] = p.level;
            }
        });

        Object.entries(state.allStatsById).forEach(([id, s]) => {
            const level = playerLevels[id];
            if (level && levelStats[level]) {
                const avg = get3DA(s);
                const mpr = getMPR(s);
                if (avg != null) levelStats[level].push({ avg, mpr });
            }
        });

        const ranges = {};
        for (const level of ['A', 'B', 'C']) {
            const stats = levelStats[level];
            if (stats.length > 0) {
                const avgs = stats.map(s => s.avg).filter(v => v != null);
                const mprs = stats.map(s => s.mpr).filter(v => v != null);
                ranges[level] = {
                    avgMin: avgs.length > 0 ? Math.min(...avgs).toFixed(1) : null,
                    avgMax: avgs.length > 0 ? Math.max(...avgs).toFixed(1) : null,
                    mprMin: mprs.length > 0 ? Math.min(...mprs).toFixed(2) : null,
                    mprMax: mprs.length > 0 ? Math.max(...mprs).toFixed(2) : null
                };
            }
        }
        return ranges;
    } catch (e) {
        console.error('Error getting level ranges:', e);
        return {};
    }
}

// ===== SUB SIGNUP FORM =====

export async function renderSubSignupForm() {
    // Show loading
    document.getElementById('modalBody').innerHTML = '<div style="text-align: center; padding: 40px;"><div class="spinner"></div><p>Loading...</p></div>';
    document.querySelector('.modal-title').textContent = 'BE A SUB';

    // Get level ranges
    const ranges = await getLevelRanges();

    const levelOptionsHtml = ['A', 'B', 'C'].map(level => {
        const r = ranges[level];
        let rangeText = '';
        if (r && r.avgMin && r.avgMax) {
            rangeText = ` (${r.avgMin}-${r.avgMax} 3DA`;
            if (r.mprMin && r.mprMax) {
                rangeText += ` / ${r.mprMin}-${r.mprMax} MPR`;
            }
            rangeText += ')';
        }
        const levelName = level === 'A' ? 'Advanced' : level === 'B' ? 'Intermediate' : 'Beginner';
        return `<option value="${level}">${level} - ${levelName}${rangeText}</option>`;
    }).join('');

    const html = `
        <div class="sub-signup-intro">
            <p>Teams sometimes need substitute players. Sign up to get called when there's a spot available.</p>
            <ul>
                <li>No commitment required</li>
                <li>Play only when you're available</li>
                <li>Great way to meet players and get league experience</li>
            </ul>
        </div>

        <!-- Sign in with Email / Google -->
        <div class="pin-section">
            <div class="pin-section-title">ALREADY A MEMBER? SIGN IN</div>
            <input type="email" id="subLoginEmail" class="pin-input" placeholder="Email" autocomplete="email" style="width:100%;margin-bottom:6px;">
            <input type="password" id="subLoginPassword" class="pin-input" placeholder="Password" autocomplete="current-password" style="width:100%;margin-bottom:6px;">
            <div id="subLoginError" style="color:#ef4444;font-size:11px;min-height:14px;margin-bottom:6px;text-align:center;"></div>
            <div class="pin-row">
                <button class="pin-btn" onclick="loginEmailForReg('sub')" style="flex:1;">EMAIL</button>
                <button class="pin-btn" onclick="loginGoogleForReg('sub')" style="flex:1;">GOOGLE</button>
            </div>
        </div>

        <div class="divider"><span>OR REGISTER NEW</span></div>

        <form id="subSignupForm" onsubmit="submitSubSignup(event)">
            <div class="form-group">
                <label class="form-label">Full Name <span>*</span></label>
                <input type="text" id="subName" name="full_name" class="form-input" required placeholder="John Smith">
            </div>

            <div class="form-group">
                <label class="form-label">Email <span>*</span></label>
                <input type="email" id="subEmail" name="email" class="form-input" required placeholder="john@example.com">
            </div>

            <div class="form-group">
                <label class="form-label">Phone <span>*</span></label>
                <input type="tel" id="subPhone" name="phone" class="form-input" required placeholder="555-123-4567">
            </div>

            <div class="form-group">
                <label class="form-label">Your Level</label>
                <select id="subLevel" name="preferred_level" class="form-select">
                    <option value="">-- Select based on your stats --</option>
                    ${levelOptionsHtml}
                </select>
            </div>

            <div class="form-row">
                <div class="form-group" style="flex: 1;">
                    <label class="form-label">501 Average</label>
                    <input type="number" id="sub501" name="avg_501" class="form-input" step="0.01" placeholder="e.g., 45.5">
                </div>
                <div class="form-group" style="flex: 1;">
                    <label class="form-label">Cricket MPR</label>
                    <input type="number" id="subMPR" name="avg_cricket" class="form-input" step="0.01" placeholder="e.g., 2.5">
                </div>
            </div>

            <button type="submit" class="submit-btn" id="subSubmitBtn">SIGN UP AS SUB</button>
        </form>
    `;

    document.getElementById('modalBody').innerHTML = html;
}

// lookupSubPin removed — PIN login retired.

export async function submitSubSignup(e) {
    e.preventDefault();
    const form = document.getElementById('subSignupForm');
    const formData = new FormData(form);
    const btn = document.getElementById('subSubmitBtn');

    btn.disabled = true;
    btn.textContent = 'SIGNING UP...';

    try {
        const result = await callFunction('registerFillin', {
            league_id: state.leagueId,
            full_name: formData.get('full_name'),
            email: formData.get('email'),
            phone: formData.get('phone'),
            preferred_level: formData.get('preferred_level') || null,
            avg_501: formData.get('avg_501') ? parseFloat(formData.get('avg_501')) : null,
            avg_cricket: formData.get('avg_cricket') ? parseFloat(formData.get('avg_cricket')) : null,
            send_welcome_sms: true, // Flag to trigger welcome SMS
            create_member: true // Also create as BRDC member
        });

        if (result.success) {
            const pinDisplay = result.player_pin ? `
                <div style="background: rgba(253,216,53,0.2); border: 2px solid var(--yellow); padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                    <div style="font-size: 12px; color: var(--text-dim); margin-bottom: 5px;">YOUR BRDC PIN</div>
                    <div style="font-family: 'Bebas Neue', cursive; font-size: 36px; color: var(--yellow); letter-spacing: 4px;">${result.player_pin}</div>
                    <div style="font-size: 11px; color: var(--text-dim); margin-top: 5px;">Save this - use it to log in anywhere on BRDC</div>
                </div>
            ` : '';

            document.getElementById('modalBody').innerHTML = `
                <div style="text-align: center; padding: 30px;">
                    <div style="font-size: 64px; margin-bottom: 15px;">🎯</div>
                    <div style="font-family: 'Archivo Black', sans-serif; font-size: 20px; color: var(--teal); margin-bottom: 15px;">YOU'RE ON THE LIST!</div>
                    ${pinDisplay}
                    <p style="color: var(--text-dim); margin-bottom: 20px;">
                        Captains will contact you when they need a substitute.
                    </p>
                    <button class="register-btn" onclick="closeModal()">DONE</button>
                </div>
            `;
            // Reload fillins list
            const fillinsSnap = await getDocs(collection(db, 'leagues', state.leagueId, 'fillins'));
            state.fillins = fillinsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        } else {
            throw new Error(result.error || 'Signup failed');
        }
    } catch (error) {
        console.error('Sub signup error:', error);
        toastError('Error: ' + error.message);
        btn.disabled = false;
        btn.textContent = 'SIGN UP AS SUB';
    }
}

// ===== FILL-IN FORM =====

export function renderFillinForm() {
    const fillinSettings = state.leagueData.fillin_settings || {};

    const html = `
        <!-- Sign in with Email / Google -->
        <div class="pin-section">
            <div class="pin-section-title">ALREADY A MEMBER? SIGN IN</div>
            <input type="email" id="fillinLoginEmail" class="pin-input" placeholder="Email" autocomplete="email" style="width:100%;margin-bottom:6px;">
            <input type="password" id="fillinLoginPassword" class="pin-input" placeholder="Password" autocomplete="current-password" style="width:100%;margin-bottom:6px;">
            <div id="fillinLoginError" style="color:#ef4444;font-size:11px;min-height:14px;margin-bottom:6px;text-align:center;"></div>
            <div class="pin-row">
                <button class="pin-btn" onclick="loginEmailForReg('fillin')" style="flex:1;">EMAIL</button>
                <button class="pin-btn" onclick="loginGoogleForReg('fillin')" style="flex:1;">GOOGLE</button>
            </div>
        </div>

        <div class="divider"><span>OR REGISTER NEW</span></div>

        <form id="fillinForm" onsubmit="submitFillin(event)">
            <div class="form-group" style="text-align: center; margin-bottom: 20px;">
                <label class="form-label">Profile Photo (Optional)</label>
                <div class="image-uploader" id="fillinPhotoUploader" style="max-width: 120px; margin: 10px auto; border-radius: 50%; min-height: 120px;">
                    <input type="file" id="fillinPhotoInput" accept="image/*" onchange="handleFillinPhotoChange(this)">
                    <div id="fillinPhotoPlaceholder">
                        <div class="image-uploader-icon">📷</div>
                        <div class="image-uploader-text" style="font-size: 11px;">Add photo</div>
                    </div>
                    <div id="fillinPhotoPreviewContainer" class="image-preview-container" style="display: none;">
                        <img id="fillinPhotoPreview" class="image-preview" style="border-radius: 50%; width: 100px; height: 100px;" alt="Preview">
                    </div>
                </div>
            </div>

            <div class="form-group">
                <label class="form-label">Full Name <span>*</span></label>
                <input type="text" id="fillinName" name="full_name" class="form-input" required placeholder="John Smith">
            </div>

            <div class="form-group">
                <label class="form-label">Email <span>*</span></label>
                <input type="email" id="fillinEmail" name="email" class="form-input" required placeholder="john@example.com">
            </div>

            <div class="form-group">
                <label class="form-label">Phone <span>*</span></label>
                <input type="tel" id="fillinPhone" name="phone" class="form-input" required placeholder="555-123-4567">
            </div>

            ${fillinSettings.collect_level !== false ? `
            <div class="form-group">
                <label class="form-label">Preferred Level</label>
                <select id="fillinLevel" name="preferred_level" class="form-select">
                    <option value="">-- Select --</option>
                    <option value="A">A - Advanced</option>
                    <option value="B">B - Intermediate</option>
                    <option value="C">C - Beginner</option>
                </select>
            </div>
            ` : ''}

            ${fillinSettings.collect_501_avg !== false ? `
            <div class="form-group">
                <label class="form-label">501 Average (if known)</label>
                <input type="number" id="fillin501" name="avg_501" class="form-input" step="0.01" placeholder="e.g., 45.5">
            </div>
            ` : ''}

            ${fillinSettings.collect_cricket_avg !== false ? `
            <div class="form-group">
                <label class="form-label">Cricket MPR (if known)</label>
                <input type="number" id="fillinCricket" name="avg_cricket" class="form-input" step="0.01" placeholder="e.g., 2.5">
            </div>
            ` : ''}

            <div class="form-group">
                <label class="checkbox-group">
                    <input type="checkbox" name="sms_opt_in" checked>
                    <span>Contact me via SMS when fill-in needed</span>
                </label>
            </div>

            <button type="submit" class="submit-btn" id="fillinSubmitBtn">SIGN UP AS FILL-IN</button>
        </form>
    `;

    document.getElementById('modalBody').innerHTML = html;
    document.querySelector('.modal-title').textContent = 'FILL-IN SIGNUP';
}

// lookupFillinPin removed — PIN login retired.

export function handleFillinPhotoChange(input) {
    const file = input.files[0];
    if (file) {
        if (file.size > 5 * 1024 * 1024) {
            toastWarning('Image must be less than 5MB');
            input.value = '';
            return;
        }
        state.selectedFillinPhoto = file;
        const reader = new FileReader();
        reader.onload = function (e) {
            document.getElementById('fillinPhotoPreview').src = e.target.result;
            document.getElementById('fillinPhotoPreviewContainer').style.display = 'block';
            document.getElementById('fillinPhotoPlaceholder').style.display = 'none';
        };
        reader.readAsDataURL(file);
    }
}

export function handleRegPhotoChange(input) {
    const file = input.files[0];
    if (file) {
        if (file.size > 5 * 1024 * 1024) {
            toastWarning('Image must be less than 5MB');
            input.value = '';
            return;
        }
        state.selectedRegPhoto = file;
        const reader = new FileReader();
        reader.onload = function (e) {
            document.getElementById('regPhotoPreview').src = e.target.result;
            document.getElementById('regPhotoPreviewContainer').style.display = 'block';
            document.getElementById('regPhotoPlaceholder').style.display = 'none';
        };
        reader.readAsDataURL(file);
    }
}

export async function submitFillin(e) {
    e.preventDefault();

    const form = e.target;
    const formData = new FormData(form);
    const btn = document.getElementById('fillinSubmitBtn');

    btn.disabled = true;
    btn.textContent = 'SIGNING UP...';

    try {
        // Upload photo if selected
        let photoUrl = '';
        if (state.selectedFillinPhoto) {
            showLoading('Uploading photo...');
            try {
                photoUrl = await uploadImage(state.selectedFillinPhoto, 'players');
            } catch (uploadError) {
                console.error('Photo upload failed:', uploadError);
            }
            hideLoading();
        }

        showLoading('Signing up...');
        const result = await callFunction('registerFillin', {
            league_id: state.leagueId,
            full_name: formData.get('full_name'),
            email: formData.get('email'),
            phone: formData.get('phone'),
            preferred_level: formData.get('preferred_level') || null,
            avg_501: formData.get('avg_501') ? parseFloat(formData.get('avg_501')) : null,
            avg_cricket: formData.get('avg_cricket') ? parseFloat(formData.get('avg_cricket')) : null,
            sms_opt_in: formData.get('sms_opt_in') ? true : false,
            member_pin: state.memberData?.pin || null,
            photo_url: photoUrl
        });
        hideLoading();

        if (!result.success) {
            throw new Error(result.error || 'Fill-in signup failed');
        }

        // Show success
        document.getElementById('modalBody').innerHTML = `
            <div class="success-content">
                <div class="success-icon">✅</div>
                <div class="success-title">YOU'RE SIGNED UP!</div>
                <div class="success-message">
                    You've been added to the fill-in list. Captains will contact you when they need a substitute.
                </div>
                ${result.player_pin ? `
                    <div class="pin-display-box">
                        <div class="pin-display-label">YOUR PIN (SAVE THIS!)</div>
                        <div class="pin-display-value">${result.player_pin}</div>
                    </div>
                ` : ''}
                <button class="submit-btn" onclick="closeModal(); location.reload();">DONE</button>
            </div>
        `;

    } catch (error) {
        hideLoading();
        toastError('Error: ' + error.message);
        btn.disabled = false;
        btn.textContent = 'SIGN UP AS FILL-IN';
    }
}

// ===== REGISTRATION FORM =====

export function renderRegistrationForm() {
    const entryFee = parseFloat(state.leagueData.entry_fee) || 0;

    const html = `
        <!-- Sign in with Email / Google -->
        <div class="pin-section">
            <div class="pin-section-title">ALREADY A MEMBER? SIGN IN</div>
            <input type="email" id="regLoginEmail" class="pin-input" placeholder="Email" autocomplete="email" style="width:100%;margin-bottom:6px;">
            <input type="password" id="regLoginPassword" class="pin-input" placeholder="Password" autocomplete="current-password" style="width:100%;margin-bottom:6px;">
            <div id="regLoginError" style="color:#ef4444;font-size:11px;min-height:14px;margin-bottom:6px;text-align:center;"></div>
            <div class="pin-row">
                <button class="pin-btn" onclick="loginEmailForReg('reg')" style="flex:1;">EMAIL</button>
                <button class="pin-btn" onclick="loginGoogleForReg('reg')" style="flex:1;">GOOGLE</button>
            </div>
        </div>

        <div class="divider"><span>OR REGISTER NEW</span></div>

        <form id="registrationForm" onsubmit="submitRegistration(event)">
            <div class="form-group" style="text-align: center; margin-bottom: 20px;">
                <label class="form-label">Profile Photo (Optional)</label>
                <div class="image-uploader" id="regPhotoUploader" style="max-width: 120px; margin: 10px auto; border-radius: 50%; min-height: 120px; background: linear-gradient(135deg, var(--pink), var(--teal)); display: flex; align-items: center; justify-content: center; cursor: pointer; position: relative; overflow: hidden; border: 3px solid rgba(255,255,255,0.2);">
                    <input type="file" id="regPhotoInput" accept="image/*" onchange="handleRegPhotoChange(this)" style="position: absolute; inset: 0; opacity: 0; cursor: pointer;">
                    <div id="regPhotoPlaceholder" style="text-align: center; color: white;">
                        <div style="font-size: 32px;">📷</div>
                        <div style="font-size: 11px;">Add photo</div>
                    </div>
                    <div id="regPhotoPreviewContainer" style="display: none; width: 100%; height: 100%;">
                        <img id="regPhotoPreview" style="border-radius: 50%; width: 100px; height: 100px; object-fit: cover;" alt="Preview">
                    </div>
                </div>
            </div>

            <div class="form-group">
                <label class="form-label">Full Name <span>*</span></label>
                <input type="text" id="regName" name="full_name" class="form-input" required placeholder="John Smith">
            </div>

            <div class="form-group">
                <label class="form-label">Email <span>*</span></label>
                <input type="email" id="regEmail" name="email" class="form-input" required placeholder="john@example.com">
            </div>

            <div class="form-group">
                <label class="form-label">Phone <span>*</span></label>
                <input type="tel" id="regPhone" name="phone" class="form-input" required placeholder="555-123-4567">
            </div>

            <div class="form-group">
                <label class="form-label">Skill Level</label>
                <select id="regLevel" name="skill_level" class="form-select">
                    <option value="">-- Select --</option>
                    <option value="A">A - Advanced</option>
                    <option value="B">B - Intermediate</option>
                    <option value="C">C - Beginner</option>
                </select>
            </div>

            <div class="form-group">
                <label class="checkbox-group">
                    <input type="checkbox" name="sms_opt_in" checked>
                    <span>Send me SMS match reminders</span>
                </label>
            </div>

            ${entryFee > 0 ? `
                <div class="fee-display">
                    <div style="color: var(--text-dim); font-size: 12px; margin-bottom: 5px;">ENTRY FEE</div>
                    <div class="fee-amount">$${entryFee.toFixed(2)}</div>
                </div>

                <div class="payment-section">
                    <div class="payment-title">PAYMENT METHOD</div>
                    <label class="payment-option selected" onclick="selectPayment(this, 'paypal')">
                        <input type="radio" name="payment_method" value="paypal" checked>
                        <div>
                            <div class="payment-label">Pay Now (PayPal)</div>
                            <div class="payment-desc">Secure payment, instant confirmation</div>
                        </div>
                    </label>
                    <label class="payment-option" onclick="selectPayment(this, 'later')">
                        <input type="radio" name="payment_method" value="later">
                        <div>
                            <div class="payment-label">Pay Later</div>
                            <div class="payment-desc">Reserve your spot, pay before deadline</div>
                        </div>
                    </label>
                    <label class="payment-option" onclick="selectPayment(this, 'event')">
                        <input type="radio" name="payment_method" value="event">
                        <div>
                            <div class="payment-label">Pay at Event</div>
                            <div class="payment-desc">Cash or card at check-in</div>
                        </div>
                    </label>
                </div>
            ` : ''}

            <button type="submit" class="submit-btn" id="submitBtn">REGISTER</button>
        </form>
    `;

    document.getElementById('modalBody').innerHTML = html;
}

export function selectPayment(el, method) {
    document.querySelectorAll('.payment-option').forEach(opt => opt.classList.remove('selected'));
    el.classList.add('selected');
    el.querySelector('input').checked = true;
}

// lookupPin removed — PIN login retired.

export async function submitRegistration(e) {
    e.preventDefault();

    const form = e.target;
    const formData = new FormData(form);
    const btn = document.getElementById('submitBtn');
    const paymentMethod = formData.get('payment_method') || 'free';

    btn.disabled = true;
    btn.textContent = 'REGISTERING...';

    try {
        // Upload photo if selected
        let photoUrl = '';
        if (state.selectedRegPhoto) {
            showLoading('Uploading photo...');
            try {
                photoUrl = await uploadImage(state.selectedRegPhoto, 'players');
            } catch (uploadError) {
                console.error('Photo upload failed:', uploadError);
            }
            hideLoading();
        }

        showLoading('Registering...');
        const result = await callFunction('registerForLeague', {
            league_id: state.leagueId,
            full_name: formData.get('full_name'),
            email: formData.get('email'),
            phone: formData.get('phone'),
            skill_level: formData.get('skill_level') || null,
            sms_opt_in: formData.get('sms_opt_in') ? true : false,
            payment_method: paymentMethod,
            member_pin: state.memberData?.pin || null,
            photo_url: photoUrl
        });
        hideLoading();

        if (!result.success) {
            throw new Error(result.error || 'Registration failed');
        }

        // If PayPal selected, redirect to payment
        if (paymentMethod === 'paypal' && result.paypal_url) {
            window.location.href = result.paypal_url;
            return;
        }

        showSuccess(result);

    } catch (error) {
        hideLoading();
        toastError('Error: ' + error.message);
        btn.disabled = false;
        btn.textContent = 'REGISTER';
    }
}

export function showSuccess(result) {
    const html = `
        <div class="success-content">
            <div class="success-icon">🎉</div>
            <div class="success-title">YOU'RE REGISTERED!</div>
            <div class="success-message">
                ${result.waitlist ? 'You\'ve been added to the waitlist. We\'ll notify you if a spot opens.' :
            result.payment_status === 'pending' ? 'Your spot is reserved! Please complete payment before the deadline.' :
                'Welcome to the league! Check your email for confirmation details.'}
            </div>
            ${result.player_pin ? `
                <div class="pin-display-box">
                    <div class="pin-display-label">YOUR PIN (SAVE THIS!)</div>
                    <div class="pin-display-value">${result.player_pin}</div>
                </div>
            ` : ''}
            <button class="submit-btn" onclick="closeModal(); location.reload();">DONE</button>
        </div>
    `;

    document.getElementById('modalBody').innerHTML = html;
}

// ===== MODAL CONTROLS =====

export function openModal() {
    renderRegistrationForm();
    var modalEl = document.getElementById('registerModal');
    modalEl.classList.add('active');
    if (window.A11y && A11y.initModal) {
        window._registerModalCleanup = A11y.initModal(modalEl, { labelledBy: 'registerModalTitle', onClose: closeModal });
    }
}

export function closeModal() {
    if (window._registerModalCleanup) { window._registerModalCleanup(); window._registerModalCleanup = null; }
    document.getElementById('registerModal').classList.remove('active');
}

// These functions are called by window.function() from inline handlers
// and need to be exposed
