import { firebase, db, storage } from './firebase-config.js';

/**
 * Uploads a file to Firebase Storage and returns the download URL
 * @param {File} file 
 * @param {string} path 
 * @returns {Promise<string>}
 */
export async function uploadFile(file, path) {
    if (!storage) throw new Error("Firebase Storage not available");
    const storageRef = storage.ref(path);
    const metadata = {
        contentType: file.type // Crucial for MP4s and correct browser rendering
    };
    const snapshot = await storageRef.put(file, metadata);
    return await snapshot.ref.getDownloadURL();
}

/**
 * Fetches a single document from Firestore
 * @param {string} collection 
 * @param {string} docId 
 */
export async function getDoc(collection, docId) {
    if (!db) return null;
    const doc = await db.collection(collection).doc(docId).get();
    return doc.exists ? doc.data() : null;
}

/**
 * Saves a document to Firestore
 */
export async function setDoc(collection, docId, data) {
    if (!db) return;
    return await db.collection(collection).doc(docId).set(data, { merge: true });
}

/**
 * Adds a document to a collection
 */
export async function addDoc(collection, data) {
    if (!db) return;
    return await db.collection(collection).add({
        ...data,
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });
}

/**
 * Updates a document in Firestore
 */
export async function updateDoc(collection, docId, data) {
    if (!db) return;
    return await db.collection(collection).doc(docId).update(data);
}

/**
 * Deletes a document from Firestore
 */
export async function deleteDoc(collection, docId) {
    if (!db) return;
    return await db.collection(collection).doc(docId).delete();
}

/**
 * Fetches all documents from a collection
 */
export async function getDocs(collection, orderByField = 'timestamp', direction = 'desc') {
    if (!db) return [];
    const snapshot = await db.collection(collection).orderBy(orderByField, direction).get();
    const docs = [];
    snapshot.forEach(doc => {
        docs.push({ id: doc.id, ...doc.data() });
    });
    return docs;
}
