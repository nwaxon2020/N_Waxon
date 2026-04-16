import { db, firestoreAvailable } from './firebase-config.js';
import { getDoc } from './firebase-helpers.js';

// ========== STATE ==========
let homeConfig = null;
let currentUserId = localStorage.getItem('chatUserId') || 'user_' + Math.random().toString(36).substr(2, 6);
let currentUserName = localStorage.getItem('userDisplayName') || '';
let isAdmin = false;
let chatInitialized = false;
const CHAT_COLLECTION = 'globalChat';
const USERS_COLLECTION = 'users';

// ========== HELPERS ==========
async function fetchHomeConfig() {
    if (!homeConfig && firestoreAvailable && db) {
        homeConfig = await getDoc('config', 'home');
    }
    return homeConfig;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ========== PUBLIC API ==========

/**
 * Set admin status. Called from main.js auth callback.
 * Does NOT trigger any UI updates — those happen when navigating to chat.
 */
export function setIsAdmin(status) {
    isAdmin = status;
    console.log('[Chat] Admin status set to:', status);
}

/**
 * Set current user display name.
 */
export function setCurrentUser(name) {
    currentUserName = name;
}

/**
 * Show name prompt ONLY if:
 * 1. Chat page is actually visible
 * 2. User is NOT admin
 * 3. User has no saved name
 */
export function checkAndPromptUserName() {
    const chatPage = document.getElementById('chat-page');
    if (!chatPage || !chatPage.classList.contains('active-page')) {
        console.log('[Chat] Not on chat page, skipping name prompt');
        return;
    }

    if (isAdmin) {
        // Admin: set name from config, no prompt
        fetchHomeConfig().then(config => {
            currentUserName = config?.hero?.name || 'Admin';
        });
        return;
    }

    const savedName = localStorage.getItem('userDisplayName');
    if (!savedName || savedName === '') {
        console.log('[Chat] No saved name, showing prompt');
        const modal = document.getElementById('namePromptModal');
        if (modal) modal.classList.add('active');
    } else {
        setCurrentUser(savedName);
    }
}

/**
 * Initialize chat page. Called when user navigates to chat tab.
 */
export async function initChatPage() {
    localStorage.setItem('chatUserId', currentUserId);
    await fetchHomeConfig();

    // Only bind event listeners once
    if (!chatInitialized) {
        initNamePrompt();
        initChatListeners();
        initProposalModal();
        chatInitialized = true;
        console.log('[Chat] Chat page initialized (first time)');
    }

    // Always refresh sidebar and messages when entering chat
    await updateSidebarContent();

    if (firestoreAvailable && db) {
        loadMessagesRealtime();
    }
}

/**
 * Load users list into admin sidebar.
 * Now delegates to updateSidebarContent to avoid overwriting the sidebar.
 */
export async function loadUsersList() {
    await updateSidebarContent();
}

/**
 * Delete user name (for regular users). Clears localStorage and re-prompts.
 */
export function deleteUserName() {
    if (confirm("Delete your name? You'll need to enter a new one to continue chatting.")) {
        localStorage.removeItem('userDisplayName');
        localStorage.removeItem('chatUserId');
        currentUserId = 'user_' + Math.random().toString(36).substr(2, 6);
        currentUserName = '';
        localStorage.setItem('chatUserId', currentUserId);
        setCurrentUser('');
        updateSidebarContent();

        setTimeout(() => {
            const modal = document.getElementById('namePromptModal');
            if (modal) modal.classList.add('active');
        }, 500);
    }
}

// ========== NAME PROMPT ==========
function initNamePrompt() {
    const saveBtn = document.getElementById('saveNameBtn');
    const nameInput = document.getElementById('userNameInput');

    if (saveBtn) {
        saveBtn.addEventListener('click', () => {
            const name = nameInput.value.trim();
            if (name) {
                localStorage.setItem('userDisplayName', name);
                setCurrentUser(name);
                document.getElementById('namePromptModal').classList.remove('active');

                if (firestoreAvailable && db) {
                    db.collection(USERS_COLLECTION).doc(currentUserId).set({
                        displayName: name,
                        userId: currentUserId,
                        timestamp: Date.now()
                    });
                }

                updateSidebarContent();
            } else {
                alert("Please enter a name");
            }
        });
    }

    if (nameInput) {
        nameInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') saveBtn.click();
        });
    }
}

// ========== SIDEBAR ==========
async function updateSidebarContent() {
    const sidebar = document.getElementById('contactSidebarContent');
    if (!sidebar) return;

    const config = await fetchHomeConfig();
    const adminName = config?.hero?.name || 'Prince O.N';
    const adminImg = config?.hero?.imgUrl || '/images/ceo1.png';
    const displayName = currentUserName || 'Guest';

    if (isAdmin) {
        // ---- ADMIN SIDEBAR ----
        let usersHTML = '';

        if (firestoreAvailable && db) {
            try {
                const snapshot = await db.collection(USERS_COLLECTION).orderBy('timestamp', 'desc').get();
                const users = snapshot.docs.map(doc => doc.data());

                if (users.length > 0) {
                    usersHTML = `
                        <h4 style="margin: 1rem 0 0.5rem; color: #8b949e; font-size: 0.85rem;">
                            Contacts (${users.length})
                        </h4>
                        <div class="user-list" style="max-height: 250px; overflow-y: auto;">
                            ${users.map(user => `
                                <div class="user-item" style="display: flex; justify-content: space-between; align-items: center; padding: 0.5rem 0.6rem; background: rgba(255,255,255,0.03); border-radius: 8px; margin-bottom: 0.4rem; border: 1px solid #2d3345;">
                                    <div>
                                        <strong style="font-size: 0.85rem; color: #e6edf3;">${user.displayName || 'Anonymous'}</strong><br>
                                        <small style="color: #6b7280;">ID: ${(user.userId || '').substring(0, 8)}...</small>
                                    </div>
                                    <button class="delete-user-msgs-btn" data-user-id="${user.userId}" data-user-name="${escapeHtml(user.displayName || 'Anonymous')}"
                                        style="background: rgba(220,38,38,0.15); color: #ef4444; border: none; padding: 0.35rem 0.6rem; 
                                        border-radius: 6px; cursor: pointer; font-size: 0.7rem; flex-shrink: 0;"
                                        title="Delete this user's messages">
                                        <i class="fas fa-trash-alt"></i>
                                    </button>
                                </div>
                            `).join('')}
                        </div>
                    `;
                } else {
                    usersHTML = '<p style="color: #6b7280; font-size: 0.8rem; margin-top: 0.5rem;">No contacts yet.</p>';
                }
            } catch (err) {
                console.error("[Chat] Error loading users:", err);
                usersHTML = '<p style="color: #ef4444; font-size: 0.8rem; margin-top: 0.5rem;">Error loading contacts.</p>';
            }
        }

        sidebar.innerHTML = `
            <div style="display: flex; align-items: center; gap: 0.8rem; margin: 1rem 0;">
                <img src="${adminImg}" style="width: 60px; height: 60px; border-radius: 50%; object-fit: cover;">
                <div>
                    <strong>${adminName}</strong><br>
                    <small style="color: #a78bfa;">System Administrator</small>
                </div>
            </div>
            <hr style="margin: 1rem 0; border-color: #2d3345;">
            <div style="background: rgba(167,139,250,0.1); padding: 0.8rem; border-radius: 8px; border: 1px solid rgba(167,139,250,0.2);">
                <p style="margin: 0 0 0.5rem; font-size: 0.85rem; color: #a78bfa;">
                    <i class="fas fa-crown"></i> <strong>You are the Admin</strong>
                </p>
                <button id="globalSidebarDeleteBtn"
                    style="width: 100%; background: linear-gradient(135deg, #ef4444, #991b1b); padding: 0.5rem; font-size: 0.8rem; border-radius: 8px; color: white; border: none; cursor: pointer; margin-top: 0.3rem;"
                    title="Delete ALL chat messages globally">
                    <i class="fas fa-radiation"></i> Wipe All Chats
                </button>
            </div>
            ${usersHTML}
        `;

        // Bind global delete
        const globalDelBtn = document.getElementById('globalSidebarDeleteBtn');
        if (globalDelBtn) {
            globalDelBtn.onclick = () => globalDeleteAllChats();
        }

        // Bind per-contact delete buttons
        sidebar.querySelectorAll('.delete-user-msgs-btn').forEach(btn => {
            btn.onclick = async () => {
                const userId = btn.getAttribute('data-user-id');
                const userName = btn.getAttribute('data-user-name');
                if (confirm(`Delete ALL messages from "${userName}"?`)) {
                    await deleteUserMessages(userId);
                }
            };
        });

    } else {
        // ---- REGULAR USER SIDEBAR ----
        sidebar.innerHTML = `
            <div style="display: flex; align-items: center; gap: 0.8rem; margin: 1rem 0;">
                <img src="${adminImg}" style="width: 80px; height: 80px; border-radius: 50%; object-fit: cover;">
                <div>
                    <strong>${adminName}</strong><br>
                    <small style="color: #a78bfa;">Available for work</small>
                </div>
            </div>
            <hr style="margin: 1rem 0; border-color: #2d3345;">
            <div style="font-size: 0.85rem; color: #8f9bb3; display: flex; align-items: center; justify-content: space-between;">
                <div>
                    <i class="fas fa-info-circle"></i> Chatting as: <strong id="userDisplayName">${displayName}</strong>
                </div>
                <button id="deleteNameBtn" style="background: #dc2626; padding: 0.3rem 0.8rem; font-size: 0.7rem; border: none; color: white; border-radius: 6px; cursor: pointer;">
                    <i class="fas fa-trash-alt"></i>
                </button>
            </div>
        `;

        const deleteNameBtn = document.getElementById('deleteNameBtn');
        if (deleteNameBtn) {
            deleteNameBtn.onclick = () => deleteUserName();
        }
    }
}

// ========== DELETE OPERATIONS ==========

/**
 * Admin: Delete ALL messages from Firestore globally.
 * Shows "no messages" if collection is empty.
 */
async function globalDeleteAllChats() {
    if (!firestoreAvailable || !db) {
        alert("Firebase not available.");
        return;
    }

    try {
        const snapshot = await db.collection(CHAT_COLLECTION).get();

        if (snapshot.empty) {
            alert("No messages to delete.");
            return;
        }

        if (!confirm(`Delete ALL ${snapshot.size} messages globally? This cannot be undone.`)) return;

        // Firestore batches handle max 500 ops
        const docs = snapshot.docs;
        for (let i = 0; i < docs.length; i += 500) {
            const batch = db.batch();
            docs.slice(i, i + 500).forEach(doc => batch.delete(doc.ref));
            await batch.commit();
        }

        // Clear UI
        const msgsArea = document.getElementById('chatMessages');
        if (msgsArea) {
            msgsArea.innerHTML = '<div style="text-align: center; color: #6b7280; padding: 2rem;"><i class="fas fa-check-circle" style="color: #22c55e;"></i> Chat cleared globally.</div>';
        }

        alert(`Deleted ${docs.length} messages globally.`);
    } catch (err) {
        console.error("[Chat] Global delete error:", err);
        if (err.code === 'permission-denied') {
            alert("Permission denied. Your Firestore rules may not allow deleting from 'globalChat'. Check your Firebase console → Firestore → Rules.");
        } else {
            alert("Delete failed: " + err.message);
        }
    }
}

/**
 * Admin: Delete all messages from a specific user AND delete the user's profile completely.
 */
async function deleteUserMessages(userId) {
    if (!firestoreAvailable || !db) return;

    try {
        // 1. Delete all messages from this user globally
        const snapshot = await db.collection(CHAT_COLLECTION).where('userId', '==', userId).get();

        if (!snapshot.empty) {
            const docs = snapshot.docs;
            for (let i = 0; i < docs.length; i += 500) {
                const batch = db.batch();
                docs.slice(i, i + 500).forEach(doc => batch.delete(doc.ref));
                await batch.commit();
            }
        }

        // 2. Delete the user profile from the users collection
        await db.collection(USERS_COLLECTION).doc(userId).delete();

        alert(`Deleted contact and all their messages.`);
        
        // Refresh sidebar to remove them from the list
        await updateSidebarContent();
    } catch (err) {
        console.error("[Chat] User message and profile delete error:", err);
        if (err.code === 'permission-denied') {
            alert("Permission denied. Check Firestore rules for 'globalChat' or 'users' collection.");
        } else {
            alert("Delete failed: " + err.message);
        }
    }
}

// ========== CHAT LISTENERS ==========
function initChatListeners() {
    const sendBtn = document.getElementById('sendChatBtn');
    const chatInput = document.getElementById('chatInput');
    const deleteBtn = document.getElementById('deleteMyChatsBtn');
    const openProposalBtn = document.getElementById('openProposalBtn');

    if (sendBtn) {
        sendBtn.addEventListener('click', () => {
            if (chatInput.value.trim()) {
                sendMessage(chatInput.value);
                chatInput.value = '';
            }
        });
    }

    if (chatInput) {
        chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && chatInput.value.trim()) {
                sendMessage(chatInput.value);
                chatInput.value = '';
            }
        });
    }

    if (deleteBtn) {
        deleteBtn.addEventListener('click', () => {
            if (isAdmin) {
                // Admin: global delete
                globalDeleteAllChats();
            } else {
                // User: local-only delete (hide messages from their view)
                if (confirm('Clear your chat view? Messages will still exist for the admin.')) {
                    localStorage.setItem('lastChatDelete', Date.now().toString());
                    loadMessagesRealtime();
                    alert("Your chat view has been cleared.");
                }
            }
        });
    }

    if (openProposalBtn) {
        openProposalBtn.addEventListener('click', () => {
            openProposalModal();
        });
    }
}

// ========== MESSAGING ==========
async function sendMessage(text) {
    if (!firestoreAvailable || !db) {
        alert("Firebase not configured. Please add your Firebase config.");
        return;
    }

    if (!currentUserName || currentUserName === '') {
        alert("Please set your name before sending messages.");
        checkAndPromptUserName();
        return;
    }

    const config = await fetchHomeConfig();
    const adminName = config?.hero?.name || 'Prince O.N';

    db.collection(CHAT_COLLECTION).add({
        userId: currentUserId,
        userName: currentUserName,
        name: isAdmin ? `${adminName} (Admin)` : currentUserName,
        text: text,
        timestamp: Date.now(),
        isAdmin: isAdmin
    });
}

function loadMessagesRealtime() {
    if (!firestoreAvailable || !db) return;

    db.collection(CHAT_COLLECTION)
        .orderBy('timestamp', 'asc')
        .onSnapshot(snapshot => {
            const msgsDiv = document.getElementById('chatMessages');
            if (!msgsDiv) return;

            msgsDiv.innerHTML = '';
            const lastDelete = parseInt(localStorage.getItem('lastChatDelete') || '0');

            snapshot.forEach(doc => {
                const data = doc.data();

                // Regular users: skip messages older than their last local delete
                if (!isAdmin && data.timestamp <= lastDelete) return;

                const bubble = document.createElement('div');
                bubble.className = `msg-bubble ${data.userId === currentUserId ? 'my-msg' : 'other-msg'}`;
                bubble.innerHTML = `<strong>${data.name || data.userName || data.userId}</strong><br>${escapeHtml(data.text)}`;
                msgsDiv.appendChild(bubble);
            });
            msgsDiv.scrollTop = msgsDiv.scrollHeight;
        });
}

// ========== CONFIRM HELPER ==========
function showConfirm(title, message, onYes) {
    if (window.showConfirm) {
        window.showConfirm(title, message, onYes);
    } else if (confirm(`${title}\n\n${message}`)) {
        onYes();
    }
}

// ========== PROPOSAL MODAL ==========
export function initProposalModal() {
    if (!document.getElementById('proposalModal')) {
        createProposalModal();
    }

    const closeModalBtn = document.getElementById('closeProposalModal');
    const cancelBtn = document.getElementById('cancelProposalBtn');
    const sendProposalWhatsAppBtn = document.getElementById('sendProposalWhatsApp');
    const sendProposalEmailBtn = document.getElementById('sendProposalEmail');
    const modalOverlay = document.getElementById('proposalModal');

    if (closeModalBtn) closeModalBtn.addEventListener('click', closeProposalModal);
    if (cancelBtn) cancelBtn.addEventListener('click', closeProposalModal);
    if (sendProposalWhatsAppBtn) sendProposalWhatsAppBtn.addEventListener('click', sendToWhatsApp);
    if (sendProposalEmailBtn) sendProposalEmailBtn.addEventListener('click', sendToEmail);
    if (modalOverlay) {
        modalOverlay.addEventListener('click', (e) => {
            if (e.target === modalOverlay) closeProposalModal();
        });
    }
}

export function openProposalModal() {
    const modal = document.getElementById('proposalModal');
    if (modal) {
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }
}

function closeProposalModal() {
    const modal = document.getElementById('proposalModal');
    if (modal) {
        modal.classList.remove('active');
        document.body.style.overflow = '';
    }
}

function createProposalModal() {
    const modalHTML = `
    <div id="proposalModal" class="proposal-modal">
        <div class="proposal-modal-content">
            <div class="proposal-modal-header">
                <h2><i class="fas fa-briefcase"></i> Send Job Proposal</h2>
                <button class="modal-close" id="closeProposalModal">&times;</button>
            </div>
            <div class="proposal-modal-body">
                <div class="form-section">
                    <h3><i class="fas fa-user"></i> Personal Information</h3>
                    <div class="form-row">
                        <div class="form-group">
                            <label><i class="fas fa-user"></i> Full Name *</label>
                            <input type="text" id="proposalName" placeholder="John Doe" required>
                        </div>
                        <div class="form-group">
                            <label><i class="fas fa-envelope"></i> Email Address *</label>
                            <input type="email" id="proposalEmail" placeholder="john@example.com" required>
                        </div>
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label><i class="fas fa-phone"></i> Phone Number</label>
                            <input type="tel" id="proposalPhone" placeholder="+1 234 567 8900">
                        </div>
                        <div class="form-group">
                            <label><i class="fas fa-building"></i> Company (Optional)</label>
                            <input type="text" id="proposalCompany" placeholder="Your Company Name">
                        </div>
                    </div>
                </div>
                <div class="form-section">
                    <h3><i class="fas fa-tasks"></i> Project Details</h3>
                    <div class="form-group full-width">
                        <label><i class="fas fa-file-alt"></i> Project Description *</label>
                        <textarea id="proposalDesc" rows="4" placeholder="Describe your project in detail..." required></textarea>
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label><i class="fas fa-dollar-sign"></i> Budget Range *</label>
                            <select id="proposalBudget" required>
                                <option value="">Select budget range</option>
                                <option value="$500 - $1,000">$500 - $1,000</option>
                                <option value="$1,000 - $2,500">$1,000 - $2,500</option>
                                <option value="$2,500 - $5,000">$2,500 - $5,000</option>
                                <option value="$5,000 - $10,000">$5,000 - $10,000</option>
                                <option value="$10,000+">$10,000+</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label><i class="fas fa-calendar-alt"></i> Timeline *</label>
                            <select id="proposalTimeline" required>
                                <option value="">Select timeline</option>
                                <option value="ASAP (1-2 weeks)">ASAP (1-2 weeks)</option>
                                <option value="2-4 weeks">2-4 weeks</option>
                                <option value="1-3 months">1-3 months</option>
                                <option value="3-6 months">3-6 months</option>
                                <option value="Flexible">Flexible</option>
                            </select>
                        </div>
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label><i class="fas fa-tag"></i> Offer Amount</label>
                            <input type="text" id="proposalOffer" placeholder="Specific offer amount (optional)">
                        </div>
                        <div class="form-group">
                            <label><i class="fas fa-globe"></i> Project Type</label>
                            <select id="proposalType">
                                <option value="">Select project type</option>
                                <option value="Website Development">Website Development</option>
                                <option value="Web Application">Web Application</option>
                                <option value="Mobile App">Mobile App</option>
                                <option value="E-commerce">E-commerce</option>
                                <option value="Portfolio">Portfolio</option>
                                <option value="Dashboard">Dashboard / Admin Panel</option>
                                <option value="Other">Other</option>
                            </select>
                        </div>
                    </div>
                </div>
                <div class="form-section">
                    <h3><i class="fas fa-paperclip"></i> Additional Information</h3>
                    <div class="form-group full-width">
                        <label><i class="fas fa-sticky-note"></i> Reference / Notes</label>
                        <textarea id="proposalNotes" rows="2" placeholder="Any additional information..."></textarea>
                    </div>
                </div>
            </div>
            <div class="proposal-modal-footer">
                <button class="btn-secondary" id="cancelProposalBtn">Cancel</button>
                <div style="display: flex; gap: 1rem;">
                    <button class="btn-primary" id="sendProposalWhatsApp">
                        <i class="fab fa-whatsapp"></i> Send via WhatsApp
                    </button>
                    <button class="btn-primary" id="sendProposalEmail" style="background: linear-gradient(95deg, #EA4335, #C5221F);">
                        <i class="fas fa-envelope"></i> Send via Email
                    </button>
                </div>
            </div>
        </div>
    </div>`;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

function getProposalData() {
    return {
        name: document.getElementById('proposalName')?.value,
        email: document.getElementById('proposalEmail')?.value,
        phone: document.getElementById('proposalPhone')?.value,
        company: document.getElementById('proposalCompany')?.value,
        desc: document.getElementById('proposalDesc')?.value,
        budget: document.getElementById('proposalBudget')?.value,
        timeline: document.getElementById('proposalTimeline')?.value,
        offer: document.getElementById('proposalOffer')?.value,
        projectType: document.getElementById('proposalType')?.value,
        notes: document.getElementById('proposalNotes')?.value
    };
}

function validateProposal(data) {
    if (!data.name || !data.email || !data.desc || !data.budget || !data.timeline) {
        alert("Please fill all required fields (*)");
        return false;
    }
    return true;
}

function sendToWhatsApp() {
    const data = getProposalData();
    if (!validateProposal(data)) return;

    const msg = `NEW JOB PROPOSAL%0A%0AName: ${data.name}%0AEmail: ${data.email}%0APhone: ${data.phone || 'N/A'}%0ACompany: ${data.company || 'N/A'}%0A%0ADescription: ${data.desc}%0ABudget: ${data.budget}%0ATimeline: ${data.timeline}%0AOffer: ${data.offer || 'N/A'}%0AType: ${data.projectType || 'N/A'}%0A%0ANotes: ${data.notes || 'N/A'}`;
    window.open(`https://wa.me/1234567890?text=${msg}`, '_blank');
    alert("Proposal prepared! WhatsApp will open.");
    clearProposalForm();
    closeProposalModal();
}

function sendToEmail() {
    const data = getProposalData();
    if (!validateProposal(data)) return;

    const body = `NEW JOB PROPOSAL\n\nName: ${data.name}\nEmail: ${data.email}\nPhone: ${data.phone || 'N/A'}\nCompany: ${data.company || 'N/A'}\n\nDescription: ${data.desc}\nBudget: ${data.budget}\nTimeline: ${data.timeline}\nOffer: ${data.offer || 'N/A'}\nType: ${data.projectType || 'N/A'}\n\nNotes: ${data.notes || 'N/A'}`;
    window.location.href = `mailto:alex@n-waxon.com?subject=Job Proposal from ${data.name}&body=${encodeURIComponent(body)}`;
    alert("Email client will open.");
    clearProposalForm();
    closeProposalModal();
}

function clearProposalForm() {
    ['proposalName', 'proposalEmail', 'proposalPhone', 'proposalCompany', 'proposalDesc', 'proposalBudget', 'proposalTimeline', 'proposalOffer', 'proposalType', 'proposalNotes'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
}