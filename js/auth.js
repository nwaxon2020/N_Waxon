import { auth, db, authAvailable } from './firebase-config.js';

let currentUser = null;
let isAdmin = false;

/**
 * Initializes authentication listeners
 * @param {Function} onStateChange - Callback when auth state or admin status changes
 */
export function initAuth(onStateChange) {
    if (!authAvailable) return;

    auth.onAuthStateChanged(async (user) => {
        currentUser = user;
        isAdmin = false;

        if (user) {
            // Check if user is in 'admins' collection
            try {
                const adminDoc = await db.collection('admins').doc(user.email).get();
                if (adminDoc.exists) {
                    isAdmin = true;
                } else {
                    // Fallback check by query if doc ID is not email
                    const adminQuery = await db.collection('admins').where('email', '==', user.email).get();
                    if (!adminQuery.empty) {
                        isAdmin = true;
                    }
                }
            } catch (error) {
                console.error("Error checking admin status:", error);
            }
        }

        // Update local storage for persistence across pages (optional, but keep for legacy compat)
        if (isAdmin) {
            localStorage.setItem('isAdmin', 'true');
            localStorage.setItem('adminEmail', user.email);
        } else {
            localStorage.removeItem('isAdmin');
            localStorage.removeItem('adminEmail');
        }

        if (onStateChange) onStateChange(user, isAdmin);
    });
}

/**
 * Trigger Google Login Popup
 */
export async function loginWithGoogle() {
    if (!authAvailable) return;
    const provider = new firebase.auth.GoogleAuthProvider();
    try {
        await auth.signInWithPopup(provider);
    } catch (error) {
        console.error("Login failed:", error);
        throw error;
    }
}

/**
 * Logout
 */
export async function logout() {
    if (!authAvailable) return;
    try {
        await auth.signOut();
        localStorage.removeItem('isAdmin');
        localStorage.removeItem('adminEmail');
    } catch (error) {
        console.error("Logout failed:", error);
    }
}

export { currentUser, isAdmin };
