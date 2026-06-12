/**
 * BRDC Accessibility Utilities
 * Shared helpers for WCAG 2.1 AA compliance
 * Usage: Loaded automatically via brdc-navigation-init.js
 */
(function() {
    'use strict';

    /**
     * Make a non-semantic element keyboard-interactive.
     * Adds tabindex="0", role, and Enter/Space keydown handler.
     */
    function makeClickable(element, role) {
        if (role) element.setAttribute('role', role);
        if (!element.hasAttribute('tabindex')) {
            element.setAttribute('tabindex', '0');
        }
        element.addEventListener('keydown', function(e) {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                element.click();
            }
        });
    }

    /**
     * Initialize a tab interface with ARIA roles and keyboard navigation.
     * Follows WAI-ARIA Tabs pattern.
     */
    function initTabs(tabContainerSelector, options) {
        options = options || {};
        var container = document.querySelector(tabContainerSelector);
        if (!container) return;

        container.setAttribute('role', 'tablist');
        if (options.label) container.setAttribute('aria-label', options.label);

        var tabSelector = options.tabSelector || '.tab, .dash-tab, .tab-btn, .main-tab';
        var tabs = container.querySelectorAll(tabSelector);

        tabs.forEach(function(tab, idx) {
            tab.setAttribute('role', 'tab');
            var isActive = tab.classList.contains('active');
            tab.setAttribute('tabindex', isActive ? '0' : '-1');
            tab.setAttribute('aria-selected', isActive ? 'true' : 'false');

            if (options.panelIds && options.panelIds[idx]) {
                tab.setAttribute('aria-controls', options.panelIds[idx]);
            }
        });

        container.addEventListener('keydown', function(e) {
            var currentTab = document.activeElement;
            if (!currentTab || currentTab.getAttribute('role') !== 'tab') return;

            var tabsArray = Array.from(tabs).filter(function(t) {
                return !t.hidden && t.style.display !== 'none';
            });
            var currentIdx = tabsArray.indexOf(currentTab);
            var newIdx = currentIdx;

            switch (e.key) {
                case 'ArrowRight':
                case 'ArrowDown':
                    newIdx = (currentIdx + 1) % tabsArray.length;
                    break;
                case 'ArrowLeft':
                case 'ArrowUp':
                    newIdx = (currentIdx - 1 + tabsArray.length) % tabsArray.length;
                    break;
                case 'Home':
                    newIdx = 0;
                    break;
                case 'End':
                    newIdx = tabsArray.length - 1;
                    break;
                default:
                    return;
            }

            e.preventDefault();
            tabsArray[newIdx].focus();
            tabsArray[newIdx].click();
        });
    }

    /**
     * Update ARIA state when a tab is activated.
     * Call from existing switchTab/switchDashTab functions.
     */
    function activateTab(activeTab, allTabs) {
        allTabs.forEach(function(tab) {
            tab.setAttribute('aria-selected', 'false');
            tab.setAttribute('tabindex', '-1');
        });
        activeTab.setAttribute('aria-selected', 'true');
        activeTab.setAttribute('tabindex', '0');
    }

    /**
     * Focus trap for modals/dialogs.
     * Returns a cleanup function to remove the trap.
     */
    function trapFocus(containerElement) {
        var focusableSelectors = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

        function getFocusableElements() {
            return Array.from(containerElement.querySelectorAll(focusableSelectors))
                .filter(function(el) { return el.offsetParent !== null; });
        }

        function handleKeydown(e) {
            if (e.key !== 'Tab') return;

            var focusable = getFocusableElements();
            if (focusable.length === 0) return;

            var first = focusable[0];
            var last = focusable[focusable.length - 1];

            if (e.shiftKey) {
                if (document.activeElement === first) {
                    e.preventDefault();
                    last.focus();
                }
            } else {
                if (document.activeElement === last) {
                    e.preventDefault();
                    first.focus();
                }
            }
        }

        containerElement.addEventListener('keydown', handleKeydown);

        var focusable = getFocusableElements();
        if (focusable.length > 0) {
            focusable[0].focus();
        }

        return function cleanup() {
            containerElement.removeEventListener('keydown', handleKeydown);
        };
    }

    /**
     * Make a modal accessible: add role, aria-modal, labelledby,
     * trap focus, and handle Escape key.
     * Returns a cleanup function.
     */
    function initModal(modalElement, options) {
        options = options || {};
        modalElement.setAttribute('role', 'dialog');
        modalElement.setAttribute('aria-modal', 'true');

        if (options.labelledBy) {
            modalElement.setAttribute('aria-labelledby', options.labelledBy);
        } else if (options.label) {
            modalElement.setAttribute('aria-label', options.label);
        }

        var previouslyFocused = document.activeElement;
        var cleanupTrap = trapFocus(modalElement);

        function handleEscape(e) {
            if (e.key === 'Escape' && options.onClose) {
                options.onClose();
            }
        }

        document.addEventListener('keydown', handleEscape);

        return function cleanup() {
            cleanupTrap();
            document.removeEventListener('keydown', handleEscape);
            if (previouslyFocused && previouslyFocused.focus) {
                previouslyFocused.focus();
            }
        };
    }

    /**
     * Announce a message to screen readers via aria-live region.
     */
    function announce(message, priority) {
        priority = priority || 'polite';
        var region = document.getElementById('brdc-a11y-live');
        if (!region) {
            region = document.createElement('div');
            region.id = 'brdc-a11y-live';
            region.setAttribute('aria-live', priority);
            region.setAttribute('aria-atomic', 'true');
            region.className = 'sr-only';
            document.body.appendChild(region);
        }
        region.setAttribute('aria-live', priority);
        region.textContent = '';
        setTimeout(function() { region.textContent = message; }, 100);
    }

    // Expose globally
    window.A11y = {
        makeClickable: makeClickable,
        initTabs: initTabs,
        activateTab: activateTab,
        trapFocus: trapFocus,
        initModal: initModal,
        announce: announce
    };
})();
