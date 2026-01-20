// Firebase Configuration
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js';
import { getFirestore, collection, addDoc, query, where, getDocs, doc, getDoc, onSnapshot, updateDoc, setDoc, deleteDoc, orderBy, limit, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js';

const firebaseConfig = {
    apiKey: "AIzaSyDN1aYhoVt3OX5EafsNTVB09i8VFx7QM1U",
    authDomain: "brdc-v2.firebaseapp.com",
    projectId: "brdc-v2",
    storageBucket: "brdc-v2.firebasestorage.app",
    messagingSenderId: "726670872282",
    appId: "1:726670872282:web:913d19c8cb3b24bf919fe3"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const storage = getStorage(app);

/**
 * Upload an image to Firebase Storage
 * @param {File} file - The file to upload
 * @param {string} folder - The folder path (e.g., 'leagues', 'tournaments', 'events')
 * @returns {Promise<string>} - The download URL of the uploaded image
 */
async function uploadImage(file, folder = 'images') {
    if (!file) return '';

    // Generate unique filename
    const timestamp = Date.now();
    const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const filename = `${folder}/${timestamp}_${safeName}`;

    const storageRef = ref(storage, filename);

    // Upload the file
    const snapshot = await uploadBytes(storageRef, file);

    // Get the download URL
    const downloadURL = await getDownloadURL(snapshot.ref);

    return downloadURL;
}

/**
 * Call a Cloud Function via HTTPS
 */
async function callFunction(functionName, data) {
    const REGION = 'us-central1';
    const PROJECT_ID = 'brdc-v2';
    const url = `https://${REGION}-${PROJECT_ID}.cloudfunctions.net/${functionName}`;

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data)
        });

        let responseData;
        const contentType = response.headers.get('content-type');

        if (contentType && contentType.includes('application/json')) {
            responseData = await response.json();
        } else {
            const text = await response.text();
            console.error('Non-JSON response:', text);
            throw new Error(`Server returned status ${response.status}: ${text.substring(0, 200)}`);
        }

        if (!response.ok) {
            const errorMsg = responseData.error || responseData.message || `HTTP error! status: ${response.status}`;
            console.error('Function error:', errorMsg);
            throw new Error(errorMsg);
        }

        return responseData;

    } catch (error) {
        console.error('Error calling ' + functionName + ':', error);
        throw error;
    }
}

/**
 * Global Loading Overlay Utilities
 */
let loadingOverlayElement = null;

function ensureLoadingOverlay() {
    if (!loadingOverlayElement) {
        loadingOverlayElement = document.getElementById('brdcGlobalLoading');
        if (!loadingOverlayElement) {
            loadingOverlayElement = document.createElement('div');
            loadingOverlayElement.className = 'brdc-loading-overlay';
            loadingOverlayElement.id = 'brdcGlobalLoading';
            loadingOverlayElement.innerHTML = `
                <div class="spinner"></div>
                <div class="loading-text" id="loadingText">Loading...</div>
            `;
            document.body.appendChild(loadingOverlayElement);
        }
    }
    return loadingOverlayElement;
}

function showLoading(message = 'Loading...') {
    const overlay = ensureLoadingOverlay();
    const textEl = overlay.querySelector('.loading-text');
    if (textEl) textEl.textContent = message;
    overlay.classList.add('active');
}

function hideLoading() {
    const overlay = ensureLoadingOverlay();
    overlay.classList.remove('active');
}

export {
    db,
    storage,
    collection,
    addDoc,
    query,
    where,
    getDocs,
    doc,
    getDoc,
    onSnapshot,
    updateDoc,
    setDoc,
    deleteDoc,
    orderBy,
    limit,
    serverTimestamp,
    ref,
    uploadBytes,
    getDownloadURL,
    callFunction,
    showLoading,
    hideLoading,
    uploadImage
};
