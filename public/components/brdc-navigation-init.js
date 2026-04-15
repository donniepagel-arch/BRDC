/**
 * BRDC Navigation Integration Script
 * Single include to add navigation to any page
 *
 * Usage in HTML:
 * <script src="/components/brdc-navigation-init.js"></script>
 * <script>
 *   initBRDCNavigation({
 *     page: 'dashboard',
 *     breadcrumbs: [
 *       { label: 'Home', url: '/pages/dashboard.html' },
 *       { label: 'Leagues', url: '/pages/leagues.html' },
 *       { label: 'Winter Triple Draft', url: '#' }
 *     ]
 *   });
 * </script>
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
    script.onload = callback;
    document.head.appendChild(script);
}

/**
 * Initialize BRDC Navigation on current page
 */
window.initBRDCNavigation = function (options = {}) {
    // Default options
    const config = {
        page: options.page || '',
        pageTitle: options.pageTitle || '',
        backUrl: options.backUrl || '',
        showMobileNav: options.showMobileNav !== false,
        showBreadcrumbs: options.showBreadcrumbs !== false && (options.breadcrumbs || []).length > 0,
        showBackButton: options.showBackButton !== false,
        showSearch: options.showSearch === true,
        breadcrumbs: options.breadcrumbs || []
    };

    // Load required CSS
    loadCSS('/css/fb-mobile.css');
    loadCSS('/css/brdc-navigation.css?v=11');
    if (config.showSearch) loadCSS('/css/brdc-search.css');

    // Load accessibility utilities
    loadScript('/js/a11y-helpers.js');

    // Load sidebar navigation (hamburger menu drawer) on all pages
    loadScript('/js/fb-nav.js?v=13', function () {
        // Initialize ONLY the sidebar if not already done.
        // Don't call FBNav.init() which creates a duplicate footer nav.
        // Dashboard does its own full init via dashboard-auth.js.
        if (window.FBNav && !window.FBNav.sidebar && window.FBNav.SidebarMenu) {
            try {
                const session = JSON.parse(localStorage.getItem('brdc_session') || '{}');
                const player = session.player_id ? session : null;
                const sidebar = new window.FBNav.SidebarMenu();
                sidebar.init();
                sidebar.setPlayer(player);
                sidebar.generateContent();
                window.FBNav.sidebar = sidebar;
            } catch (e) {
                // Sidebar init failed - hamburger fallback will retry on click
            }
        }
    });

    // Add body class for mobile nav padding
    if (config.showMobileNav) {
        document.body.classList.add('has-mobile-nav');
    }

    // Add page-specific body class
    if (config.page) {
        document.body.classList.add(`page-${config.page}`);
    }

    // Load navigation component - v2.0 auto-inits, so we just configure it
    loadScript('/components/brdc-navigation.js?v=12', function () {
        // If already auto-initialized, just update config
        if (window.brdcNavInitialized && window.brdcNav) {
            window.brdcNav.currentPage = config.page || window.brdcNav.detectCurrentPage();
            if (config.pageTitle) window.brdcNav.setPageTitle(config.pageTitle);
            window.brdcNav.setActivePage(window.brdcNav.currentPage);
            // Update breadcrumbs if provided
            if (config.breadcrumbs && config.breadcrumbs.length > 0) {
                window.brdcNav.breadcrumbPath = config.breadcrumbs;
                window.brdcNav.renderBreadcrumbs();
            }
            return;
        }

        // Otherwise init manually (for pages that don't auto-trigger)
        const nav = new BRDCNavigation({
            page: config.page,
            pageTitle: config.pageTitle,
            backUrl: config.backUrl,
            showMobileNav: config.showMobileNav,
            showBreadcrumbs: config.showBreadcrumbs,
            showBackButton: config.showBackButton,
            breadcrumbPath: config.breadcrumbs
        });

        nav.init();
        window.brdcNav = nav;
        window.brdcNavInitialized = true;
    });

    // Load search component if enabled
    if (config.showSearch) {
        loadScript('/components/brdc-search.js');
    }

    // Load chat drawer for site-wide swipe-to-chat
    loadScript('/js/chat-drawer.js?v=4');
};


/**
 * Quick navigation helpers
 */
window.BRDCNav = {
    // Navigate to dashboard
    goHome: function () {
        window.location.href = '/pages/dashboard.html';
    },

    // Navigate to league
    goToLeague: function (leagueId) {
        window.location.href = `/pages/league-view.html?id=${leagueId}`;
    },

    // Navigate to profile
    goToProfile: function (playerId) {
        if (playerId) {
            window.location.href = `/pages/player-profile.html?id=${playerId}`;
        } else {
            window.location.href = '/pages/player-profile.html';
        }
    },

    // Navigate back
    goBack: function () {
        if (window.history.length > 1) {
            window.history.back();
        } else {
            this.goHome();
        }
    },

    // Open search
    openSearch: function () {
        if (window.brdcSearch) {
            window.brdcSearch.openSearch();
        }
    }
};

console.log('✅ BRDC Navigation system loaded. Use initBRDCNavigation() to initialize.');
