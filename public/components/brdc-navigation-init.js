/**
 * BRDC Navigation Integration Script v4.2
 * Single include to add navigation to any page.
 *
 * Usage (unchanged — all vNext pages already call this):
 *   initBRDCNavigation({ pageTitle: 'League', page: 'league', backUrl: '' });
 *
 * vNext pages  → new 5-tab responsive nav (brdc-navigation.js v4.0)
 * OG pages     → legacy fb-nav sidebar unchanged
 */

// Load required CSS if not already loaded
function loadCSS(href) {
    if (!document.querySelector(`link[href="${href}"]`)) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = href;
        document.head.appendChild(link);
    }
}

// Load required scripts if not already loaded
function loadScript(src, callback) {
    if (document.querySelector(`script[src="${src}"]`)) {
        if (callback) callback();
        return;
    }
    const script = document.createElement('script');
    script.src = src;
    if (callback) script.onload = callback;
    document.head.appendChild(script);
}

/**
 * Detect vNext: any path with "-vnext" in it.
 * This is the SINGLE gate for all fb-sidebar suppression logic.
 */
function isVNextPage() {
    return /-vnext/.test(window.location.pathname);
}

/**
 * Initialize BRDC Navigation on current page.
 * Entry point called by every vNext page.
 */
window.initBRDCNavigation = function (options = {}) {
    const config = {
        page:            options.page       || '',
        pageTitle:       options.pageTitle  || document.title || 'BRDC',
        backUrl:         options.backUrl    || '',
        showSearch:      options.showSearch === true,
        // legacy compat keys (unused by v4.0 but preserved so callers don't break)
        showMobileNav:   options.showMobileNav !== false,
        showBreadcrumbs: false,
        showBackButton:  options.showBackButton !== false,
        breadcrumbs:     options.breadcrumbs || [],
    };

    // ── CSS ──────────────────────────────────────────
    loadCSS('/css/fb-mobile.css');
    loadCSS('/css/brdc-navigation.css?v=18');
    if (config.showSearch) loadCSS('/css/brdc-search.css');

    // ── Accessibility helpers ─────────────────────────
    loadScript('/js/a11y-helpers.js');

    // ── FB-NAV SIDEBAR GATE ───────────────────────────
    // On vNext pages the new top bar / bottom tab bar IS the nav.
    // The fb-sidebar (SidebarMenu from fb-nav.js) must NOT render on vNext.
    // We skip loading fb-nav.js entirely for vNext pages.
    // OG pages continue loading it exactly as before.
    if (!isVNextPage()) {
        loadScript('/js/fb-nav.js?v=13', function () {
            // OG pages: init sidebar only (not full FBNav.init which adds a duplicate footer).
            if (window.FBNav && !window.FBNav.sidebar && window.FBNav.SidebarMenu) {
                try {
                    const session = JSON.parse(localStorage.getItem('brdc_session') || '{}');
                    const player  = session.player || (session.player_id ? session : null);
                    const sidebar = new window.FBNav.SidebarMenu();
                    sidebar.init();
                    sidebar.setPlayer(player);
                    sidebar.generateContent();
                    window.FBNav.sidebar = sidebar;
                } catch (e) {
                    // Sidebar init failed — hamburger fallback will retry on click
                }
            }
        });
    }
    // No fb-nav.js load on vNext. CSS also hides .fb-sidebar on has-brdc-nav pages
    // as a belt-and-suspenders guard (see brdc-navigation.css).

    // ── Chat drawer (OG pages only — vNext chat is in the Clubhouse tab) ──
    if (!isVNextPage()) {
        loadScript('/js/chat-drawer.js?v=8');
    }

    // ── Search component ─────────────────────────────
    if (config.showSearch) {
        loadScript('/components/brdc-search.js');
    }

    // ── NAV COMPONENT v4.0 ───────────────────────────
    loadScript('/components/brdc-navigation.js?v=22', function () {
        // If already initialized, update config only
        if (window.brdcNavInitialized && window.brdcNav) {
            if (config.pageTitle) window.brdcNav.setPageTitle(config.pageTitle);
            if (config.page)      window.brdcNav.setActivePage(config.page);
            return;
        }

        const nav = new BRDCNavigation({
            pageTitle:  config.pageTitle,
            backUrl:    config.backUrl,
            showSearch: config.showSearch,
        });

        // Override active tab if caller specified page explicitly
        // Use the normalizer so legacy page keys (e.g. 'chat', 'trader') resolve correctly
        if (config.page) {
            const resolved = nav._normalizePage(config.page);
            if (resolved) nav.activeTab = resolved;
        }

        nav.init();
        window.brdcNav            = nav;
        window.brdcNavInitialized = true;

        // Skip-to-content link (accessibility)
        if (!document.getElementById('brdcSkipNav')) {
            const skip  = document.createElement('a');
            skip.id     = 'brdcSkipNav';
            skip.href   = '#mainContent';
            skip.textContent = 'Skip to main content';
            document.body.insertBefore(skip, document.body.firstChild);
        }
    });
};


/**
 * Quick navigation helpers (unchanged API — kept for any pages that call BRDCNav.*)
 */
window.BRDCNav = {
    goHome() {
        window.location.href = isVNextPage()
            ? '/pages/home-vnext.html'
            : '/pages/dashboard.html';
    },
    goToLeague(leagueId) {
        window.location.href = `/pages/triples-vnext.html${leagueId ? '?league_id=' + leagueId : ''}`;
    },
    goToProfile(playerId) {
        const base = isVNextPage() ? '/pages/player-profile-vnext.html' : '/pages/player-profile.html';
        window.location.href = playerId ? `${base}?id=${playerId}` : base;
    },
    goBack() {
        if (window.history.length > 1) { window.history.back(); return; }
        this.goHome();
    },
    openSearch() {
        window.brdcSearch?.openSearch?.();
    }
};

console.log('✅ BRDC Navigation init v4.2 loaded. Call initBRDCNavigation() to initialize.');
