import {
    auth,
    waitForAuthReady,
    callFunction,
    db,
    collection,
    addDoc,
    doc,
    getDoc,
    updateDoc,
    serverTimestamp,
    uploadImage
} from '/js/firebase-config.js';

const params = new URLSearchParams(window.location.search);
const listingId = params.get('id');
const els = {
    title: document.getElementById('pageTitle'),
    intro: document.getElementById('formIntro'),
    form: document.getElementById('listingForm'),
    status: document.getElementById('listingStatus'),
    submit: document.getElementById('submitListingBtn')
};

let currentPlayer = null;
let selectedPhoto = null;
let editListing = null;

function setStatus(message, type = '') {
    els.status.textContent = message;
    els.status.className = `ves-form-status ${type}`.trim();
}

function value(id) {
    return String(document.getElementById(id)?.value || '').trim();
}

function setValue(id, nextValue) {
    const el = document.getElementById(id);
    if (el) el.value = nextValue ?? '';
}

async function loadSession() {
    await waitForAuthReady(5000);
    try {
        const result = await callFunction('getPlayerSession', {});
        if (result?.success) currentPlayer = result.player;
    } catch (error) {
        currentPlayer = null;
    }

    setValue('sellerName', currentPlayer?.name || auth.currentUser?.displayName || '');
    setValue('sellerEmail', currentPlayer?.email || auth.currentUser?.email || '');
    setValue('sellerPhone', currentPlayer?.phone || '');
}

async function loadEditListing() {
    if (!listingId) return;
    const snap = await getDoc(doc(db, 'dart_trader_listings', listingId));
    if (!snap.exists()) throw new Error('Listing not found.');
    editListing = { id: snap.id, ...snap.data() };

    const playerId = currentPlayer?.id || currentPlayer?.player_id;
    if (editListing.seller_id && playerId && editListing.seller_id !== playerId) {
        window.location.href = `/pages/dart-trader-listing-vnext.html?id=${encodeURIComponent(listingId)}`;
        return;
    }

    els.title.textContent = 'Edit listing';
    els.intro.textContent = 'Update the gear details and contact info.';
    els.submit.textContent = 'Save changes';
    setValue('category', editListing.category || '');
    setValue('condition', editListing.condition || '');
    setValue('title', editListing.title || '');
    setValue('price', editListing.price || '');
    setValue('brand', editListing.brand || '');
    setValue('weight', editListing.weight || '');
    setValue('material', editListing.material || '');
    setValue('description', editListing.description || '');
    setValue('sellerName', editListing.seller_name || currentPlayer?.name || '');
    setValue('sellerEmail', editListing.seller_email || currentPlayer?.email || auth.currentUser?.email || '');
    setValue('sellerPhone', editListing.seller_phone || currentPlayer?.phone || '');
}

async function submitListing(event) {
    event.preventDefault();
    if (!els.form.checkValidity()) {
        els.form.reportValidity();
        return;
    }

    els.submit.disabled = true;
    setStatus(listingId ? 'Saving listing...' : 'Publishing listing...');
    try {
        let imageUrl = editListing?.image_url || '';
        if (selectedPhoto) {
            setStatus('Uploading photo...');
            imageUrl = await uploadImage(selectedPhoto, 'dart-trader');
        }

        const price = Number(value('price'));
        const weight = Number(value('weight'));
        const playerId = currentPlayer?.id || currentPlayer?.player_id || auth.currentUser?.uid || '';
        const payload = {
            seller_id: playerId,
            seller_name: value('sellerName'),
            seller_email: value('sellerEmail'),
            seller_phone: value('sellerPhone'),
            title: value('title'),
            price: Number.isFinite(price) && price > 0 ? price : 0,
            category: value('category'),
            condition: value('condition'),
            description: value('description'),
            brand: value('brand'),
            weight: Number.isFinite(weight) && weight > 0 ? weight : null,
            material: value('material'),
            image_url: imageUrl,
            updated_at: serverTimestamp()
        };

        let nextId = listingId;
        if (listingId) {
            await updateDoc(doc(db, 'dart_trader_listings', listingId), payload);
        } else {
            const created = await addDoc(collection(db, 'dart_trader_listings'), {
                ...payload,
                status: 'active',
                created_at: serverTimestamp()
            });
            nextId = created.id;
        }

        setStatus('Listing saved.', 'success');
        window.location.href = `/pages/dart-trader-listing-vnext.html?id=${encodeURIComponent(nextId)}`;
    } catch (error) {
        setStatus(error.message || 'Could not save listing.', 'error');
        els.submit.disabled = false;
    }
}

document.getElementById('photo')?.addEventListener('change', event => {
    selectedPhoto = event.target.files?.[0] || null;
});

els.form?.addEventListener('submit', submitListing);

async function init() {
    await loadSession();
    await loadEditListing();
}

init().catch(error => {
    console.error('[dart-trader-create-vnext] failed:', error);
    setStatus(error.message || 'Could not load listing form.', 'error');
});
