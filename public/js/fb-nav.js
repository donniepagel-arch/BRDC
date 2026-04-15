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

    // Cache helper with stale-while-revalidate pattern
    const CacheHelper = {
        FRESH_TIME: 5 * 60 * 1000,      // 5 minutes
        STALE_TIME: 30 * 60 * 1000,     // 30 minutes

        get(key) {
            try {
                const cached = localStorage.getItem(key);
                if (!cached) return null;
                const { data, timestamp } = JSON.parse(cached);
                const age = Date.now() - timestamp;
                return {
                    data,
                    age,
                    isFresh: age < this.FRESH_TIME,
                    isStale: age >= this.FRESH_TIME && age < this.STALE_TIME,
                    isExpired: age >= this.STALE_TIME
                };
            } catch (e) {
                return null;
            }
        },

        set(key, data) {
            try {
                localStorage.setItem(key, JSON.stringify({
                    data,
                    timestamp: Date.now()
                }));
            } catch (e) {
                console.warn('Cache set failed:', e);
            }
        },

        clear(key) {
            localStorage.removeItem(key);
        }
    };

    // Menu items configuration by section
    const MENU_ITEMS = {
        quickLinks: [
            { icon: 'target', label: 'Scorer', href: '/pages/game-setup.html' },
            { icon: 'users', label: 'Members', href: '/pages/members.html' },
            { icon: 'shopping-bag', label: 'Dart Trader', href: '/pages/dart-trader.html' }
        ],
        manage: [
            { icon: 'clipboard', label: 'Captain Dashboard', href: '/pages/captain-dashboard.html', role: 'captain' },
            { icon: 'settings', label: 'League Director', href: '/pages/league-director.html', role: 'director' },
            { icon: 'shield', label: 'Site Admin', href: '/pages/admin.html', role: 'master_admin' }
        ],
        bottom: [
            { icon: 'log-out', label: 'Logout', action: 'logout' }
        ]
    };

    // Inline SVG icons (Lucide/Feather style, 20x20, stroke-based)
    const SVG_ICONS = {
        target: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>',
        users: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
        'shopping-bag': '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>',
        book: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>',
        clipboard: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></svg>',
        settings: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
        shield: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>',
        'log-out': '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>',
        trophy: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>',
        medal: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7.21 15 2.66 7.14a2 2 0 0 1 .13-2.2L4.4 2.8A2 2 0 0 1 6 2h12a2 2 0 0 1 1.6.8l1.6 2.14a2 2 0 0 1 .14 2.2L16.79 15"/><path d="M11 12 5.12 2.2"/><path d="m13 12 5.88-9.8"/><path d="M8 7h8"/><circle cx="12" cy="17" r="5"/><path d="M12 18v-2h-.5"/></svg>',
        'chevron-down': '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>',
        'chevron-right': '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>',
        search: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>',
        chat: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',
        home: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>'
    };

    // Footer tabs configuration
    const FOOTER_TABS = [
        { id: 'home', icon: '🏠', label: 'Home', href: '/pages/dashboard.html' },
        { id: 'events', icon: '📅', label: 'Events', href: '/pages/events-hub.html' },
        { id: 'chat', icon: '💬', label: 'Chat', href: '/pages/messages.html' },
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

        .fb-sidebar-user-link {
            display: flex;
            align-items: center;
            gap: 12px;
            text-decoration: none;
            color: inherit;
            flex: 1;
            min-width: 0;
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
            padding: 6px 16px 2px;
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
            gap: 12px;
            padding: 10px 16px;
            color: ${CSS_VARS.textLight};
            text-decoration: none;
            border-radius: 8px;
            margin: 1px 8px;
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
            background: rgba(255, 70, 154, 0.15);
            color: ${CSS_VARS.pink};
            border-left: 3px solid ${CSS_VARS.pink};
            padding-left: 13px;
        }

        .fb-sidebar-item-icon {
            width: 20px;
            height: 20px;
            display: flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
        }

        .fb-sidebar-item-icon svg {
            width: 20px;
            height: 20px;
            stroke: currentColor;
            fill: none;
            stroke-width: 2;
            stroke-linecap: round;
            stroke-linejoin: round;
        }

        .fb-sidebar-item-label {
            font-size: 15px;
            font-weight: 500;
        }

        .fb-sidebar-item.highlight {
            background: linear-gradient(135deg, rgba(255, 70, 154, 0.3), rgba(255, 70, 154, 0.15));
            border: 1px solid rgba(255, 70, 154, 0.5);
            font-weight: 600;
        }

        .fb-sidebar-item.highlight:hover {
            background: linear-gradient(135deg, rgba(255, 70, 154, 0.4), rgba(255, 70, 154, 0.25));
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

        .fb-sidebar-item-detail {
            display: flex;
            flex-direction: column;
            gap: 1px;
        }
        .fb-sidebar-item-sublabel {
            font-size: 11px;
            color: var(--yellow, #FDD835);
            opacity: 0.8;
        }
        .fb-sidebar-item:hover .fb-sidebar-item-sublabel {
            opacity: 1;
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

        /* ===== SKELETON LOADERS (CHAT) ===== */
        .skeleton-chat-item {
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 12px 16px;
        }

        .skeleton-chat-avatar {
            width: 40px;
            height: 40px;
            border-radius: 50%;
            background: linear-gradient(90deg, ${CSS_VARS.bgCard} 25%, ${CSS_VARS.bgPanel} 50%, ${CSS_VARS.bgCard} 75%);
            background-size: 200% 100%;
            animation: shimmer 1.5s infinite;
            flex-shrink: 0;
        }

        .skeleton-chat-content {
            flex: 1;
            min-width: 0;
        }

        .skeleton-chat-name {
            height: 14px;
            width: 60%;
            background: linear-gradient(90deg, ${CSS_VARS.bgCard} 25%, ${CSS_VARS.bgPanel} 50%, ${CSS_VARS.bgCard} 75%);
            background-size: 200% 100%;
            animation: shimmer 1.5s infinite;
            border-radius: 4px;
            margin-bottom: 6px;
        }

        .skeleton-chat-preview {
            height: 12px;
            width: 80%;
            background: linear-gradient(90deg, ${CSS_VARS.bgCard} 25%, ${CSS_VARS.bgPanel} 50%, ${CSS_VARS.bgCard} 75%);
            background-size: 200% 100%;
            animation: shimmer 1.5s infinite;
            border-radius: 4px;
        }

        @keyframes shimmer {
            0% { background-position: 200% 0; }
            100% { background-position: -200% 0; }
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

        /* ===== ACCORDION SECTIONS ===== */
        .fb-sidebar-accordion {
            border-bottom: 1px solid rgba(255,255,255,0.05);
        }

        .fb-sidebar-accordion-header {
            display: flex;
            align-items: center;
            width: 100%;
            padding: 10px 16px;
            background: none;
            border: none;
            color: ${CSS_VARS.textDim};
            font-size: 11px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 1.5px;
            cursor: pointer;
            transition: color 0.2s;
            -webkit-tap-highlight-color: transparent;
        }

        .fb-sidebar-accordion-header:hover {
            color: ${CSS_VARS.textLight};
        }

        .fb-sidebar-accordion-title {
            flex: 1;
            text-align: left;
        }

        .fb-sidebar-accordion-chevron {
            display: flex;
            align-items: center;
        }

        .fb-sidebar-accordion-chevron svg {
            width: 16px;
            height: 16px;
            stroke: currentColor;
            fill: none;
            transition: transform 0.2s;
        }

        .fb-sidebar-badge {
            background: ${CSS_VARS.pink};
            color: white;
            font-size: 10px;
            font-weight: 700;
            padding: 1px 6px;
            border-radius: 10px;
            margin-right: 8px;
        }

        .fb-sidebar-accordion-body {
            overflow: hidden;
            transition: all 0.2s ease;
        }

        /* ===== SEARCH BAR ===== */
        .fb-sidebar-search {
            padding: 10px 16px 6px;
            position: relative;
        }

        .fb-sidebar-search-input {
            width: 100%;
            padding: 8px 12px 8px 36px;
            background: rgba(255,255,255,0.08);
            border: 1px solid rgba(255,255,255,0.15);
            border-radius: 8px;
            color: ${CSS_VARS.textLight};
            font-size: 13px;
            outline: none;
            transition: border-color 0.2s;
            box-sizing: border-box;
        }

        .fb-sidebar-search-input:focus {
            border-color: ${CSS_VARS.teal};
        }

        .fb-sidebar-search-input::placeholder {
            color: ${CSS_VARS.textDim};
        }

        .fb-sidebar-search-icon {
            position: absolute;
            left: 28px;
            top: 50%;
            transform: translateY(-50%);
            display: flex;
            pointer-events: none;
        }

        .fb-sidebar-search-icon svg {
            width: 16px;
            height: 16px;
            stroke: ${CSS_VARS.textDim};
            fill: none;
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
                    <a href="/pages/dashboard.html" class="fb-sidebar-user-link">
                        <div class="fb-sidebar-avatar" id="fbSidebarAvatar">?</div>
                        <div class="fb-sidebar-user-info">
                            <div class="fb-sidebar-user-name" id="fbSidebarUserName">Guest</div>
                            <div class="fb-sidebar-user-role" id="fbSidebarUserRole">Player</div>
                        </div>
                    </a>
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

                if (avatarEl) avatarEl.textContent = initials;
                if (nameEl) nameEl.textContent = name;

                // Determine role
                let role = 'Player';
                if (this.player.is_admin || this.player.is_master_admin) {
                    role = 'Admin';
                } else if (this.player.is_director) {
                    role = 'Director';
                } else if (this.player.is_captain) {
                    role = 'Captain';
                }
                if (roleEl) roleEl.textContent = role;

                // Avatar image if available (photo_url is the canonical field; avatar_url is legacy)
                const photoUrl = this.player.photo_url || this.player.avatar_url;
                if (photoUrl && avatarEl) {
                    avatarEl.innerHTML = `<img src="${photoUrl}" alt="${name}">`;
                }
            } else {
                // Guest/default values
                if (avatarEl) avatarEl.textContent = '?';
                if (nameEl) nameEl.textContent = 'Guest';
                if (roleEl) roleEl.textContent = 'Player';
            }
        }

        generateContent() {
            const contentEl = document.getElementById('fbSidebarContent');
            if (!contentEl) return;

            let html = '';

            // 1. Search bar
            html += this.renderSearchBar();

            // 2. Dashboard link
            const isHome = window.location.pathname.includes('dashboard');
            html += `<div class="fb-sidebar-section fb-sidebar-dashboard">
                <a href="/pages/dashboard.html" class="fb-sidebar-item ${isHome ? 'active' : ''}">
                    <span class="fb-sidebar-item-icon">${SVG_ICONS.home}</span>
                    <span class="fb-sidebar-item-label">Dashboard</span>
                </a>
            </div>`;

            // 3. My Leagues placeholder (populated async by loadInvolvements)
            html += '<div id="fbSidebarLeagues"></div>';

            // 3. My Tournaments placeholder (populated async)
            html += '<div id="fbSidebarTournaments"></div>';

            // 4. Quick Links (flat section)
            html += this.renderFlatSection('Quick Links', MENU_ITEMS.quickLinks);

            // 5. Manage (role-filtered) — rendered via placeholder only
            // Roles may be discovered async (e.g. captain from involvements),
            // so all Manage rendering goes through the single placeholder.
            html += '<div id="fbSidebarManage"></div>';

            // 6. Logout (always, at bottom with divider)
            html += this.renderLogoutSection();

            contentEl.innerHTML = html;

            // Attach click handlers for action items
            contentEl.querySelectorAll('[data-action]').forEach(el => {
                el.addEventListener('click', (e) => {
                    e.preventDefault();
                    const action = el.dataset.action;
                    this.handleAction(action);
                });
            });

            // Attach search handler
            const searchInput = contentEl.querySelector('.fb-sidebar-search-input');
            if (searchInput) {
                searchInput.addEventListener('input', (e) => this.filterItems(e.target.value));
                searchInput.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter' && e.target.value.trim()) {
                        // Open full search overlay
                        this.close();
                        if (window.FBNav && window.FBNav.search) {
                            window.FBNav.search.open();
                            setTimeout(() => {
                                const searchEl = document.getElementById('fbSearchInput');
                                if (searchEl) {
                                    searchEl.value = e.target.value;
                                    searchEl.dispatchEvent(new Event('input'));
                                }
                            }, 150);
                        }
                    }
                });
            }

            // Load dynamic involvements
            this.loadInvolvements();
        }

        hasRole(role) {
            if (!this.player) return false;
            switch (role) {
                case 'captain': return this.player.is_captain ||
                    (this.player.involvements?.leagues || []).some(l => l.role === 'captain');
                case 'director': return this.player.is_director || this.player.is_admin || this.player.is_master_admin;
                case 'master_admin': return this.player.is_master_admin;
                default: return false;
            }
        }

        renderSearchBar() {
            return '<div class="fb-sidebar-search">' +
                '<span class="fb-sidebar-search-icon">' + SVG_ICONS.search + '</span>' +
                '<input type="text" class="fb-sidebar-search-input" placeholder="Search players, leagues...">' +
                '</div>';
        }

        renderLogoutSection() {
            const icon = SVG_ICONS['log-out'] || '';
            return '<div class="fb-sidebar-section" style="border-top: 1px solid rgba(255,255,255,0.1); margin-top: 8px; padding-top: 8px;">' +
                '<a class="fb-sidebar-item logout" data-action="logout">' +
                '<span class="fb-sidebar-item-icon">' + icon + '</span>' +
                '<span class="fb-sidebar-item-label">Logout</span>' +
                '</a>' +
                '</div>';
        }

        renderAccordionSection(title, items, expanded) {
            const id = title.replace(/\s+/g, '-').toLowerCase();

            // Check localStorage for saved state
            try {
                const saved = JSON.parse(localStorage.getItem('brdc_sidebar_accordions') || '{}');
                if (saved[id] !== undefined) {
                    expanded = saved[id];
                }
            } catch (e) {}

            const actualDisplay = expanded ? 'block' : 'none';
            const actualChevron = expanded ? SVG_ICONS['chevron-down'] : SVG_ICONS['chevron-right'];
            const count = items.length;

            let html = '<div class="fb-sidebar-accordion">' +
                '<button class="fb-sidebar-accordion-header" data-accordion="' + id + '" aria-expanded="' + expanded + '">' +
                '<span class="fb-sidebar-accordion-title">' + title + '</span>' +
                '<span class="fb-sidebar-accordion-chevron" data-chevron="' + id + '">' + actualChevron + '</span>' +
                '</button>' +
                '<div class="fb-sidebar-accordion-body" id="accordion-' + id + '" style="display: ' + actualDisplay + ';">';

            items.forEach(item => {
                html += item;
            });

            html += '</div></div>';
            return html;
        }

        attachAccordionHandlers(container) {
            container.querySelectorAll('.fb-sidebar-accordion-header').forEach(header => {
                header.addEventListener('click', () => {
                    const id = header.dataset.accordion;
                    const body = document.getElementById('accordion-' + id);
                    if (!body) return;
                    const isOpen = body.style.display !== 'none';

                    body.style.display = isOpen ? 'none' : 'block';
                    const chevron = header.querySelector('[data-chevron="' + id + '"]');
                    if (chevron) {
                        chevron.innerHTML = isOpen ? SVG_ICONS['chevron-right'] : SVG_ICONS['chevron-down'];
                    }
                    header.setAttribute('aria-expanded', String(!isOpen));

                    // Save state
                    try {
                        const saved = JSON.parse(localStorage.getItem('brdc_sidebar_accordions') || '{}');
                        saved[id] = !isOpen;
                        localStorage.setItem('brdc_sidebar_accordions', JSON.stringify(saved));
                    } catch (e) {}
                });
            });
        }

        filterItems(query) {
            const lowerQuery = query.toLowerCase().trim();
            const contentEl = document.getElementById('fbSidebarContent');
            if (!contentEl) return;

            // Filter sidebar items by label text
            contentEl.querySelectorAll('.fb-sidebar-item').forEach(item => {
                const label = item.querySelector('.fb-sidebar-item-label');
                if (!label) return;
                const text = label.textContent.toLowerCase();
                if (!lowerQuery || text.includes(lowerQuery)) {
                    item.style.display = '';
                } else {
                    item.style.display = 'none';
                }
            });

            // Also show/hide accordion sections if all children hidden
            contentEl.querySelectorAll('.fb-sidebar-accordion').forEach(accordion => {
                const visibleItems = accordion.querySelectorAll('.fb-sidebar-item:not([style*="display: none"])');
                const body = accordion.querySelector('.fb-sidebar-accordion-body');
                if (lowerQuery && visibleItems.length > 0 && body) {
                    body.style.display = 'block';
                }
                accordion.style.display = (lowerQuery && visibleItems.length === 0) ? 'none' : '';
            });

            // Show/hide flat sections
            contentEl.querySelectorAll('.fb-sidebar-section').forEach(section => {
                const visibleItems = section.querySelectorAll('.fb-sidebar-item:not([style*="display: none"])');
                if (lowerQuery && visibleItems.length === 0) {
                    section.style.display = 'none';
                } else {
                    section.style.display = '';
                }
            });
        }

        renderFlatSection(title, items) {
            const currentPath = window.location.pathname;

            let html = '<div class="fb-sidebar-section">' +
                '<div class="fb-sidebar-section-title">' + title + '</div>';

            items.forEach(item => {
                const isActive = item.href && currentPath.includes(item.href.replace('/pages/', ''));
                const icon = SVG_ICONS[item.icon] || '';
                const isLogout = item.action === 'logout';

                if (item.action) {
                    html += '<a class="fb-sidebar-item ' + (isLogout ? 'logout' : '') + '" data-action="' + item.action + '">' +
                        '<span class="fb-sidebar-item-icon">' + icon + '</span>' +
                        '<span class="fb-sidebar-item-label">' + item.label + '</span>' +
                        '</a>';
                } else {
                    html += '<a href="' + item.href + '" class="fb-sidebar-item ' + (isActive ? 'active' : '') + '">' +
                        '<span class="fb-sidebar-item-icon">' + icon + '</span>' +
                        '<span class="fb-sidebar-item-label">' + item.label + '</span>' +
                        '</a>';
                }
            });

            html += '</div>';
            return html;
        }

        renderSection(title, items) {
            // Legacy method kept for backward compatibility
            return this.renderFlatSection(title, items);
        }

        handleAction(action) {
            switch (action) {
                case 'logout':
                    this.close();
                    window.FBNav.logout();
                    break;
                default:
            }
        }

        async loadInvolvements() {
            let session;
            try {
                session = JSON.parse(localStorage.getItem('brdc_session') || '{}');
                if (!session.player_id) return;
            } catch (e) { return; }

            let involvements = session.involvements;

            // If session doesn't have involvements, fetch via getPlayerInvolvements
            if (!involvements || (!involvements.leagues?.length && !involvements.tournaments?.length)) {
                try {
                    const { callFunction } = await import('/js/firebase-config.js');
                    const result = await callFunction('getPlayerInvolvements', {});
                    if (result.success && result.player && result.player.involvements) {
                        involvements = result.player.involvements;
                        session.involvements = involvements;
                        localStorage.setItem('brdc_session', JSON.stringify(session));
                    }
                } catch (err) {
                    console.warn('[FBNav] Could not fetch involvements:', err);
                }
            }

            if (!involvements) return;

            const currentParams = new URLSearchParams(window.location.search);

            // Render leagues as accordion
            const leagues = involvements.leagues || [];
            if (leagues.length > 0) {
                const container = document.getElementById('fbSidebarLeagues');
                if (container) {
                    const leagueItems = leagues.map(item => {
                        const href = '/pages/league-view.html?league_id=' + item.id;
                        const isActive = currentParams.get('league_id') === item.id;
                        const sublabel = item.team_name || '';
                        return '<a href="' + href + '" class="fb-sidebar-item ' + (isActive ? 'active' : '') + '">' +
                            '<span class="fb-sidebar-item-icon">' + SVG_ICONS.trophy + '</span>' +
                            '<span class="fb-sidebar-item-detail">' +
                            '<span class="fb-sidebar-item-label">' + this.escapeHtml(item.name) + '</span>' +
                            (sublabel ? '<span class="fb-sidebar-item-sublabel">' + this.escapeHtml(sublabel) + '</span>' : '') +
                            '</span></a>';
                    });
                    container.innerHTML = this.renderAccordionSection('My Leagues', leagueItems, true);
                    this.attachAccordionHandlers(container);
                }
            }

            // Render tournaments as accordion
            const tournaments = involvements.tournaments || [];
            if (tournaments.length > 0) {
                const container = document.getElementById('fbSidebarTournaments');
                if (container) {
                    const tournamentItems = tournaments.map(item => {
                        const href = '/pages/tournament-view.html?tournament_id=' + item.id;
                        const isActive = currentParams.get('tournament_id') === item.id;
                        const sublabel = item.event_name || item.status || '';
                        return '<a href="' + href + '" class="fb-sidebar-item ' + (isActive ? 'active' : '') + '">' +
                            '<span class="fb-sidebar-item-icon">' + SVG_ICONS.medal + '</span>' +
                            '<span class="fb-sidebar-item-detail">' +
                            '<span class="fb-sidebar-item-label">' + this.escapeHtml(item.name) + '</span>' +
                            (sublabel ? '<span class="fb-sidebar-item-sublabel">' + this.escapeHtml(sublabel) + '</span>' : '') +
                            '</span></a>';
                    });
                    container.innerHTML = this.renderAccordionSection('My Tournaments', tournamentItems, false);
                    this.attachAccordionHandlers(container);
                }
            }

            // Inject Manage section (single render point — combines sync roles + async captain discovery)
            const hasCaptainRole = leagues.some(l => l.role === 'captain');
            const manageContainer = document.getElementById('fbSidebarManage');
            if (manageContainer && manageContainer.innerHTML.trim() === '') {
                const manageItems = MENU_ITEMS.manage.filter(item => {
                    if (item.role === 'captain') return hasCaptainRole || this.hasRole('captain');
                    return this.hasRole(item.role);
                });
                if (manageItems.length > 0) {
                    manageContainer.innerHTML = this.renderFlatSection('Manage', manageItems);
                    // Attach action handlers
                    manageContainer.querySelectorAll('[data-action]').forEach(el => {
                        el.addEventListener('click', (e) => {
                            e.preventDefault();
                            this.handleAction(el.dataset.action);
                        });
                    });
                }
            }
        }

        renderInvolvementSection(title, items, type, icon) {
            // Legacy method kept for backward compatibility
            const currentParams = new URLSearchParams(window.location.search);
            const paramKey = type === 'league' ? 'league_id' : 'tournament_id';

            const itemsHtml = items.map(item => {
                const href = type === 'league'
                    ? '/pages/league-view.html?league_id=' + item.id
                    : '/pages/tournament-view.html?tournament_id=' + item.id;
                const isActive = currentParams.get(paramKey) === item.id;
                const sublabel = type === 'league'
                    ? (item.team_name || '')
                    : (item.event_name || item.status || '');
                const svgIcon = type === 'league' ? SVG_ICONS.trophy : SVG_ICONS.medal;
                return '<a href="' + href + '" class="fb-sidebar-item ' + (isActive ? 'active' : '') + '">' +
                    '<span class="fb-sidebar-item-icon">' + svgIcon + '</span>' +
                    '<span class="fb-sidebar-item-detail">' +
                    '<span class="fb-sidebar-item-label">' + this.escapeHtml(item.name) + '</span>' +
                    (sublabel ? '<span class="fb-sidebar-item-sublabel">' + this.escapeHtml(sublabel) + '</span>' : '') +
                    '</span></a>';
            });

            return this.renderAccordionSection(title, itemsHtml, type === 'league');
        }

        escapeHtml(str) {
            if (!str) return '';
            const div = document.createElement('div');
            div.textContent = str;
            return div.innerHTML;
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

        async callFunctionWithTimeout(functionName, data = {}, timeoutMs = 8000) {
            const { callFunction } = await import('/js/firebase-config.js');

            return await Promise.race([
                callFunction(functionName, data),
                new Promise((_, reject) => {
                    setTimeout(() => reject(new Error(`${functionName} timed out after ${timeoutMs}ms`)), timeoutMs);
                })
            ]);
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
                    ${this.getSkeletonHTML()}
                </div>
                <div class="fb-chat-sidebar-list" id="fbRoomList" style="display: none;">
                    ${this.getSkeletonHTML()}
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
                const session = JSON.parse(localStorage.getItem('brdc_session') || '{}');
                const playerId = session.player_id;
                if (!playerId) {
                    listEl.innerHTML = '<div class="fb-chat-empty">Log in to see messages</div>';
                    if (roomListEl) roomListEl.innerHTML = '<div class="fb-chat-empty">Log in to see rooms</div>';
                    return;
                }

                const chatCacheKey = `chat_conversations_${playerId}`;
                const roomCacheKey = `chat_rooms_${playerId}`;
                const chatCache = CacheHelper.get(chatCacheKey);
                const roomCache = CacheHelper.get(roomCacheKey);

                // Show cached data immediately if available (fresh or stale)
                if (chatCache && (chatCache.isFresh || chatCache.isStale)) {
                    this.chats = chatCache.data;
                    this.renderChats();
                }
                if (roomCache && (roomCache.isFresh || roomCache.isStale)) {
                    this.rooms = roomCache.data;
                    this.renderRooms();
                }

                // If cache is fresh, skip API calls
                if (chatCache && chatCache.isFresh && roomCache && roomCache.isFresh) {
                    return;
                }

                // Load conversations (direct messages) - fetch if no cache or stale/expired
                if (!chatCache || chatCache.isStale || chatCache.isExpired) {
                    try {
                        const convResult = await this.callFunctionWithTimeout('getConversations', {});

                        if (convResult.success) {
                            this.chats = (convResult.conversations || []).map(conv => ({
                                id: conv.id,
                                name: conv.other_participant?.name || 'Unknown',
                                lastMessage: conv.last_message?.text || '',
                                lastMessageTime: conv.updated_at,
                                unread: conv.unread_count > 0,
                                type: 'conversation'
                            }));
                            CacheHelper.set(chatCacheKey, this.chats);
                            this.renderChats();
                        } else {
                            this.chats = [];
                            listEl.innerHTML = '<div class="fb-chat-empty">No conversations yet</div>';
                        }
                    } catch (error) {
                        console.error('Error loading conversations:', error);
                        if (!chatCache) {
                            this.chats = [];
                            listEl.innerHTML = '<div class="fb-chat-empty">No conversations yet</div>';
                        }
                    }
                }

                // Load chatrooms - fetch if no cache or stale/expired
                if (roomListEl && (!roomCache || roomCache.isStale || roomCache.isExpired)) {
                    try {
                        const roomsResult = await this.callFunctionWithTimeout('getPlayerChatRooms', {});

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
                                    lastMessageTime: room.updated_at || room.last_message?.timestamp || null,
                                    unread: (room.unread_count || 0) > 0,
                                    type: room.type
                                }));
                                CacheHelper.set(roomCacheKey, this.rooms);
                                this.renderRooms();
                            } else {
                                this.rooms = [];
                                roomListEl.innerHTML = '<div class="fb-chat-empty">No chatrooms yet</div>';
                            }
                        } else {
                            this.rooms = [];
                            roomListEl.innerHTML = '<div class="fb-chat-empty">No chatrooms yet</div>';
                        }
                    } catch (error) {
                        console.error('Error loading rooms:', error);
                        if (!roomCache) {
                            this.rooms = [];
                            roomListEl.innerHTML = '<div class="fb-chat-empty">No chatrooms yet</div>';
                        }
                    }
                }
            } catch (error) {
                console.error('Error loading chats:', error);
                listEl.innerHTML = '<div class="fb-chat-empty">Could not load messages</div>';
            }
        }

        renderChats() {
            const listEl = document.getElementById('fbChatList');
            if (!listEl) return;
            if (!this.chats || !this.chats.length) {
                listEl.innerHTML = '<div class="fb-chat-empty">No conversations yet</div>';
                return;
            }

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
            if (!listEl) return;
            if (!this.rooms || !this.rooms.length) {
                listEl.innerHTML = '<div class="fb-chat-empty">No chatrooms yet</div>';
                return;
            }

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

        getSkeletonHTML() {
            let html = '';
            for (let i = 0; i < 5; i++) {
                html += `
                    <div class="skeleton-chat-item">
                        <div class="skeleton-chat-avatar"></div>
                        <div class="skeleton-chat-content">
                            <div class="skeleton-chat-name"></div>
                            <div class="skeleton-chat-preview"></div>
                        </div>
                    </div>`;
            }
            return html;
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
                { icon: '🎯', title: 'Scorer', href: '/pages/game-setup.html' },
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
                const playerId = JSON.parse(localStorage.getItem('brdc_session') || '{}').player_id;
                if (!playerId) {
                    listEl.innerHTML = '<div class="fb-notifications-empty">Log in to see notifications</div>';
                    return;
                }

                const { callFunction } = await import('/js/firebase-config.js');
                const result = await callFunction('getNotifications', {
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
                const playerId = JSON.parse(localStorage.getItem('brdc_session') || '{}').player_id;
                if (!playerId) return;

                const { callFunction } = await import('/js/firebase-config.js');
                await callFunction('markAllNotificationsRead', {});

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
        if (path.includes('message') || path.includes('conversation') || path.includes('chat-room')) return 'chat';
        if (path.includes('dart-trader')) return 'trader';
        if (path.includes('player-profile') || path.includes('settings')) return 'profile';

        return 'home';
    }

    /**
     * Logout function
     */
    function logout() {
        // Clear all session data
        localStorage.removeItem('brdc_session');
        localStorage.removeItem('brdc_player_id');
        localStorage.removeItem('brdc_player_name');
        localStorage.removeItem('brdc_player');

        // Redirect to login page
        window.location.href = '/pages/dashboard.html';
    }

    /**
     * Load unread counts for badges
     */
    async function loadBadgeCounts() {
        try {
            const playerId = JSON.parse(localStorage.getItem('brdc_session') || '{}').player_id;
            if (!playerId) return;

            const { callFunction } = await import('/js/firebase-config.js');

            // Load notification count
            try {
                const notifResult = await callFunction('getUnreadNotificationCount', {});
                if (notifResult.success && notifResult.count > 0 && window.FBNav.footer) {
                    window.FBNav.footer.setBadge('notifications', notifResult.count);
                }
            } catch (e) {
                // Notification count unavailable
            }

            // Load chat unread count
            try {
                const chatResult = await callFunction('getUnreadCount', {});
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

        // Set player data for sidebar (always generate content, even without player)
        sidebar.setPlayer(player || null);
        sidebar.generateContent();

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
