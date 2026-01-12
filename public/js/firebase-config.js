// Firebase Configuration
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js';
import { getFirestore, collection, addDoc, query, where, getDocs, doc, getDoc, onSnapshot, updateDoc, orderBy, limit } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

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

/**
 * Call a Cloud Function via HTTPS
 */
async function callFunction(functionName, data) {
    const REGION = 'us-central1';
    const PROJECT_ID = 'brdc-v2';
    const url = `https://${REGION}-${PROJECT_ID}.cloudfunctions.net/${functionName}`;
    
    console.log('Calling function:', url);
    console.log('With data:', data);
    
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data)
        });
        
        console.log('Response status:', response.status);
        
        let responseData;
        const contentType = response.headers.get('content-type');
        
        if (contentType && contentType.includes('application/json')) {
            responseData = await response.json();
            console.log('Response data:', responseData);
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

export { 
    db, 
    collection, 
    addDoc, 
    query, 
    where, 
    getDocs, 
    doc, 
    getDoc, 
    onSnapshot, 
    updateDoc,
    orderBy,
    limit,
    callFunction 
};
