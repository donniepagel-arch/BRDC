/**
 * BRDC Tab Swipe Utility
 * Adds horizontal swipe gesture support to tabbed interfaces.
 *
 * Usage:
 *   import { initTabSwipe } from '/js/tab-swipe.js';
 *   initTabSwipe({
 *       container: '.tab-content-area',  // swipeable area (selector or element)
 *       getActiveIndex: () => currentIndex,
 *       getTabCount: () => totalTabs,
 *       onSwipe: (newIndex) => switchToTab(newIndex)
 *   });
 */

export function initTabSwipe({ container, getActiveIndex, getTabCount, onSwipe }) {
    const el = typeof container === 'string' ? document.querySelector(container) : container;
    if (!el) return;

    let startX = 0;
    let startY = 0;
    let tracking = false;

    el.addEventListener('touchstart', (e) => {
        const touch = e.touches[0];
        // Ignore swipes starting near screen edges (browser back/forward gesture)
        if (touch.clientX < 20 || touch.clientX > window.innerWidth - 20) return;
        startX = touch.clientX;
        startY = touch.clientY;
        tracking = true;
    }, { passive: true });

    el.addEventListener('touchmove', (e) => {
        if (!tracking) return;
        const touch = e.touches[0];
        const deltaY = Math.abs(touch.clientY - startY);
        // Cancel if vertical movement dominates (user is scrolling)
        if (deltaY > 30) {
            tracking = false;
        }
    }, { passive: true });

    el.addEventListener('touchend', (e) => {
        if (!tracking) return;
        tracking = false;

        const endX = e.changedTouches[0].clientX;
        const deltaX = startX - endX;

        // Need at least 50px horizontal swipe
        if (Math.abs(deltaX) < 50) return;

        const current = getActiveIndex();
        const count = getTabCount();

        if (deltaX > 0 && current < count - 1) {
            // Swipe left → next tab
            onSwipe(current + 1);
        } else if (deltaX < 0 && current > 0) {
            // Swipe right → previous tab
            onSwipe(current - 1);
        }
    }, { passive: true });
}
