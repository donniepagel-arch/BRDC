/**
 * BRDC Share Utility
 * Shows a custom bottom-sheet with Facebook share, Copy Link, Screenshot, and Share to Chat options.
 * Works on all pages where match cards are rendered.
 */

let _shareStylesInjected = false;

function _injectShareStyles() {
    if (_shareStylesInjected) return;
    _shareStylesInjected = true;
    const style = document.createElement('style');
    style.textContent = `
        #brdc-share-sheet { position: fixed; inset: 0; z-index: 9999; }
        .share-backdrop { position: absolute; inset: 0; background: rgba(0,0,0,0.72); }
        .share-sheet {
            position: absolute; bottom: 0; left: 0; right: 0;
            background: var(--bg-panel, #16213e);
            border-top: 3px solid var(--pink, #FF469A);
            padding: 0 0 calc(12px + env(safe-area-inset-bottom, 0px));
        }
        .share-sheet-header {
            display: flex; align-items: center; justify-content: space-between;
            padding: 12px 16px 10px;
            border-bottom: 1px solid rgba(255,255,255,0.08);
            margin-bottom: 12px;
        }
        .share-sheet-back {
            background: none; border: none; cursor: pointer;
            color: var(--teal, #91D7EB); font-size: 14px; font-family: 'Oswald', sans-serif;
            letter-spacing: 0.5px; padding: 2px 0; display: flex; align-items: center; gap: 4px;
        }
        .share-sheet-title {
            font-family: 'Bebas Neue', cursive;
            font-size: 20px; letter-spacing: 2px;
            color: var(--yellow, #FDD835);
            margin: 0;
        }
        .share-sheet-close {
            background: none; border: none; cursor: pointer;
            color: var(--text-dim, #8a8aa3); font-size: 20px; line-height: 1;
            padding: 2px 4px;
        }
        .share-btn-list { padding: 0 12px; display: flex; flex-direction: column; gap: 8px; }
        .share-btn {
            display: flex; align-items: center; gap: 14px;
            width: 100%; padding: 13px 16px;
            border: 2px solid #000; border-radius: 8px;
            font-family: 'Oswald', sans-serif; font-size: 16px;
            letter-spacing: 1px; text-transform: uppercase;
            cursor: pointer; text-align: left;
            box-shadow: 3px 3px 0 rgba(0,0,0,0.5);
            transition: transform 0.08s, box-shadow 0.08s;
        }
        .share-btn:active {
            transform: translate(2px, 2px);
            box-shadow: 1px 1px 0 rgba(0,0,0,0.5);
        }
        .share-btn-icon { font-size: 20px; line-height: 1; flex-shrink: 0; }
        .share-fb { background: #1877f2; color: #fff; }
        .share-copy { background: var(--teal, #91D7EB); color: #000; }
        .share-screenshot { background: var(--yellow, #FDD835); color: #000; }
        .share-chat { background: var(--pink, #FF469A); color: #000; }
        .share-cancel {
            background: rgba(255,255,255,0.05); color: var(--text-dim, #8a8aa3);
            border-color: rgba(255,255,255,0.1); box-shadow: none;
            margin-top: 4px; font-size: 14px;
        }
        .share-cancel:active { transform: none; box-shadow: none; }

        /* Compose area */
        .share-compose-area { padding: 0 12px 10px; border-bottom: 1px solid rgba(255,255,255,0.08); margin-bottom: 8px; }
        .share-compose-label {
            font-family: 'Oswald', sans-serif; font-size: 11px; letter-spacing: 2px;
            color: var(--text-dim, #8a8aa3); text-transform: uppercase;
            margin-bottom: 6px; display: block;
        }
        .share-compose-input {
            width: 100%; background: var(--bg-card, #1e2a47);
            border: 2px solid rgba(255,255,255,0.15); border-radius: 8px;
            padding: 10px 12px; color: var(--text-light, #f0f0f0);
            font-family: 'Inter', sans-serif; font-size: 14px; line-height: 1.5;
            resize: none; outline: none; box-sizing: border-box;
            transition: border-color 0.15s;
        }
        .share-compose-input:focus { border-color: var(--pink, #FF469A); }
        .share-compose-input::placeholder { color: var(--text-dim, #8a8aa3); }
        .share-compose-url {
            font-size: 11px; color: var(--teal, #91D7EB); margin-top: 5px;
            white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
            opacity: 0.7;
        }

        /* Room picker styles */
        .share-room-picker { padding: 0 12px; }
        .share-room-group-label {
            font-family: 'Oswald', sans-serif; font-size: 11px; letter-spacing: 2px;
            color: var(--text-dim, #8a8aa3); text-transform: uppercase;
            padding: 6px 4px 4px; margin-top: 4px;
        }
        .share-room-list { display: flex; flex-direction: column; gap: 6px; max-height: 52vh; overflow-y: auto; padding-bottom: 4px; }
        .share-room-item {
            display: flex; align-items: center; gap: 12px;
            padding: 12px 14px; cursor: pointer;
            background: var(--bg-card, #1e2a47); border: 2px solid #000;
            border-radius: 8px; box-shadow: 3px 3px 0 rgba(0,0,0,0.5);
            transition: transform 0.08s, box-shadow 0.08s;
        }
        .share-room-item:active {
            transform: translate(2px, 2px); box-shadow: 1px 1px 0 rgba(0,0,0,0.5);
        }
        .share-room-icon { font-size: 18px; flex-shrink: 0; }
        .share-room-info { flex: 1; min-width: 0; }
        .share-room-name {
            font-family: 'Oswald', sans-serif; font-size: 15px; letter-spacing: 0.5px;
            color: var(--text-light, #f0f0f0); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .share-room-meta { font-size: 11px; color: var(--text-dim, #8a8aa3); margin-top: 1px; }
        .share-room-arrow { color: var(--text-dim, #8a8aa3); font-size: 14px; flex-shrink: 0; }
        .share-room-loading {
            padding: 32px 0; text-align: center;
            font-family: 'Oswald', sans-serif; font-size: 14px; letter-spacing: 1px;
            color: var(--text-dim, #8a8aa3);
        }
        .share-room-empty {
            padding: 24px 0; text-align: center;
            font-size: 13px; color: var(--text-dim, #8a8aa3);
        }
    `;
    document.head.appendChild(style);
}

function _escapeAttr(str) {
    return String(str || '').replace(/'/g, "\\'").replace(/"/g, '&quot;');
}

function _isLoggedIn() {
    try {
        const s = JSON.parse(localStorage.getItem('brdc_session') || '{}');
        return !!(s.player_id || s.id);
    } catch (_) { return false; }
}

function _showShareSheet(url, title, cardId) {
    _injectShareStyles();
    document.getElementById('brdc-share-sheet')?.remove();

    const encodedUrl = encodeURIComponent(url);
    const safeUrl = _escapeAttr(url);
    const safeCardId = _escapeAttr(cardId || '');
    const loggedIn = _isLoggedIn();

    const screenshotBtn = cardId ? `
        <button class="share-btn share-screenshot" onclick="_shareScreenshot('${safeCardId}', '${safeUrl}')">
            <span class="share-btn-icon">📷</span> Screenshot &amp; Share
        </button>` : '';

    const chatBtn = loggedIn ? `
        <button class="share-btn share-chat" onclick="_openChatPicker('${safeUrl}', '${_escapeAttr(title || '')}')">
            <span class="share-btn-icon">💬</span> Share to Chat
        </button>` : '';

    const sheet = document.createElement('div');
    sheet.id = 'brdc-share-sheet';
    sheet.innerHTML = `
        <div class="share-backdrop"></div>
        <div class="share-sheet">
            <div class="share-sheet-header">
                <div class="share-sheet-title">Share</div>
                <button class="share-sheet-close" onclick="document.getElementById('brdc-share-sheet')?.remove()">✕</button>
            </div>
            <div class="share-btn-list" id="share-main-view">
                <button class="share-btn share-fb" onclick="window.open('https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}', '_blank', 'width=800,height=600')">
                    <span class="share-btn-icon">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg>
                    </span>
                    Share to Facebook
                </button>
                <button class="share-btn share-copy" onclick="_shareCopyLink('${safeUrl}')">
                    <span class="share-btn-icon">🔗</span> Copy Link
                </button>
                ${screenshotBtn}
                ${chatBtn}
                <button class="share-btn share-cancel" onclick="document.getElementById('brdc-share-sheet')?.remove()">
                    Cancel
                </button>
            </div>
        </div>`;

    sheet.querySelector('.share-backdrop').addEventListener('click', () => sheet.remove());
    document.body.appendChild(sheet);
}

window.shareLink = function(url, title, text, cardId) {
    const fullUrl = url.startsWith('http') ? url : `${location.origin}${url}`;
    _showShareSheet(fullUrl, title, cardId);
};

window._shareCopyLink = function(url) {
    if (navigator.clipboard) {
        navigator.clipboard.writeText(url).then(() => {
            if (window.toastSuccess) toastSuccess('Link copied!');
            document.getElementById('brdc-share-sheet')?.remove();
        }).catch(() => {
            prompt('Copy this link:', url);
        });
    } else {
        prompt('Copy this link:', url);
    }
};

window._shareScreenshot = async function(cardId, url) {
    const card = document.getElementById(cardId);
    document.getElementById('brdc-share-sheet')?.remove();
    if (!card) return;

    // Expand card if not already so the screenshot shows full content
    if (!card.classList.contains('expanded') && window.toggleFeedCard) {
        await toggleFeedCard(cardId);
    }

    try {
        const h2c = await _loadHtml2Canvas();
        const canvas = await h2c(card, {
            allowTaint: true,
            useCORS: true,
            scrollY: -window.scrollY,
            backgroundColor: '#1a1a2e',
            scale: 2
        });
        const dataUrl = canvas.toDataURL('image/png');

        // Try native Web Share with file (iOS/Android)
        try {
            const blob = await (await fetch(dataUrl)).blob();
            const file = new File([blob], 'brdc-match.png', { type: 'image/png' });
            if (navigator.canShare?.({ files: [file] })) {
                await navigator.share({ files: [file], title: 'Match Result - BRDC', url });
                return;
            }
        } catch (_) {}

        // Fallback: download the image
        const a = document.createElement('a');
        a.href = dataUrl;
        a.download = 'brdc-match.png';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    } catch (e) {
        console.error('Screenshot failed:', e);
        if (window.toastError) toastError('Screenshot failed. Try Copy Link instead.');
    }
};

// ===== SHARE TO CHAT =====

window._openChatPicker = async function(url, title) {
    const sheet = document.getElementById('brdc-share-sheet');
    if (!sheet) return;
    const sheetPanel = sheet.querySelector('.share-sheet');

    // Swap header to show back button
    const header = sheet.querySelector('.share-sheet-header');
    header.innerHTML = `
        <button class="share-sheet-back" onclick="_closeChatPicker()">&#8592; Back</button>
        <div class="share-sheet-title">Send to Chat</div>
        <button class="share-sheet-close" onclick="document.getElementById('brdc-share-sheet')?.remove()">✕</button>`;

    // Replace main view with compose + room picker
    const mainView = sheet.querySelector('#share-main-view');
    mainView.outerHTML = `
        <div id="share-chat-view">
            <div class="share-compose-area">
                <span class="share-compose-label">Add a message</span>
                <textarea class="share-compose-input" id="share-compose-text" rows="2" placeholder="Write something..." maxlength="500"></textarea>
                <div class="share-compose-url">${url}</div>
            </div>
            <div class="share-room-picker" id="share-room-view">
                <div class="share-room-loading">Loading chats...</div>
            </div>
        </div>`;

    // Store url/title on the sheet for sending
    sheetPanel.dataset.shareUrl = url;
    sheetPanel.dataset.shareTitle = title;

    // Fetch rooms
    if (!window._brdcCall) {
        document.getElementById('share-room-view').innerHTML =
            '<div class="share-room-empty">Chat not available on this page.</div>';
        return;
    }

    try {
        const result = await window._brdcCall('getPlayerChatRooms', {});
        _renderRoomList(result);
    } catch (e) {
        console.error('getPlayerChatRooms error:', e);
        document.getElementById('share-room-view').innerHTML =
            '<div class="share-room-empty">Could not load chat rooms. Try again.</div>';
    }
};

window._closeChatPicker = function() {
    const sheet = document.getElementById('brdc-share-sheet');
    if (!sheet) return;
    const sheetPanel = sheet.querySelector('.share-sheet');
    const url = sheetPanel.dataset.shareUrl || '';
    const title = sheetPanel.dataset.shareTitle || '';

    // Re-render the main share view
    const chatView = sheet.querySelector('#share-chat-view');
    if (chatView) chatView.remove();

    const header = sheet.querySelector('.share-sheet-header');
    header.innerHTML = `
        <div class="share-sheet-title">Share</div>
        <button class="share-sheet-close" onclick="document.getElementById('brdc-share-sheet')?.remove()">✕</button>`;

    // Re-insert main buttons
    const encodedUrl = encodeURIComponent(url);
    const safeUrl = _escapeAttr(url);
    const btn_list = document.createElement('div');
    btn_list.className = 'share-btn-list';
    btn_list.id = 'share-main-view';
    btn_list.innerHTML = `
        <button class="share-btn share-fb" onclick="window.open('https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}', '_blank', 'width=800,height=600')">
            <span class="share-btn-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg></span>
            Share to Facebook
        </button>
        <button class="share-btn share-copy" onclick="_shareCopyLink('${safeUrl}')">
            <span class="share-btn-icon">🔗</span> Copy Link
        </button>
        <button class="share-btn share-chat" onclick="_openChatPicker('${safeUrl}', '${_escapeAttr(title)}')">
            <span class="share-btn-icon">💬</span> Share to Chat
        </button>
        <button class="share-btn share-cancel" onclick="document.getElementById('brdc-share-sheet')?.remove()">
            Cancel
        </button>`;
    sheetPanel.appendChild(btn_list);
};

function _renderRoomList(result) {
    const container = document.getElementById('share-room-view');
    if (!container) return;

    const sheetPanel = document.querySelector('#brdc-share-sheet .share-sheet');
    const url = sheetPanel?.dataset.shareUrl || '';
    const title = sheetPanel?.dataset.shareTitle || '';

    const typeConfig = [
        { key: 'league',           icon: '🏆', label: 'League Chats' },
        { key: 'team',             icon: '👥', label: 'Team Chats' },
        { key: 'match',            icon: '🎯', label: 'Match Chats' },
        { key: 'tournament',       icon: '🏅', label: 'Tournament Chats' },
        { key: 'tournament_event', icon: '📅', label: 'Event Chats' },
    ];

    let hasAny = false;
    let html = '<div class="share-room-list">';

    typeConfig.forEach(({ key, icon, label }) => {
        const rooms = (result[key] || []).filter(r => r.status === 'active' || !r.status);
        if (!rooms.length) return;
        hasAny = true;
        html += `<div class="share-room-group-label">${label}</div>`;
        rooms.forEach(room => {
            const meta = room.participant_count ? `${room.participant_count} members` : '';
            const safeRoomId = _escapeAttr(room.id);
            const safeRoomName = _escapeAttr(room.name);
            const safeUrl2 = _escapeAttr(url);
            const safeTitle2 = _escapeAttr(title);
            html += `
                <div class="share-room-item" onclick="_sendToRoom('${safeRoomId}', '${safeRoomName}', '${safeUrl2}', '${safeTitle2}')">
                    <span class="share-room-icon">${icon}</span>
                    <div class="share-room-info">
                        <div class="share-room-name">${room.name}</div>
                        ${meta ? `<div class="share-room-meta">${meta}</div>` : ''}
                    </div>
                    <span class="share-room-arrow">›</span>
                </div>`;
        });
    });

    html += '</div>';

    if (!hasAny) {
        container.innerHTML = '<div class="share-room-empty">No chat rooms found. Join a league to access team and league chats.</div>';
    } else {
        container.innerHTML = html;
    }
}

window._sendToRoom = async function(roomId, roomName, url, title) {
    if (!window._brdcCall) return;

    // Show sending state
    const container = document.getElementById('share-room-view');
    if (container) container.innerHTML = '<div class="share-room-loading">Sending...</div>';

    // Get custom message from compose textarea (if present)
    const customText = (document.getElementById('share-compose-text')?.value || '').trim();
    const message = customText ? `${customText}\n${url}` : `🎯 ${title || 'Check this out!'}\n${url}`;

    try {
        await window._brdcCall('sendChatMessage', { room_id: roomId, text: message });
        document.getElementById('brdc-share-sheet')?.remove();
        if (window.toastSuccess) toastSuccess(`Shared to ${roomName}!`);
    } catch (e) {
        console.error('sendChatMessage error:', e);
        if (container) container.innerHTML = '<div class="share-room-empty">Failed to send. Please try again.</div>';
        if (window.toastError) toastError('Could not send message.');
    }
};

function _loadHtml2Canvas() {
    return new Promise((resolve, reject) => {
        if (window.html2canvas) { resolve(window.html2canvas); return; }
        const s = document.createElement('script');
        s.src = 'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js';
        s.onload = () => resolve(window.html2canvas);
        s.onerror = reject;
        document.head.appendChild(s);
    });
}
