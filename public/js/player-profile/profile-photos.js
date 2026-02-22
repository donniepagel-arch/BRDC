/**
 * Player Profile - Photos Module
 *
 * Handles:
 * - Displaying and managing player photos
 * - Profile photo change
 * - Personal photo gallery (stored in /players/{id}.photos[])
 */

import { db, storage, doc, getDoc, updateDoc, arrayUnion, ref, uploadBytes, getDownloadURL } from '/js/firebase-config.js';

// ===== LOAD =====

export async function loadPhotosTab(state) {
    const container = document.getElementById('photosContent');
    if (!container) return;

    const playerId = state.currentPlayer?.player_id || state.currentPlayer?.id;
    if (!playerId) return;

    container.innerHTML = '<div style="padding:40px;text-align:center;color:var(--text-dim);">Loading photos...</div>';

    let playerData = {};
    let galleryPhotos = [];
    try {
        const playerDoc = await getDoc(doc(db, 'players', playerId));
        if (playerDoc.exists()) {
            playerData = playerDoc.data();
            galleryPhotos = playerData.photos || [];
        }
    } catch (e) {
        // Direct reads are blocked by Firestore rules — gallery loads empty initially
        console.log('Photos: direct read unavailable:', e.message);
    }

    // Cache in state so uploads can append without re-reading
    state.galleryPhotos = galleryPhotos;
    renderPhotosTab(state, playerData, galleryPhotos);
}

// ===== RENDER =====

function renderPhotosTab(state, playerData, galleryPhotos) {
    const container = document.getElementById('photosContent');
    if (!container) return;

    const player = state.currentPlayer;
    const photoUrl = player?.photo_url || playerData?.photo_url || '';
    const playerName = player?.name || '';
    const initial = playerName.charAt(0).toUpperCase() || '?';

    // Profile photo section
    const avatarHtml = photoUrl
        ? `<img src="${photoUrl}" alt="Profile photo" style="width:72px;height:72px;border-radius:50%;border:1.5px solid var(--yellow);object-fit:cover;">`
        : `<div class="photos-profile-img">${initial}</div>`;

    // Gallery grid
    let galleryHtml = '';
    if (galleryPhotos.length > 0) {
        const thumbs = galleryPhotos.map((p, i) => {
            const url = typeof p === 'string' ? p : p.url;
            return `<img class="photo-thumb" src="${url}" alt="Photo ${i + 1}" onclick="viewPhoto('${url}')">`;
        }).join('');
        galleryHtml = `
        <div class="photos-section-hdr">MY PHOTOS (${galleryPhotos.length})</div>
        <div class="photos-grid">${thumbs}</div>`;
    } else {
        galleryHtml = `
        <div class="photos-section-hdr">MY PHOTOS</div>
        <div style="padding:32px 16px;text-align:center;color:var(--text-dim);font-size:13px;">No photos yet. Add some below!</div>`;
    }

    container.innerHTML = `
        <div class="photos-profile-section">
            ${avatarHtml}
            <div>
                <div style="font-family:'Oswald',sans-serif;font-size:15px;color:var(--text-light);">${escapeHtml(playerName)}</div>
                <div style="font-size:11px;color:var(--text-dim);margin-top:2px;">Profile Photo</div>
                <label for="photoInput" class="photos-change-btn">CHANGE PHOTO</label>
            </div>
        </div>
        ${galleryHtml}
        <label class="photos-add-btn" for="galleryInput">+ ADD PHOTO</label>
        <input type="file" id="galleryInput" accept="image/*" style="display:none;" onchange="uploadGalleryPhoto(this)">
    `;
}

// ===== UPLOAD =====

window.uploadGalleryPhoto = async function(input) {
    const file = input.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
        if (window.toastError) window.toastError('Please select an image file');
        return;
    }
    if (file.size > 10 * 1024 * 1024) {
        if (window.toastError) window.toastError('Image must be under 10MB');
        return;
    }

    const state = window.playerProfileState;
    const playerId = state?.currentPlayer?.player_id || state?.currentPlayer?.id;
    if (!playerId) return;

    try {
        if (window.toastInfo) window.toastInfo('Uploading photo...');

        const ext = file.name.split('.').pop().toLowerCase() || 'jpg';
        const storageRef = ref(storage, `players/${playerId}/gallery/${Date.now()}.${ext}`);
        const snapshot = await uploadBytes(storageRef, file);
        const photoUrl = await getDownloadURL(snapshot.ref);

        const newPhoto = { url: photoUrl, uploaded_at: new Date().toISOString() };

        // arrayUnion atomically appends without needing to read first
        await updateDoc(doc(db, 'players', playerId), { photos: arrayUnion(newPhoto) });

        if (window.toastSuccess) window.toastSuccess('Photo added!');

        // Append to local state and re-render
        state.galleryPhotos = [...(state.galleryPhotos || []), newPhoto];
        renderPhotosTab(state, {}, state.galleryPhotos);
    } catch (err) {
        console.error('Gallery upload error:', err);
        if (window.toastError) window.toastError('Upload failed: ' + err.message);
    } finally {
        input.value = '';
    }
};

window.viewPhoto = function(url) {
    let modal = document.getElementById('photoLightbox');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'photoLightbox';
        modal.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.92);display:flex;align-items:center;justify-content:center;cursor:zoom-out;';
        modal.innerHTML = `
            <button onclick="document.getElementById('photoLightbox').style.display='none'" style="position:absolute;top:16px;right:16px;background:rgba(255,255,255,0.15);border:none;color:#fff;font-size:20px;width:36px;height:36px;border-radius:50%;cursor:pointer;line-height:1;display:flex;align-items:center;justify-content:center;">✕</button>
            <img id="photoLightboxImg" style="max-width:94vw;max-height:88vh;object-fit:contain;border-radius:4px;box-shadow:0 8px 40px rgba(0,0,0,0.6);">
        `;
        modal.addEventListener('click', function(e) {
            if (e.target === modal) modal.style.display = 'none';
        });
        document.body.appendChild(modal);
    }
    document.getElementById('photoLightboxImg').src = url;
    modal.style.display = 'flex';
};

function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ===== INIT =====

export function initPhotosTab(state) {
    // Lazy-loaded on first tab click
}
