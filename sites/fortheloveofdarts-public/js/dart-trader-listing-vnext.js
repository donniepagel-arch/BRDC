import {
    auth,
    waitForAuthReady,
    callFunction,
    db,
    doc,
    getDoc
} from '/js/firebase-config.js';

const params = new URLSearchParams(window.location.search);
const listingId = params.get('id');
const els = {
    category: document.getElementById('listingCategory'),
    title: document.getElementById('listingTitle'),
    status: document.getElementById('listingStatus'),
    detail: document.getElementById('listingDetail'),
    edit: document.getElementById('editListingLink')
};

let currentPlayer = null;

function escapeHtml(value) {
    return String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}

function money(value) {
    const n = Number(value);
    return Number.isFinite(n) && n > 0 ? `$${n.toFixed(0)}` : 'Trade / offer';
}

function spec(label, value) {
    if (!value && value !== 0) return '';
    return `<div class="ves-spec"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`;
}

async function loadSession() {
    await waitForAuthReady(3500);
    try {
        const result = await callFunction('getPlayerSession', {});
        if (result?.success) currentPlayer = result.player;
    } catch (error) {
        currentPlayer = null;
    }
}

function renderEmpty(message) {
    els.title.textContent = 'Listing unavailable';
    els.status.textContent = message;
    els.detail.innerHTML = `<div class="ves-empty">${escapeHtml(message)} <a href="/rookies/pages/dart-trader-vnext.html">Browse trader</a></div>`;
}

function render(listing) {
    const category = listing.category || 'listing';
    const ownerId = currentPlayer?.id || currentPlayer?.player_id || auth.currentUser?.uid || '';
    const isOwner = ownerId && listing.seller_id === ownerId;
    const image = listing.image_url || listing.photo_url || '';
    const contactEmail = listing.contact_email || listing.seller_email || '';
    const contactPhone = listing.contact_phone || listing.seller_phone || '';

    document.title = `${listing.title || 'Listing'} - Dart Trader - BRDC`;
    els.category.textContent = category;
    els.title.textContent = listing.title || 'Dart listing';
    els.status.textContent = `${money(listing.price)} - ${listing.condition || 'Condition not listed'}`;
    if (isOwner) {
        els.edit.hidden = false;
        els.edit.href = `/rookies/pages/dart-trader-create-vnext.html?id=${encodeURIComponent(listing.id)}`;
    }

    els.detail.innerHTML = `
        <section class="ves-gallery-main">
            ${image
                ? `<img src="${escapeHtml(image)}" alt="${escapeHtml(listing.title || 'Dart listing')}">`
                : '<div class="ves-gallery-placeholder">No photo</div>'}
        </section>
        <section class="ves-panel">
            <p class="ves-kicker">${escapeHtml(category)}</p>
            <h2 class="ves-detail-title">${escapeHtml(listing.title || 'Dart listing')}</h2>
            <div class="ves-price">${escapeHtml(money(listing.price))}</div>
            <div class="ves-spec-grid">
                ${spec('Condition', listing.condition)}
                ${spec('Brand', listing.brand)}
                ${spec('Weight', listing.weight ? `${listing.weight}g` : '')}
                ${spec('Material', listing.material)}
                ${spec('Status', listing.status || 'active')}
            </div>
            ${listing.description ? `<p>${escapeHtml(listing.description)}</p>` : '<p>No description yet.</p>'}
            <div class="ves-seller-card">
                <div>
                    <p class="ves-kicker">Seller</p>
                    <strong>${escapeHtml(listing.seller_name || 'BRDC member')}</strong>
                </div>
                <div class="ves-hero-actions">
                    ${contactEmail ? `<a class="ves-action primary" href="mailto:${escapeHtml(contactEmail)}?subject=${encodeURIComponent(`Dart Trader: ${listing.title || 'Listing'}`)}">Email</a>` : ''}
                    ${contactPhone ? `<a class="ves-action" href="tel:${escapeHtml(contactPhone)}">Call/text</a>` : ''}
                    ${!contactEmail && !contactPhone ? '<span class="ves-meta">Contact info not listed.</span>' : ''}
                </div>
            </div>
        </section>
    `;
}

async function init() {
    if (!listingId) {
        renderEmpty('No listing ID was provided.');
        return;
    }
    await loadSession();
    const snap = await getDoc(doc(db, 'dart_trader_listings', listingId));
    if (!snap.exists()) {
        renderEmpty('Listing was not found.');
        return;
    }
    render({ id: snap.id, ...snap.data() });
}

init().catch(error => {
    console.error('[dart-trader-listing-vnext] failed:', error);
    renderEmpty(error.message || 'Could not load listing.');
});
