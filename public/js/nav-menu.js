/**
 * BRDC Navigation Menu Component
 * Adds consistent navigation with home logo + hamburger menu to all pages
 * Supports role-based visibility: admin/director items hidden from regular players
 */

(function () {
    // Check if user has admin/director role from session
    function isAdminUser() {
        try {
            const session = JSON.parse(localStorage.getItem('brdc_session') || '{}');
            return session.is_admin || session.is_master_admin || session.is_director || false;
        } catch (e) {
            return false;
        }
    }

    // Menu items configuration
    // role: 'all' = everyone, 'admin' = admin/director only
    const allMenuItems = [
        { label: 'DASHBOARD', href: '/pages/dashboard.html', icon: '&#128100;', role: 'all' },
        { label: 'SCORER', href: '/pages/game-setup.html', icon: '&#127919;', role: 'all' },
        { label: 'PRACTICE', href: '/virtual-darts/index.html', icon: '&#127919;', role: 'all' },
        { label: 'LIVE', href: '/pages/live-scoreboard.html', icon: '&#128308;', role: 'admin' },
        { label: 'MATCHMAKER', href: '/pages/matchmaker-view.html', icon: '&#128152;', role: 'admin' },
        { label: 'FIND EVENTS', href: '/pages/events-hub.html', icon: '&#128205;', role: 'all' },
        { label: 'CHAT', href: '/pages/chat-room.html', icon: '&#128488;', role: 'all' },
        { label: 'MESSAGES', href: '/pages/messages.html', icon: '&#128172;', role: 'all', hasBadge: true },
        // Admin/Director only
        { label: 'LEAGUE', href: '/pages/league-view.html', icon: '&#127942;', role: 'admin' },
        { label: 'CREATE LEAGUE', href: '/pages/create-league.html', icon: '&#128203;', role: 'admin' },
        { label: 'CREATE TOURNAMENT', href: '/pages/create-tournament.html', icon: '&#127942;', role: 'admin' },
        { label: 'ADMIN', href: '/pages/admin.html', icon: '&#128272;', role: 'admin' },
        { label: 'DART TRADER', href: '/pages/dart-trader.html', icon: '&#128176;', role: 'admin' },
        // Always last
        { label: 'LOGOUT', href: '#', icon: '&#128682;', action: 'logout', role: 'all' }
    ];

    // Filter items based on role
    const admin = isAdminUser();
    const menuItems = allMenuItems.filter(item => item.role === 'all' || (item.role === 'admin' && admin));

    // Inject styles
    const styles = document.createElement('style');
    styles.textContent = `
        /* Nav Menu Styles */
        .nav-home-link {
            display: flex;
            align-items: center;
            text-decoration: none;
            cursor: pointer;
        }
        .nav-home-link:hover .header-logo {
            transform: scale(1.1);
        }
        .header-logo {
            transition: all 0.2s ease;
        }

        .menu-btn {
            background: transparent;
            border: 2px solid var(--teal, #91D7EB);
            color: var(--teal, #91D7EB);
            width: 44px;
            height: 44px;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 5px;
            cursor: pointer;
            margin-left: auto;
            transition: all 0.2s;
            border-radius: 4px;
        }
        .menu-btn:hover {
            background: var(--teal, #91D7EB);
        }
        .menu-btn:hover .menu-bar {
            background: var(--black, #1a1a2e);
        }
        .menu-bar {
            width: 22px;
            height: 3px;
            background: var(--teal, #91D7EB);
            transition: all 0.2s;
            border-radius: 2px;
        }
        .menu-btn.active .menu-bar:nth-child(1) {
            transform: rotate(45deg) translate(5px, 5px);
        }
        .menu-btn.active .menu-bar:nth-child(2) {
            opacity: 0;
        }
        .menu-btn.active .menu-bar:nth-child(3) {
            transform: rotate(-45deg) translate(6px, -6px);
        }

        .nav-overlay {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(15, 15, 26, 0.95);
            backdrop-filter: blur(10px);
            z-index: 999;
            opacity: 0;
            visibility: hidden;
            transition: all 0.3s ease;
        }
        .nav-overlay.open {
            opacity: 1;
            visibility: visible;
        }

        .nav-menu {
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%) scale(0.9);
            z-index: 1000;
            display: flex;
            flex-direction: column;
            gap: 8px;
            opacity: 0;
            visibility: hidden;
            transition: all 0.3s ease;
            max-height: 85vh;
            overflow-y: auto;
        }
        .nav-overlay.open + .nav-menu,
        .nav-menu.open {
            opacity: 1;
            visibility: visible;
            transform: translate(-50%, -50%) scale(1);
        }

        .nav-menu-item {
            display: flex;
            align-items: center;
            gap: 15px;
            padding: 16px 40px;
            background: rgba(26, 26, 46, 0.9);
            border: 3px solid var(--black, #1a1a2e);
            color: white;
            text-decoration: none;
            font-family: 'Bebas Neue', cursive;
            font-size: 24px;
            letter-spacing: 3px;
            transition: all 0.2s ease;
            box-shadow: 5px 5px 0 rgba(0,0,0,0.3);
        }
        .nav-menu-item:hover {
            background: var(--pink, #FF469A);
            transform: translate(-3px, -3px);
            box-shadow: 8px 8px 0 rgba(0,0,0,0.4);
        }
        .nav-menu-item .nav-icon {
            font-size: 28px;
            width: 35px;
            text-align: center;
        }

        .nav-menu-item.nav-admin-item {
            border-color: var(--yellow, #FFD700);
            color: var(--yellow, #FFD700);
            font-size: 20px;
            padding: 12px 40px;
        }
        .nav-menu-item.nav-admin-item:hover {
            background: var(--yellow, #FFD700);
            color: var(--black, #1a1a2e);
        }

        .nav-menu-divider {
            height: 1px;
            background: rgba(255, 215, 0, 0.3);
            margin: 4px 0;
        }

        .nav-close-btn {
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 1001;
            background: transparent;
            border: 2px solid var(--pink, #FF469A);
            color: var(--pink, #FF469A);
            width: 50px;
            height: 50px;
            font-size: 28px;
            cursor: pointer;
            opacity: 0;
            visibility: hidden;
            transition: all 0.2s;
            font-family: 'Bebas Neue', cursive;
        }
        .nav-close-btn.open {
            opacity: 1;
            visibility: visible;
        }
        .nav-close-btn:hover {
            background: var(--pink, #FF469A);
            color: white;
        }

        .nav-badge {
            background: var(--pink, #FF469A);
            color: white;
            min-width: 20px;
            height: 20px;
            border-radius: 10px;
            font-size: 12px;
            font-family: 'Inter', sans-serif;
            font-weight: 700;
            display: none;
            align-items: center;
            justify-content: center;
            padding: 0 6px;
            margin-left: auto;
        }
        .nav-badge.visible {
            display: flex;
        }

        .nav-logout-item {
            border-color: var(--pink, #FF469A) !important;
            color: var(--pink, #FF469A) !important;
        }
        .nav-logout-item:hover {
            background: var(--pink, #FF469A) !important;
            color: white !important;
        }
    `;
    document.head.appendChild(styles);

    // Create menu elements
    function createMenu() {
        // Overlay
        const overlay = document.createElement('div');
        overlay.className = 'nav-overlay';
        overlay.onclick = closeMenu;
        document.body.appendChild(overlay);

        // Menu container
        const menu = document.createElement('nav');
        menu.className = 'nav-menu';

        let hasAdminSection = false;
        menu.innerHTML = menuItems.map(item => {
            // Add divider before first admin item
            let divider = '';
            if (item.role === 'admin' && !hasAdminSection) {
                hasAdminSection = true;
                divider = '<div class="nav-menu-divider"></div>';
            }

            if (item.action === 'logout') {
                return `
                    <a href="#" class="nav-menu-item nav-logout-item" onclick="brdcNav.logout(); return false;">
                        <span class="nav-icon">${item.icon}</span>
                        <span>${item.label}</span>
                    </a>
                `;
            }

            const adminClass = item.role === 'admin' ? ' nav-admin-item' : '';
            return `${divider}
                <a href="${item.href}" class="nav-menu-item${adminClass}">
                    <span class="nav-icon">${item.icon}</span>
                    <span>${item.label}</span>
                    ${item.hasBadge ? '<span class="nav-badge" id="navMessageBadge">0</span>' : ''}
                </a>
            `;
        }).join('');
        document.body.appendChild(menu);

        // Close button
        const closeBtn = document.createElement('button');
        closeBtn.className = 'nav-close-btn';
        closeBtn.innerHTML = '&times;';
        closeBtn.setAttribute('aria-label', 'Close menu');
        closeBtn.onclick = closeMenu;
        document.body.appendChild(closeBtn);
    }

    // Update existing header
    function updateHeader() {
        const header = document.querySelector('.header-bar');
        if (!header) return;

        // Find or create logo
        let logo = header.querySelector('.header-logo');

        // Wrap logo in home link if not already
        if (logo && !logo.closest('.nav-home-link')) {
            const homeLink = document.createElement('a');
            homeLink.href = '/';
            homeLink.className = 'nav-home-link';
            homeLink.title = 'Go to Home';
            logo.parentNode.insertBefore(homeLink, logo);
            homeLink.appendChild(logo);
        }

        // Add menu button if not exists
        if (!header.querySelector('.menu-btn')) {
            const menuBtn = document.createElement('button');
            menuBtn.className = 'menu-btn';
            menuBtn.innerHTML = `
                <span class="menu-bar"></span>
                <span class="menu-bar"></span>
                <span class="menu-bar"></span>
            `;
            menuBtn.onclick = toggleMenu;
            menuBtn.title = 'Menu';
            header.appendChild(menuBtn);
        }
    }

    function toggleMenu() {
        const overlay = document.querySelector('.nav-overlay');
        const menu = document.querySelector('.nav-menu');
        const closeBtn = document.querySelector('.nav-close-btn');
        const menuBtn = document.querySelector('.menu-btn');

        const isOpen = overlay.classList.contains('open');

        if (isOpen) {
            closeMenu();
        } else {
            overlay.classList.add('open');
            menu.classList.add('open');
            closeBtn.classList.add('open');
            menuBtn.classList.add('active');
            document.body.style.overflow = 'hidden';
        }
    }

    function closeMenu() {
        const overlay = document.querySelector('.nav-overlay');
        const menu = document.querySelector('.nav-menu');
        const closeBtn = document.querySelector('.nav-close-btn');
        const menuBtn = document.querySelector('.menu-btn');

        overlay?.classList.remove('open');
        menu?.classList.remove('open');
        closeBtn?.classList.remove('open');
        menuBtn?.classList.remove('active');
        document.body.style.overflow = '';
    }

    // Keyboard support
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeMenu();
        }
    });

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    function init() {
        createMenu();
        updateHeader();
        loadUnreadCount();
    }

    // Load unread message count if player is logged in
    async function loadUnreadCount() {
        const playerId = JSON.parse(localStorage.getItem('brdc_session') || '{}').player_id;
        if (!playerId) return;

        try {
            const { callFunction, auth, onAuthStateChanged } = await import('/js/firebase-config.js');

            // Wait for Firebase Auth to resolve before calling (needs Bearer token)
            if (!auth.currentUser) {
                await new Promise(resolve => {
                    const unsubscribe = onAuthStateChanged(auth, user => {
                        unsubscribe();
                        resolve(user);
                    });
                    setTimeout(() => { unsubscribe(); resolve(null); }, 5000);
                });
            }
            if (!auth.currentUser) return;

            const result = await callFunction('getUnreadCount', {});
            if (result.success && result.total_unread > 0) {
                updateMessageBadge(result.total_unread);
            }
        } catch (error) {
            // Unread count unavailable
        }
    }

    function updateMessageBadge(count) {
        const badge = document.getElementById('navMessageBadge');
        if (badge) {
            if (count > 0) {
                badge.textContent = count > 99 ? '99+' : count;
                badge.classList.add('visible');
            } else {
                badge.classList.remove('visible');
            }
        }
    }

    // Logout function
    function logout() {
        // Clear all session data
        localStorage.removeItem('brdc_session');
        localStorage.removeItem('brdc_player_id');
        localStorage.removeItem('brdc_player_name');
        localStorage.removeItem('brdc_secure_session');
        localStorage.removeItem('brdc_session_token');

        // Close menu
        closeMenu();

        // Redirect to home/login
        window.location.href = '/';
    }

    // Export for manual use
    window.brdcNav = { toggleMenu, closeMenu, updateMessageBadge, logout };
})();
