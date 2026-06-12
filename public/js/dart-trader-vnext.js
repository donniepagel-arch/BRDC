import {
    db,
    collection,
    getDocs,
    query,
    where,
    orderBy,
    limit
} from '/js/firebase-config.js';

const els = {
    status: document.getElementById('traderStatus'),
    grid: document.getElementById('listingGrid'),
    activeCount: document.getElementById('activeListingCount'),
    categoryCount: document.getElementById('categoryCount'),
    tradeCount: document.getElementById('tradeCount')
};

let listings = [];
let activeCategory = 'all';

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
    return Number.isFinite(n) && n > 0 ? `$${n.toFixed(0)}` : 'Trade';
}

function categoryOf(listing) {
    return String(listing.category || listing.item_category || 'accessories').toLowerCase();
}

function updateSummary() {
    const categories = new Set(listings.map(categoryOf)).size;
    const trade = listings.filter(item => !Number(item.price)).length;
    if (els.activeCount) els.activeCount.textContent = String(listings.length);
    if (els.categoryCount) els.categoryCount.textContent = String(categories || 0);
    if (els.tradeCount) els.tradeCount.textContent = String(trade);
}

function render() {
    const filtered = listings.filter(item => activeCategory === 'all' || categoryOf(item) === activeCategory);
    updateSummary();
    els.status.textContent = `${filtered.length} listing${filtered.length === 1 ? '' : 's'} shown`;
    if (!filtered.length) {
        els.grid.innerHTML = '<div class="ves-empty">No listings found. Create one from the button above.</div>';
        return;
    }
    els.grid.innerHTML = filtered.map(item => `
        <article class="ves-card">
            <div>
                <p class="ves-kicker">${escapeHtml(categoryOf(item))}</p>
                <h2>${escapeHtml(item.title || item.name || 'Dart listing')}</h2>
            </div>
            <div class="ves-price">${escapeHtml(money(item.price))}</div>
            <p>${escapeHtml(item.condition || 'Condition not listed')} - ${escapeHtml(item.location || item.city || 'BRDC')}</p>
            <div class="ves-card-meta">
                <span>${escapeHtml(item.condition || 'Condition TBD')}</span>
                <span>${Number(item.price) ? 'For sale' : 'Trade / offer'}</span>
            </div>
            <a href="/pages/dart-trader-listing-vnext.html?id=${encodeURIComponent(item.id)}">View listing</a>
        </article>
    `).join('');
}

async function loadListings() {
    const q = query(
        collection(db, 'dart_trader_listings'),
        where('status', '==', 'active'),
        orderBy('created_at', 'desc'),
        limit(60)
    );
    const snap = await getDocs(q);
    listings = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    render();
}

document.querySelectorAll('[data-category]').forEach(button => {
    button.addEventListener('click', () => {
        activeCategory = button.dataset.category;
        document.querySelectorAll('[data-category]').forEach(item => item.classList.toggle('active', item === button));
        render();
    });
});

loadListings().catch(error => {
    console.error('[dart-trader-vnext] failed:', error);
    els.status.textContent = 'Trader unavailable.';
    els.grid.innerHTML = `<div class="ves-empty">${escapeHtml(error.message || 'Could not load listings')}</div>`;
});
