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
    loadCSS('/css/brdc-navigation.css');
    if (config.showSearch) loadCSS('/css/brdc-search.css');

    // Load accessibility utilities
    loadScript('/js/a11y-helpers.js');

    // Add body class for mobile nav padding
    if (config.showMobileNav) {
        document.body.classList.add('has-mobile-nav');
    }

    // Add page-specific body class
    if (config.page) {
        document.body.classList.add(`page-${config.page}`);
    }

    // Load navigation component - v2.0 auto-inits, so we just configure it
    loadScript('/components/brdc-navigation.js?v=2', function () {
        // If already auto-initialized, just update config
        if (window.brdcNavInitialized && window.brdcNav) {
            window.brdcNav.currentPage = config.page || window.brdcNav.detectCurrentPage();
            if (config.pageTitle) window.brdcNav.setPageTitle(config.pageTitle);
            window.brdcNav.setActivePage(window.brdcNav.currentPage);
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
    loadScript('/js/chat-drawer.js?v=2');
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
