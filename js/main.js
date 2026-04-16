import { initHomePage } from './home.js';
import { initBlogPage } from './blog.js';
import { initChatPage, setCurrentUser, setIsAdmin, loadUsersList, checkAndPromptUserName } from './chat.js';
import { initAdminEditor } from './admin-editor.js';
import { initAuth, loginWithGoogle, logout } from './auth.js';

// Demo data for fallback
export const demoProjects = [
    { title: "NeoBank UI", img: "https://picsum.photos/id/104/300/200" },
    { title: "AI Visualizer", img: "https://picsum.photos/id/26/300/200" },
    { title: "3D Configurator", img: "https://picsum.photos/id/155/300/200" },
    { title: "Portfolio X", img: "https://picsum.photos/id/169/300/200" },
    { title: "Eco App", img: "https://picsum.photos/id/29/300/200" },
    { title: "Metaverse Hub", img: "https://picsum.photos/id/96/300/200" },
    { title: "Fitness Tracker", img: "https://picsum.photos/id/127/300/200" },
    { title: "NFT Gallery", img: "https://picsum.photos/id/20/300/200" }
];

export let blogMedia = [
    { type: "image", url: "https://picsum.photos/id/1015/400/300", projectId: "p1", name: "Mountain Retreat" },
    { type: "image", url: "https://picsum.photos/id/1018/400/300", projectId: "p1", name: "Urban Landscape" },
    { type: "video", url: "https://sample-videos.com/video123/mp4/720/big_buck_bunny_720p_1mb.mp4", projectId: "p2", name: "Animation Demo" },
    { type: "image", url: "https://picsum.photos/id/42/400/300", projectId: "p2", name: "Abstract Art" }
];



function initAdminLogin() {
    const loginBtn = document.getElementById('googleLoginBtn');
    const cancelBtn = document.getElementById('cancelAdminBtn');
    const modal = document.getElementById('adminLoginModal');
    const adminBtn = document.getElementById('adminLoginBtn');

    if (adminBtn) {
        adminBtn.onclick = async () => {
            const isAdmin = localStorage.getItem('isAdmin') === 'true';
            if (isAdmin) {
                if (confirm("Sign out of Admin account?")) {
                    await logout();
                    window.location.reload();
                }
            } else {
                modal.classList.add('active');
            }
        };
    }

    if (loginBtn) {
        loginBtn.onclick = async () => {
            try {
                loginBtn.innerText = "Signing in...";
                await loginWithGoogle();
                modal.classList.remove('active');
            } catch (err) {
                alert("Login failed: " + err.message);
            }
            loginBtn.innerHTML = `<img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" width="20"> Sign in with Google`;
        };
    }

    if (cancelBtn) {
        cancelBtn.addEventListener('click', () => {
            modal.classList.remove('active');
        });
    }
}

// Page routing
function initRouting() {
    const pages = ['home', 'blog', 'chat', 'admin'];

    document.querySelectorAll('.nav-link, .footer-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const pageId = link.getAttribute('data-page');
            pages.forEach(p => {
                const pg = document.getElementById(`${p}-page`);
                if (pg) pg.classList.remove('active-page');
            });
            document.getElementById(`${pageId}-page`).classList.add('active-page');
            document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
            if (link.classList.contains('nav-link')) link.classList.add('active');

            if (pageId === 'blog') initBlogPage();
            if (pageId === 'chat') {
                initChatPage();
                // Name prompt ONLY fires here — when user actually clicks Chat
                checkAndPromptUserName();
            }
            if (pageId === 'admin') {
                if (localStorage.getItem('isAdmin') !== 'true') {
                    alert("Unauthorized access. Please login with your admin account.");
                    document.querySelector('[data-page="home"]').click();
                    return;
                }
                initAdminEditor();
            }
        });
    });
}



// Initialize
document.addEventListener('DOMContentLoaded', () => {
    initRouting();
    initAdminLogin();
    initHomePage();
    initBlogPage();
    // NOTE: Chat is NOT initialized here. It only initializes when user clicks "Chat" tab.
    // This prevents the name prompt from appearing on page load.

    initAuth((user, isAdminStatus) => {
        // Only update admin state — no chat UI triggering here
        setIsAdmin(isAdminStatus);
        
        // Toggle Admin-only elements
        const adminElements = document.querySelectorAll('.admin-only');
        adminElements.forEach(el => el.style.display = isAdminStatus ? 'inline-block' : 'none');

        // Update Footer Login Button
        const adminLoginBtn = document.getElementById('adminLoginBtn');
        if (adminLoginBtn) {
            adminLoginBtn.innerHTML = isAdminStatus ? '🔓 Sign Out' : '🔐 Admin Login';
        }

        const adminPage = document.getElementById('admin-page');
        if (!isAdminStatus && adminPage && adminPage.classList.contains('active-page')) {
            document.querySelector('[data-page="home"]').click();
        }

        // NO checkAndPromptUserName() here — that only happens on chat navigation
    });
});