import {
    auth,
    waitForAuthReady,
    callFunction,
    signInWithEmailAndPassword,
    sendPasswordResetEmail,
    GoogleAuthProvider,
    signInWithPopup,
    signOut
} from '/js/firebase-config.js';

function hasDirectorRole(player) {
    return player?.is_director === true || player?.is_admin === true || player?.is_master_admin === true;
}

function storeDirectorSession(player) {
    localStorage.setItem('brdc_session', JSON.stringify({
        player_id: player.id,
        name: player.name,
        source_type: player.source_type || 'global',
        league_id: player.league_id || null,
        is_admin: player.is_admin || false,
        is_master_admin: player.is_master_admin || false,
        is_director: player.is_director || false,
        is_captain: player.is_captain || false,
        involvements: player.involvements || {},
        logged_in_at: Date.now()
    }));
}

function setError(panel, message = '') {
    const error = panel.querySelector('[data-director-auth-error]');
    if (!error) return;
    error.textContent = message;
    error.hidden = !message;
}

function setBusy(panel, busy) {
    panel.querySelectorAll('button, input').forEach(item => {
        item.disabled = busy;
    });
}

function createLoginPanel({ title, copy }) {
    const panel = document.createElement('section');
    panel.className = 'ves-panel ves-director-auth';
    panel.innerHTML = `
        <p class="ves-kicker">Director login</p>
        <h2>${title}</h2>
        <p class="ves-director-auth-copy">${copy}</p>
        <div class="ves-config-grid">
            <label>Email<input type="email" autocomplete="email" data-director-auth-email></label>
            <label>Password<input type="password" autocomplete="current-password" data-director-auth-password></label>
        </div>
        <div class="ves-director-auth-actions">
            <button class="ves-launch" type="button" data-director-auth-submit>Log in</button>
            <button class="ves-action" type="button" data-director-auth-google>Google</button>
            <button class="ves-action" type="button" data-director-auth-reset>Reset password</button>
        </div>
        <div class="ves-form-status error" data-director-auth-error hidden></div>
    `;
    return panel;
}

async function currentDirectorSession() {
    await waitForAuthReady(5000);
    if (!auth.currentUser) return null;

    const result = await callFunction('getPlayerSession', {});
    if (!result?.success || !result.player) {
        throw new Error(result?.error || 'Could not load director account.');
    }

    if (!hasDirectorRole(result.player)) {
        await signOut(auth).catch(() => {});
        throw new Error('This account is not marked as a director or admin.');
    }

    storeDirectorSession(result.player);
    return result.player;
}

export async function requireDirectorLogin(options = {}) {
    const {
        mountAfter,
        gatedElements = [],
        statusEl = null,
        title = 'Director Access',
        copy = 'Use a director or admin account to manage tournament setup and runtime controls.',
        readyText = 'Director controls ready'
    } = options;

    const panel = createLoginPanel({ title, copy });
    const anchor = mountAfter || document.querySelector('.ves-hero');
    anchor?.insertAdjacentElement('afterend', panel);

    const gates = gatedElements.filter(Boolean);
    const showGates = (show) => {
        gates.forEach(element => {
            element.hidden = !show;
        });
        panel.hidden = show;
    };

    const completeLogin = async (mode) => {
        setError(panel, '');
        setBusy(panel, true);
        try {
            if (mode === 'email') {
                const email = panel.querySelector('[data-director-auth-email]')?.value.trim();
                const password = panel.querySelector('[data-director-auth-password]')?.value || '';
                if (!email || !password) throw new Error('Enter your director email and password.');
                await signInWithEmailAndPassword(auth, email, password);
            } else if (mode === 'google') {
                const provider = new GoogleAuthProvider();
                await signInWithPopup(auth, provider);
            }

            const player = await currentDirectorSession();
            showGates(true);
            if (statusEl) statusEl.textContent = `${readyText}: ${player.name || player.email || auth.currentUser?.email}`;
            return player;
        } catch (error) {
            if (error.code === 'auth/popup-closed-by-user' || error.code === 'auth/cancelled-popup-request') return null;
            let message = error.message || 'Director login failed.';
            if (error.code === 'auth/invalid-credential' || error.code === 'auth/wrong-password' || error.code === 'auth/user-not-found') {
                message = 'Invalid email or password.';
            } else if (error.code === 'auth/too-many-requests') {
                message = 'Too many attempts. Try again later.';
            } else if (error.code === 'auth/popup-blocked') {
                message = 'Popup was blocked. Allow popups for this site and try again.';
            }
            setError(panel, message);
            showGates(false);
            return null;
        } finally {
            setBusy(panel, false);
        }
    };

    panel.querySelector('[data-director-auth-submit]')?.addEventListener('click', () => completeLogin('email'));
    panel.querySelector('[data-director-auth-google]')?.addEventListener('click', () => completeLogin('google'));
    panel.querySelector('[data-director-auth-password]')?.addEventListener('keydown', event => {
        if (event.key === 'Enter') completeLogin('email');
    });
    panel.querySelector('[data-director-auth-email]')?.addEventListener('keydown', event => {
        if (event.key === 'Enter') completeLogin('email');
    });
    panel.querySelector('[data-director-auth-reset]')?.addEventListener('click', async () => {
        const email = panel.querySelector('[data-director-auth-email]')?.value.trim();
        if (!email) {
            setError(panel, 'Enter your email first.');
            return;
        }
        try {
            await sendPasswordResetEmail(auth, email);
            setError(panel, 'Password reset email sent.');
        } catch (error) {
            setError(panel, error.message || 'Could not send password reset.');
        }
    });

    showGates(false);
    if (statusEl) statusEl.textContent = 'Director login required';

    try {
        const player = await currentDirectorSession();
        showGates(true);
        if (statusEl) statusEl.textContent = `${readyText}: ${player.name || player.email || auth.currentUser?.email}`;
        return player;
    } catch (error) {
        if (auth.currentUser) setError(panel, error.message || 'Director login required.');
        showGates(false);
        return null;
    }
}
