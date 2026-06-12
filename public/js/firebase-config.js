// Firebase Configuration
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js';
import { getFirestore, collection, addDoc, query, where, getDocs, doc, getDoc, onSnapshot, updateDoc, setDoc, deleteDoc, orderBy, limit, startAfter, serverTimestamp, Timestamp, arrayUnion, arrayRemove } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js';
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, sendPasswordResetEmail, onAuthStateChanged, GoogleAuthProvider, signInWithPopup } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';

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
const auth = getAuth(app);
let authReadyResolved = false;
const authReadyPromise = new Promise((resolve) => {
    onAuthStateChanged(auth, (user) => {
        authReadyResolved = true;
        resolve(user || null);
    }, () => {
        authReadyResolved = true;
        resolve(null);
    });
});

async function waitForAuthReady(timeoutMs = 5000) {
    if (authReadyResolved || auth.currentUser) return auth.currentUser;
    return await Promise.race([
        authReadyPromise,
        new Promise((resolve) => setTimeout(() => resolve(auth.currentUser || null), timeoutMs))
    ]);
}

function shouldRetryFunctionCall(error, functionName) {
    const msg = (error?.message || '').toLowerCase();
    if (!msg) return false;
    const authSensitive = new Set([
        'getplayersession',
        'gettournamentplayerruntime',
        'getconversations',
        'getplayerchatrooms'
    ]);
    const isAuthSensitive = authSensitive.has(String(functionName || '').toLowerCase());
    if (!isAuthSensitive) return false;
    return msg.includes('failed to fetch')
        || msg.includes('unauthorized')
        || msg.includes('cors')
        || msg.includes('networkerror');
}

function isQuietFunctionCall(functionName) {
    const quietFunctions = new Set([
        'getunreadnotificationcount',
        'getunreadcount',
        'getplayerchallenges'
    ]);
    return quietFunctions.has(String(functionName || '').toLowerCase());
}

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
 * Uses direct Cloud Functions URL
 */
async function callFunction(functionName, data = {}) {
    const url = `https://us-central1-brdc-v2.cloudfunctions.net/${functionName}`;

    async function executeAttempt(forceAuthWait = false) {
        const headers = { 'Content-Type': 'application/json' };
        const user = auth.currentUser || await waitForAuthReady(forceAuthWait ? 6500 : 5000);
        if (user) {
            try {
                const token = await user.getIdToken(forceAuthWait);
                headers['Authorization'] = `Bearer ${token}`;
            } catch (e) {
                console.warn('[callFunction] Could not get ID token:', e.message);
            }
        }

        const response = await fetch(url, {
            method: 'POST',
            headers,
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
            if (!isQuietFunctionCall(functionName)) {
                console.error('Function error:', errorMsg);
            }
            throw new Error(errorMsg);
        }

        return responseData;
    }

    try {
        return await executeAttempt(false);
    } catch (error) {
        if (shouldRetryFunctionCall(error, functionName)) {
            try {
                await new Promise((resolve) => setTimeout(resolve, 900));
                return await executeAttempt(true);
            } catch (retryError) {
                if (!isQuietFunctionCall(functionName)) {
                    console.error('Error calling ' + functionName + ':', retryError);
                }
                throw retryError;
            }
        }
        if (!isQuietFunctionCall(functionName)) {
            console.error('Error calling ' + functionName + ':', error);
        }
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

// Expose callFunction globally so non-module scripts (e.g. brdc-share.js) can use it with auth
window._brdcCall = callFunction;

export {
    db,
    storage,
    auth,
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
    startAfter,
    serverTimestamp,
    Timestamp,
    arrayUnion,
    arrayRemove,
    ref,
    uploadBytes,
    getDownloadURL,
    callFunction,
    showLoading,
    hideLoading,
    uploadImage,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signOut,
    sendPasswordResetEmail,
    onAuthStateChanged,
    waitForAuthReady,
    GoogleAuthProvider,
    signInWithPopup
};
