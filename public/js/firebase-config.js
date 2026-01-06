// Firebase Configuration
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js';
import { getFirestore, collection, addDoc, query, where, getDocs, doc, getDoc, onSnapshot, updateDoc } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

const firebaseConfig = {
    apiKey: "AIzaSyDLByd5LAfCVcKkSC8e0Ih_O_2cX7oqhDU",
    authDomain: "brdc-1e428.firebaseapp.com",
    projectId: "brdc-1e428",
    storageBucket: "brdc-1e428.firebasestorage.app",
    messagingSenderId: "651482692878",
    appId: "1:651482692878:web:2fb93cf30a5c0de6a10e53"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

/**
 * Call a Cloud Function via HTTPS
 */
async function callFunction(functionName, data) {
    const REGION = 'us-central1';
    const PROJECT_ID = 'brdc-1e428';
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
        
        // Try to parse response body regardless of status
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

// Export everything for use in other files
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
    callFunction 
};
