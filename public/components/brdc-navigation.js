/**
 * BRDC Navigation Component v3.0
 * Unified mobile-first navigation system
 * Mobile/Tablet: unified top header + bottom nav | Desktop: header bar
 */

class BRDCNavigation {
    constructor(options = {}) {
        this.currentPage = options.page || this.detectCurrentPage();
        this.showMobileNav = options.showMobileNav !== false;
        this.showBackButton = options.showBackButton !== false;
        this.pageTitle = options.pageTitle || '';
        this.backUrl = options.backUrl || '';
        this.breadcrumbPath = options.breadcrumbPath || [];
        this.player = null;
        this.isMobile = window.innerWidth < 768;
        this.isTablet = window.innerWidth >= 768 && window.innerWidth < 1024;
        this.isDesktop = window.innerWidth >= 1024;
        this._hiddenHeader = null; // track original header hidden by mobile header
    }

    /**
     * Detect current page from URL
     */
    detectCurrentPage() {
        const path = window.location.pathname;
        if (path.includes('dashboard')) return 'home';
        if (path.includes('message') || path.includes('conversation') || path.includes('chat-room')) return 'chat';
        if (path.includes('league')) return 'leagues';
        if (path.includes('match') || path.includes('scorer') || path.includes('x01') || path.includes('cricket')) return 'play';
        if (path.includes('profile') || path.includes('friends')) return 'profile';
        if (path.includes('event') || path.includes('tournament')) return 'events';
        return 'home';
    }

    /**
     * Initialize navigation for current page
     */
    async init() {
        await this.loadPlayerData();

        // Add responsive body classes
        document.body.classList.add('has-brdc-nav');
        if (this.isMobile) document.body.classList.add('is-mobile');
        if (this.isTablet) document.body.classList.add('is-tablet');
        if (this.isDesktop) document.body.classList.add('is-desktop');

        // Render appropriate navigation
        if (this.isDesktop) {
            this.renderDesktopNav();
        } else {
            this.renderMobileHeader();
            this.renderMobileNav();
        }

        this.renderRoleBadges();

        // Initialize Notifications
        this.notifications = new NotificationsPanel();
        this.notifications.init();

        // Load badges
        this.loadBadgeCounts();

        // Handle resize
        window.addEventListener('resize', this.handleResize.bind(this));
    }

    /**
     * Toggle notifications panel
     */
    toggleNotifications() {
        if (this.notifications) {
            this.notifications.toggle();
        }
    }

    /**
     * Load badge counts (notifications, chats, etc)
     */
    async loadBadgeCounts() {
        try {
            // Only attempt if user has an active session
            const session = localStorage.getItem('brdc_session');
            if (!session) return;

            // Dynamically import firebase config only when needed
            let callFunction, auth, onAuthStateChanged;
            try {
                const module = await import('/js/firebase-config.js');
                callFunction = module.callFunction;
                auth = module.auth;
                onAuthStateChanged = module.onAuthStateChanged;
            } catch (e) {
                console.warn('Firebase config not found, badge counts skipped');
                return;
            }

            // Wait for Firebase Auth to resolve (up to 5 seconds)
            if (!auth.currentUser) {
                await new Promise(resolve => {
                    const unsubscribe = onAuthStateChanged(auth, user => {
                        unsubscribe();
                        resolve(user);
                    });
                    setTimeout(() => { unsubscribe(); resolve(null); }, 5000);
                });
            }

            if (!auth.currentUser) return; // Not authenticated

            // Load notification count
            try {
                const notifResult = await callFunction('getUnreadNotificationCount', {});
                if (notifResult.success && notifResult.count > 0) {
                    this.updateBadge('notifications', notifResult.count);
                }
            } catch (e) {
                // Notification count unavailable
            }

            // Load chat unread count (future use)
            // ...
        } catch (error) {
            console.error('Error loading badge counts:', error);
        }
    }

    updateBadge(action, count) {
        const badge = document.querySelector(`.mobile-nav-item[data-action="${action}"] .fb-footer-tab-badge`);
        if (badge) {
            badge.setAttribute('data-count', count);
        }
        // Update aria-label on the notification button
        const btn = document.querySelector(`[data-action="${action}"]`);
        if (btn) {
            btn.setAttribute('aria-label', `Notifications, ${count} unread`);
        }
    }

    /**
     * Check if current page is home/dashboard
     */
    isHomePage() {
        const path = window.location.pathname;
        return path === '/' || path.includes('dashboard') || path.includes('index');
    }

    /**
     * Handle window resize
     */
    handleResize() {
        const wasDesktop = this.isDesktop;

        this.isMobile = window.innerWidth < 768;
        this.isTablet = window.innerWidth >= 768 && window.innerWidth < 1024;
        this.isDesktop = window.innerWidth >= 1024;

        // Only act if crossing the desktop threshold
        if (wasDesktop !== this.isDesktop) {
            document.body.classList.toggle('is-mobile', this.isMobile);
            document.body.classList.toggle('is-tablet', this.isTablet);
            document.body.classList.toggle('is-desktop', this.isDesktop);

            if (this.isDesktop) {
                // Switched TO desktop: remove mobile header, restore static header, show desktop nav
                const mobileHeader = document.getElementById('brdcMobileHeader');
                if (mobileHeader) mobileHeader.remove();
                const mobileNav = document.getElementById('brdcMobileNav');
                if (mobileNav) mobileNav.remove();
                if (this._hiddenHeader) {
                    this._hiddenHeader.removeAttribute('data-hidden-by-nav');
                    this._hiddenHeader.style.display = '';
                }
                this.renderDesktopNav();
            } else {
                // Switched FROM desktop: remove desktop nav, create mobile header + bottom nav
                const desktopNav = document.getElementById('brdcDesktopNav');
                if (desktopNav) desktopNav.remove();
                document.body.classList.remove('has-desktop-nav');
                this.renderMobileHeader();
                this.renderMobileNav();
            }
        } else {
            // Update sub-breakpoint classes even within mobile/tablet
            document.body.classList.toggle('is-mobile', this.isMobile);
            document.body.classList.toggle('is-tablet', this.isTablet);
        }
    }

    /**
     * Load current player data
     */
    async loadPlayerData() {
        const playerData = sessionStorage.getItem('currentPlayer');
        if (playerData) {
            try {
                this.player = JSON.parse(playerData);
            } catch (e) {
                console.warn('Could not parse player data');
            }
        }
    }

    /**
     * Render mobile bottom navigation (always visible on mobile/tablet)
     */
    renderMobileNav() {
        if (!this.showMobileNav) return;
        if (document.getElementById('brdcMobileNav')) return;

        const nav = document.createElement('nav');
        nav.id = 'brdcMobileNav';
        nav.className = 'brdc-mobile-nav';
        nav.setAttribute('aria-label', 'Main navigation');
        nav.innerHTML = `
            <a href="/pages/dashboard.html" class="mobile-nav-item ${this.currentPage === 'home' ? 'active' : ''}" data-page="home" ${this.currentPage === 'home' ? 'aria-current="page"' : ''}>
                <span class="mobile-nav-icon" aria-hidden="true">🏠</span>
                <span class="mobile-nav-label">Home</span>
            </a>
            <a href="/pages/events-hub.html" class="mobile-nav-item ${this.currentPage === 'events' ? 'active' : ''}" data-page="events" ${this.currentPage === 'events' ? 'aria-current="page"' : ''}>
                <span class="mobile-nav-icon" aria-hidden="true">📅</span>
                <span class="mobile-nav-label">Events</span>
            </a>
            <a href="/pages/messages.html" class="mobile-nav-item ${this.currentPage === 'chat' ? 'active' : ''}" data-page="chat" ${this.currentPage === 'chat' ? 'aria-current="page"' : ''}>
                <span class="mobile-nav-icon" aria-hidden="true">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                </span>
                <span class="mobile-nav-label">Chat</span>
            </a>
            <button class="mobile-nav-item" data-action="notifications" aria-label="Notifications, 0 unread">
                <span class="mobile-nav-icon fb-footer-tab-badge" data-count="0" aria-hidden="true">🔔</span>
                <span class="mobile-nav-label">Alerts</span>
            </button>
            <a href="/pages/player-profile.html" class="mobile-nav-item ${this.currentPage === 'profile' ? 'active' : ''}" data-page="profile" ${this.currentPage === 'profile' ? 'aria-current="page"' : ''}>
                <span class="mobile-nav-icon" aria-hidden="true">👤</span>
                <span class="mobile-nav-label">Profile</span>
            </a>
        `;

        document.body.appendChild(nav);
        document.body.classList.add('has-mobile-nav');

        // Inject skip-to-content link
        if (!document.getElementById('brdcSkipNav')) {
            const skip = document.createElement('a');
            skip.id = 'brdcSkipNav';
            skip.href = '#mainContent';
            skip.className = 'sr-only';
            skip.textContent = 'Skip to main content';
            skip.style.cssText = 'position:absolute;top:-40px;left:0;background:var(--pink);color:white;padding:8px 16px;z-index:100001;font-weight:700;border-radius:0 0 8px 0;';
            skip.addEventListener('focus', function() { this.style.top = '0'; });
            skip.addEventListener('blur', function() { this.style.top = '-40px'; });
            document.body.insertBefore(skip, document.body.firstChild);
        }

        // Bind notification click
        const alertBtn = nav.querySelector('[data-action="notifications"]');
        if (alertBtn) {
            alertBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.toggleNotifications();
            });
        }
    }

    /**
     * Render unified mobile/tablet top header
     * Creates fb-header layout: back/hamburger | centered logo | chat button
     * Hides any existing static header to avoid duplicates
     */
    renderMobileHeader() {
        if (this.isDesktop) return;
        if (document.getElementById('brdcMobileHeader')) return;

        // Find and hide any existing static header
        const existingHeader = document.querySelector('.header-bar')
            || document.querySelector('.header')
            || document.querySelector('.page-header')
            || document.querySelector('.fb-header');

        if (existingHeader) {
            existingHeader.style.display = 'none';
            existingHeader.setAttribute('data-hidden-by-nav', 'true');
            this._hiddenHeader = existingHeader;
        }

        // Create header element matching fb-header layout
        const header = document.createElement('header');
        header.id = 'brdcMobileHeader';
        header.className = 'fb-header';
        header.setAttribute('role', 'banner');

        // Determine if this is the dashboard (home page)
        const isDashboard = this.isHomePage();

        // Left side: back button OR hamburger menu
        let leftContent;
        if (isDashboard) {
            // Dashboard gets hamburger menu
            leftContent = `<button class="fb-header-btn" id="brdcSidebarToggle" aria-label="Open menu">
                <div class="fb-hamburger">
                    <span></span>
                    <span></span>
                    <span></span>
                </div>
            </button>`;
        } else {
            // Other pages get back button
            leftContent = `<button class="fb-header-btn brdc-back-btn" id="brdcBackBtn" aria-label="Go back">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M19 12H5M12 19l-7-7 7-7"/>
                </svg>
            </button>`;
        }

        header.innerHTML = `
            <div class="fb-header-left">
                ${leftContent}
            </div>
            <div class="fb-header-center">
                <a href="/pages/dashboard.html">
                    <img src="/images/gold_logo.png" alt="BRDC" class="fb-header-logo">
                </a>
            </div>
            <div class="fb-header-right">
                <button class="fb-header-btn fb-header-btn-badge" id="brdcChatBtn" data-count="0" aria-label="Messages">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
                    </svg>
                </button>
            </div>
        `;

        // Insert at top of body
        document.body.insertBefore(header, document.body.firstChild);

        // Wire up hamburger to open sidebar (if dashboard)
        if (isDashboard) {
            header.querySelector('#brdcSidebarToggle').addEventListener('click', () => {
                if (window.FBNav && window.FBNav.sidebar) {
                    window.FBNav.sidebar.open();
                } else if (window.FBNav && window.FBNav.SidebarMenu) {
                    // Sidebar not initialized yet - create sidebar only (no duplicate footer)
                    try {
                        const session = JSON.parse(localStorage.getItem('brdc_session') || '{}');
                        const player = session.player_id ? session : null;
                        const sidebar = new window.FBNav.SidebarMenu();
                        sidebar.init();
                        sidebar.setPlayer(player);
                        sidebar.generateContent();
                        window.FBNav.sidebar = sidebar;
                        sidebar.open();
                    } catch (e) {
                        console.warn('Could not initialize sidebar:', e);
                    }
                }
            });
        } else {
            // Wire up back button (if not dashboard)
            header.querySelector('#brdcBackBtn').addEventListener('click', () => {
                this.handleBackNavigation();
            });
        }

        // Chat button is wired by chat-drawer.js (loaded via brdc-navigation-init.js)
        // to avoid double-toggle from duplicate handlers.
    }

    /**
     * Handle back button navigation
     * Uses backUrl if provided, falls back to breadcrumbs first item URL,
     * or history.back() as last resort
     */
    handleBackNavigation() {
        // Priority 1: backUrl from config
        if (this.backUrl) {
            window.location.href = this.backUrl;
            return;
        }

        // Priority 2: First breadcrumb URL (for backward compatibility)
        if (this.breadcrumbPath && this.breadcrumbPath.length > 0) {
            const firstCrumb = this.breadcrumbPath[0];
            if (firstCrumb.url && firstCrumb.url !== '#') {
                window.location.href = firstCrumb.url;
                return;
            }
        }

        // Priority 3: Browser back
        if (window.history.length > 1) {
            window.history.back();
        } else {
            // Last resort: go to dashboard
            window.location.href = '/pages/dashboard.html';
        }
    }

    /**
     * Render desktop navigation — sidebar layout.
     *
     * On desktop the left nav sidebar (fb-sidebar from fb-nav.js) and the right
     * chat sidebar (fb-chat-sidebar from chat-drawer.js) are permanently pinned
     * via CSS (brdc-navigation.css desktop rules). No top bar is rendered here.
     *
     * This method just marks the body and triggers an initial chat data load so
     * the right panel shows content without requiring the user to open it first.
     */
    renderDesktopNav() {
        // Mark body so CSS desktop sidebar rules activate
        document.body.classList.add('has-desktop-nav');

        if (document.getElementById('brdcDesktopNav')) return;

        const nav = document.createElement('nav');
        nav.id = 'brdcDesktopNav';
        nav.className = 'brdc-desktop-nav';
        nav.setAttribute('aria-label', 'Main navigation');

        // SVG icons matching sidebar Lucide/Feather style (20x20, stroke-based, 2px)
        const svgAttr = 'xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';
        const icons = {
            home: `<svg ${svgAttr}><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`,
            events: `<svg ${svgAttr}><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`,
            chat: `<svg ${svgAttr}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`,
            trader: `<svg ${svgAttr}><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>`,
            alerts: `<svg ${svgAttr}><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>`,
            profile: `<svg ${svgAttr}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`
        };

        nav.innerHTML = `
            <div class="desktop-nav-links desktop-nav-links-left">
                <a href="/pages/dashboard.html" class="desktop-nav-link ${this.currentPage === 'home' ? 'active' : ''}" data-page="home">
                    <span class="desktop-nav-link-icon">${icons.home}</span>
                    <span>Home</span>
                </a>
                <a href="/pages/events-hub.html" class="desktop-nav-link ${this.currentPage === 'events' ? 'active' : ''}" data-page="events">
                    <span class="desktop-nav-link-icon">${icons.events}</span>
                    <span>Events</span>
                </a>
                <a href="/pages/messages.html" class="desktop-nav-link ${this.currentPage === 'chat' ? 'active' : ''}" data-page="chat">
                    <span class="desktop-nav-link-icon">${icons.chat}</span>
                    <span>Chat</span>
                </a>
            </div>
            <a href="/pages/dashboard.html" class="desktop-nav-logo">
                <img src="/images/gold_logo.png" alt="BRDC" height="32">
            </a>
            <div class="desktop-nav-links desktop-nav-links-right">
                <a href="/pages/dart-trader.html" class="desktop-nav-link ${this.currentPage === 'trader' ? 'active' : ''}" data-page="trader">
                    <span class="desktop-nav-link-icon">${icons.trader}</span>
                    <span>Trader</span>
                </a>
                <button class="desktop-nav-link" data-action="notifications">
                    <span class="desktop-nav-link-icon fb-footer-tab-badge" data-count="0">${icons.alerts}</span>
                    <span>Alerts</span>
                </button>
                <a href="/pages/player-profile.html" class="desktop-nav-link ${this.currentPage === 'profile' ? 'active' : ''}" data-page="profile">
                    <span class="desktop-nav-link-icon">${icons.profile}</span>
                    <span>Profile</span>
                </a>
            </div>
        `;

        document.body.insertBefore(nav, document.body.firstChild);

        // Bind notification click
        const alertBtn = nav.querySelector('[data-action="notifications"]');
        if (alertBtn) {
            alertBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.toggleNotifications();
            });
        }

        // Pre-load chat data for the permanently-visible right panel.
        setTimeout(() => {
            if (window.chatDrawer && typeof window.chatDrawer.loadRecentChats === 'function') {
                window.chatDrawer.loadRecentChats();
            }
        }, 800);
    }

    /**
     * Update mobile header title (callable from pages that set title dynamically)
     */
    setPageTitle(title) {
        this.pageTitle = title;
        const titleEl = document.querySelector('.brdc-mh-title');
        if (titleEl) titleEl.textContent = title;
    }

    /**
     * Render role badges for current player
     */
    renderRoleBadges() {
        if (!this.player || !this.player.roles) return;

        const container = document.getElementById('brdcRoleBadges') || this.createRoleBadgeContainer();
        const badges = [];

        const roles = this.player.roles;

        if (roles.directing && roles.directing.length > 0) {
            badges.push('<span class="role-badge director">📋 Director</span>');
        }
        if (roles.captaining && roles.captaining.length > 0) {
            badges.push('<span class="role-badge captain">👔 Captain</span>');
        }
        if (this.player.is_admin) {
            badges.push('<span class="role-badge admin">⚙️ Admin</span>');
        }

        if (badges.length > 0) {
            container.innerHTML = badges.join('');
            container.style.display = 'flex';
        }
    }

    /**
     * Create role badge container if doesn't exist
     */
    createRoleBadgeContainer() {
        const container = document.createElement('div');
        container.id = 'brdcRoleBadges';
        container.className = 'brdc-role-badges';

        const header = document.getElementById('brdcMobileHeader') || document.getElementById('brdcDesktopNav') || document.querySelector('header') || document.querySelector('.fb-header');
        if (header) {
            header.after(container);
        } else {
            document.body.insertBefore(container, document.body.firstChild);
        }

        return container;
    }

    /**
     * Helper: Set active page
     */
    setActivePage(page) {
        this.currentPage = page;

        // Update mobile nav
        const mobileNav = document.getElementById('brdcMobileNav');
        if (mobileNav) {
            mobileNav.querySelectorAll('.mobile-nav-item[data-page]').forEach(item => {
                const isActive = item.dataset.page === page;
                item.classList.toggle('active', isActive);
                if (isActive) {
                    item.setAttribute('aria-current', 'page');
                } else {
                    item.removeAttribute('aria-current');
                }
            });
        }

        // Update desktop nav
        const desktopNav = document.getElementById('brdcDesktopNav');
        if (desktopNav) {
            desktopNav.querySelectorAll('.desktop-nav-link[data-page]').forEach(link => {
                const isActive = link.dataset.page === page;
                link.classList.toggle('active', isActive);
                if (isActive) {
                    link.setAttribute('aria-current', 'page');
                } else {
                    link.removeAttribute('aria-current');
                }
            });
        }

    }
}


/**
 * NotificationsPanel - Inline notifications panel component
 */
class NotificationsPanel {
    constructor() {
        this.isOpen = false;
        this.panel = null;
        this.notifications = [];
    }

    init() {
        this.createDOM();
    }

    createDOM() {
        if (document.querySelector('.fb-notifications-panel')) return;

        this.panel = document.createElement('div');
        this.panel.className = 'fb-notifications-panel';
        this.panel.innerHTML = `
            <div class="fb-notifications-header">
                <span class="fb-notifications-title">Notifications</span>
                <span class="fb-notifications-action" id="fbMarkAllRead">Mark all read</span>
            </div>
            <div class="fb-notifications-list" id="fbNotificationsList">
                <div class="fb-notifications-empty">Loading...</div>
            </div>
        `;
        document.body.appendChild(this.panel);

        // Mark all read
        document.getElementById('fbMarkAllRead').addEventListener('click', () => {
            this.markAllAsRead();
        });

        // Close on outside click
        document.addEventListener('click', (e) => {
            if (this.isOpen && !this.panel.contains(e.target)) {
                // Check if click was on the toggle button
                const toggleBtn = e.target.closest('[data-action="notifications"]');
                if (!toggleBtn) {
                    this.close();
                }
            }
        });
    }

    open() {
        this.isOpen = true;
        this.panel.classList.add('open');
        this.loadNotifications();
    }

    close() {
        this.isOpen = false;
        this.panel.classList.remove('open');
    }

    toggle() {
        if (this.isOpen) {
            this.close();
        } else {
            this.open();
        }
    }

    async loadNotifications() {
        const listEl = document.getElementById('fbNotificationsList');
        if (!listEl) return;

        try {
            const playerPin = localStorage.getItem('brdc_player_pin');
            if (!playerPin) {
                listEl.innerHTML = '<div class="fb-notifications-empty">Log in to see notifications</div>';
                return;
            }

            const { callFunction } = await import('/js/firebase-config.js');
            const result = await callFunction('getNotifications', {
                player_pin: playerPin,
                limit: 10
            });

            if (result.success && result.notifications && result.notifications.length > 0) {
                this.notifications = result.notifications;
                this.renderNotifications();
            } else {
                listEl.innerHTML = '<div class="fb-notifications-empty">No notifications</div>';
            }
        } catch (error) {
            console.error('Error loading notifications:', error);
            listEl.innerHTML = '<div class="fb-notifications-empty">No notifications</div>';
        }
    }

    renderNotifications() {
        const listEl = document.getElementById('fbNotificationsList');
        if (!listEl || !this.notifications.length) return;

        let html = '';
        this.notifications.forEach(notif => {
            const icon = this.getNotificationIcon(notif.type);
            const timeAgo = this.formatTimeAgo(notif.created_at);

            html += `
                <div class="fb-notification-item ${notif.read ? '' : 'unread'}" data-id="${notif.id}">
                    <div class="fb-notification-icon">${icon}</div>
                    <div class="fb-notification-content">
                        <div class="fb-notification-text">${notif.message}</div>
                        <div class="fb-notification-time">${timeAgo}</div>
                    </div>
                    ${notif.read ? '' : '<div class="fb-notification-dot"></div>'}
                </div>`;
        });
        listEl.innerHTML = html;

        // Attach click handlers
        listEl.querySelectorAll('.fb-notification-item').forEach(el => {
            el.addEventListener('click', () => {
                const id = el.dataset.id;
                this.markAsRead(id);
                el.classList.remove('unread');
                el.querySelector('.fb-notification-dot')?.remove();
            });
        });
    }

    getNotificationIcon(type) {
        const icons = {
            match: '🎯',
            message: '💬',
            team: '👥',
            event: '📅',
            achievement: '🏆',
            system: '🔔'
        };
        return icons[type] || '🔔';
    }

    formatTimeAgo(timestamp) {
        if (!timestamp) return '';

        let date = null;
        if (timestamp?.toDate) {
            date = timestamp.toDate();
        } else if (typeof timestamp === 'object' && timestamp !== null) {
            const seconds = timestamp.seconds ?? timestamp._seconds;
            if (Number.isFinite(seconds)) {
                date = new Date(seconds * 1000);
            }
        }
        if (!date) date = new Date(timestamp);
        if (Number.isNaN(date.getTime())) return '';
        const now = new Date();
        const diff = Math.floor((now - date) / 1000);

        if (diff < 60) return 'Just now';
        if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
        if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
        if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;

        return date.toLocaleDateString();
    }

    async markAsRead(id) {
        try {
            const { callFunction } = await import('/js/firebase-config.js');
            await callFunction('markNotificationRead', { notification_id: id });

            // Decrease badge count if we can access the main nav instance
            // Ideally we'd emit an event or callback
        } catch (error) {
            console.error('Error marking notification read:', error);
        }
    }

    async markAllAsRead() {
        try {
            const playerPin = localStorage.getItem('brdc_player_pin');
            if (!playerPin) return;

            const { callFunction } = await import('/js/firebase-config.js');
            await callFunction('markAllNotificationsRead', { player_pin: playerPin });

            // Update UI
            this.notifications.forEach(n => n.read = true);
            this.renderNotifications();

            // Reset badge
            const badge = document.querySelector('.mobile-nav-item[data-action="notifications"] .fb-footer-tab-badge');
            if (badge) badge.setAttribute('data-count', '0');

        } catch (error) {
            console.error('Error marking all notifications read:', error);
        }
    }
}

// Auto-initialize on pages that include this script
window.BRDCNavigation = BRDCNavigation;


// Auto-init if document is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        if (!window.brdcNavInitialized) {
            window.brdcNav = new BRDCNavigation();
            window.brdcNav.init();
            window.brdcNavInitialized = true;
        }
    });
} else {
    if (!window.brdcNavInitialized) {
        window.brdcNav = new BRDCNavigation();
        window.brdcNav.init();
        window.brdcNavInitialized = true;
    }
}
