// Firebase Configuration - BRDC Tournament System
// Import this file in all pages that need Firebase

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { getFunctions } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-functions.js';

// Your Firebase project configuration
const firebaseConfig = {
    apiKey: "AIzaSyBT9oy8jxOet5i-pLtHN_ugO6zdvkHWlBk",
    authDomain: "brdc-1e428.firebaseapp.com",
    projectId: "brdc-1e428",
    storageBucket: "brdc-1e428.firebasestorage.app",
    messagingSenderId: "926857687537",
    appId: "1:926857687537:web:66eac9e169f46a9e81d41e"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const functions = getFunctions(app);

// Export for use in other files
export { app, db, functions };

// Cloud Functions API base URL
export const FUNCTIONS_URL = 'https://us-central1-brdc-1e428.cloudfunctions.net';

// Helper function to call Cloud Functions
export async function callFunction(functionName, data) {
    try {
        const response = await fetch(`${FUNCTIONS_URL}/${functionName}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data)
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        return await response.json();
    } catch (error) {
        console.error(`Error calling ${functionName}:`, error);
        throw error;
    }
}
