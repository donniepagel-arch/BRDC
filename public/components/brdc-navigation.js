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
        if (path.includes('league')) return 'leagues';
        if (path.includes('match') || path.includes('scorer') || path.includes('x01') || path.includes('cricket')) return 'play';
        if (path.includes('profile') || path.includes('friends') || path.includes('messages')) return 'profile';
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
            const playerPin = localStorage.getItem('brdc_player_pin');
            if (!playerPin) return;

            // Dynamically import firebase config only when needed
            let callFunction;
            try {
                const module = await import('/js/firebase-config.js');
                callFunction = module.callFunction;
            } catch (e) {
                console.warn('Firebase config not found, badge counts skipped');
                return;
            }

            // Load notification count
            try {
                const notifResult = await callFunction('getUnreadNotificationCount', { player_pin: playerPin });
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
            <a href="/pages/dart-trader.html" class="mobile-nav-item ${this.currentPage === 'trader' ? 'active' : ''}" data-page="trader" ${this.currentPage === 'trader' ? 'aria-current="page"' : ''}>
                <span class="mobile-nav-icon" aria-hidden="true">💰</span>
                <span class="mobile-nav-label">Trader</span>
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
     * Creates fb-header layout: hamburger | centered logo | chat button
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

        // Determine if back button or hamburger should show
        const showBack = this.showBackButton && !this.isHomePage();
        const backUrl = this.backUrl || '';

        // Create header element matching fb-header layout
        const header = document.createElement('header');
        header.id = 'brdcMobileHeader';
        header.className = 'fb-header';
        header.setAttribute('role', 'banner');

        // Left side: hamburger menu or back button
        const leftContent = showBack
            ? `<button class="fb-header-btn" id="brdcBackBtn" aria-label="Go back">
                   <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                       <path d="M19 12H5M12 19l-7-7 7-7"/>
                   </svg>
               </button>`
            : `<button class="fb-header-btn" id="brdcSidebarToggle" aria-label="Open menu">
                   <div class="fb-hamburger">
                       <span></span>
                       <span></span>
                       <span></span>
                   </div>
               </button>`;

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

        // Wire up hamburger or back button
        if (showBack) {
            header.querySelector('#brdcBackBtn').addEventListener('click', () => {
                if (backUrl) {
                    window.location.href = backUrl;
                } else if (window.history.length > 1) {
                    window.history.back();
                } else {
                    window.location.href = '/pages/dashboard.html';
                }
            });
        } else {
            header.querySelector('#brdcSidebarToggle').addEventListener('click', () => {
                if (window.FBNav && window.FBNav.sidebar) {
                    window.FBNav.sidebar.open();
                }
            });
        }

        // Chat button is wired by chat-drawer.js (loaded via brdc-navigation-init.js)
        // to avoid double-toggle from duplicate handlers.
    }

    /**
     * Render desktop header navigation
     */
    renderDesktopNav() {
        if (document.getElementById('brdcDesktopNav')) return;

        const playerName = this.player?.display_name || this.player?.name || 'Player';
        const initials = playerName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();

        const nav = document.createElement('header');
        nav.id = 'brdcDesktopNav';
        nav.className = 'brdc-desktop-nav';
        nav.setAttribute('role', 'banner');
        nav.innerHTML = `
            <div class="desktop-nav-brand">
                <a href="/pages/dashboard.html" class="desktop-nav-logo">
                    <img src="/images/gold_logo.png" alt="BRDC Home" height="32">
                </a>
            </div>
            <nav class="desktop-nav-links" aria-label="Main navigation">
                <a href="/pages/leagues.html" class="desktop-nav-link ${this.currentPage === 'leagues' ? 'active' : ''}" ${this.currentPage === 'leagues' ? 'aria-current="page"' : ''}>Leagues</a>
                <a href="/pages/tournaments.html" class="desktop-nav-link ${this.currentPage === 'events' ? 'active' : ''}" ${this.currentPage === 'events' ? 'aria-current="page"' : ''}>Tournaments</a>
                <a href="/pages/events-hub.html" class="desktop-nav-link">Events</a>
                <a href="/pages/match-hub.html" class="desktop-nav-link ${this.currentPage === 'play' ? 'active' : ''}" ${this.currentPage === 'play' ? 'aria-current="page"' : ''}>Match Hub</a>
            </nav>
            <div class="desktop-nav-user">
                <button class="desktop-nav-user-menu" id="userMenuToggle" aria-expanded="false" aria-haspopup="true" aria-label="User menu">
                    <span class="desktop-nav-user-name">${playerName}</span>
                    <div class="desktop-nav-user-avatar" aria-hidden="true">${initials}</div>
                    <span class="dropdown-arrow" aria-hidden="true">▼</span>
                </button>
                <div class="desktop-user-dropdown" id="userDropdown" role="menu">
                    <a href="/pages/player-profile.html" class="dropdown-item" role="menuitem">My Profile</a>
                    <a href="/pages/friends.html" class="dropdown-item" role="menuitem">Friends</a>
                    <a href="/pages/messages.html" class="dropdown-item" role="menuitem">Messages</a>
                    ${this.player?.roles?.captaining?.length ? '<a href="/pages/captain-dashboard.html" class="dropdown-item" role="menuitem">Captain Dashboard</a>' : ''}
                    ${this.player?.roles?.directing?.length ? '<a href="/pages/league-director.html" class="dropdown-item" role="menuitem">Director Tools</a>' : ''}
                    <div class="dropdown-divider" role="separator"></div>
                    <a href="#" class="dropdown-item" role="menuitem" onclick="window.logout?.(); return false;">Logout</a>
                </div>
            </div>
        `;

        document.body.insertBefore(nav, document.body.firstChild);
        document.body.classList.add('has-desktop-nav');

        // Toggle dropdown with keyboard support
        const toggle = nav.querySelector('#userMenuToggle');
        const dropdown = nav.querySelector('#userDropdown');
        toggle.addEventListener('click', (e) => {
            e.stopPropagation();
            const isOpen = dropdown.classList.toggle('open');
            toggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
        });
        toggle.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && dropdown.classList.contains('open')) {
                dropdown.classList.remove('open');
                toggle.setAttribute('aria-expanded', 'false');
                toggle.focus();
            }
        });
        document.addEventListener('click', () => {
            dropdown.classList.remove('open');
            toggle.setAttribute('aria-expanded', 'false');
        });
        // Arrow key navigation within dropdown menu
        dropdown.addEventListener('keydown', (e) => {
            const items = Array.from(dropdown.querySelectorAll('[role="menuitem"]'));
            const idx = items.indexOf(document.activeElement);
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                items[(idx + 1) % items.length]?.focus();
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                items[(idx - 1 + items.length) % items.length]?.focus();
            } else if (e.key === 'Escape') {
                dropdown.classList.remove('open');
                toggle.setAttribute('aria-expanded', 'false');
                toggle.focus();
            }
        });
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
            desktopNav.querySelectorAll('.desktop-nav-link').forEach(link => {
                const href = link.getAttribute('href');
                const isActive = (page === 'leagues' && href.includes('leagues')) ||
                    (page === 'events' && (href.includes('tournament') || href.includes('event'))) ||
                    (page === 'play' && href.includes('match'));
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

        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
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
