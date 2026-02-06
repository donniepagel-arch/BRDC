/**
 * BRDC Navigation Component v2.0
 * Unified mobile-first navigation system
 * Supports: Mobile (bottom nav), Tablet (sidebar + bottom), Desktop (header)
 */

class BRDCNavigation {
    constructor(options = {}) {
        this.currentPage = options.page || this.detectCurrentPage();
        this.showMobileNav = options.showMobileNav !== false;
        this.showBackButton = options.showBackButton !== false;
        this.breadcrumbPath = options.breadcrumbPath || [];
        this.player = null;
        this.isMobile = window.innerWidth < 768;
        this.isTablet = window.innerWidth >= 768 && window.innerWidth < 1024;
        this.isDesktop = window.innerWidth >= 1024;
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
        this.renderMobileNav();

        if (this.isDesktop) {
            this.renderDesktopNav();
        }

        if (this.isTablet) {
            this.renderTabletSidebar();
        }

        if (this.showBackButton && !this.isHomePage()) {
            this.renderBackButton();
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
        const wasMobile = this.isMobile;
        const wasTablet = this.isTablet;
        const wasDesktop = this.isDesktop;

        this.isMobile = window.innerWidth < 768;
        this.isTablet = window.innerWidth >= 768 && window.innerWidth < 1024;
        this.isDesktop = window.innerWidth >= 1024;

        // Only re-render if breakpoint changed
        if (wasMobile !== this.isMobile || wasTablet !== this.isTablet || wasDesktop !== this.isDesktop) {
            document.body.classList.toggle('is-mobile', this.isMobile);
            document.body.classList.toggle('is-tablet', this.isTablet);
            document.body.classList.toggle('is-desktop', this.isDesktop);

            // Toggle desktop nav
            const desktopNav = document.getElementById('brdcDesktopNav');
            if (this.isDesktop && !desktopNav) {
                this.renderDesktopNav();
            } else if (!this.isDesktop && desktopNav) {
                desktopNav.remove();
            }

            // Toggle tablet sidebar
            const sidebar = document.getElementById('brdcSidebar');
            if (this.isTablet && !sidebar) {
                this.renderTabletSidebar();
            } else if (!this.isTablet && sidebar) {
                sidebar.remove();
            }
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
        nav.innerHTML = `
            <a href="/pages/dashboard.html" class="mobile-nav-item ${this.currentPage === 'home' ? 'active' : ''}" data-page="home">
                <span class="mobile-nav-icon">🏠</span>
                <span class="mobile-nav-label">Home</span>
            </a>
            <a href="/pages/events-hub.html" class="mobile-nav-item ${this.currentPage === 'events' ? 'active' : ''}" data-page="events">
                <span class="mobile-nav-icon">📅</span>
                <span class="mobile-nav-label">Events</span>
            </a>
            <a href="/pages/dart-trader.html" class="mobile-nav-item ${this.currentPage === 'trader' ? 'active' : ''}" data-page="trader">
                <span class="mobile-nav-icon">💰</span>
                <span class="mobile-nav-label">Trader</span>
            </a>
            <a href="#" class="mobile-nav-item" data-action="notifications">
                <span class="mobile-nav-icon fb-footer-tab-badge" data-count="0">🔔</span>
                <span class="mobile-nav-label">Alerts</span>
            </a>
            <a href="/pages/player-profile.html" class="mobile-nav-item ${this.currentPage === 'profile' ? 'active' : ''}" data-page="profile">
                <span class="mobile-nav-icon">👤</span>
                <span class="mobile-nav-label">Profile</span>
            </a>
        `;

        document.body.appendChild(nav);
        document.body.classList.add('has-mobile-nav');

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
     * Toggle notifications panel
     */
    toggleNotifications() {
        console.log('Toggle notifications');
        // TODO: Implement notification panel logic or emit event
        const event = new CustomEvent('brdc:toggle-notifications');
        window.dispatchEvent(event);
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
        nav.innerHTML = `
            <div class="desktop-nav-brand">
                <a href="/pages/dashboard.html" class="desktop-nav-logo">
                    <img src="/images/gold_logo.png" alt="BRDC" height="32">
                </a>
            </div>
            <div class="desktop-nav-links">
                <a href="/pages/leagues.html" class="desktop-nav-link ${this.currentPage === 'leagues' ? 'active' : ''}">Leagues</a>
                <a href="/pages/tournaments.html" class="desktop-nav-link ${this.currentPage === 'events' ? 'active' : ''}">Tournaments</a>
                <a href="/pages/events-hub.html" class="desktop-nav-link">Events</a>
                <a href="/pages/match-hub.html" class="desktop-nav-link ${this.currentPage === 'play' ? 'active' : ''}">Match Hub</a>
            </div>
            <div class="desktop-nav-user">
                <div class="desktop-nav-user-menu" id="userMenuToggle">
                    <span class="desktop-nav-user-name">${playerName}</span>
                    <div class="desktop-nav-user-avatar">${initials}</div>
                    <span class="dropdown-arrow">▼</span>
                </div>
                <div class="desktop-user-dropdown" id="userDropdown">
                    <a href="/pages/player-profile.html" class="dropdown-item">My Profile</a>
                    <a href="/pages/friends.html" class="dropdown-item">Friends</a>
                    <a href="/pages/messages.html" class="dropdown-item">Messages</a>
                    ${this.player?.roles?.captaining?.length ? '<a href="/pages/captain-dashboard.html" class="dropdown-item">Captain Dashboard</a>' : ''}
                    ${this.player?.roles?.directing?.length ? '<a href="/pages/league-director.html" class="dropdown-item">Director Tools</a>' : ''}
                    <div class="dropdown-divider"></div>
                    <a href="#" class="dropdown-item" onclick="window.logout?.(); return false;">Logout</a>
                </div>
            </div>
        `;

        document.body.insertBefore(nav, document.body.firstChild);
        document.body.classList.add('has-desktop-nav');

        // Toggle dropdown
        const toggle = nav.querySelector('#userMenuToggle');
        const dropdown = nav.querySelector('#userDropdown');
        toggle.addEventListener('click', (e) => {
            e.stopPropagation();
            dropdown.classList.toggle('open');
        });
        document.addEventListener('click', () => dropdown.classList.remove('open'));
    }

    /**
     * Render tablet sidebar navigation
     */
    renderTabletSidebar() {
        if (document.getElementById('brdcSidebar')) return;

        const sidebar = document.createElement('aside');
        sidebar.id = 'brdcSidebar';
        sidebar.className = 'brdc-sidebar collapsed';
        sidebar.innerHTML = `
            <button class="sidebar-toggle" id="sidebarToggle">☰</button>
            <nav class="sidebar-nav">
                <a href="/pages/dashboard.html" class="sidebar-item ${this.currentPage === 'home' ? 'active' : ''}">
                    <span class="sidebar-icon">🏠</span>
                    <span class="sidebar-label">Home</span>
                </a>
                <a href="/pages/leagues.html" class="sidebar-item ${this.currentPage === 'leagues' ? 'active' : ''}">
                    <span class="sidebar-icon">⚡</span>
                    <span class="sidebar-label">Leagues</span>
                </a>
                <a href="/pages/tournaments.html" class="sidebar-item">
                    <span class="sidebar-icon">🏆</span>
                    <span class="sidebar-label">Tournaments</span>
                </a>
                <a href="/pages/events-hub.html" class="sidebar-item">
                    <span class="sidebar-icon">📅</span>
                    <span class="sidebar-label">Events</span>
                </a>
                <a href="/pages/match-hub.html" class="sidebar-item ${this.currentPage === 'play' ? 'active' : ''}">
                    <span class="sidebar-icon">🎯</span>
                    <span class="sidebar-label">Match Hub</span>
                </a>
                <a href="/pages/friends.html" class="sidebar-item">
                    <span class="sidebar-icon">👥</span>
                    <span class="sidebar-label">Friends</span>
                </a>
                <a href="/pages/messages.html" class="sidebar-item">
                    <span class="sidebar-icon">💬</span>
                    <span class="sidebar-label">Messages</span>
                </a>
                ${this.player?.roles?.captaining?.length ? `
                <a href="/pages/captain-dashboard.html" class="sidebar-item">
                    <span class="sidebar-icon">👔</span>
                    <span class="sidebar-label">Captain</span>
                </a>` : ''}
                ${this.player?.roles?.directing?.length ? `
                <a href="/pages/league-director.html" class="sidebar-item">
                    <span class="sidebar-icon">📋</span>
                    <span class="sidebar-label">Director</span>
                </a>` : ''}
            </nav>
        `;

        document.body.insertBefore(sidebar, document.body.firstChild);
        document.body.classList.add('has-sidebar');

        // Toggle sidebar
        const toggle = sidebar.querySelector('#sidebarToggle');
        toggle.addEventListener('click', () => {
            sidebar.classList.toggle('collapsed');
            document.body.classList.toggle('sidebar-expanded');
        });
    }

    /**
     * Render back button
     */
    renderBackButton() {
        if (document.getElementById('brdcBackBtn')) return;

        const backBtn = document.createElement('button');
        backBtn.id = 'brdcBackBtn';
        backBtn.className = 'brdc-back-btn';
        backBtn.innerHTML = '← Back';
        backBtn.onclick = () => {
            if (window.history.length > 1) {
                window.history.back();
            } else {
                window.location.href = '/pages/dashboard.html';
            }
        };

        // Insert after desktop nav or at top
        const desktopNav = document.getElementById('brdcDesktopNav');
        if (desktopNav) {
            desktopNav.after(backBtn);
        } else {
            document.body.insertBefore(backBtn, document.body.firstChild);
        }
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

        const header = document.querySelector('header') || document.querySelector('.fb-header') || document.getElementById('brdcDesktopNav');
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
            mobileNav.querySelectorAll('.mobile-nav-item').forEach(item => {
                item.classList.toggle('active', item.dataset.page === page);
            });
        }

        // Update desktop nav
        const desktopNav = document.getElementById('brdcDesktopNav');
        if (desktopNav) {
            desktopNav.querySelectorAll('.desktop-nav-link').forEach(link => {
                const href = link.getAttribute('href');
                link.classList.toggle('active',
                    (page === 'leagues' && href.includes('leagues')) ||
                    (page === 'events' && (href.includes('tournament') || href.includes('event'))) ||
                    (page === 'play' && href.includes('match'))
                );
            });
        }

        // Update sidebar
        const sidebar = document.getElementById('brdcSidebar');
        if (sidebar) {
            sidebar.querySelectorAll('.sidebar-item').forEach(item => {
                const href = item.getAttribute('href');
                item.classList.toggle('active',
                    (page === 'home' && href.includes('dashboard')) ||
                    (page === 'leagues' && href.includes('leagues')) ||
                    (page === 'play' && href.includes('match'))
                );
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
