/**
 * BRDC Toast Notification System
 * Usage: <script src="/js/brdc-toast.js"></script>
 * API: showToast(msg, type, duration), toastSuccess(msg), toastError(msg), toastWarning(msg), toastInfo(msg)
 */
(function() {
    'use strict';

    // Inject styles
    const style = document.createElement('style');
    style.textContent = `
        .brdc-toast-container {
            position: fixed;
            top: 16px;
            right: 16px;
            z-index: 100000;
            display: flex;
            flex-direction: column;
            gap: 8px;
            pointer-events: none;
        }
        @media (max-width: 600px) {
            .brdc-toast-container {
                left: 16px;
                right: 16px;
            }
        }
        .brdc-toast {
            min-width: 280px;
            max-width: 400px;
            padding: 14px 16px;
            border-radius: 12px;
            font-size: 14px;
            line-height: 1.4;
            color: var(--text-light, #f0f0f0);
            border: 2px solid;
            box-shadow: 4px 4px 0 rgba(0,0,0,0.3);
            display: flex;
            align-items: flex-start;
            gap: 10px;
            pointer-events: auto;
            cursor: pointer;
            animation: brdcToastIn 0.3s ease-out;
        }
        @media (max-width: 600px) {
            .brdc-toast {
                min-width: unset;
                max-width: unset;
                width: 100%;
            }
        }
        .brdc-toast.success {
            background: rgba(34, 197, 94, 0.15);
            border-color: var(--success, #22c55e);
        }
        .brdc-toast.error {
            background: rgba(239, 68, 68, 0.15);
            border-color: var(--danger, #ef4444);
        }
        .brdc-toast.warning {
            background: rgba(253, 216, 53, 0.15);
            border-color: var(--yellow, #FDD835);
        }
        .brdc-toast.info {
            background: rgba(145, 215, 235, 0.15);
            border-color: var(--teal, #91D7EB);
        }
        .brdc-toast-icon {
            font-size: 16px;
            font-weight: 700;
            flex-shrink: 0;
            width: 20px;
            text-align: center;
        }
        .brdc-toast.success .brdc-toast-icon { color: var(--success, #22c55e); }
        .brdc-toast.error .brdc-toast-icon { color: var(--danger, #ef4444); }
        .brdc-toast.warning .brdc-toast-icon { color: var(--yellow, #FDD835); }
        .brdc-toast.info .brdc-toast-icon { color: var(--teal, #91D7EB); }
        .brdc-toast-msg { flex: 1; }
        .brdc-toast-x {
            opacity: 0.5;
            font-size: 14px;
            padding: 0 2px;
            flex-shrink: 0;
        }
        .brdc-toast-x:hover { opacity: 1; }
        @keyframes brdcToastIn {
            from { transform: translateX(40px); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
        @keyframes brdcToastOut {
            from { transform: translateX(0); opacity: 1; max-height: 100px; margin-bottom: 0; }
            to { transform: translateX(40px); opacity: 0; max-height: 0; margin-bottom: -8px; }
        }
    `;
    document.head.appendChild(style);

    let container = null;

    function getContainer() {
        if (!container || !document.body.contains(container)) {
            container = document.createElement('div');
            container.className = 'brdc-toast-container';
            container.setAttribute('role', 'log');
            container.setAttribute('aria-live', 'polite');
            container.setAttribute('aria-label', 'Notifications');
            document.body.appendChild(container);
        }
        return container;
    }

    const ICONS = { success: '✓', error: '✕', warning: '⚠', info: 'ℹ' };
    const DURATIONS = { success: 3000, error: 5000, warning: 4000, info: 4000 };

    function showToast(message, type = 'info', duration) {
        if (typeof duration === 'undefined') duration = DURATIONS[type] || 4000;

        const el = document.createElement('div');
        el.className = `brdc-toast ${type}`;
        if (type === 'error') el.setAttribute('role', 'alert');
        el.innerHTML = `
            <span class="brdc-toast-icon" aria-hidden="true">${ICONS[type] || ICONS.info}</span>
            <span class="brdc-toast-msg">${message}</span>
            <span class="brdc-toast-x" aria-label="Dismiss notification">✕</span>
        `;

        function dismiss() {
            if (el._dismissed) return;
            el._dismissed = true;
            el.style.animation = 'brdcToastOut 0.3s ease-in forwards';
            setTimeout(() => { el.remove(); }, 300);
        }

        el.querySelector('.brdc-toast-x').onclick = (e) => {
            e.stopPropagation();
            dismiss();
        };
        el.onclick = dismiss;

        getContainer().appendChild(el);

        if (duration > 0) {
            setTimeout(dismiss, duration);
        }

        return el;
    }

    // Expose globally
    window.showToast = showToast;
    window.toastSuccess = (msg, dur) => showToast(msg, 'success', dur);
    window.toastError = (msg, dur) => showToast(msg, 'error', dur);
    window.toastWarning = (msg, dur) => showToast(msg, 'warning', dur);
    window.toastInfo = (msg, dur) => showToast(msg, 'info', dur);
})();
