/**
 * BRDC Facebook-Style Navigation System
 *
 * Implements mobile-first navigation with:
 * - Slide-in sidebar menu (left)
 * - Footer navigation tabs
 * - Chat dropdown
 * - Search overlay
 * - Notifications panel
 */

(function() {
    'use strict';

    // CSS Variables for consistent styling
    const CSS_VARS = {
        pink: 'var(--pink, #FF469A)',
        teal: 'var(--teal, #91D7EB)',
        yellow: 'var(--yellow, #FDD835)',
        bgDark: 'var(--bg-dark, #1a1a2e)',
        bgPanel: 'var(--bg-panel, #16213e)',
        bgCard: 'var(--bg-card, #1e2a47)',
        textLight: 'var(--text-light, #f0f0f0)',
        textDim: 'var(--text-dim, #8a8aa3)'
    };

    // Menu items configuration by section
    const MENU_ITEMS = {
        play: [
            { icon: '🎯', label: 'Scorer Hub', href: '/pages/scorer-hub.html' },
            { icon: '🎮', label: 'VR-Darts', href: '/virtual-darts/index.html' },
            { icon: '📺', label: 'Live Scoreboard', href: '/pages/live-scoreboard.html' },
            { icon: '🎥', label: 'Stream Director', href: '/pages/stream-director.html' },
            { icon: '🎲', label: 'Online Play', href: '/pages/online-play.html' }
        ],
        discover: [
            { icon: '👥', label: 'Friends', href: '/pages/friends.html' },
            { icon: '📅', label: 'Events Hub', href: '/pages/events-hub.html' },
            { icon: '👥', label: 'Members', href: '/pages/members.html' }
        ],
        manage: [
            { icon: '👔', label: 'Captain Dashboard', href: '/pages/captain-dashboard.html' },
            { icon: '📋', label: 'Roster', href: '/pages/roster.html' },
            { icon: '📨', label: 'Team Messages', href: '/pages/team-messages.html' }
        ],
        admin: [
            { icon: '🏆', label: 'Director Dashboard', href: '/pages/director-dashboard.html' },
            { icon: '⚙️', label: 'League Settings', href: '/pages/league-settings.html' }
        ],
        settings: [
            { icon: '⚙️', label: 'Account Settings', href: '/pages/settings.html' },
            { icon: '🔔', label: 'Notifications', href: '/pages/notification-settings.html' },
            { icon: '🚪', label: 'Logout', action: 'logout' }
        ]
    };

    // Footer tabs configuration
    const FOOTER_TABS = [
        { id: 'home', icon: '🏠', label: 'Home', href: '/pages/dashboard.html' },
        { id: 'events', icon: '📅', label: 'Events', href: '/pages/events-hub.html' },
        { id: 'trader', icon: '💰', label: 'Trader', href: '/pages/dart-trader.html' },
        { id: 'notifications', icon: '🔔', label: 'Alerts', action: 'notifications' },
        { id: 'profile', icon: '👤', label: 'Profile', href: '/pages/player-profile.html' }
    ];

    // Inject styles
    const styles = document.createElement('style');
    styles.id = 'fb-nav-styles';
    styles.textContent = `
        /* ===== FB SIDEBAR ===== */
        .fb-sidebar {
            position: fixed;
            top: 0;
            left: 0;
            width: 280px;
            max-width: 85vw;
            height: 100%;
            background: ${CSS_VARS.bgPanel};
            z-index: 10001;
            transform: translateX(-100%);
            transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            display: flex;
            flex-direction: column;
            box-shadow: 4px 0 20px rgba(0,0,0,0.5);
            overflow: hidden;
        }

        .fb-sidebar.open {
            transform: translateX(0);
        }

        .fb-sidebar-overlay {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.7);
            z-index: 10000;
            opacity: 0;
            visibility: hidden;
            transition: opacity 0.3s ease, visibility 0.3s ease;
        }

        .fb-sidebar-overlay.open {
            opacity: 1;
            visibility: visible;
        }

        .fb-sidebar-header {
            padding: 20px 16px;
            border-bottom: 1px solid rgba(255,255,255,0.1);
            display: flex;
            align-items: center;
            gap: 12px;
        }

        .fb-sidebar-avatar {
            width: 48px;
            height: 48px;
            border-radius: 50%;
            background: ${CSS_VARS.pink};
            display: flex;
            align-items: center;
            justify-content: center;
            font-family: 'Bebas Neue', cursive;
            font-size: 24px;
            color: white;
            overflow: hidden;
        }

        .fb-sidebar-avatar img {
            width: 100%;
            height: 100%;
            object-fit: cover;
        }

        .fb-sidebar-user-info {
            flex: 1;
            min-width: 0;
        }

        .fb-sidebar-user-name {
            font-family: 'Bebas Neue', cursive;
            font-size: 20px;
            color: ${CSS_VARS.textLight};
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }

        .fb-sidebar-user-role {
            font-size: 12px;
            color: ${CSS_VARS.teal};
            text-transform: uppercase;
            letter-spacing: 1px;
        }

        .fb-sidebar-close {
            width: 36px;
            height: 36px;
            border-radius: 50%;
            background: rgba(255,255,255,0.1);
            border: none;
            color: ${CSS_VARS.textDim};
            font-size: 20px;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: background 0.2s, color 0.2s;
        }

        .fb-sidebar-close:hover {
            background: ${CSS_VARS.pink};
            color: white;
        }

        .fb-sidebar-content {
            flex: 1;
            overflow-y: auto;
            padding: 8px 0;
            -webkit-overflow-scrolling: touch;
        }

        .fb-sidebar-section {
            padding: 8px 16px 4px;
        }

        .fb-sidebar-section-title {
            font-size: 11px;
            font-weight: 700;
            color: ${CSS_VARS.textDim};
            text-transform: uppercase;
            letter-spacing: 1.5px;
            margin-bottom: 8px;
        }

        .fb-sidebar-item {
            display: flex;
            align-items: center;
            gap: 14px;
            padding: 12px 16px;
            color: ${CSS_VARS.textLight};
            text-decoration: none;
            border-radius: 8px;
            margin: 2px 8px;
            transition: background 0.15s;
            cursor: pointer;
        }

        .fb-sidebar-item:hover {
            background: rgba(255,255,255,0.1);
        }

        .fb-sidebar-item:active {
            background: rgba(255,255,255,0.15);
        }

        .fb-sidebar-item.active {
            background: rgba(255, 70, 154, 0.2);
            color: ${CSS_VARS.pink};
        }

        .fb-sidebar-item-icon {
            font-size: 20px;
            width: 24px;
            text-align: center;
        }

        .fb-sidebar-item-label {
            font-size: 15px;
            font-weight: 500;
        }

        .fb-sidebar-item.logout {
            color: ${CSS_VARS.pink};
            border-top: 1px solid rgba(255,255,255,0.1);
            margin-top: 8px;
            padding-top: 16px;
            border-radius: 0;
        }

        .fb-sidebar-item.logout:hover {
            background: rgba(255, 70, 154, 0.2);
        }

        /* ===== FB FOOTER ===== */
        .fb-footer {
            position: fixed;
            bottom: 0;
            left: 0;
            right: 0;
            height: 60px;
            background: ${CSS_VARS.bgPanel};
            border-top: 1px solid rgba(255,255,255,0.1);
            display: flex;
            align-items: center;
            justify-content: space-around;
            z-index: 9999;
            padding: 0 4px;
            padding-bottom: env(safe-area-inset-bottom, 0);
            box-shadow: 0 -2px 20px rgba(0,0,0,0.3);
        }

        .fb-footer-tab {
            flex: 1;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 2px;
            padding: 8px 4px;
            color: ${CSS_VARS.textDim};
            text-decoration: none;
            cursor: pointer;
            transition: color 0.2s;
            position: relative;
            -webkit-tap-highlight-color: transparent;
        }

        .fb-footer-tab:hover {
            color: ${CSS_VARS.textLight};
        }

        .fb-footer-tab.active {
            color: ${CSS_VARS.pink};
        }

        .fb-footer-tab-icon {
            font-size: 22px;
            line-height: 1;
        }

        .fb-footer-tab-label {
            font-size: 10px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }

        .fb-footer-badge {
            position: absolute;
            top: 4px;
            right: 50%;
            transform: translateX(14px);
            min-width: 18px;
            height: 18px;
            background: ${CSS_VARS.pink};
            color: white;
            font-size: 10px;
            font-weight: 700;
            border-radius: 9px;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 0 5px;
        }

        .fb-footer-badge.hidden {
            display: none;
        }

        /* Page body padding for footer */
        body.has-fb-footer {
            padding-bottom: 70px;
        }

        /* ===== FB CHAT SIDEBAR (RIGHT) ===== */
        .fb-chat-sidebar {
            position: fixed;
            top: 0;
            right: 0;
            width: 280px;
            max-width: 85vw;
            height: 100%;
            background: ${CSS_VARS.bgPanel};
            z-index: 10001;
            transform: translateX(100%);
            transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            display: flex;
            flex-direction: column;
            box-shadow: -4px 0 20px rgba(0,0,0,0.5);
            overflow: hidden;
        }

        .fb-chat-sidebar.open {
            transform: translateX(0);
        }

        .fb-chat-sidebar-overlay {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.7);
            z-index: 10000;
            opacity: 0;
            visibility: hidden;
            transition: opacity 0.3s ease, visibility 0.3s ease;
        }

        .fb-chat-sidebar-overlay.open {
            opacity: 1;
            visibility: visible;
        }

        .fb-chat-sidebar-header {
            padding: 20px 16px;
            border-bottom: 1px solid rgba(255,255,255,0.1);
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        .fb-chat-sidebar-title {
            font-family: 'Bebas Neue', cursive;
            font-size: 20px;
            color: ${CSS_VARS.teal};
            letter-spacing: 1px;
        }

        .fb-chat-sidebar-new-btn {
            padding: 8px 14px;
            background: ${CSS_VARS.pink};
            border: none;
            border-radius: 6px;
            color: white;
            font-size: 12px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s;
        }

        .fb-chat-sidebar-new-btn:hover {
            background: #d63384;
            transform: translateY(-1px);
        }

        .fb-chat-sidebar-close {
            width: 36px;
            height: 36px;
            border-radius: 50%;
            background: rgba(255,255,255,0.1);
            border: none;
            color: ${CSS_VARS.textDim};
            font-size: 20px;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: background 0.2s, color 0.2s;
            margin-left: 10px;
        }

        .fb-chat-sidebar-close:hover {
            background: ${CSS_VARS.pink};
            color: white;
        }

        .fb-chat-sidebar-list {
            flex: 1;
            overflow-y: auto;
            -webkit-overflow-scrolling: touch;
        }

        .fb-chat-sidebar-footer {
            padding: 12px 16px;
            border-top: 1px solid rgba(255,255,255,0.1);
            text-align: center;
        }

        .fb-chat-sidebar-see-all {
            color: ${CSS_VARS.teal};
            text-decoration: none;
            font-size: 13px;
            font-weight: 600;
        }

        .fb-chat-sidebar-see-all:hover {
            text-decoration: underline;
        }

        .fb-chat-item {
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 12px 16px;
            cursor: pointer;
            transition: background 0.15s;
            text-decoration: none;
            color: inherit;
        }

        .fb-chat-item:hover {
            background: rgba(255,255,255,0.05);
        }

        .fb-chat-item-avatar {
            width: 40px;
            height: 40px;
            border-radius: 50%;
            background: ${CSS_VARS.pink};
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 16px;
            color: white;
            flex-shrink: 0;
        }

        .fb-chat-item-content {
            flex: 1;
            min-width: 0;
        }

        .fb-chat-item-name {
            font-weight: 600;
            font-size: 14px;
            color: ${CSS_VARS.textLight};
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }

        .fb-chat-item-preview {
            font-size: 12px;
            color: ${CSS_VARS.textDim};
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }

        .fb-chat-item-unread {
            width: 10px;
            height: 10px;
            background: ${CSS_VARS.pink};
            border-radius: 50%;
            flex-shrink: 0;
        }

        .fb-chat-empty {
            padding: 30px 20px;
            text-align: center;
            color: ${CSS_VARS.textDim};
            font-size: 14px;
        }

        /* ===== FB SEARCH OVERLAY ===== */
        .fb-search-overlay {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(15, 15, 26, 0.98);
            z-index: 10003;
            opacity: 0;
            visibility: hidden;
            transition: opacity 0.2s, visibility 0.2s;
            display: flex;
            flex-direction: column;
        }

        .fb-search-overlay.open {
            opacity: 1;
            visibility: visible;
        }

        .fb-search-header {
            padding: 16px;
            display: flex;
            align-items: center;
            gap: 12px;
            border-bottom: 1px solid rgba(255,255,255,0.1);
        }

        .fb-search-back {
            width: 40px;
            height: 40px;
            border-radius: 50%;
            background: rgba(255,255,255,0.1);
            border: none;
            color: ${CSS_VARS.textLight};
            font-size: 20px;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .fb-search-input-wrapper {
            flex: 1;
            position: relative;
        }

        .fb-search-input {
            width: 100%;
            padding: 12px 16px;
            padding-left: 40px;
            background: rgba(255,255,255,0.1);
            border: 1px solid rgba(255,255,255,0.2);
            border-radius: 24px;
            color: ${CSS_VARS.textLight};
            font-size: 16px;
            outline: none;
            transition: border-color 0.2s;
        }

        .fb-search-input:focus {
            border-color: ${CSS_VARS.teal};
        }

        .fb-search-input::placeholder {
            color: ${CSS_VARS.textDim};
        }

        .fb-search-icon {
            position: absolute;
            left: 14px;
            top: 50%;
            transform: translateY(-50%);
            font-size: 16px;
            color: ${CSS_VARS.textDim};
        }

        .fb-search-results {
            flex: 1;
            overflow-y: auto;
            padding: 16px;
            -webkit-overflow-scrolling: touch;
        }

        .fb-search-section-title {
            font-size: 12px;
            font-weight: 700;
            color: ${CSS_VARS.textDim};
            text-transform: uppercase;
            letter-spacing: 1px;
            margin-bottom: 12px;
            padding-left: 4px;
        }

        .fb-search-result {
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 12px;
            border-radius: 8px;
            cursor: pointer;
            transition: background 0.15s;
            text-decoration: none;
            color: inherit;
        }

        .fb-search-result:hover {
            background: rgba(255,255,255,0.1);
        }

        .fb-search-result-icon {
            width: 40px;
            height: 40px;
            border-radius: 50%;
            background: rgba(255,255,255,0.1);
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 18px;
        }

        .fb-search-result-text {
            flex: 1;
        }

        .fb-search-result-title {
            font-weight: 600;
            font-size: 14px;
            color: ${CSS_VARS.textLight};
        }

        .fb-search-result-subtitle {
            font-size: 12px;
            color: ${CSS_VARS.textDim};
        }

        .fb-search-empty {
            text-align: center;
            padding: 40px 20px;
            color: ${CSS_VARS.textDim};
        }

        /* ===== FB NOTIFICATIONS PANEL ===== */
        .fb-notifications-panel {
            position: fixed;
            bottom: 70px;
            left: 10px;
            right: 10px;
            max-width: 400px;
            max-height: 450px;
            background: ${CSS_VARS.bgPanel};
            border: 1px solid rgba(255,255,255,0.15);
            border-radius: 12px;
            box-shadow: 0 -4px 20px rgba(0,0,0,0.4);
            z-index: 10002;
            opacity: 0;
            visibility: hidden;
            transform: translateY(10px);
            transition: opacity 0.2s, visibility 0.2s, transform 0.2s;
            display: flex;
            flex-direction: column;
            overflow: hidden;
            margin: 0 auto;
        }

        .fb-notifications-panel.open {
            opacity: 1;
            visibility: visible;
            transform: translateY(0);
        }

        .fb-notifications-header {
            padding: 12px 16px;
            border-bottom: 1px solid rgba(255,255,255,0.1);
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        .fb-notifications-title {
            font-family: 'Bebas Neue', cursive;
            font-size: 18px;
            color: ${CSS_VARS.teal};
        }

        .fb-notifications-action {
            font-size: 12px;
            color: ${CSS_VARS.pink};
            cursor: pointer;
        }

        .fb-notifications-action:hover {
            text-decoration: underline;
        }

        .fb-notifications-list {
            flex: 1;
            overflow-y: auto;
            -webkit-overflow-scrolling: touch;
        }

        .fb-notification-item {
            display: flex;
            align-items: flex-start;
            gap: 12px;
            padding: 14px 16px;
            cursor: pointer;
            transition: background 0.15s;
            border-bottom: 1px solid rgba(255,255,255,0.05);
        }

        .fb-notification-item:hover {
            background: rgba(255,255,255,0.05);
        }

        .fb-notification-item.unread {
            background: rgba(255, 70, 154, 0.1);
        }

        .fb-notification-icon {
            width: 40px;
            height: 40px;
            border-radius: 50%;
            background: rgba(255,255,255,0.1);
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 18px;
            flex-shrink: 0;
        }

        .fb-notification-content {
            flex: 1;
            min-width: 0;
        }

        .fb-notification-text {
            font-size: 14px;
            color: ${CSS_VARS.textLight};
            line-height: 1.4;
        }

        .fb-notification-time {
            font-size: 11px;
            color: ${CSS_VARS.textDim};
            margin-top: 4px;
        }

        .fb-notification-dot {
            width: 8px;
            height: 8px;
            background: ${CSS_VARS.pink};
            border-radius: 50%;
            flex-shrink: 0;
            margin-top: 6px;
        }

        .fb-notifications-empty {
            padding: 30px 20px;
            text-align: center;
            color: ${CSS_VARS.textDim};
            font-size: 14px;
        }

        /* ===== ANIMATIONS ===== */
        @keyframes fb-slide-in {
            from { transform: translateX(-100%); }
            to { transform: translateX(0); }
        }

        @keyframes fb-fade-in {
            from { opacity: 0; }
            to { opacity: 1; }
        }

        /* ===== UTILITY CLASSES ===== */
        .fb-hidden {
            display: none !important;
        }

        /* Prevent scroll when sidebar/overlay open */
        body.fb-no-scroll {
            overflow: hidden;
            position: fixed;
            width: 100%;
        }
    `;
    document.head.appendChild(styles);


    /**
     * SidebarMenu - Slide-in navigation menu from left
     */
    class SidebarMenu {
        constructor() {
            this.isOpen = false;
            this.sidebar = null;
            this.overlay = null;
            this.touchStartX = 0;
            this.touchCurrentX = 0;
            this.isSwiping = false;
            this.player = null;
        }

        init() {
            this.createDOM();
            this.attachListeners();
        }

        createDOM() {
            // Create overlay
            this.overlay = document.createElement('div');
            this.overlay.className = 'fb-sidebar-overlay';
            document.body.appendChild(this.overlay);

            // Create sidebar
            this.sidebar = document.createElement('nav');
            this.sidebar.className = 'fb-sidebar';
            this.sidebar.innerHTML = `
                <div class="fb-sidebar-header">
                    <div class="fb-sidebar-avatar" id="fbSidebarAvatar">?</div>
                    <div class="fb-sidebar-user-info">
                        <div class="fb-sidebar-user-name" id="fbSidebarUserName">Guest</div>
                        <div class="fb-sidebar-user-role" id="fbSidebarUserRole">Player</div>
                    </div>
                    <button class="fb-sidebar-close" aria-label="Close menu">&times;</button>
                </div>
                <div class="fb-sidebar-content" id="fbSidebarContent">
                    <!-- Content populated dynamically -->
                </div>
            `;
            document.body.appendChild(this.sidebar);
        }

        attachListeners() {
            // Overlay click to close
            this.overlay.addEventListener('click', () => this.close());

            // Close button
            const closeBtn = this.sidebar.querySelector('.fb-sidebar-close');
            closeBtn.addEventListener('click', () => this.close());

            // ESC key to close
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape' && this.isOpen) {
                    this.close();
                }
            });

            // Touch/swipe support
            this.sidebar.addEventListener('touchstart', (e) => this.onTouchStart(e), { passive: true });
            this.sidebar.addEventListener('touchmove', (e) => this.onTouchMove(e), { passive: false });
            this.sidebar.addEventListener('touchend', (e) => this.onTouchEnd(e), { passive: true });

            // Swipe from left edge to open
            document.addEventListener('touchstart', (e) => {
                if (e.touches[0].clientX < 20 && !this.isOpen) {
                    this.touchStartX = e.touches[0].clientX;
                    this.isSwiping = true;
                }
            }, { passive: true });

            document.addEventListener('touchmove', (e) => {
                if (this.isSwiping && !this.isOpen) {
                    const currentX = e.touches[0].clientX;
                    if (currentX - this.touchStartX > 50) {
                        this.open();
                        this.isSwiping = false;
                    }
                }
            }, { passive: true });

            document.addEventListener('touchend', () => {
                this.isSwiping = false;
            }, { passive: true });
        }

        onTouchStart(e) {
            this.touchStartX = e.touches[0].clientX;
            this.touchCurrentX = this.touchStartX;
        }

        onTouchMove(e) {
            if (!this.isOpen) return;

            this.touchCurrentX = e.touches[0].clientX;
            const diff = this.touchStartX - this.touchCurrentX;

            // Only handle left swipe (closing)
            if (diff > 0) {
                const translateX = Math.min(0, -diff);
                this.sidebar.style.transform = `translateX(${translateX}px)`;
                this.sidebar.style.transition = 'none';
                e.preventDefault();
            }
        }

        onTouchEnd(e) {
            if (!this.isOpen) return;

            const diff = this.touchStartX - this.touchCurrentX;
            this.sidebar.style.transition = '';

            if (diff > 80) {
                this.close();
            } else {
                this.sidebar.style.transform = 'translateX(0)';
            }
        }

        open() {
            this.isOpen = true;
            this.sidebar.classList.add('open');
            this.overlay.classList.add('open');
            document.body.classList.add('fb-no-scroll');
        }

        close() {
            this.isOpen = false;
            this.sidebar.classList.remove('open');
            this.overlay.classList.remove('open');
            this.sidebar.style.transform = '';
            document.body.classList.remove('fb-no-scroll');
        }

        toggle() {
            if (this.isOpen) {
                this.close();
            } else {
                this.open();
            }
        }

        setPlayer(player) {
            this.player = player;
            this.updateUserInfo();
            this.generateContent();
        }

        updateUserInfo() {
            const avatarEl = document.getElementById('fbSidebarAvatar');
            const nameEl = document.getElementById('fbSidebarUserName');
            const roleEl = document.getElementById('fbSidebarUserRole');

            if (this.player) {
                const name = this.player.name || 'Player';
                const initials = name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();

                avatarEl.textContent = initials;
                nameEl.textContent = name;

                // Determine role
                let role = 'Player';
                if (this.player.is_admin || this.player.is_master_admin) {
                    role = 'Admin';
                } else if (this.player.is_director) {
                    role = 'Director';
                } else if (this.player.is_captain) {
                    role = 'Captain';
                }
                roleEl.textContent = role;

                // Avatar image if available
                if (this.player.avatar_url) {
                    avatarEl.innerHTML = `<img src="${this.player.avatar_url}" alt="${name}">`;
                }
            }
        }

        generateContent() {
            const contentEl = document.getElementById('fbSidebarContent');
            if (!contentEl) return;

            let html = '';

            // Play section (always visible)
            html += this.renderSection('Play', MENU_ITEMS.play);

            // Discover section (always visible)
            html += this.renderSection('Discover', MENU_ITEMS.discover);

            // Manage section (captains only)
            if (this.player && this.player.is_captain) {
                html += this.renderSection('Manage', MENU_ITEMS.manage);
            }

            // Admin section (directors/admins only)
            if (this.player && (this.player.is_director || this.player.is_admin || this.player.is_master_admin)) {
                html += this.renderSection('Admin', MENU_ITEMS.admin);
            }

            // Settings section (always visible)
            html += this.renderSection('Settings', MENU_ITEMS.settings);

            contentEl.innerHTML = html;

            // Attach click handlers for action items
            contentEl.querySelectorAll('[data-action]').forEach(el => {
                el.addEventListener('click', (e) => {
                    e.preventDefault();
                    const action = el.dataset.action;
                    this.handleAction(action);
                });
            });
        }

        renderSection(title, items) {
            const currentPath = window.location.pathname;

            let html = `<div class="fb-sidebar-section">
                <div class="fb-sidebar-section-title">${title}</div>`;

            items.forEach(item => {
                const isActive = item.href && currentPath.includes(item.href.replace('/pages/', ''));
                const isLogout = item.action === 'logout';

                if (item.action) {
                    html += `
                        <a class="fb-sidebar-item ${isLogout ? 'logout' : ''}" data-action="${item.action}">
                            <span class="fb-sidebar-item-icon">${item.icon}</span>
                            <span class="fb-sidebar-item-label">${item.label}</span>
                        </a>`;
                } else {
                    html += `
                        <a href="${item.href}" class="fb-sidebar-item ${isActive ? 'active' : ''}">
                            <span class="fb-sidebar-item-icon">${item.icon}</span>
                            <span class="fb-sidebar-item-label">${item.label}</span>
                        </a>`;
                }
            });

            html += '</div>';
            return html;
        }

        handleAction(action) {
            switch (action) {
                case 'logout':
                    this.close();
                    window.FBNav.logout();
                    break;
                default:
                    console.log('Unknown action:', action);
            }
        }

        destroy() {
            if (this.overlay) {
                this.overlay.remove();
            }
            if (this.sidebar) {
                this.sidebar.remove();
            }
        }
    }


    /**
     * FooterNav - Bottom navigation tabs
     */
    class FooterNav {
        constructor() {
            this.activeTab = 'home';
            this.footer = null;
            this.badges = {};
        }

        init() {
            this.createDOM();
            this.detectActiveTab();
            document.body.classList.add('has-fb-footer');
        }

        createDOM() {
            this.footer = document.createElement('nav');
            this.footer.className = 'fb-footer';

            let html = '';
            FOOTER_TABS.forEach(tab => {
                html += `
                    <a class="fb-footer-tab" data-tab="${tab.id}" ${tab.href ? `href="${tab.href}"` : ''}>
                        <span class="fb-footer-tab-icon">${tab.icon}</span>
                        <span class="fb-footer-tab-label">${tab.label}</span>
                        <span class="fb-footer-badge hidden" id="fbBadge-${tab.id}">0</span>
                    </a>`;
            });

            this.footer.innerHTML = html;
            document.body.appendChild(this.footer);

            // Attach click handlers for action tabs
            this.footer.querySelectorAll('[data-tab]').forEach(el => {
                const tab = FOOTER_TABS.find(t => t.id === el.dataset.tab);
                if (tab && tab.action) {
                    el.addEventListener('click', (e) => {
                        e.preventDefault();
                        this.handleTabAction(tab.action, el.dataset.tab);
                    });
                } else {
                    el.addEventListener('click', () => {
                        this.setActive(el.dataset.tab);
                    });
                }
            });
        }

        detectActiveTab() {
            const path = window.location.pathname;

            for (const tab of FOOTER_TABS) {
                if (tab.href && path.includes(tab.href.replace('/pages/', ''))) {
                    this.setActive(tab.id);
                    return;
                }
            }

            // Default to home if on dashboard
            if (path.includes('dashboard')) {
                this.setActive('home');
            }
        }

        setActive(tabId) {
            this.activeTab = tabId;

            this.footer.querySelectorAll('.fb-footer-tab').forEach(el => {
                if (el.dataset.tab === tabId) {
                    el.classList.add('active');
                } else {
                    el.classList.remove('active');
                }
            });
        }

        handleTabAction(action, tabId) {
            switch (action) {
                case 'notifications':
                    if (window.FBNav && window.FBNav.notifications) {
                        window.FBNav.notifications.toggle();
                    }
                    break;
                default:
                    console.log('Unknown tab action:', action);
            }
        }

        setBadge(tabId, count) {
            const badge = document.getElementById(`fbBadge-${tabId}`);
            if (badge) {
                if (count > 0) {
                    badge.textContent = count > 99 ? '99+' : count;
                    badge.classList.remove('hidden');
                } else {
                    badge.classList.add('hidden');
                }
            }
        }

        navigate(tabId) {
            const tab = FOOTER_TABS.find(t => t.id === tabId);
            if (tab && tab.href) {
                window.location.href = tab.href;
            }
        }

        destroy() {
            if (this.footer) {
                this.footer.remove();
            }
            document.body.classList.remove('has-fb-footer');
        }
    }


    /**
     * ChatSidebar - Right sliding sidebar for messages/chat
     */
    class ChatSidebar {
        constructor() {
            this.isOpen = false;
            this.sidebar = null;
            this.overlay = null;
            this.chats = [];
            this.rooms = [];
            this.touchStartX = 0;
            this.touchCurrentX = 0;
        }

        init() {
            this.createDOM();
            this.attachListeners();
        }

        createDOM() {
            // Create overlay
            this.overlay = document.createElement('div');
            this.overlay.className = 'fb-chat-sidebar-overlay';
            document.body.appendChild(this.overlay);

            // Create sidebar
            this.sidebar = document.createElement('div');
            this.sidebar.className = 'fb-chat-sidebar';
            this.sidebar.innerHTML = `
                <div class="fb-chat-sidebar-header">
                    <span class="fb-chat-sidebar-title">Messages</span>
                    <div style="display: flex; align-items: center;">
                        <button class="fb-chat-sidebar-new-btn" onclick="window.location.href='/pages/messages.html?new=1'">+ New</button>
                        <button class="fb-chat-sidebar-close" aria-label="Close messages">&times;</button>
                    </div>
                </div>
                <div class="fb-chat-sidebar-tabs" style="display: flex; border-bottom: 1px solid rgba(255,255,255,0.1);">
                    <button class="fb-chat-sidebar-tab active" data-tab="chats" style="flex: 1; padding: 10px; background: none; border: none; color: ${CSS_VARS.pink}; font-size: 12px; font-weight: 600; cursor: pointer; border-bottom: 2px solid ${CSS_VARS.pink};">CHATS</button>
                    <button class="fb-chat-sidebar-tab" data-tab="rooms" style="flex: 1; padding: 10px; background: none; border: none; color: ${CSS_VARS.textDim}; font-size: 12px; font-weight: 600; cursor: pointer; border-bottom: 2px solid transparent;">ROOMS</button>
                </div>
                <div class="fb-chat-sidebar-list" id="fbChatList">
                    <div class="fb-chat-empty">Loading...</div>
                </div>
                <div class="fb-chat-sidebar-list" id="fbRoomList" style="display: none;">
                    <div class="fb-chat-empty">Loading...</div>
                </div>
                <div class="fb-chat-sidebar-footer">
                    <a href="/pages/messages.html" class="fb-chat-sidebar-see-all">See All Messages</a>
                </div>
            `;
            document.body.appendChild(this.sidebar);

            // Tab switching
            this.sidebar.querySelectorAll('.fb-chat-sidebar-tab').forEach(tab => {
                tab.addEventListener('click', (e) => {
                    this.switchTab(e.target.dataset.tab);
                });
            });
        }

        switchTab(tabName) {
            const tabs = this.sidebar.querySelectorAll('.fb-chat-sidebar-tab');
            const chatList = document.getElementById('fbChatList');
            const roomList = document.getElementById('fbRoomList');

            tabs.forEach(tab => {
                if (tab.dataset.tab === tabName) {
                    tab.style.color = CSS_VARS.pink;
                    tab.style.borderBottom = `2px solid ${CSS_VARS.pink}`;
                } else {
                    tab.style.color = CSS_VARS.textDim;
                    tab.style.borderBottom = '2px solid transparent';
                }
            });

            if (tabName === 'chats') {
                chatList.style.display = 'block';
                roomList.style.display = 'none';
            } else {
                chatList.style.display = 'none';
                roomList.style.display = 'block';
            }
        }

        attachListeners() {
            // Overlay click to close
            this.overlay.addEventListener('click', () => this.close());

            // Close button
            const closeBtn = this.sidebar.querySelector('.fb-chat-sidebar-close');
            closeBtn.addEventListener('click', () => this.close());

            // ESC key to close
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape' && this.isOpen) {
                    this.close();
                }
            });

            // Touch/swipe support for closing (swipe right to close)
            this.sidebar.addEventListener('touchstart', (e) => this.onTouchStart(e), { passive: true });
            this.sidebar.addEventListener('touchmove', (e) => this.onTouchMove(e), { passive: false });
            this.sidebar.addEventListener('touchend', (e) => this.onTouchEnd(e), { passive: true });
        }

        onTouchStart(e) {
            this.touchStartX = e.touches[0].clientX;
            this.touchCurrentX = this.touchStartX;
        }

        onTouchMove(e) {
            if (!this.isOpen) return;

            this.touchCurrentX = e.touches[0].clientX;
            const diff = this.touchCurrentX - this.touchStartX;

            // Only handle right swipe (closing)
            if (diff > 0) {
                const translateX = Math.min(diff, 280);
                this.sidebar.style.transform = `translateX(${translateX}px)`;
                this.sidebar.style.transition = 'none';
                e.preventDefault();
            }
        }

        onTouchEnd(e) {
            if (!this.isOpen) return;

            const diff = this.touchCurrentX - this.touchStartX;
            this.sidebar.style.transition = '';

            if (diff > 80) {
                this.close();
            } else {
                this.sidebar.style.transform = 'translateX(0)';
            }
        }

        open() {
            this.isOpen = true;
            this.sidebar.classList.add('open');
            this.overlay.classList.add('open');
            document.body.classList.add('fb-no-scroll');
            this.loadRecentChats();
        }

        close() {
            this.isOpen = false;
            this.sidebar.classList.remove('open');
            this.overlay.classList.remove('open');
            this.sidebar.style.transform = '';
            document.body.classList.remove('fb-no-scroll');
        }

        toggle() {
            if (this.isOpen) {
                this.close();
            } else {
                this.open();
            }
        }

        async loadRecentChats() {
            const listEl = document.getElementById('fbChatList');
            const roomListEl = document.getElementById('fbRoomList');
            if (!listEl) return;

            try {
                const playerPin = localStorage.getItem('brdc_player_pin');
                if (!playerPin) {
                    listEl.innerHTML = '<div class="fb-chat-empty">Log in to see messages</div>';
                    if (roomListEl) roomListEl.innerHTML = '<div class="fb-chat-empty">Log in to see rooms</div>';
                    return;
                }

                const { callFunction } = await import('/js/firebase-config.js');

                // Load conversations (direct messages)
                try {
                    const convResult = await callFunction('getConversations', {
                        player_pin: playerPin
                    });

                    if (convResult.success && convResult.conversations && convResult.conversations.length > 0) {
                        this.chats = convResult.conversations.map(conv => ({
                            id: conv.id,
                            name: conv.other_participant?.name || 'Unknown',
                            lastMessage: conv.last_message?.text || '',
                            lastMessageTime: conv.updated_at,
                            unread: conv.unread_count > 0,
                            type: 'conversation'
                        }));
                        this.renderChats();
                    } else {
                        listEl.innerHTML = '<div class="fb-chat-empty">No conversations yet</div>';
                    }
                } catch (error) {
                    console.error('Error loading conversations:', error);
                    listEl.innerHTML = '<div class="fb-chat-empty">No conversations yet</div>';
                }

                // Load chatrooms
                if (roomListEl) {
                    try {
                        const roomsResult = await callFunction('getPlayerChatRooms', {
                            player_pin: playerPin
                        });

                        if (roomsResult.success && roomsResult.rooms) {
                            const allRooms = [
                                ...(roomsResult.rooms.league || []),
                                ...(roomsResult.rooms.team || []),
                                ...(roomsResult.rooms.match || []),
                                ...(roomsResult.rooms.tournament || []),
                                ...(roomsResult.rooms.tournament_event || [])
                            ];

                            if (allRooms.length > 0) {
                                this.rooms = allRooms.map(room => ({
                                    id: room.id,
                                    name: room.name,
                                    lastMessage: room.last_message?.text || '',
                                    lastMessageTime: room.last_message?.timestamp,
                                    unread: (room.unread_count || 0) > 0,
                                    type: room.type
                                }));
                                this.renderRooms();
                            } else {
                                roomListEl.innerHTML = '<div class="fb-chat-empty">No chatrooms yet</div>';
                            }
                        } else {
                            roomListEl.innerHTML = '<div class="fb-chat-empty">No chatrooms yet</div>';
                        }
                    } catch (error) {
                        console.error('Error loading rooms:', error);
                        roomListEl.innerHTML = '<div class="fb-chat-empty">No chatrooms yet</div>';
                    }
                }
            } catch (error) {
                console.error('Error loading chats:', error);
                listEl.innerHTML = '<div class="fb-chat-empty">Could not load messages</div>';
            }
        }

        renderChats() {
            const listEl = document.getElementById('fbChatList');
            if (!listEl || !this.chats.length) return;

            let html = '';
            this.chats.forEach(chat => {
                const initials = this.getInitials(chat.name || '?');
                const timeStr = this.formatTimeAgo(chat.lastMessageTime);
                const preview = this.escapeHtml((chat.lastMessage || '').substring(0, 35));
                html += `
                    <a href="/pages/conversation.html?id=${chat.id}" class="fb-chat-item">
                        <div class="fb-chat-item-avatar">${initials}</div>
                        <div class="fb-chat-item-content">
                            <div class="fb-chat-item-name">${this.escapeHtml(chat.name || 'Unknown')}</div>
                            <div class="fb-chat-item-preview">${preview}${chat.lastMessage && chat.lastMessage.length > 35 ? '...' : ''}</div>
                        </div>
                        <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 4px;">
                            ${timeStr ? `<span style="font-size: 10px; color: var(--text-dim);">${timeStr}</span>` : ''}
                            ${chat.unread ? '<div class="fb-chat-item-unread"></div>' : ''}
                        </div>
                    </a>`;
            });
            listEl.innerHTML = html;
        }

        renderRooms() {
            const listEl = document.getElementById('fbRoomList');
            if (!listEl || !this.rooms || !this.rooms.length) return;

            const typeIcons = {
                league: '🏆',
                team: '👥',
                match: '🎯',
                tournament: '🏅',
                tournament_event: '📅'
            };

            let html = '';
            this.rooms.forEach(room => {
                const icon = typeIcons[room.type] || '💬';
                const timeStr = this.formatTimeAgo(room.lastMessageTime);
                const preview = this.escapeHtml((room.lastMessage || '').substring(0, 35));
                html += `
                    <a href="/pages/chat-room.html?id=${room.id}" class="fb-chat-item">
                        <div class="fb-chat-item-avatar" style="font-size: 20px;">${icon}</div>
                        <div class="fb-chat-item-content">
                            <div class="fb-chat-item-name">${this.escapeHtml(room.name || 'Unknown Room')}</div>
                            <div class="fb-chat-item-preview">${preview}${room.lastMessage && room.lastMessage.length > 35 ? '...' : ''}</div>
                        </div>
                        <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 4px;">
                            ${timeStr ? `<span style="font-size: 10px; color: var(--text-dim);">${timeStr}</span>` : ''}
                            ${room.unread ? '<div class="fb-chat-item-unread"></div>' : ''}
                        </div>
                    </a>`;
            });
            listEl.innerHTML = html;
        }

        getInitials(name) {
            if (!name) return '?';
            const parts = name.split(' ');
            if (parts.length >= 2) {
                return (parts[0][0] + parts[1][0]).toUpperCase();
            }
            return name.substring(0, 2).toUpperCase();
        }

        escapeHtml(text) {
            if (!text) return '';
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        }

        formatTimeAgo(timestamp) {
            if (!timestamp) return '';
            const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
            const now = new Date();
            const diff = Math.floor((now - date) / 1000);

            if (diff < 60) return 'now';
            if (diff < 3600) return `${Math.floor(diff / 60)}m`;
            if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
            if (diff < 604800) return `${Math.floor(diff / 86400)}d`;
            return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        }

        destroy() {
            if (this.overlay) {
                this.overlay.remove();
            }
            if (this.sidebar) {
                this.sidebar.remove();
            }
        }
    }

    // Alias for backwards compatibility
    const ChatDropdown = ChatSidebar;


    /**
     * SearchOverlay - Full-screen search
     */
    class SearchOverlay {
        constructor() {
            this.isOpen = false;
            this.overlay = null;
            this.searchTimeout = null;
        }

        init() {
            this.createDOM();
        }

        createDOM() {
            this.overlay = document.createElement('div');
            this.overlay.className = 'fb-search-overlay';
            this.overlay.innerHTML = `
                <div class="fb-search-header">
                    <button class="fb-search-back" aria-label="Close search">&#8592;</button>
                    <div class="fb-search-input-wrapper">
                        <span class="fb-search-icon">🔍</span>
                        <input type="text" class="fb-search-input" id="fbSearchInput" placeholder="Search players, leagues, events...">
                    </div>
                </div>
                <div class="fb-search-results" id="fbSearchResults">
                    <div class="fb-search-empty">Start typing to search</div>
                </div>
            `;
            document.body.appendChild(this.overlay);

            // Back button
            this.overlay.querySelector('.fb-search-back').addEventListener('click', () => this.close());

            // Search input
            const input = document.getElementById('fbSearchInput');
            input.addEventListener('input', (e) => this.onSearchInput(e.target.value));
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Escape') {
                    this.close();
                }
            });
        }

        open() {
            this.isOpen = true;
            this.overlay.classList.add('open');
            document.body.classList.add('fb-no-scroll');

            // Focus input after animation
            setTimeout(() => {
                const input = document.getElementById('fbSearchInput');
                if (input) input.focus();
            }, 100);
        }

        close() {
            this.isOpen = false;
            this.overlay.classList.remove('open');
            document.body.classList.remove('fb-no-scroll');

            // Clear search
            const input = document.getElementById('fbSearchInput');
            if (input) input.value = '';

            const results = document.getElementById('fbSearchResults');
            if (results) results.innerHTML = '<div class="fb-search-empty">Start typing to search</div>';
        }

        toggle() {
            if (this.isOpen) {
                this.close();
            } else {
                this.open();
            }
        }

        onSearchInput(query) {
            clearTimeout(this.searchTimeout);

            if (!query || query.length < 2) {
                document.getElementById('fbSearchResults').innerHTML =
                    '<div class="fb-search-empty">Start typing to search</div>';
                return;
            }

            // Debounce search
            this.searchTimeout = setTimeout(() => {
                this.search(query);
            }, 300);
        }

        async search(query) {
            const resultsEl = document.getElementById('fbSearchResults');
            resultsEl.innerHTML = '<div class="fb-search-empty">Searching...</div>';

            try {
                const { callFunction } = await import('/js/firebase-config.js');
                const result = await callFunction('globalSearch', { query, limit: 20 });

                if (result.success && result.results) {
                    this.renderResults(result.results);
                } else {
                    resultsEl.innerHTML = '<div class="fb-search-empty">No results found</div>';
                }
            } catch (error) {
                console.error('Search error:', error);
                // Fallback to local search simulation
                this.renderLocalResults(query);
            }
        }

        renderResults(results) {
            const resultsEl = document.getElementById('fbSearchResults');

            if (!results || Object.keys(results).length === 0) {
                resultsEl.innerHTML = '<div class="fb-search-empty">No results found</div>';
                return;
            }

            let html = '';

            // Players
            if (results.players && results.players.length) {
                html += '<div class="fb-search-section-title">Players</div>';
                results.players.forEach(player => {
                    html += `
                        <a href="/pages/player-profile.html?id=${player.id}" class="fb-search-result">
                            <div class="fb-search-result-icon">👤</div>
                            <div class="fb-search-result-text">
                                <div class="fb-search-result-title">${player.name}</div>
                                <div class="fb-search-result-subtitle">${player.team || 'Player'}</div>
                            </div>
                        </a>`;
                });
            }

            // Leagues
            if (results.leagues && results.leagues.length) {
                html += '<div class="fb-search-section-title">Leagues</div>';
                results.leagues.forEach(league => {
                    html += `
                        <a href="/pages/league-view.html?league_id=${league.id}" class="fb-search-result">
                            <div class="fb-search-result-icon">🏆</div>
                            <div class="fb-search-result-text">
                                <div class="fb-search-result-title">${league.name}</div>
                                <div class="fb-search-result-subtitle">League</div>
                            </div>
                        </a>`;
                });
            }

            // Events
            if (results.events && results.events.length) {
                html += '<div class="fb-search-section-title">Events</div>';
                results.events.forEach(event => {
                    html += `
                        <a href="/pages/event-view.html?id=${event.id}" class="fb-search-result">
                            <div class="fb-search-result-icon">📅</div>
                            <div class="fb-search-result-text">
                                <div class="fb-search-result-title">${event.name}</div>
                                <div class="fb-search-result-subtitle">${event.date || 'Event'}</div>
                            </div>
                        </a>`;
                });
            }

            resultsEl.innerHTML = html || '<div class="fb-search-empty">No results found</div>';
        }

        renderLocalResults(query) {
            // Local fallback - show quick links
            const resultsEl = document.getElementById('fbSearchResults');
            const lowerQuery = query.toLowerCase();

            let html = '<div class="fb-search-section-title">Quick Links</div>';

            const quickLinks = [
                { icon: '🎯', title: 'Scorer Hub', href: '/pages/scorer-hub.html' },
                { icon: '📅', title: 'Events', href: '/pages/events-hub.html' },
                { icon: '👥', title: 'Members', href: '/pages/members.html' }
            ];

            const matches = quickLinks.filter(link =>
                link.title.toLowerCase().includes(lowerQuery)
            );

            if (matches.length) {
                matches.forEach(link => {
                    html += `
                        <a href="${link.href}" class="fb-search-result">
                            <div class="fb-search-result-icon">${link.icon}</div>
                            <div class="fb-search-result-text">
                                <div class="fb-search-result-title">${link.title}</div>
                            </div>
                        </a>`;
                });
            } else {
                html = '<div class="fb-search-empty">No results found</div>';
            }

            resultsEl.innerHTML = html;
        }

        destroy() {
            if (this.overlay) {
                this.overlay.remove();
            }
        }
    }


    /**
     * NotificationsPanel - Inline notifications panel
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
                    const notifTab = document.querySelector('[data-tab="notifications"]');
                    if (!notifTab || !notifTab.contains(e.target)) {
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

                // Update badge count
                if (window.FBNav && window.FBNav.footer) {
                    const unreadCount = this.notifications.filter(n => !n.read && n.id !== id).length;
                    window.FBNav.footer.setBadge('notifications', unreadCount);
                }
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

                // Clear badge
                if (window.FBNav && window.FBNav.footer) {
                    window.FBNav.footer.setBadge('notifications', 0);
                }
            } catch (error) {
                console.error('Error marking all notifications read:', error);
            }
        }

        destroy() {
            if (this.panel) {
                this.panel.remove();
            }
        }
    }


    /**
     * Get current tab based on URL path
     */
    function getCurrentTab() {
        const path = window.location.pathname;

        if (path.includes('dashboard')) return 'home';
        if (path.includes('events-hub') || path.includes('community-events') || path.includes('event-view')) return 'events';
        if (path.includes('dart-trader')) return 'trader';
        if (path.includes('messages')) return 'chat';
        if (path.includes('player-profile') || path.includes('settings')) return 'profile';

        return 'home';
    }

    /**
     * Logout function
     */
    function logout() {
        // Clear all session data
        localStorage.removeItem('brdc_session');
        localStorage.removeItem('brdc_player_pin');
        localStorage.removeItem('brdc_player_id');
        localStorage.removeItem('brdc_player_name');
        localStorage.removeItem('brdc_player');

        // Redirect to home/login
        window.location.href = '/';
    }

    /**
     * Load unread counts for badges
     */
    async function loadBadgeCounts() {
        try {
            const playerPin = localStorage.getItem('brdc_player_pin');
            if (!playerPin) return;

            const { callFunction } = await import('/js/firebase-config.js');

            // Load notification count
            try {
                const notifResult = await callFunction('getUnreadNotificationCount', { player_pin: playerPin });
                if (notifResult.success && notifResult.count > 0 && window.FBNav.footer) {
                    window.FBNav.footer.setBadge('notifications', notifResult.count);
                }
            } catch (e) {
                // Notification count unavailable
            }

            // Load chat unread count
            try {
                const chatResult = await callFunction('getUnreadCount', { player_pin: playerPin });
                if (chatResult.success && chatResult.total_unread > 0 && window.FBNav.footer) {
                    window.FBNav.footer.setBadge('chat', chatResult.total_unread);
                }
            } catch (e) {
                // Chat count unavailable
            }
        } catch (error) {
            console.error('Error loading badge counts:', error);
        }
    }

    /**
     * Initialize FB Navigation system
     */
    function initFBNav(player) {
        const sidebar = new SidebarMenu();
        const footer = new FooterNav();
        const chatSidebar = new ChatSidebar();
        const search = new SearchOverlay();
        const notifications = new NotificationsPanel();

        // Initialize all components
        sidebar.init();
        footer.init();
        chatSidebar.init();
        search.init();
        notifications.init();

        // Set player data for sidebar
        if (player) {
            sidebar.setPlayer(player);
        }

        // Set active tab based on current page
        footer.setActive(getCurrentTab());

        // Store references
        window.FBNav = {
            sidebar,
            footer,
            chatSidebar,
            chatDropdown: chatSidebar, // backwards compatibility
            search,
            notifications,
            init: initFBNav,
            logout,
            loadBadgeCounts,
            SidebarMenu,
            FooterNav,
            ChatSidebar,
            ChatDropdown: ChatSidebar, // backwards compatibility
            SearchOverlay,
            NotificationsPanel
        };

        // Load badge counts
        loadBadgeCounts();

        return window.FBNav;
    }

    // Export initialization function
    window.FBNav = {
        init: initFBNav,
        logout,
        SidebarMenu,
        FooterNav,
        ChatSidebar,
        ChatDropdown: ChatSidebar, // backwards compatibility
        SearchOverlay,
        NotificationsPanel
    };

})();
