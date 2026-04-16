import { db, storage, firestoreAvailable } from './firebase-config.js';
import { getDoc, setDoc, uploadFile, addDoc, updateDoc, deleteDoc, getDocs } from './firebase-helpers.js';
import { logout } from './auth.js';

let homeConfig = {};
let originalHomeConfig = {};
let originalProjectData = {};
let currentEditingProjectId = null;
let activeTabId = 'home-settings';
let dirtySections = {};

let adminInitialized = false;


export async function initAdminEditor() {
    if (adminInitialized) return;
    adminInitialized = true;
    
    initTabs();
    await loadHomeConfig();
    initHomeAdmin();
    initAboutContactAdmin();
    initProjectAdmin();
    await initChatAdmin();
    initLogout();
    initChangeTracking();
    initFloatingBarActions();
}

// --- TAB SYSTEM ---
function initTabs() {
    const tabs = document.querySelectorAll('.admin-tab');
    const contents = document.querySelectorAll('.tab-content');

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const target = tab.getAttribute('data-tab');
            activeTabId = target;
            
            tabs.forEach(t => t.classList.remove('active'));
            contents.forEach(c => c.classList.remove('active'));
            tab.classList.add('active');
            document.getElementById(target).classList.add('active');

            // Toggle floating bar based on new active tab state
            updateFloatingBar();
        });
    });
}

// --- DIRTY CHECK SYSTEM ---
function setDirty(sectionId, status) {
    dirtySections[sectionId] = status;
    updateFloatingBar();
}

function updateFloatingBar() {
    const bar = document.getElementById('adminFloatingBar');
    if (dirtySections[activeTabId]) {
        bar.classList.add('active');
    } else {
        bar.classList.remove('active');
    }
}

function initChangeTracking() {
    console.log('[Admin] Dirty tracking initialized');

    // Listen for typing in inputs/textareas
    document.addEventListener('input', (e) => {
        const adminPage = document.getElementById('admin-page');
        if (!adminPage || !adminPage.classList.contains('active-page')) return;

        const section = e.target.closest('.tab-content');
        if (section) {
            if (section.id === 'project-settings' && !currentEditingProjectId) return;
            
            try {
                const isDirty = checkSectionDirty(section.id);
                console.log(`[Admin] Dirty check for ${section.id}: ${isDirty}`);
                setDirty(section.id, isDirty);
            } catch (err) {
                console.warn('[Admin] Dirty check error, marking dirty:', err);
                setDirty(section.id, true);
            }
        }
    });

    // Listen for select/checkbox changes
    document.addEventListener('change', (e) => {
        const adminPage = document.getElementById('admin-page');
        if (!adminPage || !adminPage.classList.contains('active-page')) return;

        const section = e.target.closest('.tab-content');
        if (section) {
            console.log(`[Admin] Change event in ${section.id}`);
            setDirty(section.id, true);
        }
    });

    // Listen for add/remove button clicks
    document.addEventListener('click', (e) => {
        const adminPage = document.getElementById('admin-page');
        if (!adminPage || !adminPage.classList.contains('active-page')) return;

        if (e.target.closest('.btn-secondary') || e.target.closest('.remove-btn')) {
            const section = e.target.closest('.tab-content');
            if (section) {
                console.log(`[Admin] Button click in ${section.id}, marking dirty`);
                setDirty(section.id, true);
            }
        }
    });
}

function checkSectionDirty(sectionId) {
    try {
        if (sectionId === 'home-settings') {
            const currentHero = {
                name: document.getElementById('adminHeroName')?.value || '',
                subtext: document.getElementById('adminHeroSubtext')?.value || '',
                movingWords: (document.getElementById('adminMovingWords')?.value || '')
                                .split(',')
                                .map(s => s.trim())
                                .filter(s => s !== ''),
                imgUrl: document.getElementById('adminHeroImgUrl')?.value || ''
            };
            const currentMeta = {
                logoText: document.getElementById('adminNavLogo')?.value || '',
                siteTitle: document.getElementById('adminSiteTitle')?.value || ''
            };
            
            const origHero = originalHomeConfig.hero || {};
            const origMovingWords = (origHero.movingWords || []).map(s => s.trim());
            
            const isHeroDirty = currentHero.name !== (origHero.name || '') ||
                   currentHero.subtext !== (origHero.subtext || '') ||
                   currentHero.imgUrl !== (origHero.imgUrl || '') ||
                   JSON.stringify(currentHero.movingWords) !== JSON.stringify(origMovingWords);
                   
            const isMetaDirty = currentMeta.logoText !== (originalHomeConfig.logoText || '') ||
                   currentMeta.siteTitle !== (originalHomeConfig.siteTitle || '');

            const currentCoffee = {
                fullName: document.getElementById('adminBankFullName')?.value || '',
                account: document.getElementById('adminBankAccount')?.value || '',
                bankName: document.getElementById('adminBankName')?.value || '',
                logoUrl: document.getElementById('adminBankLogo')?.value || ''
            };
            const origCoffee = originalHomeConfig.coffee || {};
            const isCoffeeDirty = currentCoffee.fullName !== (origCoffee.fullName || '') ||
                   currentCoffee.account !== (origCoffee.account || '') ||
                   currentCoffee.bankName !== (origCoffee.bankName || '') ||
                   currentCoffee.logoUrl !== (origCoffee.logoUrl || '');

            return isHeroDirty || isMetaDirty || isCoffeeDirty;
        }

        if (sectionId === 'about-settings') {
            const currentAboutTitle = document.getElementById('adminAboutTitle')?.value || '';
            const contacts = {
                phone: document.getElementById('adminPhone')?.value || '',
                email: document.getElementById('adminEmail')?.value || '',
                github: document.getElementById('adminGithub')?.value || '',
                linkedin: document.getElementById('adminLinkedin')?.value || '',
                facebook: document.getElementById('adminFacebook')?.value || '',
                instagram: document.getElementById('adminInstagram')?.value || '',
                tiktok: document.getElementById('adminTikTok')?.value || '',
                twitter: document.getElementById('adminTwitter')?.value || ''
            };
            const currentParas = Array.from(document.querySelectorAll('.about-para-input')).map(i => i.value);
            const currentBullets = Array.from(document.querySelectorAll('.about-bullet-item')).map(item => ({
                icon: item.querySelector('.about-bullet-icon').value,
                text: item.querySelector('.about-bullet-text').value
            }));
            
            const origAbout = originalHomeConfig.about || {};
            const origContacts = originalHomeConfig.contacts || {};
            const origSocials = originalHomeConfig.socials || {};

            const isContactsDirty = contacts.phone !== (origContacts.phone || '') ||
                                    contacts.email !== (origContacts.email || '') ||
                                    contacts.github !== (origContacts.github || 'https://github.com/') ||
                                    contacts.linkedin !== (origContacts.linkedin || 'https://linkedin.com/in/') ||
                                    contacts.facebook !== (origSocials.facebook || 'https://facebook.com/') ||
                                    contacts.instagram !== (origSocials.instagram || 'https://instagram.com/') ||
                                    contacts.tiktok !== (origSocials.tiktok || 'https://tiktok.com/@') ||
                                    contacts.twitter !== (origSocials.twitter || 'https://twitter.com/');

            const isParasDirty = JSON.stringify(currentParas) !== JSON.stringify(origAbout.paragraphs || []);
            const isBulletsDirty = JSON.stringify(currentBullets) !== JSON.stringify(origAbout.bullets || []);

            return isContactsDirty || currentAboutTitle !== (origAbout.title || '') || isParasDirty || isBulletsDirty;
        }

        if (sectionId === 'project-settings') {
            let isProjDirty = false;
            if (currentEditingProjectId) {
                const currentProj = {
                    name: document.getElementById('adminProjName')?.value || '',
                    link: document.getElementById('adminProjLink')?.value || '',
                    category: document.getElementById('adminProjCategory')?.value || '',
                    languages: document.getElementById('adminProjLanguages')?.value || '',
                    showHome: document.getElementById('adminProjShowHome')?.checked || false
                };
                
                isProjDirty = currentProj.name !== (originalProjectData.name || '') ||
                       currentProj.link !== (originalProjectData.link || '') ||
                       currentProj.category !== (originalProjectData.category || '') ||
                       currentProj.languages !== (originalProjectData.languages || '') ||
                       currentProj.showHome !== (originalProjectData.showOnHome || false);
            }
            return isProjDirty;
        }

        if (sectionId === 'quick-link-settings') {
            const currentLinks = Array.from(document.querySelectorAll('.quick-link-item')).map(item => ({
                icon: item.querySelector('.quick-link-icon').value,
                text: item.querySelector('.quick-link-text').value,
                url: item.querySelector('.quick-link-url').value
            }));
            const rawOrig = originalHomeConfig.quickLinks || [];
            const origLinks = rawOrig.map(l => ({ icon: l.icon || '', text: l.text || '', url: l.url || '' }));
            return JSON.stringify(currentLinks) !== JSON.stringify(origLinks);
        }
    } catch (e) {
        return true; 
    }
    return false;
}

function initFloatingBarActions() {
    const saveBtn = document.getElementById('saveChangesBtn');
    const discardBtn = document.getElementById('discardChangesBtn');

    saveBtn.onclick = async () => {
        const activeSection = document.getElementById(activeTabId);
        if (activeSection) {
            const sectionSaveBtns = Array.from(activeSection.querySelectorAll('.save-config-btn, #saveProjectBtn'));
            
            saveBtn.innerText = 'Saving...';
            for (const btn of sectionSaveBtns) {
                btn.click();
                await new Promise(r => setTimeout(r, 600)); // Delay loop execution iteratively to stop database config race condition overrides
            }
            saveBtn.innerText = 'Save Changes';
        }
    };

    discardBtn.onclick = () => {
        if (confirm('Discard all unsaved changes in this section?')) {
            window.location.reload(); // Simplest way to revert everything
        }
    };
}

// --- LOGOUT ---
function initLogout() {
    const logoutBtn = document.getElementById('logoutAdminBtn');
    if (logoutBtn) {
        logoutBtn.onclick = async () => {
            await logout();
            window.location.reload();
        };
    }
}

// --- HOME CONFIG ---
async function loadHomeConfig() {
    if (!firestoreAvailable) return;
    homeConfig = await getDoc('config', 'home') || {};
    
    // Fill basic fields
    document.getElementById('adminNavLogo').value = homeConfig.logoText || '';
    document.getElementById('adminSiteTitle').value = homeConfig.siteTitle || '';
    document.getElementById('adminHeroName').value = homeConfig.hero?.name || '';
    document.getElementById('adminHeroSubtext').value = homeConfig.hero?.subtext || '';
    document.getElementById('adminMovingWords').value = homeConfig.hero?.movingWords?.join(', ') || '';
    document.getElementById('adminHeroImgUrl').value = homeConfig.hero?.imgUrl || '';
    
    document.getElementById('adminBankFullName').value = homeConfig.coffee?.fullName || '';
    document.getElementById('adminBankAccount').value = homeConfig.coffee?.account || '';
    document.getElementById('adminBankName').value = homeConfig.coffee?.bankName || '';
    document.getElementById('adminBankLogo').value = homeConfig.coffee?.logoUrl || '';

    document.getElementById('adminAboutTitle').value = homeConfig.about?.title || '';

    // Render About Paragraphs
    renderAboutParagraphs(homeConfig.about?.paragraphs || []);
    // Render About Bullets
    renderAboutBullets(homeConfig.about?.bullets || []);
    // Render Contacts
    document.getElementById('adminPhone').value = homeConfig.contacts?.phone || '';
    document.getElementById('adminEmail').value = homeConfig.contacts?.email || '';
    document.getElementById('adminGithub').value = homeConfig.contacts?.github || '';
    document.getElementById('adminLinkedin').value = homeConfig.contacts?.linkedin || '';

    // Render Socials
    document.getElementById('adminFacebook').value = homeConfig.socials?.facebook || 'https://facebook.com/';
    document.getElementById('adminInstagram').value = homeConfig.socials?.instagram || 'https://instagram.com/';
    document.getElementById('adminTikTok').value = homeConfig.socials?.tiktok || 'https://tiktok.com/@';
    document.getElementById('adminTwitter').value = homeConfig.socials?.twitter || 'https://twitter.com/';

    // Optional: Also for GitHub/LinkedIn
    if (!document.getElementById('adminGithub').value) document.getElementById('adminGithub').value = 'https://github.com/';
    if (!document.getElementById('adminLinkedin').value) document.getElementById('adminLinkedin').value = 'https://linkedin.com/in/';
    
    renderQuickLinks(homeConfig.quickLinks || []);

    // Backup original values for dirty check comparison
    originalHomeConfig = JSON.parse(JSON.stringify(homeConfig));
    
    // Reset dirty state for these sections after load
    dirtySections['home-settings'] = false;
    dirtySections['about-settings'] = false;
    updateFloatingBar();
}

function initHomeAdmin() {
    const saveBtns = document.querySelectorAll('.save-config-btn');
    saveBtns.forEach(btn => {
        btn.onclick = async () => {
            const section = btn.getAttribute('data-section');
            const tabId = (section === 'hero' || section === 'coffee') ? 'home-settings' : (section === 'about' || section === 'contacts' || section === 'socials' ? 'about-settings' : (section === 'quickLinks' ? 'quick-link-settings' : ''));
            
            btn.innerText = 'Saving...';
            btn.disabled = true;

            try {
                if (section === 'hero') {
                    const imgFile = document.getElementById('adminHeroImgFile').files[0];
                    let imgUrl = document.getElementById('adminHeroImgUrl').value;

                    if (imgFile) {
                        imgUrl = await uploadFile(imgFile, `home/hero_${Date.now()}`);
                    }

                    const heroData = {
                        name: document.getElementById('adminHeroName').value,
                        subtext: document.getElementById('adminHeroSubtext').value,
                        movingWords: document.getElementById('adminMovingWords').value.split(',').map(s => s.trim()),
                        imgUrl: imgUrl
                    };
                    await setDoc('config', 'home', { 
                        hero: heroData,
                        logoText: document.getElementById('adminNavLogo').value,
                        siteTitle: document.getElementById('adminSiteTitle').value
                    });
                } else if (section === 'coffee') {
                    const coffeeData = {
                        fullName: document.getElementById('adminBankFullName').value,
                        account: document.getElementById('adminBankAccount').value,
                        bankName: document.getElementById('adminBankName').value,
                        logoUrl: document.getElementById('adminBankLogo').value
                    };
                    await setDoc('config', 'home', { coffee: coffeeData });
                } else if (section === 'about') {
                    const paras = Array.from(document.querySelectorAll('.about-para-input')).map(i => i.value);
                    const bullets = Array.from(document.querySelectorAll('.about-bullet-item')).map(item => ({
                        icon: item.querySelector('.about-bullet-icon').value,
                        text: item.querySelector('.about-bullet-text').value
                    }));
                    await setDoc('config', 'home', { 
                        about: { 
                            title: document.getElementById('adminAboutTitle').value,
                            paragraphs: paras,
                            bullets: bullets
                        } 
                    });
                } else if (section === 'contacts') {
                    const contactsData = {
                        phone: document.getElementById('adminPhone').value,
                        email: document.getElementById('adminEmail').value,
                        github: document.getElementById('adminGithub').value,
                        linkedin: document.getElementById('adminLinkedin').value
                    };
                    await setDoc('config', 'home', { contacts: contactsData });
                } else if (section === 'socials') {
                    const socialsData = {
                        facebook: document.getElementById('adminFacebook').value,
                        instagram: document.getElementById('adminInstagram').value,
                        tiktok: document.getElementById('adminTikTok').value,
                        twitter: document.getElementById('adminTwitter').value
                    };
                    await setDoc('config', 'home', { socials: socialsData });
                } else if (section === 'quickLinks') {
                    const linkElements = Array.from(document.querySelectorAll('.quick-link-item'));
                    const linksData = linkElements.map(item => ({
                        icon: item.querySelector('.quick-link-icon').value,
                        text: item.querySelector('.quick-link-text').value,
                        url: item.querySelector('.quick-link-url').value
                    }));
                    await setDoc('config', 'home', { quickLinks: linksData });
                }
                
                if (tabId) setDirty(tabId, false);
                await loadHomeConfig(); // Refresh original state
                
                // Debounce success alert so it doesn't spam globally during sequential grouped batch saves
                if (!window._saveAlertPending) {
                    window._saveAlertPending = true;
                    setTimeout(() => {
                        alert('Success: Settings saved globally!');
                        window._saveAlertPending = false;
                    }, 400);
                }
            } catch (err) {
                console.error(err);
                alert('Error saving settings: ' + err.message);
            }
            btn.innerText = 'Save Settings';
            btn.disabled = false;
        };
    });

    // Hero Preview
    document.getElementById('adminHeroImgFile').onchange = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (ev) => {
                const preview = document.getElementById('heroImgPreview');
                preview.src = ev.target.result;
                preview.style.display = 'block';
            };
            reader.readAsDataURL(file);
            setDirty('home-settings', true);
        }
    };
}

// --- ABOUT & CONTACTS ---
function renderAboutParagraphs(paras) {
    const container = document.getElementById('aboutParagraphsContainer');
    container.innerHTML = '';
    paras.forEach((p, idx) => addAboutParaRow(p));
}

function addAboutParaRow(val = '') {
    const container = document.getElementById('aboutParagraphsContainer');
    const div = document.createElement('div');
    div.className = 'dynamic-item';
    div.innerHTML = `
        <textarea class="about-para-input" rows="2">${val}</textarea>
        <button class="remove-btn" onclick="this.parentElement.remove(); window.dispatchEvent(new Event('input', {bubbles:true}))"><i class="fas fa-trash"></i></button>
    `;
    container.appendChild(div);
}

function renderContacts(contacts) {
    // Legacy support or just leave empty since we moved to static inputs
}

function addContactRow(data = { type: 'link', label: '', url: '' }) {
    // Legacy support or just leave empty
}

function initAboutContactAdmin() {
    const paraBtn = document.getElementById('addAboutParaBtn');
    const bulletBtn = document.getElementById('addAboutBulletBtn');
    const contactBtn = document.getElementById('addContactBtn');
    const quickLinkBtn = document.getElementById('addQuickLinkBtn');
    
    if (paraBtn) paraBtn.onclick = () => addAboutParaRow();
    if (bulletBtn) bulletBtn.onclick = () => addAboutBulletRow();
    if (contactBtn) contactBtn.onclick = () => addContactRow();
    if (quickLinkBtn) quickLinkBtn.onclick = () => addQuickLinkRow();
    
    console.log('[Admin] About/Contact admin initialized');
}

function renderAboutBullets(bullets) {
    const container = document.getElementById('aboutBulletsContainer');
    container.innerHTML = '';
    bullets.forEach(b => addAboutBulletRow(b));
}

function addAboutBulletRow(data = { icon: 'fas fa-star', text: '' }) {
    const container = document.getElementById('aboutBulletsContainer');
    const div = document.createElement('div');
    div.className = 'dynamic-item about-bullet-item';
    div.innerHTML = `
        <select class="about-bullet-icon" style="width: auto;">
            <option value="fas fa-star" ${data.icon === 'fas fa-star' ? 'selected' : ''}>Star</option>
            <option value="fas fa-laptop" ${data.icon === 'fas fa-laptop' ? 'selected' : ''}>💻 Laptop</option>
            <option value="fas fa-code" ${data.icon === 'fas fa-code' ? 'selected' : ''}>💻 Code</option>
            <option value="fas fa-bolt" ${data.icon === 'fas fa-bolt' ? 'selected' : ''}>⚡ Bolt</option>
            <option value="fas fa-check-circle" ${data.icon === 'fas fa-check-circle' ? 'selected' : ''}>✅ Check</option>
            <option value="fas fa-globe" ${data.icon === 'fas fa-globe' ? 'selected' : ''}>🌐 Globe</option>
        </select>
        <input type="text" class="about-bullet-text" placeholder="Bullet text" value="${data.text}">
        <button class="remove-btn" onclick="this.parentElement.remove(); window.dispatchEvent(new Event('input', {bubbles:true}))"><i class="fas fa-trash"></i></button>
    `;
    container.appendChild(div);
}

// --- QUICK LINKS ---
function renderQuickLinks(links) {
    const container = document.getElementById('adminQuickLinksContainer');
    if (container) {
        container.innerHTML = '';
        links.forEach(l => addQuickLinkRow(l));
    }
}

function addQuickLinkRow(data = { text: '', url: '', icon: 'fas fa-link' }) {
    const container = document.getElementById('adminQuickLinksContainer');
    if (!container) return;
    const div = document.createElement('div');
    div.className = 'dynamic-item quick-link-item';
    div.innerHTML = `
        <select class="quick-link-icon" style="width: auto;">
            <option value="fas fa-link" ${data.icon === 'fas fa-link' ? 'selected' : ''}>🔗 Link</option>
            <option value="fas fa-user" ${data.icon === 'fas fa-user' ? 'selected' : ''}>👤 Person</option>
            <option value="fas fa-building" ${data.icon === 'fas fa-building' ? 'selected' : ''}>🏢 Office</option>
            <option value="fas fa-car" ${data.icon === 'fas fa-car' ? 'selected' : ''}>🚗 Cars</option>
            <option value="fas fa-book" ${data.icon === 'fas fa-book' ? 'selected' : ''}>📚 Books</option>
            <option value="fas fa-plane" ${data.icon === 'fas fa-plane' ? 'selected' : ''}>✈️ Plane</option>
            <option value="fas fa-tree" ${data.icon === 'fas fa-tree' ? 'selected' : ''}>🌳 Trees</option>
            <option value="fas fa-envelope" ${data.icon === 'fas fa-envelope' ? 'selected' : ''}>✉️ Email</option>
            <option value="fas fa-camera" ${data.icon === 'fas fa-camera' ? 'selected' : ''}>📷 Camera</option>
            <option value="fas fa-music" ${data.icon === 'fas fa-music' ? 'selected' : ''}>🎵 Music</option>
            <option value="fas fa-gamepad" ${data.icon === 'fas fa-gamepad' ? 'selected' : ''}>🎮 Gamepad</option>
            <option value="fas fa-star" ${data.icon === 'fas fa-star' ? 'selected' : ''}>⭐ Star</option>
            <option value="fas fa-shopping-cart" ${data.icon === 'fas fa-shopping-cart' ? 'selected' : ''}>🛒 Shop</option>
            <option value="fab fa-github" ${data.icon === 'fab fa-github' ? 'selected' : ''}>🐱 GitHub</option>
            <option value="fas fa-globe" ${data.icon === 'fas fa-globe' ? 'selected' : ''}>🌐 Globe</option>
            <option value="fas fa-code" ${data.icon === 'fas fa-code' ? 'selected' : ''}>💻 Code</option>
            <option value="fas fa-play" ${data.icon === 'fas fa-play' ? 'selected' : ''}>▶️ Play</option>
            <option value="fab fa-youtube" ${data.icon === 'fab fa-youtube' ? 'selected' : ''}>▶️ YouTube</option>
            <option value="fab fa-twitter" ${data.icon === 'fab fa-twitter' ? 'selected' : ''}>🐦 Twitter</option>
            <option value="fab fa-linkedin" ${data.icon === 'fab fa-linkedin' ? 'selected' : ''}>💼 LinkedIn</option>
            <option value="fab fa-medium" ${data.icon === 'fab fa-medium' ? 'selected' : ''}>📝 Medium</option>
            <option value="fab fa-dribbble" ${data.icon === 'fab fa-dribbble' ? 'selected' : ''}>🏀 Dribbble</option>
            <option value="fab fa-behance" ${data.icon === 'fab fa-behance' ? 'selected' : ''}>🎨 Behance</option>
        </select>
        <input type="text" class="quick-link-text" placeholder="Title (e.g., Portfolio)" value="${data.text}">
        <input type="text" class="quick-link-url" placeholder="URL (https://...)" value="${data.url}">
        <button class="remove-btn" onclick="this.parentElement.remove(); window.dispatchEvent(new Event('input', {bubbles:true}))"><i class="fas fa-trash"></i></button>
    `;
    container.appendChild(div);
}

// --- PROJECTS ADMIN ---
async function initProjectAdmin() {
    document.getElementById('addMediaBtn').onclick = () => addMediaRow();
    document.getElementById('saveProjectBtn').onclick = saveProject;
    await loadProjectsList();
    dirtySections['project-settings'] = false;
}

function addMediaRow(data = { url: '', type: 'image' }) {
    const container = document.getElementById('adminMediaItemsContainer');
    const div = document.createElement('div');
    div.className = 'media-entry';
    div.innerHTML = `
        <div class="media-type-switch">
            <label><input type="radio" name="mt_${Date.now()}" value="image" ${data.type === 'image' ? 'checked' : ''}> 🖼️ Image</label>
            <label><input type="radio" name="mt_${Date.now()}" value="video" ${data.type === 'video' ? 'checked' : ''}> 🎥 Video</label>
        </div>
        <div class="form-group">
            <input type="text" class="media-url" placeholder="Direct URL" value="${data.url}">
            <div style="margin-top: 5px;">
                <input type="file" class="media-file" accept="image/*,video/*">
            </div>
            <div class="media-preview-container" style="margin-top: 10px;"></div>
        </div>
        <button class="remove-btn" onclick="this.parentElement.remove(); window.dispatchEvent(new Event('input', {bubbles:true}))" style="margin-top: 5px; width: 100%;">Remove Media</button>
    `;
    
    // Preview logic
    const fileInput = div.querySelector('.media-file');
    const previewContainer = div.querySelector('.media-preview-container');
    fileInput.onchange = (e) => {
        const file = e.target.files[0];
        if (file) {
            previewContainer.innerHTML = '<em>Loading preview...</em>';
            const url = URL.createObjectURL(file);
            if (file.type.startsWith('image')) {
                previewContainer.innerHTML = `<img src="${url}" style="max-width: 100px; border-radius: 8px;">`;
            } else {
                previewContainer.innerHTML = `<video src="${url}" style="max-width: 100px; border-radius: 8px;" muted></video>`;
            }
            setDirty('project-settings', true);
        }
    };

    container.appendChild(div);
}

async function saveProject() {
    const btn = document.getElementById('saveProjectBtn');
    btn.innerText = 'Saving...';
    btn.disabled = true;

    try {
        const name = document.getElementById('adminProjName').value;
        const link = document.getElementById('adminProjLink').value;
        const category = document.getElementById('adminProjCategory').value;
        const languages = document.getElementById('adminProjLanguages').value;
        const showOnHome = document.getElementById('adminProjShowHome').checked;

        // Limit Check: Max 8 on Home Page
        if (showOnHome) {
            const allProjects = await getDocs('projects');
            const homeProjects = allProjects.filter(p => p.showOnHome && p.id !== currentEditingProjectId);
            if (homeProjects.length >= 8) {
                alert("Limit Reached: You can only showcase a maximum of 8 projects on the home page. Please uncheck another project first.");
                btn.innerText = 'Save Project';
                btn.disabled = false;
                return;
            }
        }
        
        const mediaEntries = Array.from(document.querySelectorAll('.media-entry'));
        const mediaList = [];

        for (const entry of mediaEntries) {
            const type = entry.querySelector('input[type="radio"]:checked').value;
            const urlInput = entry.querySelector('.media-url').value;
            const fileInput = entry.querySelector('.media-file').files[0];
            
            let finalUrl = urlInput;
            if (fileInput) {
                finalUrl = await uploadFile(fileInput, `projects/${Date.now()}_${fileInput.name}`);
            }

            if (finalUrl) {
                mediaList.push({ url: finalUrl, type: type });
            }
        }

        const projectData = {
            name,
            link,
            category,
            languages,
            showOnHome,
            media: mediaList
        };

        if (currentEditingProjectId) {
            await updateDoc('projects', currentEditingProjectId, projectData);
        } else {
            await addDoc('projects', projectData);
        }

        setDirty('project-settings', false);
        alert('Project saved successfully!');
        resetProjectForm();
        await loadProjectsList();
    } catch (err) {
        alert('Error: ' + err.message);
    }
    
    btn.innerText = 'Save Project';
    btn.disabled = false;
}

function resetProjectForm() {
    currentEditingProjectId = null;
    document.getElementById('adminProjName').value = '';
    document.getElementById('adminProjLink').value = '';
    document.getElementById('adminProjLanguages').value = '';
    document.getElementById('adminProjShowHome').checked = false;
    document.getElementById('adminMediaItemsContainer').innerHTML = '';
}

let unsubscribeAdminProjects = null;
async function loadProjectsList() {
    const list = document.getElementById('adminProjectsList');
    if (!list || !db) return;

    list.innerHTML = 'Loading projects...';
    
    if (unsubscribeAdminProjects) unsubscribeAdminProjects();

    unsubscribeAdminProjects = db.collection('projects').onSnapshot(snapshot => {
        list.innerHTML = '';
        snapshot.forEach(doc => {
            const proj = { id: doc.id, ...doc.data() };
            const card = document.createElement('div');
            card.className = 'admin-project-item';
            card.innerHTML = `
                <img src="${proj.media?.[0]?.url || 'https://via.placeholder.com/150'}" alt="thumb">
                <strong>${proj.name}</strong>
                <p style="font-size: 0.7rem; color: #8b949e;">${proj.category} | ${proj.languages}</p>
                <div class="admin-project-actions">
                    <button class="edit-btn" onclick="editProject('${proj.id}')">Edit</button>
                    <button class="delete-btn" onclick="showConfirmDeleteProject('${proj.id}')">Delete</button>
                </div>
            `;
            list.appendChild(card);
        });
    });
}

// Global scope functions for buttons
window.editProject = async (id) => {
    const proj = await getDoc('projects', id);
    if (!proj) return;

    currentEditingProjectId = id;
    document.getElementById('adminProjName').value = proj.name;
    document.getElementById('adminProjLink').value = proj.link;
    document.getElementById('adminProjCategory').value = proj.category;
    document.getElementById('adminProjLanguages').value = proj.languages;
    document.getElementById('adminProjShowHome').checked = proj.showOnHome || false;
    
    document.getElementById('adminMediaItemsContainer').innerHTML = '';
    (proj.media || []).forEach(m => addMediaRow(m));
    
    // Backup for dirty check
    originalProjectData = JSON.parse(JSON.stringify(proj));
    
    // Reset dirty state since we just loaded a project
    setDirty('project-settings', false);
};

window.showConfirmDeleteProject = (id) => {
    showConfirm('Delete Project', 'Are you sure? This is irreversible.', async () => {
        await deleteDoc('projects', id);
        await loadProjectsList();
    });
};

// --- CHAT ADMIN ---
async function initChatAdmin() {
    const globalDeleteBtn = document.getElementById('globalDeleteChatBtn');
    if (globalDeleteBtn) {
        globalDeleteBtn.onclick = async () => {
            if (confirm('CRITICAL ACTION: Are you sure you want to delete ALL chat messages globally? This cannot be undone.')) {
                if (confirm('Final confirmation: Delete everything for ALL users?')) {
                    globalDeleteBtn.innerText = 'Deleting...';
                    globalDeleteBtn.disabled = true;

                    try {
                        const snapshot = await db.collection('globalChat').get();
                        const batch = db.batch();
                        
                        snapshot.docs.forEach((doc) => {
                            batch.delete(doc.ref);
                        });
                        
                        await batch.commit();
                        // Clear the local chat messages area if it exists
                        const msgsArea = document.getElementById('chatMessages');
                        if (msgsArea) msgsArea.innerHTML = '<div class="system-msg">Chat database cleared globally.</div>';
                        
                        alert('Success: All chat data has been permanently deleted.');
                    } catch (err) {
                        console.error("Global Delete Error:", err);
                        alert('Error deleting chats. Check console for details.');
                    }
                    
                    globalDeleteBtn.innerText = 'Global Delete All Chats';
                    globalDeleteBtn.disabled = false;
                }
            }
        };
    }
}

// --- CONFIRMATION MODAL ---
let confirmCallback = null;
function showConfirm(title, message, onYes) {
    const modal = document.getElementById('confirmModal');
    document.getElementById('confirmTitle').innerText = title;
    document.getElementById('confirmMessage').innerText = message;
    modal.classList.add('active');
    confirmCallback = onYes;
}

document.getElementById('confirmYesBtn').onclick = async () => {
    if (confirmCallback) {
        await confirmCallback();
    }
    document.getElementById('confirmModal').classList.remove('active');
};

document.getElementById('confirmNoBtn').onclick = () => {
    document.getElementById('confirmModal').classList.remove('active');
};
