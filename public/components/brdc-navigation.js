/**
 * BRDC Navigation Component v4.3
 * Single responsive nav system for vNext pages.
 *
 * Mobile (≤860px): fixed bottom tab bar (5 tabs, raised center Play) + compact top header.
 * Desktop (>860px): sticky top bar — logo left, 5 tabs center, utility right. NO sidebar.
 *
 * Entry point: initBRDCNavigation({ pageTitle, page, backUrl, ... })
 * called from brdc-navigation-init.js which each vNext page already includes.
 *
 * TODO (Phase 6): wire onPlayAction() for the Play action sheet
 * Phase 2 (SHIPPED): role-gated Manage section in avatar dropdown menu.
 */

/* ─────────────────────────────────────────────
   PAGE → TAB MAP
   Maps URL path segments to the 5 primary tab keys.
   ───────────────────────────────────────────── */
const VNEXT_TAB_MAP = {
    // Home
    'home-vnext':        'home',
    'dashboard':         'home',
    // League
    'triples-vnext':     'league',
    'leagues-vnext':     'league',
    'leagues':           'league',
    'league-team':       'league',
    'league-director':   'league',
    'league-import':     'league',
    'members-vnext':     'clubhouse',  // members = people directory → Clubhouse
    // Play (scorer flows + arena)
    'arena-vnext':       'play',
    'scorer-setup':      'play',
    'x01-scorer':        'play',
    'league-cricket':    'play',
    'match-hub':         'play',
    'matchmaker-mingle': 'play',
    'matchmaker-tv':     'play',
    // Events
    'events-vnext':      'events',
    'tournament-view':   'events',
    'tournament-register':'events',
    'tournament-runtime':'events',
    'wing-it-wednesdays':'events',
    'create-tournament': 'events',
    // Clubhouse
    'messages-vnext':    'clubhouse',
    'dart-trader':       'clubhouse',
    'dart-trader-create':'clubhouse',
    'dart-trader-listing':'clubhouse',
};

/**
 * Legacy page-key → tab-key normalizer.
 * Pages pass `page:` values from before the 5-tab redesign.
 * Map them to the correct tab so setActivePage() works without requiring
 * every page to update its initBRDCNavigation() call.
 */
const LEGACY_PAGE_TO_TAB = {
    // old home keys
    'dashboard':          'home',
    // old events keys (capital E used in several pages)
    'Events':             'events',
    'event':              'events',
    // old chat/messages keys
    'chat':               'clubhouse',
    'messages':           'clubhouse',
    // old trader keys
    'trader':             'clubhouse',
    // old scorer keys
    'scorer':             'play',
    'play':               'play',
    // old league keys
    'league':             'league',
    'leagues':            'league',
    'league-director':    'league',
    'league-import':      'league',
    // old profile — no primary tab, falls back to URL detection
    'player-profile':     null,
    'profile':            null,
    // old manage/captain/admin — no primary tab
    'captain':            null,
    'director-home':      null,
    'director-contact':   null,
    'admin':              null,
    'create-league':      null,
    // members
    'members':            'clubhouse',
};

/* ─────────────────────────────────────────────
   ROUTES
   ───────────────────────────────────────────── */
const VNEXT_ROUTES = {
    home:      '/pages/home-vnext.html',
    league:    '/pages/leagues-vnext.html',    // Phase 4: My Leagues player-centric landing
    play:      '/pages/arena-vnext.html',
    events:    '/pages/events-vnext.html',
    clubhouse: '/pages/messages-vnext.html',  // interim — Phase 5 renames to Clubhouse
    profile:   '/pages/player-profile-vnext.html',
};

/* ─────────────────────────────────────────────
   SVG ICON LIBRARY  (inline, stroke-based)
   ───────────────────────────────────────────── */
const _SA = 'xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';
const NAV_ICONS = {
    home:      `<svg ${_SA}><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`,
    league:    `<svg ${_SA}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,
    play:      `<svg ${_SA}><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="5.5"/><circle cx="12" cy="12" r="1.6" fill="currentColor"/><line x1="12" y1="2" x2="12" y2="5"/><line x1="12" y1="19" x2="12" y2="22"/><line x1="2" y1="12" x2="5" y2="12"/><line x1="19" y1="12" x2="22" y2="12"/></svg>`,
    events:    `<svg ${_SA}><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`,
    clubhouse: `<svg ${_SA}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`,
    search:    `<svg ${_SA}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`,
    bell:      `<svg ${_SA}><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>`,
    avatar:    `<svg ${_SA}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`,
    back:      `<svg ${_SA}><path d="M19 12H5M12 19l-7-7 7-7"/></svg>`,
    chevron:   `<svg ${_SA} width="16" height="16"><polyline points="6 9 12 15 18 9"/></svg>`,
    profile:   `<svg ${_SA}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`,
    settings:  `<svg ${_SA}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`,
    logout:    `<svg ${_SA}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>`,
    manage:    `<svg ${_SA}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>`,
};

/* ─────────────────────────────────────────────
   DESKTOP BREAKPOINT
   ───────────────────────────────────────────── */
const DESKTOP_BP = 860;

/* ─────────────────────────────────────────────
   BRDCNavigation CLASS
   ───────────────────────────────────────────── */
class BRDCNavigation {
    constructor(options = {}) {
        this.pageTitle  = options.pageTitle  || document.title || 'BRDC';
        this.backUrl    = options.backUrl    || '';
        this.showSearch = options.showSearch !== false;
        this.player     = null;
        this._resizeTimer = null;
        this._avatarOpen  = false;
        this._notifPanel  = null;

        // Detect active tab from URL
        this.activeTab = this._detectTab();
    }

    /* ── Detect which tab the current page belongs to ── */
    _detectTab() {
        const path = window.location.pathname;
        // Check each key in the tab map against the URL path
        for (const [segment, tab] of Object.entries(VNEXT_TAB_MAP)) {
            if (path.includes(segment)) return tab;
        }
        return 'home';
    }

    /* ── Normalize a legacy page-key (from initBRDCNavigation's `page:`) ── */
    _normalizePage(pageKey) {
        if (!pageKey) return null;
        // Already a valid primary tab key?
        if (['home','league','play','events','clubhouse'].includes(pageKey)) return pageKey;
        // Map from legacy key
        const mapped = LEGACY_PAGE_TO_TAB[pageKey];
        if (mapped !== undefined) return mapped; // may be null (no primary tab)
        // Last resort: try URL detection
        return null;
    }

    /* ── Load player from sessionStorage / localStorage ── */
    _loadPlayer() {
        try {
            const raw = sessionStorage.getItem('currentPlayer')
                     || localStorage.getItem('brdc_session');
            if (raw) this.player = JSON.parse(raw);
        } catch (_) {}
    }

    /* ── Player initials for avatar ── */
    _initials() {
        const name = this.player?.name || this.player?.display_name || '';
        const parts = name.trim().split(/\s+/);
        if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
        if (parts[0]) return parts[0].slice(0, 2).toUpperCase();
        return 'B';
    }

    /* ── Check if desktop ── */
    _isDesktop() { return window.innerWidth > DESKTOP_BP; }

    /* ══════════════════════════════════════════
       INIT
    ══════════════════════════════════════════ */
    async init() {
        // Phase 3: Scorer full-screen guard.
        // Scorer pages are their own full-screen surfaces with their own exit
        // controls. If this init is ever called on one (e.g. future copy-paste),
        // bail immediately so no nav bars or body padding are injected.
        if (document.body.classList.contains('scorer-fullscreen')) return;

        this._loadPlayer();

        // Body baseline
        document.body.classList.add('has-brdc-nav');

        this._build();
        this._bindResize();

        // Async badge load (non-blocking)
        this._loadBadgeCounts().catch(() => {});

        // Phase 2: async role resolution → inject Manage section when ready.
        // Fails closed: Manage section only appears after roles confirmed.
        this._resolveRoles().catch(() => {});
    }

    /* ══════════════════════════════════════════
       BUILD / REBUILD
    ══════════════════════════════════════════ */
    _build() {
        // Remove any old instances
        document.getElementById('brdcTopBar')    ?.remove();
        document.getElementById('brdcMobileHeader')?.remove();
        document.getElementById('brdcMobileNav') ?.remove();
        document.getElementById('brdcDesktopNav')?.remove();  // legacy id
        document.getElementById('brdcAvatarMenu')?.remove();
        document.body.classList.remove('has-desktop-nav', 'has-mobile-nav',
            'is-desktop', 'is-mobile', 'is-tablet');

        if (this._isDesktop()) {
            document.body.classList.add('is-desktop', 'has-desktop-nav');
            this._buildDesktopTopBar();
        } else {
            document.body.classList.add('is-mobile', 'has-mobile-nav');
            this._buildMobileHeader();
            this._buildMobileTabBar();
        }

        this._buildAvatarMenu();
        this._buildNotifPanel();
    }

    /* ══════════════════════════════════════════
       DESKTOP TOP BAR
    ══════════════════════════════════════════ */
    _buildDesktopTopBar() {
        const bar = document.createElement('nav');
        bar.id = 'brdcTopBar';
        bar.className = 'brdc-top-bar';
        bar.setAttribute('aria-label', 'Main navigation');
        bar.innerHTML = `
            <a href="${VNEXT_ROUTES.home}" class="brdc-tb-logo" aria-label="BRDC Home">
                <img src="/images/gold_logo.png" alt="BRDC" height="40">
            </a>
            <div class="brdc-tb-tabs" role="tablist">
                ${this._desktopTab('home',      'Home')}
                ${this._desktopTab('league',    'League')}
                ${this._desktopPlayBtn()}
                ${this._desktopTab('events',    'Events')}
                ${this._desktopTab('clubhouse', 'Clubhouse')}
            </div>
            <div class="brdc-tb-utility">
                <button class="brdc-tb-util-btn" id="brdcSearchBtn" aria-label="Search">
                    ${NAV_ICONS.search}
                </button>
                <button class="brdc-tb-util-btn brdc-notif-btn" id="brdcNotifBtnDesktop" aria-label="Notifications">
                    ${NAV_ICONS.bell}
                    <span class="brdc-badge" id="brdcNotifBadgeDesktop" hidden></span>
                </button>
                <button class="brdc-tb-avatar-btn" id="brdcAvatarBtnDesktop" aria-label="Account menu" aria-haspopup="true" aria-expanded="false">
                    <span class="brdc-avatar-circle">${this._initials()}</span>
                </button>
            </div>
        `;

        // Insert at very top of body
        document.body.insertBefore(bar, document.body.firstChild);

        // Wire up buttons
        bar.querySelector('#brdcSearchBtn')?.addEventListener('click', () => this._handleSearch());
        bar.querySelector('#brdcNotifBtnDesktop')?.addEventListener('click', (e) => {
            e.stopPropagation();
            this._toggleNotifications();
        });
        bar.querySelector('#brdcAvatarBtnDesktop')?.addEventListener('click', (e) => {
            e.stopPropagation();
            this._toggleAvatarMenu(bar.querySelector('#brdcAvatarBtnDesktop'));
        });

        // Wire the desktop Play button. _wireDesktopPlayBtn() existed but was never
        // called, which left desktop Play dead while mobile Play (wired separately) worked.
        this._wireDesktopPlayBtn();
    }

    _desktopTab(key, label) {
        const active = this.activeTab === key;
        return `<a href="${VNEXT_ROUTES[key]}"
                   class="brdc-tb-tab${active ? ' active' : ''}"
                   data-tab="${key}"
                   ${active ? 'aria-current="page"' : ''}
                   role="tab">
                    <span class="brdc-tb-tab-icon">${NAV_ICONS[key]}</span>
                    <span class="brdc-tb-tab-label">${label}</span>
                </a>`;
    }

    _desktopPlayBtn() {
        const active = this.activeTab === 'play';
        return `<button class="brdc-tb-tab brdc-tb-play${active ? ' active' : ''}"
                        data-tab="play"
                        id="brdcDesktopPlayBtn"
                        aria-label="Play"
                        ${active ? 'aria-current="page"' : ''}>
                    <span class="brdc-tb-tab-icon brdc-play-icon">${NAV_ICONS.play}</span>
                    <span class="brdc-tb-tab-label">Play</span>
                </button>`;
    }

    /* ══════════════════════════════════════════
       MOBILE TOP HEADER
    ══════════════════════════════════════════ */
    _buildMobileHeader() {
        const header = document.createElement('header');
        header.id = 'brdcMobileHeader';
        header.className = 'brdc-mob-header';
        header.setAttribute('role', 'banner');

        // Back button logic: show if backUrl provided or page is not home
        const showBack = !!(this.backUrl || this.activeTab !== 'home');

        header.innerHTML = `
            <div class="brdc-mh-left">
                ${showBack
                    ? `<button class="brdc-mh-btn brdc-mh-back" id="brdcMobBackBtn" aria-label="Go back">${NAV_ICONS.back}</button>`
                    : `<a href="${VNEXT_ROUTES.home}" class="brdc-mh-logo-wrap" aria-label="BRDC"><img src="/images/gold_logo.png" alt="BRDC" class="brdc-mh-logo"></a>`
                }
            </div>
            <div class="brdc-mh-center">
                <span class="brdc-mh-title" id="brdcMobTitle">${this.pageTitle}</span>
            </div>
            <div class="brdc-mh-right">
                <button class="brdc-mh-btn" id="brdcSearchBtnMob" aria-label="Search">
                    ${NAV_ICONS.search}
                </button>
                <button class="brdc-mh-btn brdc-notif-btn" id="brdcNotifBtnMob" aria-label="Notifications">
                    ${NAV_ICONS.bell}
                    <span class="brdc-badge" id="brdcNotifBadgeMob" hidden></span>
                </button>
                <button class="brdc-mh-avatar-btn" id="brdcAvatarBtnMob" aria-label="Account menu" aria-haspopup="true" aria-expanded="false">
                    <span class="brdc-avatar-circle brdc-avatar-sm">${this._initials()}</span>
                </button>
            </div>
        `;

        document.body.insertBefore(header, document.body.firstChild);

        // Wire back
        header.querySelector('#brdcMobBackBtn')?.addEventListener('click', () => this._handleBack());

        // Wire search
        header.querySelector('#brdcSearchBtnMob')?.addEventListener('click', () => this._handleSearch());

        // Wire notifications
        header.querySelector('#brdcNotifBtnMob')?.addEventListener('click', (e) => {
            e.stopPropagation();
            this._toggleNotifications();
        });

        // Wire avatar
        header.querySelector('#brdcAvatarBtnMob')?.addEventListener('click', (e) => {
            e.stopPropagation();
            this._toggleAvatarMenu(header.querySelector('#brdcAvatarBtnMob'));
        });
    }

    /* ══════════════════════════════════════════
       MOBILE BOTTOM TAB BAR
    ══════════════════════════════════════════ */
    _buildMobileTabBar() {
        const nav = document.createElement('nav');
        nav.id = 'brdcMobileNav';
        nav.className = 'brdc-mob-nav';
        nav.setAttribute('aria-label', 'Main navigation');
        nav.innerHTML = `
            ${this._mobileTab('home',      'Home')}
            ${this._mobileTab('league',    'League')}
            ${this._mobilePlayBtn()}
            ${this._mobileTab('events',    'Events')}
            ${this._mobileTab('clubhouse', 'Clubhouse')}
        `;

        document.body.appendChild(nav);

        // Wire Play button
        nav.querySelector('#brdcMobPlayBtn')?.addEventListener('click', () => this._handlePlay());
    }

    _mobileTab(key, label) {
        const active = this.activeTab === key;
        return `<a href="${VNEXT_ROUTES[key]}"
                   class="brdc-mob-tab${active ? ' active' : ''}"
                   data-tab="${key}"
                   ${active ? 'aria-current="page"' : ''}>
                    <span class="brdc-mob-tab-icon">${NAV_ICONS[key]}</span>
                    <span class="brdc-mob-tab-label">${label}</span>
                </a>`;
    }

    _mobilePlayBtn() {
        const active = this.activeTab === 'play';
        return `<button class="brdc-mob-tab brdc-mob-play${active ? ' active' : ''}"
                        data-tab="play"
                        id="brdcMobPlayBtn"
                        aria-label="Play">
                    <span class="brdc-mob-play-ring">
                        <span class="brdc-mob-tab-icon">${NAV_ICONS.play}</span>
                    </span>
                    <span class="brdc-mob-tab-label">Play</span>
                </button>`;
    }

    /* ══════════════════════════════════════════
       AVATAR DROPDOWN MENU  (Phase 2)
    ══════════════════════════════════════════ */
    _buildAvatarMenu() {
        if (document.getElementById('brdcAvatarMenu')) return;

        // Build profile href — include player id if available
        const playerId = this.player?.player_id || this.player?.id || this.player?.uid || '';
        const profileHref = playerId
            ? `${VNEXT_ROUTES.profile}?id=${playerId}`
            : VNEXT_ROUTES.profile;

        const menu = document.createElement('div');
        menu.id = 'brdcAvatarMenu';
        menu.className = 'brdc-avatar-menu';
        menu.setAttribute('role', 'menu');
        menu.setAttribute('aria-hidden', 'true');
        menu.innerHTML = `
            <a href="${profileHref}" class="brdc-avatar-menu-item" role="menuitem">
                ${NAV_ICONS.profile}
                <span>Profile</span>
            </a>
            <a href="#" class="brdc-avatar-menu-item" role="menuitem" id="brdcSettingsMenuItem">
                ${NAV_ICONS.settings}
                <span>Settings</span>
            </a>
            <div class="brdc-avatar-menu-divider" id="brdcAvatarDivider1"></div>
            <!-- Phase 2: Manage section injected here by _injectManageSection() after role resolution -->
            <button class="brdc-avatar-menu-item brdc-avatar-menu-logout" role="menuitem" id="brdcLogoutMenuItem">
                ${NAV_ICONS.logout}
                <span>Log out</span>
            </button>
        `;

        document.body.appendChild(menu);

        // Wire logout
        menu.querySelector('#brdcLogoutMenuItem')?.addEventListener('click', () => {
            this._closeAvatarMenu();
            this._handleLogout();
        });

        // Wire settings — stub (no settings page exists yet)
        menu.querySelector('#brdcSettingsMenuItem')?.addEventListener('click', (e) => {
            e.preventDefault();
            this._closeAvatarMenu();
            // TODO (future phase): wire to /pages/settings-vnext.html when built
            console.log('[Nav] Settings — page not yet built');
        });

        // Close on outside click
        document.addEventListener('click', (e) => {
            if (this._avatarOpen && !menu.contains(e.target)) {
                this._closeAvatarMenu();
            }
        });

        // Close on Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this._avatarOpen) {
                this._closeAvatarMenu();
            }
        });
    }

    /**
     * Phase 2: Async role resolution.
     * Calls getPlayerSession (same call the rest of the app uses) after auth settles,
     * then injects the Manage section if the user has an operator role.
     * Fails closed — Manage section does NOT appear until roles are confirmed.
     */
    async _resolveRoles() {
        try {
            const session = this._getSession();
            if (!session) return; // not logged in — nothing to show

            // The session stored at login already carries role flags. Read them directly —
            // synchronous, no dependency on Firebase auth being restored at init time
            // (that race is what previously stopped Manage from ever appearing).
            let roles = {
                is_director:     !!session.is_director,
                is_admin:        !!session.is_admin,
                is_master_admin: !!session.is_master_admin,
            };

            // Fallback ONLY if the local session somehow lacks role flags: do the server lookup.
            if (!(roles.is_director || roles.is_admin || roles.is_master_admin)) {
                const { callFunction, auth, onAuthStateChanged } = await import('/js/firebase-config.js');
                if (!auth.currentUser) {
                    await new Promise(resolve => {
                        const unsub = onAuthStateChanged(auth, u => { unsub(); resolve(u); });
                        setTimeout(() => { unsub(); resolve(null); }, 6000);
                    });
                }
                if (auth.currentUser) {
                    const result = await callFunction('getPlayerSession', {});
                    if (result?.success && result.player) {
                        roles = {
                            is_director:     !!result.player.is_director,
                            is_admin:        !!result.player.is_admin,
                            is_master_admin: !!result.player.is_master_admin,
                        };
                    }
                }
            }

            // Only inject if user has at least one operator role
            if (roles.is_director || roles.is_admin || roles.is_master_admin) {
                this._injectManageSection(roles);
            }
        } catch (_) {
            // Fail closed — no Manage section on error
        }
    }

    /**
     * Phase 2: Inject the Manage section into the avatar menu.
     * Called internally by _resolveRoles() after roles are confirmed.
     * Also exposed as showManageMenuItem(roles) for external callers.
     *
     * Role gates:
     *   Manage group visible:  is_director || is_admin || is_master_admin
     *   "Site admin" link:     is_admin || is_master_admin only
     *
     * @param {{ is_director:boolean, is_admin:boolean, is_master_admin:boolean }} roles
     */
    _injectManageSection(roles) {
        const menu = document.getElementById('brdcAvatarMenu');
        if (!menu) return;
        if (document.getElementById('brdcManageSection')) return; // idempotent

        const showSiteAdmin = roles.is_admin || roles.is_master_admin;

        // Build Manage section element
        const section = document.createElement('div');
        section.id = 'brdcManageSection';

        section.innerHTML = `
            <div class="brdc-avatar-menu-divider"></div>
            <div class="brdc-avatar-menu-group-label">MANAGE</div>
            <a href="/pages/director-home-vnext.html" class="brdc-avatar-menu-item brdc-avatar-menu-manage" role="menuitem">
                ${NAV_ICONS.manage}
                <span>Director home</span>
            </a>
            <a href="/pages/create-league-vnext.html" class="brdc-avatar-menu-item brdc-avatar-menu-manage" role="menuitem">
                ${NAV_ICONS.league}
                <span>Create league</span>
            </a>
            <a href="/pages/create-tournament-vnext.html" class="brdc-avatar-menu-item brdc-avatar-menu-manage" role="menuitem">
                ${NAV_ICONS.events}
                <span>Create event</span>
            </a>
            <a href="/pages/contact-center-vnext.html" class="brdc-avatar-menu-item brdc-avatar-menu-manage" role="menuitem">
                ${NAV_ICONS.clubhouse}
                <span>Contact center</span>
            </a>
            <a href="/pages/league-import-vnext.html" class="brdc-avatar-menu-item brdc-avatar-menu-manage" role="menuitem">
                ${NAV_ICONS.settings}
                <span>Import results</span>
            </a>
            <a href="/pages/stream-director.html" class="brdc-avatar-menu-item brdc-avatar-menu-manage" role="menuitem">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>
                <span>Go live (stream)</span>
            </a>
            ${showSiteAdmin ? `
            <a href="/pages/admin-vnext.html" class="brdc-avatar-menu-item brdc-avatar-menu-manage brdc-avatar-menu-site-admin" role="menuitem">
                ${NAV_ICONS.manage}
                <span>Site admin</span>
            </a>` : ''}
        `;

        // Insert before the logout button (after the first divider)
        const logoutBtn = menu.querySelector('#brdcLogoutMenuItem');
        if (logoutBtn) {
            menu.insertBefore(section, logoutBtn);
        } else {
            menu.appendChild(section);
        }
    }

    /**
     * Public API: showManageMenuItem(roles)
     * Legacy hook — delegates to _injectManageSection.
     * External callers (page scripts) can still call this after auth.
     * @param {Object} roles
     */
    showManageMenuItem(roles) {
        if (!roles) return;
        const normalized = {
            is_director:    !!(roles.is_director || (roles.directing?.length > 0)),
            is_admin:       !!roles.is_admin,
            is_master_admin: !!roles.is_master_admin,
        };
        if (normalized.is_director || normalized.is_admin || normalized.is_master_admin) {
            this._injectManageSection(normalized);
        }
    }

    _toggleAvatarMenu(anchorEl) {
        if (this._avatarOpen) {
            this._closeAvatarMenu();
        } else {
            this._openAvatarMenu(anchorEl);
        }
    }

    _openAvatarMenu(anchorEl) {
        const menu = document.getElementById('brdcAvatarMenu');
        if (!menu) return;

        // Position the menu below the anchor
        const rect = anchorEl.getBoundingClientRect();
        menu.style.top  = `${rect.bottom + 8}px`;
        menu.style.right = `${window.innerWidth - rect.right}px`;
        menu.style.left  = 'auto';

        menu.classList.add('open');
        menu.setAttribute('aria-hidden', 'false');
        anchorEl.setAttribute('aria-expanded', 'true');
        this._avatarOpen = true;
        this._activeAnchor = anchorEl;
    }

    _closeAvatarMenu() {
        const menu = document.getElementById('brdcAvatarMenu');
        if (!menu) return;
        menu.classList.remove('open');
        menu.setAttribute('aria-hidden', 'true');
        this._activeAnchor?.setAttribute('aria-expanded', 'false');
        this._avatarOpen = false;
        this._activeAnchor = null;
    }

    /* ══════════════════════════════════════════
       NOTIFICATIONS PANEL
    ══════════════════════════════════════════ */
    _buildNotifPanel() {
        if (document.getElementById('brdcNotifPanel')) return;

        const panel = document.createElement('div');
        panel.id = 'brdcNotifPanel';
        panel.className = 'brdc-notif-panel';
        panel.setAttribute('role', 'dialog');
        panel.setAttribute('aria-label', 'Notifications');
        panel.setAttribute('aria-hidden', 'true');
        panel.innerHTML = `
            <div class="brdc-notif-header">
                <span class="brdc-notif-title">Notifications</span>
                <button class="brdc-notif-mark-read" id="brdcMarkAllRead">Mark all read</button>
            </div>
            <div class="brdc-notif-list" id="brdcNotifList">
                <div class="brdc-notif-empty">Loading...</div>
            </div>
        `;

        document.body.appendChild(panel);
        this._notifPanel = panel;

        panel.querySelector('#brdcMarkAllRead')?.addEventListener('click', () => this._markAllRead());

        document.addEventListener('click', (e) => {
            if (panel.classList.contains('open') && !panel.contains(e.target)) {
                const notifBtn = e.target.closest('.brdc-notif-btn');
                if (!notifBtn) this._closeNotifications();
            }
        });
    }

    _toggleNotifications() {
        if (this._notifPanel?.classList.contains('open')) {
            this._closeNotifications();
        } else {
            this._openNotifications();
        }
    }

    _openNotifications() {
        if (!this._notifPanel) return;
        this._notifPanel.classList.add('open');
        this._notifPanel.setAttribute('aria-hidden', 'false');
        this._loadNotifications();
    }

    _closeNotifications() {
        if (!this._notifPanel) return;
        this._notifPanel.classList.remove('open');
        this._notifPanel.setAttribute('aria-hidden', 'true');
    }

    async _loadNotifications() {
        const listEl = document.getElementById('brdcNotifList');
        if (!listEl) return;

        try {
            const session = this._getSession();
            if (!session) {
                listEl.innerHTML = '<div class="brdc-notif-empty">Log in to see notifications</div>';
                return;
            }

            const { callFunction } = await import('/js/firebase-config.js');
            const result = await callFunction('getNotifications', { limit: 10 });

            if (result.success && result.notifications?.length > 0) {
                this._renderNotifications(result.notifications);
            } else {
                listEl.innerHTML = '<div class="brdc-notif-empty">No notifications yet</div>';
            }
        } catch (_) {
            listEl.innerHTML = '<div class="brdc-notif-empty">No notifications yet</div>';
        }
    }

    _renderNotifications(notifs) {
        const listEl = document.getElementById('brdcNotifList');
        if (!listEl) return;
        const typeIcon = { match:'🎯', message:'💬', team:'👥', event:'📅', achievement:'🏆', system:'🔔' };
        listEl.innerHTML = notifs.map(n => {
            const icon = typeIcon[n.type] || '🔔';
            const time = this._formatTimeAgo(n.created_at);
            return `<div class="brdc-notif-item${n.read ? '' : ' unread'}" data-id="${n.id}">
                <div class="brdc-notif-item-icon">${icon}</div>
                <div class="brdc-notif-item-body">
                    <div class="brdc-notif-item-text">${n.message}</div>
                    <div class="brdc-notif-item-time">${time}</div>
                </div>
                ${n.read ? '' : '<div class="brdc-notif-dot"></div>'}
            </div>`;
        }).join('');
    }

    async _markAllRead() {
        try {
            const session = this._getSession();
            if (!session) return;
            const { callFunction } = await import('/js/firebase-config.js');
            await callFunction('markAllNotificationsRead', {});
            const listEl = document.getElementById('brdcNotifList');
            if (listEl) {
                listEl.querySelectorAll('.brdc-notif-item').forEach(el => {
                    el.classList.remove('unread');
                    el.querySelector('.brdc-notif-dot')?.remove();
                });
            }
            this._setBadge(0);
        } catch (_) {}
    }

    /* ══════════════════════════════════════════
       PLAY HANDLER
    ══════════════════════════════════════════ */
    /**
     * Phase 6: Play → Arena.
     * VNEXT_ROUTES.play now points to /pages/arena-vnext.html.
     * An onPlayAction override hook is preserved for pages that need custom behaviour.
     */
    _handlePlay() {
        // Phase 6 hook — if a custom handler is registered, use it; else navigate to Arena
        if (typeof this.onPlayAction === 'function') {
            this.onPlayAction();
            return;
        }
        window.location.href = VNEXT_ROUTES.play;
    }

    /* ══════════════════════════════════════════
       DESKTOP PLAY BTN WIRE  (inserted after DOM build)
    ══════════════════════════════════════════ */
    _wireDesktopPlayBtn() {
        document.getElementById('brdcDesktopPlayBtn')?.addEventListener('click', () => this._handlePlay());
    }

    /* ══════════════════════════════════════════
       BACK NAVIGATION
    ══════════════════════════════════════════ */
    _handleBack() {
        if (this.backUrl) { window.location.href = this.backUrl; return; }
        if (window.history.length > 1) { window.history.back(); return; }
        window.location.href = VNEXT_ROUTES.home;
    }

    /* ══════════════════════════════════════════
       SEARCH
    ══════════════════════════════════════════ */
    _handleSearch() {
        if (window.brdcSearch?.openSearch) {
            window.brdcSearch.openSearch();
        }
    }

    /* ══════════════════════════════════════════
       LOGOUT
    ══════════════════════════════════════════ */
    async _handleLogout() {
        try {
            const { auth, signOut } = await import('/js/firebase-config.js');
            if (auth && signOut) await signOut(auth);
        } catch (_) {}
        localStorage.removeItem('brdc_session');
        sessionStorage.removeItem('currentPlayer');
        window.location.href = '/pages/dashboard.html';
    }

    /* ══════════════════════════════════════════
       BADGE COUNTS
    ══════════════════════════════════════════ */
    async _loadBadgeCounts() {
        const session = this._getSession();
        if (!session) return;

        try {
            const { callFunction, auth, onAuthStateChanged } = await import('/js/firebase-config.js');

            if (!auth.currentUser) {
                await new Promise(resolve => {
                    const unsub = onAuthStateChanged(auth, u => { unsub(); resolve(u); });
                    setTimeout(() => { unsub(); resolve(null); }, 5000);
                });
            }
            if (!auth.currentUser) return;

            const result = await callFunction('getUnreadNotificationCount', {});
            if (result.success && result.count > 0) {
                this._setBadge(result.count);
            }
        } catch (_) {}
    }

    _setBadge(count) {
        ['brdcNotifBadgeDesktop', 'brdcNotifBadgeMob'].forEach(id => {
            const el = document.getElementById(id);
            if (!el) return;
            if (count > 0) {
                el.textContent = count > 99 ? '99+' : count;
                el.removeAttribute('hidden');
            } else {
                el.setAttribute('hidden', '');
            }
        });
    }

    /* ══════════════════════════════════════════
       PUBLIC: update page title (callable from page JS)
    ══════════════════════════════════════════ */
    setPageTitle(title) {
        this.pageTitle = title;
        const el = document.getElementById('brdcMobTitle');
        if (el) el.textContent = title;
    }

    /* ══════════════════════════════════════════
       PUBLIC: set active tab (callable from page JS)
       Accepts both new tab keys and legacy page keys.
    ══════════════════════════════════════════ */
    setActivePage(tab) {
        const resolved = this._normalizePage(tab);
        if (!resolved) return; // contextual page, no primary tab to highlight
        this.activeTab = resolved;
        // Update desktop
        document.querySelectorAll('#brdcTopBar .brdc-tb-tab').forEach(el => {
            const isActive = el.dataset.tab === tab;
            el.classList.toggle('active', isActive);
            isActive ? el.setAttribute('aria-current','page') : el.removeAttribute('aria-current');
        });
        // Update mobile
        document.querySelectorAll('#brdcMobileNav .brdc-mob-tab').forEach(el => {
            const isActive = el.dataset.tab === tab;
            el.classList.toggle('active', isActive);
            isActive ? el.setAttribute('aria-current','page') : el.removeAttribute('aria-current');
        });
    }

    /* ══════════════════════════════════════════
       RESIZE HANDLER
    ══════════════════════════════════════════ */
    _bindResize() {
        window.addEventListener('resize', () => {
            clearTimeout(this._resizeTimer);
            this._resizeTimer = setTimeout(() => {
                const wasDesktop = document.body.classList.contains('is-desktop');
                const isNowDesktop = this._isDesktop();
                if (wasDesktop !== isNowDesktop) this._build();
            }, 120);
        });
    }

    /* ══════════════════════════════════════════
       HELPERS
    ══════════════════════════════════════════ */
    _getSession() {
        try {
            const raw = localStorage.getItem('brdc_session');
            if (!raw) return null;
            const s = JSON.parse(raw);
            return (s.player_id || s.id || s.uid) ? s : null;
        } catch (_) { return null; }
    }

    _formatTimeAgo(ts) {
        if (!ts) return '';
        let date;
        if (ts?.toDate) date = ts.toDate();
        else if (ts?.seconds) date = new Date(ts.seconds * 1000);
        else date = new Date(ts);
        if (isNaN(date.getTime())) return '';
        const diff = Math.floor((Date.now() - date) / 1000);
        if (diff < 60)    return 'Just now';
        if (diff < 3600)  return `${Math.floor(diff/60)}m ago`;
        if (diff < 86400) return `${Math.floor(diff/3600)}h ago`;
        return date.toLocaleDateString();
    }
}

/* ─────────────────────────────────────────────
   EXPORTS + GLOBAL
   ───────────────────────────────────────────── */
window.BRDCNavigation = BRDCNavigation;
window.VNEXT_TAB_MAP  = VNEXT_TAB_MAP;
window.VNEXT_ROUTES   = VNEXT_ROUTES;

// Export tab-map and routes for external use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { BRDCNavigation, VNEXT_TAB_MAP, VNEXT_ROUTES };
}

console.log('✅ BRDC Navigation v4.4 loaded (Phase 6: Play → arena-vnext)');
