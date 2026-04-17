// Firebase configuration
// IMPORTANT: Replace with your own Firebase project configuration
export const firebaseConfig = {
    apiKey: "AIzaSyAxYFw3993-vxBJEjAoBHCPd8oX-iOeuBQ",
    authDomain: "n-waxon.firebaseapp.com",
    projectId: "n-waxon",
    storageBucket: "n-waxon.firebasestorage.app",
    messagingSenderId: "553803735269",
    appId: "1:553803735269:web:0ec72de011bc1dc390f40c"
};

// Admin emails are now managed dynamically in the Firestore 'admins' collection.

let db = null;
let storage = null;
let auth = null;
let firestoreAvailable = false;
let storageAvailable = false;
let authAvailable = false;

try {
    if (firebaseConfig.apiKey !== "YOUR_API_KEY") {
        firebase.initializeApp(firebaseConfig);
        db = firebase.firestore();
        storage = firebase.storage();
        auth = firebase.auth();
        firestoreAvailable = true;
        storageAvailable = true;
        authAvailable = true;
        console.log("✅ Firebase connected successfully");
    } else {
        console.warn("⚠️ Please configure Firebase with your own credentials in js/firebase-config.js");
    }
} catch (e) {
    console.warn("Firebase initialization failed:", e);
}

const firebaseInstance = firebase;
export { firebaseInstance as firebase, db, storage, auth, firestoreAvailable, storageAvailable, authAvailable };
