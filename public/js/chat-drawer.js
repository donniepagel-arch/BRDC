/**
 * BRDC Chat Drawer - Site-wide swipe-to-open chat sidebar
 *
 * Provides a right-side sliding chat drawer with:
 * - Right-edge swipe-to-open gesture
 * - Swipe-to-close from within the drawer
 * - CHATS/ROOMS tabs with cloud function data loading
 * - Accordion-style inline chat (click item to expand messages below it)
 * - Multiple accordions can be open simultaneously
 * - Stale-while-revalidate caching
 * - Replaces fb-nav.js ChatSidebar if already created (ensures inline chat works everywhere)
 * - Opt-out via data-no-chat-drawer body attribute
 *
 * Loaded by brdc-navigation-init.js after navigation is initialized.
 */

(function() {
    'use strict';

    // CSS Variables matching BRDC design system
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
        FRESH_TIME: 5 * 60 * 1000,
        STALE_TIME: 30 * 60 * 1000,

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
                localStorage.setItem(key, JSON.stringify({ data, timestamp: Date.now() }));
            } catch (e) {
                console.warn('[ChatDrawer] Cache set failed:', e);
            }
        },

        clear(key) { localStorage.removeItem(key); }
    };

    // Inject CSS (dedup check)
    function injectStyles() {
        if (document.getElementById('chat-drawer-styles')) return;

        const styles = document.createElement('style');
        styles.id = 'chat-drawer-styles';
        styles.textContent = `
            /* ===== CHAT DRAWER SIDEBAR (RIGHT) ===== */
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
                top: 0; left: 0; right: 0; bottom: 0;
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
                flex-shrink: 0;
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

            .fb-chat-sidebar-tabs {
                display: flex;
                border-bottom: 1px solid rgba(255,255,255,0.1);
                flex-shrink: 0;
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
                flex-shrink: 0;
            }

            .fb-chat-sidebar-see-all {
                color: ${CSS_VARS.teal};
                text-decoration: none;
                font-size: 13px;
                font-weight: 600;
            }

            .fb-chat-sidebar-see-all:hover { text-decoration: underline; }

            /* ===== CHAT LIST ITEMS ===== */
            .fb-chat-item {
                display: flex;
                align-items: center;
                gap: 12px;
                padding: 11px 16px;
                cursor: pointer;
                transition: background 0.15s;
                user-select: none;
            }

            .fb-chat-item:hover {
                background: rgba(255,255,255,0.05);
            }

            .fb-chat-item.fb-chat-item-open {
                background: rgba(255,255,255,0.07);
                border-bottom: none;
            }

            .fb-chat-item-avatar {
                width: 38px;
                height: 38px;
                border-radius: 50%;
                background: ${CSS_VARS.pink};
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 14px;
                font-weight: 700;
                color: white;
                flex-shrink: 0;
            }

            .fb-chat-item-content {
                flex: 1;
                min-width: 0;
            }

            .fb-chat-item-name {
                font-weight: 600;
                font-size: 13px;
                color: ${CSS_VARS.textLight};
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }

            .fb-chat-item-preview {
                font-size: 11px;
                color: ${CSS_VARS.textDim};
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }

            .fb-chat-item-unread {
                width: 9px;
                height: 9px;
                background: ${CSS_VARS.pink};
                border-radius: 50%;
                flex-shrink: 0;
            }

            .fb-chat-item-chevron {
                font-size: 10px;
                color: ${CSS_VARS.textDim};
                flex-shrink: 0;
                transition: transform 0.2s;
                display: inline-block;
            }

            .fb-chat-item.fb-chat-item-open .fb-chat-item-chevron {
                transform: rotate(90deg);
                color: ${CSS_VARS.teal};
            }

            .fb-chat-empty {
                padding: 30px 20px;
                text-align: center;
                color: ${CSS_VARS.textDim};
                font-size: 14px;
            }

            /* ===== ACCORDION PANEL ===== */
            .fb-chat-accordion {
                max-height: 0;
                overflow: hidden;
                transition: max-height 0.25s ease-out;
                background: rgba(0,0,0,0.2);
                border-bottom: 1px solid rgba(255,255,255,0.06);
            }

            .fb-chat-accordion.open {
                max-height: 320px;
            }

            .fb-chat-acc-messages {
                height: 200px;
                overflow-y: auto;
                -webkit-overflow-scrolling: touch;
                padding: 8px 12px;
                display: flex;
                flex-direction: column;
                gap: 4px;
            }

            .fb-chat-acc-loading {
                height: 200px;
                display: flex;
                align-items: center;
                justify-content: center;
                color: ${CSS_VARS.textDim};
                font-size: 12px;
            }

            /* Accordion message bubbles */
            .fb-chat-msg {
                display: flex;
                flex-direction: column;
                max-width: 88%;
            }
            .fb-chat-msg.sent {
                align-self: flex-end;
                align-items: flex-end;
            }
            .fb-chat-msg.received {
                align-self: flex-start;
                align-items: flex-start;
            }

            .fb-chat-msg-sender {
                font-size: 9px;
                color: ${CSS_VARS.teal};
                margin-bottom: 2px;
                padding: 0 3px;
            }

            .fb-chat-msg-bubble {
                padding: 6px 10px;
                border-radius: 12px;
                font-size: 12px;
                line-height: 1.4;
                word-break: break-word;
            }
            .fb-chat-msg.sent .fb-chat-msg-bubble {
                background: ${CSS_VARS.pink};
                color: white;
                border-bottom-right-radius: 3px;
            }
            .fb-chat-msg.received .fb-chat-msg-bubble {
                background: ${CSS_VARS.bgCard};
                color: ${CSS_VARS.textLight};
                border-bottom-left-radius: 3px;
            }

            .fb-chat-msg-time {
                font-size: 9px;
                color: ${CSS_VARS.textDim};
                margin-top: 1px;
                padding: 0 3px;
            }

            .fb-chat-date-divider {
                text-align: center;
                margin: 6px 0 2px;
                font-size: 9px;
                color: ${CSS_VARS.textDim};
            }

            /* Accordion footer: open-link + input row */
            .fb-chat-acc-footer {
                border-top: 1px solid rgba(255,255,255,0.08);
                padding: 6px 10px;
                display: flex;
                align-items: center;
                gap: 6px;
            }

            .fb-chat-acc-open-link {
                color: ${CSS_VARS.textDim};
                text-decoration: none;
                font-size: 14px;
                flex-shrink: 0;
                padding: 2px 4px;
                border-radius: 4px;
                transition: color 0.15s;
                line-height: 1;
            }
            .fb-chat-acc-open-link:hover { color: ${CSS_VARS.teal}; }

            .fb-chat-acc-input {
                flex: 1;
                min-height: 30px;
                max-height: 72px;
                padding: 5px 10px;
                background: rgba(255,255,255,0.06);
                border: 1px solid rgba(255,255,255,0.1);
                border-radius: 15px;
                color: ${CSS_VARS.textLight};
                font-size: 12px;
                font-family: inherit;
                resize: none;
                outline: none;
                transition: border-color 0.2s;
                line-height: 1.4;
            }
            .fb-chat-acc-input:focus { border-color: ${CSS_VARS.pink}; }
            .fb-chat-acc-input::placeholder { color: ${CSS_VARS.textDim}; }

            .fb-chat-acc-send {
                width: 30px;
                height: 30px;
                border-radius: 50%;
                background: ${CSS_VARS.teal};
                border: none;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 13px;
                cursor: pointer;
                flex-shrink: 0;
                transition: all 0.2s;
                color: #000;
            }
            .fb-chat-acc-send:hover { background: ${CSS_VARS.pink}; color: white; }
            .fb-chat-acc-send:disabled { opacity: 0.4; cursor: not-allowed; }

            /* ===== SKELETON LOADERS ===== */
            .skeleton-chat-item {
                display: flex;
                align-items: center;
                gap: 12px;
                padding: 12px 16px;
            }

            .skeleton-chat-avatar {
                width: 38px;
                height: 38px;
                border-radius: 50%;
                background: linear-gradient(90deg, ${CSS_VARS.bgCard} 25%, ${CSS_VARS.bgPanel} 50%, ${CSS_VARS.bgCard} 75%);
                background-size: 200% 100%;
                animation: chatDrawerShimmer 1.5s infinite;
                flex-shrink: 0;
            }

            .skeleton-chat-content { flex: 1; min-width: 0; }

            .skeleton-chat-name {
                height: 13px;
                width: 60%;
                background: linear-gradient(90deg, ${CSS_VARS.bgCard} 25%, ${CSS_VARS.bgPanel} 50%, ${CSS_VARS.bgCard} 75%);
                background-size: 200% 100%;
                animation: chatDrawerShimmer 1.5s infinite;
                border-radius: 4px;
                margin-bottom: 6px;
            }

            .skeleton-chat-preview {
                height: 11px;
                width: 80%;
                background: linear-gradient(90deg, ${CSS_VARS.bgCard} 25%, ${CSS_VARS.bgPanel} 50%, ${CSS_VARS.bgCard} 75%);
                background-size: 200% 100%;
                animation: chatDrawerShimmer 1.5s infinite;
                border-radius: 4px;
            }

            @keyframes chatDrawerShimmer {
                0% { background-position: 200% 0; }
                100% { background-position: -200% 0; }
            }

            /* Prevent scroll when chat drawer is open (mobile only) */
            body.chat-drawer-no-scroll {
                overflow: hidden;
                position: fixed;
                width: 100%;
            }

            /* Unread indicator on header chat button */
            #brdcChatBtn { position: relative; }
            #brdcChatBtn.has-unread svg path {
                fill: white;
                stroke: var(--pink, #FF469A);
                stroke-width: 1.5;
            }
            #brdcChatBtn.has-unread::after {
                content: '!';
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -44%);
                font-size: 11px;
                font-weight: 900;
                color: var(--pink, #FF469A);
                pointer-events: none;
                line-height: 1;
            }
            .mobile-nav-item[data-page="chat"].has-unread .mobile-nav-icon svg path {
                fill: white;
                stroke: var(--pink, #FF469A);
            }

            /* ===== SEARCH BAR ===== */
            .fb-chat-search-wrap {
                padding: 8px 12px 6px;
                flex-shrink: 0;
                position: relative;
                background: ${CSS_VARS.bgPanel};
            }
            .fb-chat-search-input {
                width: 100%;
                padding: 7px 12px 7px 32px;
                background: rgba(255,255,255,0.08);
                border: 1px solid rgba(255,255,255,0.15);
                border-radius: 20px;
                color: ${CSS_VARS.textLight};
                font-size: 13px;
                outline: none;
                box-sizing: border-box;
                transition: border-color 0.2s;
            }
            .fb-chat-search-input:focus { border-color: ${CSS_VARS.teal}; }
            .fb-chat-search-input::placeholder { color: ${CSS_VARS.textDim}; }
            .fb-chat-search-icon {
                position: absolute;
                left: 22px;
                top: 50%;
                transform: translateY(-50%);
                pointer-events: none;
                display: flex;
                color: ${CSS_VARS.textDim};
            }

            /* ===== SECTION HEADERS ===== */
            .fb-chat-section-header {
                padding: 8px 16px 4px;
                font-size: 10px;
                font-weight: 700;
                color: ${CSS_VARS.textDim};
                letter-spacing: 1px;
                text-transform: uppercase;
            }

            /* ===== COLLAPSIBLE SECTIONS ===== */
            .fb-chat-collapse-header {
                display: flex;
                align-items: center;
                gap: 6px;
                padding: 8px 16px 4px;
                cursor: pointer;
                user-select: none;
                transition: background 0.15s;
            }
            .fb-chat-collapse-header:hover {
                background: rgba(255,255,255,0.04);
            }
            .fb-chat-collapse-arrow {
                font-size: 10px;
                color: ${CSS_VARS.textDim};
                width: 10px;
                display: inline-block;
            }
            .fb-chat-collapse-label {
                font-size: 10px;
                font-weight: 700;
                color: ${CSS_VARS.textDim};
                letter-spacing: 1px;
                flex: 1;
            }
            .fb-chat-collapse-count {
                font-size: 10px;
                color: ${CSS_VARS.textDim};
                background: rgba(255,255,255,0.08);
                border-radius: 10px;
                padding: 1px 6px;
                min-width: 18px;
                text-align: center;
            }
            .fb-chat-collapse-body {
                overflow: hidden;
            }

            /* ===== NEW GROUP BUTTON (inline in section header) ===== */
            .fb-new-group-btn-inline {
                background: none;
                border: 1px solid rgba(255,255,255,0.2);
                border-radius: 4px;
                color: ${CSS_VARS.teal};
                font-size: 14px;
                font-weight: 700;
                width: 20px;
                height: 20px;
                display: flex;
                align-items: center;
                justify-content: center;
                cursor: pointer;
                padding: 0;
                line-height: 1;
                flex-shrink: 0;
                transition: background 0.15s;
            }
            .fb-new-group-btn-inline:hover {
                background: rgba(255,255,255,0.15);
            }
        `;
        document.head.appendChild(styles);
    }

    /**
     * ChatDrawer - Right sliding sidebar for messages/chat
     */
    class ChatDrawer {
        constructor() {
            this.isOpen = false;
            this.sidebar = null;
            this.overlay = null;
            this.chats = [];
            this.rooms = [];
            this.touchStartX = 0;
            this.touchCurrentX = 0;
            this.edgeSwipeStartX = 0;
            this.edgeSwipeStartY = 0;
            this.isEdgeSwiping = false;

            // Accordion state: key = chatId, value = { type, name, recipientId, messages, unsubscribe }
            this.openAccordions = {};
            this.currentPlayerId = null;
            this.teammates = [];
            this.leaguePlayers = [];
            this._longPressTimer = null;
            this._longPressTriggered = false;
            this._longPressStartPos = null;
        }

        init() {
            injectStyles();
            this._readCurrentPlayer();
            this.createDOM();
            this.attachListeners();
        }

        _readCurrentPlayer() {
            try {
                const session = JSON.parse(localStorage.getItem('brdc_session') || '{}');
                this.currentPlayerId = session.player_id || null;
            } catch (e) {}
        }

        createDOM() {
            // Create overlay
            this.overlay = document.createElement('div');
            this.overlay.className = 'fb-chat-sidebar-overlay';
            document.body.appendChild(this.overlay);

            // Create sidebar
            this.sidebar = document.createElement('div');
            this.sidebar.className = 'fb-chat-sidebar';
            this.sidebar.setAttribute('role', 'dialog');
            this.sidebar.setAttribute('aria-label', 'Messages');
            this.sidebar.innerHTML = `
                <div class="fb-chat-sidebar-header">
                    <span class="fb-chat-sidebar-title">Messages</span>
                    <div style="display: flex; align-items: center;">
                        <button class="fb-chat-sidebar-new-btn" onclick="window.location.href='/pages/messages.html?new=1'">+ New</button>
                        <button class="fb-chat-sidebar-close" aria-label="Close messages">&times;</button>
                    </div>
                </div>
                <div class="fb-chat-search-wrap" id="chatSearchWrap">
                    <span class="fb-chat-search-icon">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                    </span>
                    <input type="text" class="fb-chat-search-input" id="chatDrawerSearch" placeholder="Search players..." autocomplete="off">
                </div>
                <div class="fb-chat-sidebar-list" id="chatDrawerChatList">
                    <div class="fb-chat-collapsible" id="chatSection-recent" data-open="true">
                        <div class="fb-chat-collapse-header" data-section="recent">
                            <span class="fb-chat-collapse-arrow">&#9660;</span>
                            <span class="fb-chat-collapse-label">RECENT</span>
                            <span class="fb-chat-collapse-count" id="chatCount-recent"></span>
                        </div>
                        <div class="fb-chat-collapse-body" id="chatDrawerRecentList">${this.getSkeletonHTML()}</div>
                    </div>
                    <div class="fb-chat-collapsible" id="chatSection-team" data-open="true" style="display:none;">
                        <div class="fb-chat-collapse-header" data-section="team">
                            <span class="fb-chat-collapse-arrow">&#9660;</span>
                            <span class="fb-chat-collapse-label">MY TEAM</span>
                            <span class="fb-chat-collapse-count" id="chatCount-team"></span>
                        </div>
                        <div class="fb-chat-collapse-body" id="chatDrawerTeamList"></div>
                    </div>
                    <div class="fb-chat-collapsible" id="chatSection-league" data-open="false" style="display:none;">
                        <div class="fb-chat-collapse-header" data-section="league">
                            <span class="fb-chat-collapse-arrow">&#9654;</span>
                            <span class="fb-chat-collapse-label">LEAGUE</span>
                            <span class="fb-chat-collapse-count" id="chatCount-league"></span>
                        </div>
                        <div class="fb-chat-collapse-body" id="chatDrawerLeagueList" style="display:none;"></div>
                    </div>
                    <div class="fb-chat-collapsible" id="chatSection-rooms" data-open="true" style="display:none;">
                        <div class="fb-chat-collapse-header" data-section="rooms">
                            <span class="fb-chat-collapse-arrow">&#9660;</span>
                            <span class="fb-chat-collapse-label">ROOMS</span>
                            <span class="fb-chat-collapse-count" id="chatCount-rooms"></span>
                            <button class="fb-new-group-btn-inline" id="chatNewGroupBtn" title="New Group Chat">+</button>
                        </div>
                        <div class="fb-chat-collapse-body" id="chatDrawerRoomList">${this.getSkeletonHTML()}</div>
                    </div>
                </div>
                <div class="fb-chat-sidebar-footer">
                    <a href="/pages/messages.html" class="fb-chat-sidebar-see-all">See All Messages</a>
                </div>
            `;
            document.body.appendChild(this.sidebar);

            // Collapsible section headers — wire BEFORE chat-item delegation
            this.sidebar.querySelector('#chatDrawerChatList').addEventListener('click', (e) => {
                // Don't collapse when clicking the new-group button
                if (e.target.closest('#chatNewGroupBtn')) return;
                const header = e.target.closest('.fb-chat-collapse-header');
                if (!header) return;
                const section = header.closest('.fb-chat-collapsible');
                if (!section) return;
                const isOpen = section.dataset.open === 'true';
                const body = section.querySelector('.fb-chat-collapse-body');
                const arrow = section.querySelector('.fb-chat-collapse-arrow');
                if (isOpen) {
                    section.dataset.open = 'false';
                    if (body) body.style.display = 'none';
                    if (arrow) arrow.innerHTML = '&#9654;';
                } else {
                    section.dataset.open = 'true';
                    if (body) body.style.display = '';
                    if (arrow) arrow.innerHTML = '&#9660;';
                }
            });

            // Event delegation for accordion interactions — all sections are inside chatDrawerChatList
            ['chatDrawerChatList'].forEach(listId => {
                const list = this.sidebar.querySelector(`#${listId}`);
                if (!list) return;

                // Click: toggle accordion on item click, send on button click
                list.addEventListener('click', (e) => {
                    // Send button
                    const sendBtn = e.target.closest('.fb-chat-acc-send');
                    if (sendBtn) {
                        const acc = sendBtn.closest('.fb-chat-accordion');
                        if (acc) this.sendAccordionMessage(acc.dataset.chatId);
                        return;
                    }

                    // Ignore clicks inside an open accordion (messages, input, link)
                    if (e.target.closest('.fb-chat-accordion')) return;

                    // Toggle accordion on item click
                    const item = e.target.closest('.fb-chat-item[data-chat-id]');
                    if (item) {
                        if (this._longPressTriggered) { this._longPressTriggered = false; return; }
                        this.toggleAccordion(
                            item.dataset.chatId,
                            item.dataset.chatType,
                            item.dataset.chatName,
                            item.dataset.chatRecipient || ''
                        );
                    }
                });

                // Enter to send
                list.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter' && !e.shiftKey && e.target.matches('.fb-chat-acc-input')) {
                        e.preventDefault();
                        const acc = e.target.closest('.fb-chat-accordion');
                        if (acc) this.sendAccordionMessage(acc.dataset.chatId);
                    }
                });

                // Auto-resize textarea
                list.addEventListener('input', (e) => {
                    if (e.target.matches('.fb-chat-acc-input')) {
                        e.target.style.height = 'auto';
                        e.target.style.height = Math.min(e.target.scrollHeight, 72) + 'px';
                    }
                });

                // Long-press + right-click context menu
                this._attachLongPress(list);
            });

            // Search input
            const searchInput = this.sidebar.querySelector('#chatDrawerSearch');
            if (searchInput) {
                searchInput.addEventListener('input', (e) => this.filterChatSearch(e.target.value));
            }
        }

        switchTab(tabName) {
            const tabs = this.sidebar.querySelectorAll('.fb-chat-sidebar-tab');
            const chatList = document.getElementById('chatDrawerChatList');
            const roomList = document.getElementById('chatDrawerRoomList');

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
                if (chatList) chatList.style.display = 'block';
                if (roomList) roomList.style.display = 'none';
            } else {
                if (chatList) chatList.style.display = 'none';
                if (roomList) roomList.style.display = 'block';
            }

            const searchWrap = document.getElementById('chatSearchWrap');
            if (searchWrap) searchWrap.style.display = tabName === 'chats' ? '' : 'none';
        }

        attachListeners() {
            this.overlay.addEventListener('click', () => this.close());

            const closeBtn = this.sidebar.querySelector('.fb-chat-sidebar-close');
            closeBtn.addEventListener('click', () => this.close());

            const newGroupBtn = this.sidebar.querySelector('#chatNewGroupBtn');
            if (newGroupBtn) {
                newGroupBtn.addEventListener('click', () => this.openNewGroupPanel());
            }

            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape' && this.isOpen) this.close();
            });

            // Swipe to close
            this.sidebar.addEventListener('touchstart', (e) => this.onTouchStart(e), { passive: true });
            this.sidebar.addEventListener('touchmove', (e) => this.onTouchMove(e), { passive: false });
            this.sidebar.addEventListener('touchend', (e) => this.onTouchEnd(e), { passive: true });

            // Right-edge swipe to open
            document.addEventListener('touchstart', (e) => {
                const touch = e.touches[0];
                if (touch.clientX > window.innerWidth - 20 && !this.isOpen) {
                    this.edgeSwipeStartX = touch.clientX;
                    this.edgeSwipeStartY = touch.clientY;
                    this.isEdgeSwiping = true;
                }
            }, { passive: true });

            document.addEventListener('touchmove', (e) => {
                if (this.isEdgeSwiping && !this.isOpen) {
                    const touch = e.touches[0];
                    const deltaX = this.edgeSwipeStartX - touch.clientX;
                    const deltaY = Math.abs(touch.clientY - this.edgeSwipeStartY);
                    if (deltaY > 30) { this.isEdgeSwiping = false; return; }
                    if (deltaX > 50) { this.open(); this.isEdgeSwiping = false; }
                }
            }, { passive: true });

            document.addEventListener('touchend', () => { this.isEdgeSwiping = false; }, { passive: true });
        }

        onTouchStart(e) {
            this.touchStartX = e.touches[0].clientX;
            this.touchCurrentX = this.touchStartX;
        }

        onTouchMove(e) {
            if (!this.isOpen) return;
            this.touchCurrentX = e.touches[0].clientX;
            const diff = this.touchCurrentX - this.touchStartX;
            if (diff > 0) {
                this.sidebar.style.transform = `translateX(${Math.min(diff, 280)}px)`;
                this.sidebar.style.transition = 'none';
                e.preventDefault();
            }
        }

        onTouchEnd() {
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
            if (!document.body.classList.contains('is-desktop')) {
                document.body.classList.add('chat-drawer-no-scroll');
            }
            this.loadRecentChats();
        }

        close() {
            this.isOpen = false;
            this.sidebar.classList.remove('open');
            this.overlay.classList.remove('open');
            this.sidebar.style.transform = '';
            document.body.classList.remove('chat-drawer-no-scroll');
        }

        toggle() {
            if (this._toggleGuard) return;
            this._toggleGuard = true;
            setTimeout(() => { this._toggleGuard = false; }, 100);
            if (this.isOpen) { this.close(); } else { this.open(); }
        }

        // ===== ACCORDION METHODS =====

        /**
         * Toggle accordion for a chat item. If open, close it. If closed, open it.
         */
        toggleAccordion(chatId, type, name, recipientId) {
            if (this.openAccordions[chatId]) {
                this.closeAccordion(chatId);
            } else {
                this.openAccordion(chatId, type, name, recipientId);
            }
        }

        openAccordion(chatId, type, name, recipientId) {
            const acc = this.sidebar.querySelector(`.fb-chat-accordion[data-chat-id="${chatId}"]`);
            const item = this.sidebar.querySelector(`.fb-chat-item[data-chat-id="${chatId}"]`);
            if (!acc) return;

            // Mark open
            this.openAccordions[chatId] = { type, name, recipientId, messages: [], unsubscribe: null };
            acc.classList.add('open');
            if (item) item.classList.add('fb-chat-item-open');

            // Scroll item into view
            setTimeout(() => {
                if (item) item.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }, 50);

            // Load messages if not already loaded
            this.loadAccordionMessages(chatId, type);
        }

        closeAccordion(chatId) {
            const acc = this.sidebar.querySelector(`.fb-chat-accordion[data-chat-id="${chatId}"]`);
            const item = this.sidebar.querySelector(`.fb-chat-item[data-chat-id="${chatId}"]`);

            if (acc) acc.classList.remove('open');
            if (item) item.classList.remove('fb-chat-item-open');

            // Unsubscribe Firestore listener
            const state = this.openAccordions[chatId];
            if (state && state.unsubscribe) {
                try { state.unsubscribe(); } catch (e) {}
            }
            delete this.openAccordions[chatId];
        }

        async loadAccordionMessages(chatId, type) {
            const state = this.openAccordions[chatId];
            if (!state) return;

            const msgContainer = this.sidebar.querySelector(
                `.fb-chat-accordion[data-chat-id="${chatId}"] .fb-chat-acc-messages`
            );
            if (!msgContainer) return;

            const playerId = JSON.parse(localStorage.getItem('brdc_session') || '{}').player_id;
            if (!playerId) {
                msgContainer.innerHTML = '<div class="fb-chat-acc-loading">Log in to view messages</div>';
                return;
            }

            try {
                const { db, collection, query, orderBy, limit, startAfter, onSnapshot, callFunction } =
                    await import('/js/firebase-config.js');

                if (!this.openAccordions[chatId]) return; // closed while loading

                if (type === 'new_dm') {
                    if (msgContainer) msgContainer.innerHTML = '<div class="fb-chat-acc-loading">No messages yet. Say hi!</div>';
                    return;
                }

                if (type === 'conversation') {
                    const result = await callFunction('getConversationMessages', {
                        conversation_id: chatId,
                        limit: 30
                    });

                    if (!this.openAccordions[chatId]) return;

                    if (result && result.success) {
                        if (result.conversation?.current_player_id) {
                            this.currentPlayerId = result.conversation.current_player_id;
                        }
                        // Store recipientId if missing
                        if (result.conversation?.other_participant?.id && !state.recipientId) {
                            state.recipientId = result.conversation.other_participant.id;
                        }

                        const otherParticipantId = result.conversation?.other_participant?.id;
                        const messages = (result.messages || []).map(m => ({
                            ...m,
                            is_own: m.is_own !== undefined
                                ? m.is_own
                                : (m.sender_id !== otherParticipantId)
                        }));

                        state.messages = messages;
                        this.renderAccordionMessages(chatId, messages);

                        // Real-time listener
                        const newestTs = messages.length > 0
                            ? new Date(messages[messages.length - 1].timestamp)
                            : new Date(0);
                        const realtimeQ = query(
                            collection(db, 'conversations', chatId, 'messages'),
                            orderBy('timestamp', 'asc'),
                            startAfter(newestTs)
                        );
                        state.unsubscribe = onSnapshot(realtimeQ, (snap) => {
                            if (!this.openAccordions[chatId]) return;
                            snap.docChanges().forEach(change => {
                                if (change.type === 'added') {
                                    const data = change.doc.data();
                                    const msg = {
                                        id: change.doc.id,
                                        ...data,
                                        timestamp: data.timestamp?.toDate?.()?.toISOString() || null,
                                        is_own: data.sender_id !== otherParticipantId
                                    };
                                    state.messages.push(msg);
                                    this.renderAccordionMessages(chatId, state.messages);
                                }
                            });
                            callFunction('markConversationRead', { conversation_id: chatId }).catch(() => {});
                        });

                        callFunction('markConversationRead', { conversation_id: chatId }).catch(() => {});
                    } else {
                        msgContainer.innerHTML = '<div class="fb-chat-acc-loading">Could not load messages</div>';
                    }

                } else {
                    // Room
                    const result = await callFunction('getChatRoomMessages', {
                        room_id: chatId,
                        limit: 30
                    });

                    if (!this.openAccordions[chatId]) return;

                    if (result && result.success) {
                        const messages = result.messages || [];
                        state.messages = messages;
                        this.renderAccordionMessages(chatId, messages);

                        const newestTs = messages.length > 0
                            ? new Date(messages[messages.length - 1].timestamp)
                            : new Date(0);
                        const realtimeQ = query(
                            collection(db, 'chat_rooms', chatId, 'messages'),
                            orderBy('timestamp', 'asc'),
                            startAfter(newestTs)
                        );
                        state.unsubscribe = onSnapshot(realtimeQ, (snap) => {
                            if (!this.openAccordions[chatId]) return;
                            snap.docChanges().forEach(change => {
                                if (change.type === 'added') {
                                    const data = change.doc.data();
                                    const msg = {
                                        id: change.doc.id,
                                        ...data,
                                        timestamp: data.timestamp?.toDate?.()?.toISOString() || null,
                                        is_own: this.currentPlayerId ? data.sender_id === this.currentPlayerId : false
                                    };
                                    state.messages.push(msg);
                                    this.renderAccordionMessages(chatId, state.messages);
                                }
                            });
                            callFunction('markChatRoomRead', { room_id: chatId }).catch(() => {});
                        });

                        callFunction('markChatRoomRead', { room_id: chatId }).catch(() => {});
                    } else {
                        msgContainer.innerHTML = '<div class="fb-chat-acc-loading">Could not load messages</div>';
                    }
                }
            } catch (error) {
                console.error('[ChatDrawer] Error loading accordion messages:', error);
                const mc = this.sidebar.querySelector(
                    `.fb-chat-accordion[data-chat-id="${chatId}"] .fb-chat-acc-messages`
                );
                if (mc) mc.innerHTML = '<div class="fb-chat-acc-loading">Error loading messages</div>';
            }
        }

        renderAccordionMessages(chatId, messages) {
            const msgContainer = this.sidebar.querySelector(
                `.fb-chat-accordion[data-chat-id="${chatId}"] .fb-chat-acc-messages`
            );
            if (!msgContainer) return;

            const state = this.openAccordions[chatId];
            const isRoom = state && state.type === 'room';

            if (!messages || messages.length === 0) {
                msgContainer.innerHTML = '<div class="fb-chat-acc-loading">No messages yet. Say hi!</div>';
                return;
            }

            let html = '';
            let lastDate = null;

            messages.forEach(msg => {
                const ts = msg.timestamp ? new Date(msg.timestamp) : null;
                if (ts) {
                    const dateStr = ts.toDateString();
                    if (dateStr !== lastDate) {
                        html += `<div class="fb-chat-date-divider">${this.formatDateDivider(msg.timestamp)}</div>`;
                        lastDate = dateStr;
                    }
                }

                const isSent = msg.is_own;
                const timeStr = ts ? ts.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }) : '';
                const text = this.escapeHtml(msg.text || '');

                let senderLine = '';
                if (isRoom && !isSent && msg.sender_name) {
                    senderLine = `<div class="fb-chat-msg-sender">${this.escapeHtml(msg.sender_name)}</div>`;
                }

                html += `
                    <div class="fb-chat-msg ${isSent ? 'sent' : 'received'}">
                        ${senderLine}
                        <div class="fb-chat-msg-bubble">${text}</div>
                        ${timeStr ? `<div class="fb-chat-msg-time">${timeStr}</div>` : ''}
                    </div>`;
            });

            msgContainer.innerHTML = html;
            msgContainer.scrollTop = msgContainer.scrollHeight;
        }

        async sendAccordionMessage(chatId) {
            const state = this.openAccordions[chatId];
            if (!state) return;

            const acc = this.sidebar.querySelector(`.fb-chat-accordion[data-chat-id="${chatId}"]`);
            if (!acc) return;

            const input = acc.querySelector('.fb-chat-acc-input');
            const sendBtn = acc.querySelector('.fb-chat-acc-send');
            if (!input || !sendBtn) return;

            const text = input.value.trim();
            if (!text) return;

            const playerId = JSON.parse(localStorage.getItem('brdc_session') || '{}').player_id;
            if (!playerId) return;

            sendBtn.disabled = true;

            try {
                const { callFunction } = await import('/js/firebase-config.js');

                if (state.type === 'conversation') {
                    await callFunction('sendDirectMessage', {
                        recipient_id: state.recipientId,
                        text
                    });
                } else {
                    await callFunction('sendChatMessage', {
                        room_id: chatId,
                        text
                    });
                }

                input.value = '';
                input.style.height = 'auto';
            } catch (error) {
                console.error('[ChatDrawer] Error sending message:', error);
            } finally {
                sendBtn.disabled = false;
                input.focus();
            }
        }

        // ===== CHAT LIST LOADING =====

        async loadRecentChats() {
            const listEl = document.getElementById('chatDrawerRecentList');
            const roomListEl = document.getElementById('chatDrawerRoomList');
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

                if (chatCache && (chatCache.isFresh || chatCache.isStale)) {
                    this.chats = chatCache.data;
                    this.renderChats();
                }
                if (roomCache && (roomCache.isFresh || roomCache.isStale)) {
                    this.rooms = roomCache.data;
                    this.renderRooms();
                }

                if (chatCache && chatCache.isFresh && roomCache && roomCache.isFresh) return;

                const { callFunction } = await import('/js/firebase-config.js');

                if (!chatCache || chatCache.isStale || chatCache.isExpired) {
                    try {
                        const convResult = await callFunction('getConversations', {});
                        if (convResult.success && convResult.conversations && convResult.conversations.length > 0) {
                            this.chats = convResult.conversations.map(conv => ({
                                id: conv.id,
                                name: conv.other_participant?.name || 'Unknown',
                                recipientId: conv.other_participant?.id || '',
                                lastMessage: conv.last_message?.text || '',
                                lastMessageTime: conv.updated_at,
                                unread: conv.unread_count > 0,
                                type: 'conversation'
                            }));
                            CacheHelper.set(chatCacheKey, this.chats);
                            this.renderChats();
                        } else if (!chatCache) {
                            listEl.innerHTML = '<div class="fb-chat-empty">No conversations yet</div>';
                        }
                    } catch (error) {
                        console.error('[ChatDrawer] Error loading conversations:', error);
                        if (!chatCache) listEl.innerHTML = '<div class="fb-chat-empty">No conversations yet</div>';
                    }
                }

                if (!roomCache || roomCache.isStale || roomCache.isExpired) {
                    try {
                        const roomsResult = await callFunction('getPlayerChatRooms', {});
                        if (roomsResult.success && roomsResult.rooms) {
                            const allRooms = [
                                ...(roomsResult.rooms.league || []),
                                ...(roomsResult.rooms.team || []),
                                ...(roomsResult.rooms.match || []),
                                ...(roomsResult.rooms.tournament || []),
                                ...(roomsResult.rooms.tournament_event || [])
                            ];
                            this.rooms = allRooms.map(room => ({
                                id: room.id,
                                name: room.name,
                                lastMessage: room.last_message?.text || '',
                                lastMessageTime: room.last_message?.timestamp,
                                unread: (room.unread_count || 0) > 0,
                                type: room.type
                            }));
                            if (this.rooms.length > 0) CacheHelper.set(roomCacheKey, this.rooms);
                        } else {
                            this.rooms = [];
                        }
                        this.renderRooms();
                    } catch (error) {
                        console.error('[ChatDrawer] Error loading rooms:', error);
                        this.renderRooms();
                    }
                }
            } catch (error) {
                console.error('[ChatDrawer] Error loading chats:', error);
                const listEl2 = document.getElementById('chatDrawerRecentList');
                if (listEl2) listEl2.innerHTML = '<div class="fb-chat-empty">Could not load messages</div>';
            }
            // Load teammates and league players separately
            this.loadTeammatesAndLeaguePlayers();
        }

        /**
         * Build the HTML for a chat item + its accordion panel.
         */
        _buildChatItemHTML(id, type, name, recipientId, initials, avatarStyle, timeStr, preview, hasMore, unread, fullPageUrl) {
            const safeId = this.escapeAttr(id);
            const safeName = this.escapeAttr(name);
            const safeRecipient = this.escapeAttr(recipientId || '');

            return `
                <div class="fb-chat-item"
                     data-chat-id="${safeId}"
                     data-chat-type="${type}"
                     data-chat-name="${safeName}"
                     data-chat-recipient="${safeRecipient}">
                    <div class="fb-chat-item-avatar" ${avatarStyle}>${initials}</div>
                    <div class="fb-chat-item-content">
                        <div class="fb-chat-item-name">${this.escapeHtml(name || 'Unknown')}</div>
                        <div class="fb-chat-item-preview">${preview}${hasMore ? '...' : ''}</div>
                    </div>
                    <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 3px; margin-right: 2px;">
                        ${timeStr ? `<span style="font-size: 10px; color: var(--text-dim);">${timeStr}</span>` : ''}
                        ${unread ? '<div class="fb-chat-item-unread"></div>' : ''}
                    </div>
                    <span class="fb-chat-item-chevron">&#9658;</span>
                </div>
                <div class="fb-chat-accordion" data-chat-id="${safeId}">
                    <div class="fb-chat-acc-messages">
                        <div class="fb-chat-acc-loading">Loading messages...</div>
                    </div>
                    <div class="fb-chat-acc-footer">
                        <a class="fb-chat-acc-open-link" href="${this.escapeAttr(fullPageUrl)}" title="Open full page">&#8599;</a>
                        <textarea class="fb-chat-acc-input" placeholder="Message ${this.escapeAttr(name)}..." rows="1"></textarea>
                        <button class="fb-chat-acc-send" aria-label="Send">&#10148;</button>
                    </div>
                </div>`;
        }

        renderChats() {
            const listEl = document.getElementById('chatDrawerRecentList');
            const section = document.getElementById('chatSection-recent');
            const countEl = document.getElementById('chatCount-recent');
            if (!listEl) return;

            if (!this.chats || !this.chats.length) {
                if (section) section.style.display = 'none';
                return;
            }

            if (section) section.style.display = '';
            if (countEl) countEl.textContent = this.chats.length;

            let html = '';
            this.chats.forEach(chat => {
                const initials = this.getInitials(chat.name || '?');
                const timeStr = this.formatTimeAgo(chat.lastMessageTime);
                const preview = this.escapeHtml((chat.lastMessage || '').substring(0, 30));
                const hasMore = chat.lastMessage && chat.lastMessage.length > 30;
                html += this._buildChatItemHTML(
                    chat.id, 'conversation', chat.name, chat.recipientId,
                    initials, '', timeStr, preview, hasMore, chat.unread,
                    `/pages/conversation.html?id=${chat.id}`
                );
            });
            listEl.innerHTML = html;
            this.updateUnreadIndicator();
        }

        async loadTeammatesAndLeaguePlayers() {
            try {
                const session = JSON.parse(localStorage.getItem('brdc_session') || '{}');
                // Use all available fallbacks for leagueId and teamId
                const leagueId = session.involvements?.leagues?.[0]?.id || session.league_id;
                const teamId = session.involvements?.leagues?.[0]?.team_id || session.team_id;
                const myId = session.player_id;

                if (!leagueId || !myId) return;

                const cacheKey = `chat_league_players_${leagueId}`;
                const cached = CacheHelper.get(cacheKey);

                let allPlayers;
                if (cached && (cached.isFresh || cached.isStale)) {
                    allPlayers = cached.data;
                } else {
                    const { callFunction } = await import('/js/firebase-config.js');
                    const result = await callFunction('getPlayers', { league_id: leagueId });
                    if (!result || !result.success) return;
                    allPlayers = result.players || [];
                    CacheHelper.set(cacheKey, allPlayers);
                }

                // Exclude self
                const others = allPlayers.filter(p => p.id !== myId);

                // Resolve team_id from live player data — more reliable than cached session
                const myLeaguePlayer = allPlayers.find(p => p.id === myId);
                const resolvedTeamId = myLeaguePlayer?.team_id || teamId;

                // Teammates: same team
                this.teammates = resolvedTeamId
                    ? others.filter(p => p.team_id === resolvedTeamId)
                    : [];
                const teammateIds = new Set(this.teammates.map(p => p.id));

                // League: everyone else
                this.leaguePlayers = others.filter(p => !teammateIds.has(p.id));

                this.renderTeammates();
                this.renderLeaguePlayers();

            } catch (err) {
                console.error('[ChatDrawer] Error loading league players:', err);
            }
        }

        renderTeammates() {
            const listEl = document.getElementById('chatDrawerTeamList');
            const section = document.getElementById('chatSection-team');
            const countEl = document.getElementById('chatCount-team');
            if (!listEl) return;

            const players = this.teammates || [];
            if (!players.length) {
                if (section) section.style.display = 'none';
                return;
            }

            if (section) section.style.display = '';
            if (countEl) countEl.textContent = players.length;

            const convByRecipient = {};
            (this.chats || []).forEach(c => { if (c.recipientId) convByRecipient[c.recipientId] = c; });

            let html = '';
            players.forEach(player => {
                const existing = convByRecipient[player.id];
                const chatId = existing ? existing.id : `new_dm_${player.id}`;
                const type = existing ? 'conversation' : 'new_dm';
                const unread = existing ? existing.unread : false;
                const initials = this.getInitials(player.name || '?');
                const pageUrl = existing
                    ? `/pages/conversation.html?id=${existing.id}`
                    : `/pages/messages.html?new=1`;
                html += this._buildChatItemHTML(
                    chatId, type, player.name, player.id,
                    initials, '', '', '', false, unread, pageUrl
                );
            });
            listEl.innerHTML = html;
        }

        renderLeaguePlayers() {
            const listEl = document.getElementById('chatDrawerLeagueList');
            const section = document.getElementById('chatSection-league');
            const countEl = document.getElementById('chatCount-league');
            if (!listEl) return;

            const players = this.leaguePlayers || [];
            if (!players.length) {
                if (section) section.style.display = 'none';
                return;
            }

            if (section) section.style.display = '';
            if (countEl) countEl.textContent = players.length;

            const convByRecipient = {};
            (this.chats || []).forEach(c => { if (c.recipientId) convByRecipient[c.recipientId] = c; });

            let html = '';
            players.forEach(player => {
                const existing = convByRecipient[player.id];
                const chatId = existing ? existing.id : `new_dm_${player.id}`;
                const type = existing ? 'conversation' : 'new_dm';
                const unread = existing ? existing.unread : false;
                const initials = this.getInitials(player.name || '?');
                const pageUrl = existing
                    ? `/pages/conversation.html?id=${existing.id}`
                    : `/pages/messages.html?new=1`;
                html += this._buildChatItemHTML(
                    chatId, type, player.name, player.id,
                    initials, '', '', '', false, unread, pageUrl
                );
            });
            listEl.innerHTML = html;
        }

        filterChatSearch(query) {
            const q = (query || '').toLowerCase().trim();
            const sections = [
                { sectionId: 'chatSection-recent', listId: 'chatDrawerRecentList' },
                { sectionId: 'chatSection-team', listId: 'chatDrawerTeamList' },
                { sectionId: 'chatSection-league', listId: 'chatDrawerLeagueList' },
                { sectionId: 'chatSection-rooms', listId: 'chatDrawerRoomList' }
            ];

            sections.forEach(({ sectionId, listId }) => {
                const section = document.getElementById(sectionId);
                const list = document.getElementById(listId);
                if (!list || !section) return;

                if (!q) {
                    // Restore: show section only if it had players rendered
                    const items = list.querySelectorAll('.fb-chat-item');
                    section.style.display = items.length ? '' : 'none';
                    items.forEach(item => { item.style.display = ''; });
                    list.querySelectorAll('.fb-chat-accordion').forEach(acc => { acc.style.display = ''; });
                    return;
                }

                const items = list.querySelectorAll('.fb-chat-item[data-chat-id]');
                let visibleCount = 0;
                items.forEach(item => {
                    const name = (item.dataset.chatName || '').toLowerCase();
                    const matches = name.includes(q);
                    item.style.display = matches ? '' : 'none';
                    // Hide/show paired accordion too
                    const chatId = item.dataset.chatId;
                    const acc = list.querySelector(`.fb-chat-accordion[data-chat-id="${chatId}"]`);
                    if (acc) acc.style.display = matches ? '' : 'none';
                    if (matches) visibleCount++;
                });

                section.style.display = visibleCount > 0 ? '' : 'none';
            });
        }

        openNewGroupPanel() {
            // Build a simple player picker overlay inside the sidebar
            const existing = this.sidebar.querySelector('#chatNewGroupPanel');
            if (existing) { existing.remove(); return; }

            // Gather all known players from all sections
            const allPlayers = [
                ...(this.captains || []),
                ...(this.teammates || []),
                ...(this.leaguePlayers || [])
            ];

            if (!allPlayers.length) {
                alert('Open the chat panel and wait for players to load.');
                return;
            }

            const panel = document.createElement('div');
            panel.id = 'chatNewGroupPanel';
            panel.style.cssText = `
                position: absolute; top: 0; left: 0; right: 0; bottom: 0;
                background: ${CSS_VARS.bgPanel};
                z-index: 10;
                display: flex;
                flex-direction: column;
            `;
            panel.innerHTML = `
                <div style="display:flex;align-items:center;gap:8px;padding:14px 16px;border-bottom:1px solid rgba(255,255,255,0.1);flex-shrink:0;">
                    <button id="chatGroupPanelClose" style="background:none;border:none;color:${CSS_VARS.textDim};font-size:20px;cursor:pointer;padding:0;line-height:1;">&#8249;</button>
                    <span style="font-family:'Bebas Neue',cursive;font-size:18px;color:${CSS_VARS.teal};">New Group Chat</span>
                </div>
                <div style="padding:10px 12px;flex-shrink:0;border-bottom:1px solid rgba(255,255,255,0.08);">
                    <input type="text" id="chatGroupName" placeholder="Group name..." style="
                        width:100%;padding:7px 12px;background:rgba(255,255,255,0.08);
                        border:1px solid rgba(255,255,255,0.2);border-radius:8px;
                        color:${CSS_VARS.textLight};font-size:13px;outline:none;box-sizing:border-box;
                    ">
                </div>
                <div style="padding:6px 16px 4px;font-size:10px;font-weight:700;color:${CSS_VARS.textDim};letter-spacing:1px;flex-shrink:0;">
                    ADD PLAYERS
                </div>
                <div id="chatGroupPlayerList" style="flex:1;overflow-y:auto;">
                    ${allPlayers.map(p => `
                        <label style="display:flex;align-items:center;gap:10px;padding:8px 16px;cursor:pointer;transition:background 0.15s;" data-player-id="${this.escapeAttr(p.id)}">
                            <input type="checkbox" value="${this.escapeAttr(p.id)}" style="accent-color:${CSS_VARS.pink};width:16px;height:16px;">
                            <div style="width:32px;height:32px;border-radius:50%;background:${CSS_VARS.pink};display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;color:white;flex-shrink:0;">${this.escapeHtml(this.getInitials(p.name || '?'))}</div>
                            <span style="font-size:13px;color:${CSS_VARS.textLight};">${this.escapeHtml(p.name || 'Unknown')}</span>
                        </label>
                    `).join('')}
                </div>
                <div style="padding:10px 12px;border-top:1px solid rgba(255,255,255,0.1);flex-shrink:0;">
                    <button id="chatGroupCreateBtn" style="
                        width:100%;padding:10px;
                        background:linear-gradient(180deg,${CSS_VARS.pink} 0%,#d63384 100%);
                        border:none;border-radius:8px;color:white;font-size:13px;font-weight:700;
                        cursor:pointer;transition:opacity 0.2s;
                    ">Create Group</button>
                </div>
            `;

            this.sidebar.style.position = 'relative';
            this.sidebar.appendChild(panel);

            panel.querySelector('#chatGroupPanelClose').addEventListener('click', () => panel.remove());

            panel.querySelector('#chatGroupCreateBtn').addEventListener('click', async () => {
                const name = (panel.querySelector('#chatGroupName').value || '').trim();
                const checked = [...panel.querySelectorAll('#chatGroupPlayerList input:checked')];
                const participantIds = checked.map(cb => cb.value);

                if (!name) { panel.querySelector('#chatGroupName').focus(); return; }
                if (participantIds.length < 1) { alert('Select at least one player.'); return; }

                const btn = panel.querySelector('#chatGroupCreateBtn');
                btn.textContent = 'Creating...';
                btn.disabled = true;

                try {
                    const playerId = JSON.parse(localStorage.getItem('brdc_session') || '{}').player_id;
                    const { callFunction } = await import('/js/firebase-config.js');
                    const result = await callFunction('createGroupChatRoom', {
                        name,
                        participant_ids: participantIds
                    });
                    if (result && result.success) {
                        panel.remove();
                        // Expand and scroll to the ROOMS section
                        const roomsSection = document.getElementById('chatSection-rooms');
                        if (roomsSection) {
                            roomsSection.dataset.open = 'true';
                            const body = roomsSection.querySelector('.fb-chat-collapse-body');
                            const arrow = roomsSection.querySelector('.fb-chat-collapse-arrow');
                            if (body) body.style.display = '';
                            if (arrow) arrow.innerHTML = '&#9660;';
                            setTimeout(() => roomsSection.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
                        }
                        CacheHelper.clear(`chat_rooms_${playerId}`);
                        this.loadRecentChats();
                    } else {
                        btn.textContent = 'Create Group';
                        btn.disabled = false;
                        alert(result?.error || 'Could not create group. Try again.');
                    }
                } catch (err) {
                    console.error('[ChatDrawer] createGroupChatRoom error:', err);
                    btn.textContent = 'Create Group';
                    btn.disabled = false;
                    alert('Error creating group. Try again.');
                }
            });
        }

        // ===== LONG-PRESS CONTEXT MENU =====

        _attachLongPress(list) {
            const startPress = (chatId, chatType, chatName, x, y) => {
                this._longPressStartPos = { x, y };
                clearTimeout(this._longPressTimer);
                this._longPressTimer = setTimeout(() => {
                    this._longPressTriggered = true;
                    this.showContextMenu(chatId, chatType, chatName, x, y);
                }, 500);
            };

            const cancelPress = () => {
                clearTimeout(this._longPressTimer);
                this._longPressTimer = null;
            };

            // Touch long press
            list.addEventListener('touchstart', (e) => {
                const item = e.target.closest('.fb-chat-item[data-chat-id]');
                if (!item || e.target.closest('.fb-chat-accordion')) return;
                const touch = e.touches[0];
                startPress(item.dataset.chatId, item.dataset.chatType, item.dataset.chatName, touch.clientX, touch.clientY);
            }, { passive: true });

            list.addEventListener('touchmove', (e) => {
                if (!this._longPressTimer || !this._longPressStartPos) return;
                const touch = e.touches[0];
                const dx = Math.abs(touch.clientX - this._longPressStartPos.x);
                const dy = Math.abs(touch.clientY - this._longPressStartPos.y);
                if (dx > 8 || dy > 8) cancelPress();
            }, { passive: true });

            list.addEventListener('touchend', cancelPress, { passive: true });
            list.addEventListener('touchcancel', cancelPress, { passive: true });

            // Mouse long press
            list.addEventListener('mousedown', (e) => {
                if (e.button !== 0) return;
                const item = e.target.closest('.fb-chat-item[data-chat-id]');
                if (!item || e.target.closest('.fb-chat-accordion')) return;
                startPress(item.dataset.chatId, item.dataset.chatType, item.dataset.chatName, e.clientX, e.clientY);
            });

            list.addEventListener('mouseup', cancelPress);
            list.addEventListener('mouseleave', cancelPress);

            // Right-click
            list.addEventListener('contextmenu', (e) => {
                const item = e.target.closest('.fb-chat-item[data-chat-id]');
                if (!item) return;
                e.preventDefault();
                cancelPress();
                this.showContextMenu(item.dataset.chatId, item.dataset.chatType, item.dataset.chatName, e.clientX, e.clientY);
            });
        }

        showContextMenu(chatId, type, name, x, y) {
            this.hideContextMenu();

            const options = [];

            // Open full page
            if (type !== 'new_dm') {
                const url = type === 'room'
                    ? `/pages/chat-room.html?id=${chatId}`
                    : `/pages/conversation.html?id=${chatId}`;
                options.push({
                    icon: '↗',
                    label: 'Open Full Page',
                    action: () => { window.location.href = url; }
                });
            }

            // Hide from list
            if (type === 'conversation') {
                options.push({
                    icon: '✕',
                    label: 'Hide from List',
                    action: () => {
                        this.chats = this.chats.filter(c => c.id !== chatId);
                        this.renderChats();
                    }
                });
            } else if (type === 'new_dm') {
                const playerId = chatId.replace('new_dm_', '');
                options.push({
                    icon: '✕',
                    label: 'Hide from List',
                    action: () => {
                        this.teammates = this.teammates.filter(p => p.id !== playerId);
                        this.leaguePlayers = this.leaguePlayers.filter(p => p.id !== playerId);
                        this.renderTeammates();
                        this.renderLeaguePlayers();
                    }
                });
            } else if (type === 'room') {
                options.push({
                    icon: '✕',
                    label: 'Hide from List',
                    action: () => {
                        this.rooms = this.rooms.filter(r => r.id !== chatId);
                        this.renderRooms();
                    }
                });
            }

            if (!options.length) return;

            const menu = document.createElement('div');
            menu.id = 'chatContextMenu';
            menu.style.cssText = `
                position: fixed;
                z-index: 99999;
                background: var(--bg-card, #1e2a47);
                border: 1px solid rgba(255,255,255,0.15);
                border-radius: 10px;
                box-shadow: 0 8px 32px rgba(0,0,0,0.6);
                min-width: 160px;
                padding: 6px 0;
                overflow: hidden;
            `;

            // Name header
            const header = document.createElement('div');
            header.style.cssText = `
                padding: 8px 16px 6px;
                font-size: 11px;
                font-weight: 700;
                color: var(--teal, #91D7EB);
                letter-spacing: 0.5px;
                border-bottom: 1px solid rgba(255,255,255,0.08);
                margin-bottom: 4px;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
                max-width: 200px;
            `;
            header.textContent = name || 'Chat';
            menu.appendChild(header);

            options.forEach(opt => {
                const btn = document.createElement('button');
                btn.style.cssText = `
                    display: flex; align-items: center; gap: 10px;
                    width: 100%; padding: 9px 16px;
                    background: none; border: none;
                    color: var(--text-light, #f0f0f0);
                    font-size: 13px; cursor: pointer;
                    text-align: left; font-family: inherit;
                    transition: background 0.15s;
                `;
                btn.innerHTML = `<span style="font-size:14px;width:16px;text-align:center;">${opt.icon}</span><span>${opt.label}</span>`;
                btn.addEventListener('mouseenter', () => { btn.style.background = 'rgba(255,255,255,0.07)'; });
                btn.addEventListener('mouseleave', () => { btn.style.background = 'none'; });
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.hideContextMenu();
                    opt.action();
                });
                menu.appendChild(btn);
            });

            document.body.appendChild(menu);

            // Position: keep on screen
            const menuW = 180;
            const menuH = options.length * 38 + 48;
            let left = x;
            let top = y;
            if (left + menuW > window.innerWidth - 8) left = window.innerWidth - menuW - 8;
            if (top + menuH > window.innerHeight - 8) top = window.innerHeight - menuH - 8;
            if (left < 8) left = 8;
            if (top < 8) top = 8;
            menu.style.left = left + 'px';
            menu.style.top = top + 'px';

            // Dismiss on outside click/touch
            const dismiss = (e) => {
                if (!menu.contains(e.target)) {
                    this.hideContextMenu();
                    document.removeEventListener('click', dismiss);
                    document.removeEventListener('touchstart', dismiss);
                }
            };
            setTimeout(() => {
                document.addEventListener('click', dismiss);
                document.addEventListener('touchstart', dismiss, { passive: true });
            }, 10);
        }

        hideContextMenu() {
            const existing = document.getElementById('chatContextMenu');
            if (existing) existing.remove();
        }

        renderRooms() {
            const listEl = document.getElementById('chatDrawerRoomList');
            const section = document.getElementById('chatSection-rooms');
            const countEl = document.getElementById('chatCount-rooms');
            if (!listEl) return;

            // Always show the ROOMS section so user can create group chats
            if (section) section.style.display = '';

            if (!this.rooms || !this.rooms.length) {
                listEl.innerHTML = '<div class="fb-chat-empty">No chatrooms yet</div>';
                if (countEl) countEl.textContent = '';
                this.updateUnreadIndicator();
                return;
            }

            if (countEl) countEl.textContent = this.rooms.length;

            const typeIcons = {
                league: '🏆', team: '👥', match: '🎯',
                tournament: '🏅', tournament_event: '📅'
            };

            let html = '';
            this.rooms.forEach(room => {
                const icon = typeIcons[room.type] || '💬';
                const timeStr = this.formatTimeAgo(room.lastMessageTime);
                const preview = this.escapeHtml((room.lastMessage || '').substring(0, 30));
                const hasMore = room.lastMessage && room.lastMessage.length > 30;
                html += this._buildChatItemHTML(
                    room.id, 'room', room.name, '',
                    icon, 'style="font-size: 18px;"', timeStr, preview, hasMore, room.unread,
                    `/pages/chat-room.html?id=${room.id}`
                );
            });
            listEl.innerHTML = html;

            this.updateUnreadIndicator();
        }

        updateUnreadIndicator() {
            const hasUnread =
                this.chats.some(c => c.unread) ||
                (this.rooms && this.rooms.some(r => r.unread));

            const chatBtn = document.getElementById('brdcChatBtn');
            if (chatBtn) chatBtn.classList.toggle('has-unread', hasUnread);

            const mobileNavChat = document.querySelector('.mobile-nav-item[data-page="chat"]');
            if (mobileNavChat) mobileNavChat.classList.toggle('has-unread', hasUnread);
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
            if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
            return name.substring(0, 2).toUpperCase();
        }

        escapeHtml(text) {
            if (!text) return '';
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        }

        escapeAttr(text) {
            if (!text) return '';
            return String(text)
                .replace(/&/g, '&amp;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#39;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;');
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

        formatDateDivider(isoString) {
            if (!isoString) return '';
            const date = new Date(isoString);
            const today = new Date();
            const yesterday = new Date(today);
            yesterday.setDate(yesterday.getDate() - 1);
            if (date.toDateString() === today.toDateString()) return 'Today';
            if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
            return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
        }

        destroy() {
            Object.keys(this.openAccordions).forEach(id => this.closeAccordion(id));
            if (this.overlay) this.overlay.remove();
            if (this.sidebar) this.sidebar.remove();
        }
    }

    /**
     * Wire up brdc-navigation chat button to the drawer (sole handler)
     */
    function wireChatButton() {
        const chatBtn = document.getElementById('brdcChatBtn');
        if (chatBtn && window.chatDrawer) {
            if (!chatBtn.hasAttribute('data-chat-drawer-wired')) {
                chatBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    window.chatDrawer.toggle();
                });
                chatBtn.setAttribute('data-chat-drawer-wired', 'true');
            }
        }
    }

    // ==================== Auto-initialize ====================

    if (document.body.hasAttribute('data-no-chat-drawer')) {
        // Opt-out
    }
    else {
        // If fb-nav.js already created a ChatSidebar, remove its DOM so we can
        // replace it with our enhanced ChatDrawer (accordion inline chat).
        if (window.FBNav && window.FBNav.chatSidebar && window.FBNav.chatSidebar.sidebar) {
            try {
                if (window.FBNav.chatSidebar.overlay) window.FBNav.chatSidebar.overlay.remove();
                if (window.FBNav.chatSidebar.sidebar) window.FBNav.chatSidebar.sidebar.remove();
            } catch (e) {}
        }

        injectStyles();
        const drawer = new ChatDrawer();
        drawer.init();
        window.chatDrawer = drawer;
        if (window.FBNav) window.FBNav.chatSidebar = drawer;
        wireChatButton();
    }

    setTimeout(wireChatButton, 500);
    setTimeout(wireChatButton, 1500);

    // On desktop the chat panel is permanently visible — pre-load chat data.
    if (document.body.classList.contains('is-desktop')) {
        setTimeout(() => {
            if (window.chatDrawer && typeof window.chatDrawer.loadRecentChats === 'function') {
                window.chatDrawer.loadRecentChats();
            }
        }, 600);
    }

})();
