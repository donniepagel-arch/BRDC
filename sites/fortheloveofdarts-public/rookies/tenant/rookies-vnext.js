(function () {
    const ROOKIES_HOME = '/rookies/';
    const ROOKIES_DASHBOARD = '/rookies/dashboard/';
    const ROOKIES_PAGES = '/rookies/pages/';
    const ROOKIES_LOGO = 'https://static.wixstatic.com/media/e21a2d_89e369b22e004fdd8c3a7f3515ab7c22~mv2.png/v1/fill/w_360,h_90,al_c,q_85,usm_0.66_1.00_0.01,enc_avif,quality_auto/Rookies%20Logo.png';

    window.ROOKIES_TENANT = {
        name: 'Rookies Darts Hub',
        venue: 'Rookies Sports Bar & Grill',
        boards: 12,
        phone: '(440) 842-0834',
        address: '6913 W 130th St, Parma Heights, OH'
    };

    function rewriteUrl(url) {
        if (!url) return url;
        if (url === '/pages/home-vnext.html' || url === '/rookies/pages/home-vnext.html') return ROOKIES_DASHBOARD;
        if (url.startsWith('/pages/')) return `${ROOKIES_PAGES}${url.slice('/pages/'.length)}`;
        return url;
    }

    function rewriteLinks(root = document) {
        root.querySelectorAll('a[href^="/pages/"]').forEach(link => {
            link.setAttribute('href', rewriteUrl(link.getAttribute('href')));
        });
        root.querySelectorAll('a[href="/pages/home-vnext.html"]').forEach(link => {
            link.setAttribute('href', ROOKIES_DASHBOARD);
        });
    }

    function brandText() {
        document.title = document.title
            .replace('BRDC Clubhouse VNext', 'Rookies Darts Hub')
            .replace('BRDC', 'Rookies');

        const replacements = [
            ['BRDC SOCIAL', 'Rookies Social'],
            ['BRDC Social', 'Rookies Social'],
            ['Your BRDC', 'Rookies Darts'],
            ['Loading your BRDC home...', 'Loading the Rookies darts hub...'],
            ['BRDC Dashboard', 'Rookies Darts Hub'],
            ['Burning River Dart Club', 'Rookies Darts'],
            ['Recent BRDC activity', 'Recent Rookies darts activity'],
            ['What is happening', 'Rookies darts calendar'],
            ['Dashboard', 'Hub'],
            ['dashboard', 'hub']
        ];

        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
        const nodes = [];
        while (walker.nextNode()) nodes.push(walker.currentNode);
        nodes.forEach(node => {
            let text = node.nodeValue;
            replacements.forEach(([from, to]) => {
                text = text.replaceAll(from, to);
            });
            node.nodeValue = text;
        });
    }

    function brandImages() {
        document.querySelectorAll('img[src="/images/gold_logo.png"], img[alt="BRDC"]').forEach(img => {
            img.src = ROOKIES_LOGO;
            img.alt = 'Rookies Sports Bar & Grill';
        });
    }

    function currentSession() {
        try {
            return JSON.parse(localStorage.getItem('brdc_session') || 'null');
        } catch (error) {
            return null;
        }
    }

    function hasPlayerSession(session = currentSession()) {
        return Boolean(session?.player_id || session?.id);
    }

    function isDirectorSession(session = currentSession()) {
        try {
            if (!hasPlayerSession(session)) return false;
            return session?.demo_mode === true
                || session?.is_director === true
                || session?.is_admin === true
                || session?.is_master_admin === true;
        } catch (error) {
            return false;
        }
    }

    function currentPage() {
        const path = window.location.pathname;
        const normalizedPath = path.replace(/\/+$/, '') || '/';
        if (path.includes('director') || path.includes('create-league') || path.includes('create-tournament') || path.includes('league-import')) return 'admin';
        if (path.includes('message') || path.includes('conversation') || path.includes('chat-room')) return 'chat';
        if (path.includes('event') || path.includes('tournament')) return 'events';
        if (path.includes('profile')) return 'profile';
        if (normalizedPath === '/rookies' || normalizedPath === '/rookies/dashboard' || path.includes('/dashboard')) return 'home';
        return '';
    }

    function navIcon(name) {
        const svgAttr = 'xmlns="http://www.w3.org/2000/svg" width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"';
        const icons = {
            events: `<svg ${svgAttr}><rect x="4" y="5" width="16" height="15" rx="2"/><path d="M8 3v4M16 3v4M4 10h16"/></svg>`,
            chat: `<svg ${svgAttr}><path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z"/></svg>`,
            home: `<svg class="rookies-home-plate-icon" xmlns="http://www.w3.org/2000/svg" width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 4h12v9.5L12 20 6 13.5z"/></svg>`,
            alerts: `<svg ${svgAttr}><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/></svg>`,
            profile: `<svg ${svgAttr}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`,
            admin: `<svg ${svgAttr}><path d="M12 3l7 4v5c0 4.5-2.8 7.8-7 9-4.2-1.2-7-4.5-7-9V7z"/><path d="M9.5 12.5l1.8 1.8 3.7-4"/></svg>`
        };
        return icons[name] || '';
    }

    function navLink({ page, href, label, icon, active, attrs = '' }) {
        return `
            <a href="${href}" class="mobile-nav-item ${page === 'home' ? 'rookies-home-tab' : ''} ${active ? 'active' : ''}" data-page="${page}" ${active ? 'aria-current="page"' : ''} ${attrs}>
                <span class="mobile-nav-icon ${page === 'home' ? 'rookies-home-plate' : ''}" aria-hidden="true">${navIcon(icon)}</span>
                <span class="mobile-nav-label">${label}</span>
            </a>
        `;
    }

    function syncNavState(nav) {
        const page = currentPage();
        nav.querySelectorAll('.mobile-nav-item[data-page]').forEach(item => {
            const isActive = item.dataset.page === page;
            item.classList.toggle('active', isActive);
            if (isActive) {
                item.setAttribute('aria-current', 'page');
            } else {
                item.removeAttribute('aria-current');
            }
        });
    }

    function tuneDesktopAccount(signedIn, accountPage) {
        const accountLink = document.querySelector('.brdc-desktop-nav .desktop-nav-link[data-page="profile"], .brdc-desktop-nav .desktop-nav-link[data-page="admin"], .brdc-desktop-nav .desktop-nav-link[data-page="login"]');
        if (!accountLink) return;
        const label = Array.from(accountLink.querySelectorAll('span'))
            .find(span => !span.classList.contains('desktop-nav-link-icon'));
        if (!signedIn) {
            accountLink.href = ROOKIES_HOME;
            accountLink.dataset.page = 'login';
            accountLink.classList.remove('active');
            if (label) label.textContent = 'Login';
            return;
        }
        if (accountPage === 'admin') {
            accountLink.href = '/rookies/pages/director-home-vnext.html';
            accountLink.dataset.page = 'admin';
            if (label) label.textContent = 'Admin';
            return;
        }
        accountLink.href = '/rookies/pages/player-profile-vnext.html';
        accountLink.dataset.page = 'profile';
        if (label) label.textContent = 'Profile';
    }

    function tuneNavigation() {
        const nav = document.getElementById('brdcMobileNav');
        const session = currentSession();
        const signedIn = hasPlayerSession(session) && !document.body.classList.contains('is-signed-out');
        const accountPage = signedIn && isDirectorSession(session) ? 'admin' : signedIn ? 'profile' : 'login';
        tuneDesktopAccount(signedIn, accountPage);
        if (nav && (!nav.dataset.rookiesTuned || nav.dataset.rookiesAccount !== accountPage)) {
            const page = currentPage();
            const accountHref = accountPage === 'admin'
                ? '/rookies/pages/director-home-vnext.html'
                : signedIn
                    ? '/rookies/pages/player-profile-vnext.html'
                    : '/rookies/';
            const accountLabel = accountPage === 'admin' ? 'Admin' : signedIn ? 'Me' : 'Login';
            const accountAttrs = signedIn ? '' : 'data-rookies-login-open';
            const homeHref = document.body.classList.contains('is-signed-out') ? ROOKIES_HOME : ROOKIES_DASHBOARD;

            nav.classList.add('rookies-bottom-nav');
            nav.innerHTML = [
                navLink({ page: 'events', href: '/rookies/pages/events-vnext.html', label: 'Events', icon: 'events', active: page === 'events' }),
                navLink({ page: 'chat', href: '/rookies/pages/messages-vnext.html', label: 'Chat', icon: 'chat', active: page === 'chat' }),
                navLink({ page: 'home', href: homeHref, label: 'Home', icon: 'home', active: page === 'home' }),
                `<button class="mobile-nav-item" data-action="notifications" aria-label="Notifications, 0 unread">
                    <span class="mobile-nav-icon fb-footer-tab-badge" data-count="0" aria-hidden="true">${navIcon('alerts')}</span>
                    <span class="mobile-nav-label">Alerts</span>
                </button>`,
                navLink({ page: accountPage, href: accountHref, label: accountLabel, icon: accountPage === 'admin' ? 'admin' : 'profile', active: page === accountPage, attrs: accountAttrs })
            ].join('');
            nav.querySelector('[data-action="notifications"]')?.addEventListener('click', event => {
                event.preventDefault();
                window.brdcNav?.toggleNotifications?.();
            });
            nav.dataset.rookiesTuned = 'true';
            nav.dataset.rookiesAccount = accountPage;
        }
        if (nav) syncNavState(nav);

        const sidebar = document.querySelector('.fb-sidebar');
        const overlay = document.querySelector('.fb-sidebar-overlay');
        sidebar?.classList.remove('open');
        overlay?.classList.remove('open');
        document.body.classList.remove('fb-sidebar-open');

        const menuButton = document.getElementById('brdcSidebarToggle');
        const publicBackButton = currentPage() === 'home' ? document.getElementById('brdcBackBtn') : null;
        const legacyShellButton = menuButton || publicBackButton;
        if (legacyShellButton && !legacyShellButton.dataset.rookiesDisabled) {
            const spacer = document.createElement('span');
            spacer.className = 'fb-header-spacer rookies-header-spacer';
            spacer.setAttribute('aria-hidden', 'true');
            legacyShellButton.replaceWith(spacer);
        }
    }

    function interceptInternalNavigation() {
        document.addEventListener('click', event => {
            const link = event.target.closest('a[href^="/pages/"]');
            if (!link) return;
            const next = rewriteUrl(link.getAttribute('href'));
            if (!next || next === link.getAttribute('href')) return;
            event.preventDefault();
            window.location.href = next;
        }, true);
    }

    function patchLocationAssigns() {
        const nativeAssign = window.location.assign.bind(window.location);
        window.rookiesNavigate = url => nativeAssign(rewriteUrl(String(url || '')));
    }

    function boot() {
        rewriteLinks();
        brandText();
        brandImages();
        tuneNavigation();
        interceptInternalNavigation();
        patchLocationAssigns();
        document.body.classList.add('rookies-tenant');
        window.addEventListener('rookies:auth-mode-changed', tuneNavigation);
        setTimeout(tuneNavigation, 250);
        setTimeout(tuneNavigation, 1200);

        const observer = new MutationObserver(mutations => {
            for (const mutation of mutations) {
                mutation.addedNodes.forEach(node => {
                    if (node.nodeType !== 1) return;
                    rewriteLinks(node);
                    brandImages();
                    tuneNavigation();
                });
            }
        });
        observer.observe(document.body, { childList: true, subtree: true });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot);
    } else {
        boot();
    }
})();
