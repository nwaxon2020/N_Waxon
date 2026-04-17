import { demoProjects } from './main.js';
import { openProposalModal } from './chat.js';
import { getDoc, getDocs } from './firebase-helpers.js';
import { db } from './firebase-config.js';
import { openOverlay } from './blog.js';

export function initHomePage() {
    applyHomeConfig();
    loadSlider();
    initMovingText();
    initHomeButtons();
    initSocialLinks();
    initViewMoreButton();
    initSliderScroll();
}

let unsubscribeHomeConfig = null;
function applyHomeConfig() {
    if (!db) return;
    if (unsubscribeHomeConfig) unsubscribeHomeConfig();

    unsubscribeHomeConfig = db.collection('config').doc('home').onSnapshot((docSnapshot) => {
        if (!docSnapshot.exists) return;
        const config = docSnapshot.data();

    // Logo & Title
    if (config.logoText) {
        document.querySelectorAll('.logo, .footer-logo').forEach(el => {
            el.innerHTML = `<i class="fas fa-laptop" style="margin-right: 0.6rem;"></i>${config.logoText}`;
        });
    }
    if (config.siteTitle) document.title = config.siteTitle;

    // Hero
    if (config.hero) {
        if (config.hero.name) document.querySelector('.hero-text h1').innerText = config.hero.name;
        const subtextEl = document.getElementById('heroSubtext') || document.querySelector('.hero-text p');
        if (config.hero.subtext && subtextEl) subtextEl.innerText = config.hero.subtext;
        if (config.hero.imgUrl) document.getElementById('profileImage').src = config.hero.imgUrl;
        if (config.hero.movingWords) {
            window._movingWords = config.hero.movingWords;
            initMovingText();
        }
    }

    // About
    if (config.about) {
        const aboutCard = document.querySelector('.grid-2col .info-card:first-child');
        if (aboutCard) {
            let html = `<h3><i class="fas fa-user-astronaut"></i> ${config.about.title || 'About Me'}</h3>`;
            (config.about.paragraphs || []).forEach(p => {
                html += `<p>${p}</p>`;
            });

            // Add Bullet Points
            if (config.about.bullets && config.about.bullets.length > 0) {
                html += `<ul class="about-bullets" style="margin-top: 1.5rem; list-style: none; padding: 0;">`;
                config.about.bullets.forEach(b => {
                    html += `<li style="margin-bottom: 1rem; display: flex; align-items: flex-start; gap: 0.8rem;">
                        <i class="${b.icon}" style="color: #a78bfa; margin-top: 4px;"></i>
                        <span>${b.text}</span>
                    </li>`;
                });
                html += `</ul>`;
            }

            aboutCard.innerHTML = html;
        }
    }

    // Contacts & Socials
    if (config.contacts || config.socials) {
        const contactCard = document.querySelector('.grid-2col .info-card:last-child');
        const contactIconsDiv = document.getElementById('socialIconsContact');
        const footerSocialDiv = document.getElementById('footerSocial');
        const emailP = document.getElementById('contactEmailDisplay');

        let phone = config.contacts?.phone || '';
        const email = config.contacts?.email || '';
        const github = config.contacts?.github || '';
        const linkedin = config.contacts?.linkedin || '';

        // Phone +234 logic
        if (phone) {
            phone = phone.trim();
            if (phone.startsWith('0')) {
                phone = '+234' + phone.substring(1);
            } else if (!phone.startsWith('+')) {
                phone = '+234' + phone;
            }
        }

        // Apply to Contact Card
        if (contactIconsDiv) {
            contactIconsDiv.innerHTML = '';
            if (linkedin) contactIconsDiv.innerHTML += `<a href="${linkedin}" target="_blank"><i class="fab fa-linkedin"></i></a>`;
            if (github) contactIconsDiv.innerHTML += `<a href="${github}" target="_blank"><i class="fab fa-github"></i></a>`;
            if (config.socials?.facebook) contactIconsDiv.innerHTML += `<a href="${config.socials.facebook}" target="_blank"><i class="fab fa-facebook"></i></a>`;
        }
        if (emailP && email) {
            emailP.innerHTML = `📧 ${email}`;
            if (emailP.tagName === 'A') emailP.href = `mailto:${email}`;
        }

        // Apply to Hero Buttons
        const heroButtons = document.getElementById('heroButtons');
        const buyCoffeeBtn = document.getElementById('buyCoffeeBtn');

        if (config.coffee && config.coffee.account) {
            document.getElementById('coffeeFullName').innerText = config.coffee.fullName || '';
            document.getElementById('coffeeAccount').innerText = config.coffee.account || '';
            document.getElementById('coffeeBankName').innerText = config.coffee.bankName || '';
            
            const logoEl = document.getElementById('coffeeBankLogo');
            if (config.coffee.logoUrl) {
                logoEl.src = config.coffee.logoUrl;
                logoEl.style.display = 'block';
            } else {
                logoEl.style.display = 'none';
            }
        }

        if (heroButtons) {
            const emailBtn = document.getElementById('emailMeBtnHome');
            const whatsappBtn = document.getElementById('whatsappBtnHome');
            const callBtn = document.getElementById('callBtnHome');

            if (email) {
                emailBtn.style.display = 'flex';
                emailBtn.onclick = () => window.location.href = `mailto:${email}`;
            } else {
                emailBtn.style.display = 'none';
            }

            if (phone) {
                const adminName = config.hero?.name || 'Prince N.O';
                const boilerplate = encodeURIComponent(`Hello ${adminName}, I'm interested in your services and would like to discuss a project with you.`);
                whatsappBtn.style.display = 'flex';
                whatsappBtn.onclick = () => window.open(`https://wa.me/${phone.replace('+', '')}?text=${boilerplate}`, '_blank');

                callBtn.style.display = 'flex';
                callBtn.onclick = () => window.location.href = `tel:${phone}`;
            } else {
                whatsappBtn.style.display = 'none';
                callBtn.style.display = 'none';
            }

            heroButtons.style.display = 'flex'; // Show after data is loaded
        }

        // Apply to Footer Socials
        if (footerSocialDiv) {
            footerSocialDiv.innerHTML = '';
            const socials = config.socials || {};

            const platforms = [
                { id: 'twitter', icon: 'fab fa-twitter', base: 'https://twitter.com/' },
                { id: 'instagram', icon: 'fab fa-instagram', base: 'https://instagram.com/' },
                { id: 'facebook', icon: 'fab fa-facebook', base: 'https://facebook.com/' },
                { id: 'tiktok', icon: 'fab fa-tiktok', base: 'https://tiktok.com/@' }
            ];

            platforms.forEach(p => {
                const url = socials[p.id];
                if (url && url.length > p.base.length) {
                    footerSocialDiv.innerHTML += `<a href="${url}" target="_blank" class="footer-social-icon"><i class="${p.icon}"></i></a>`;
                }
            });
        }
    }

    // Apply Quick Links across all .links-grid elements
    const linkGrids = document.querySelectorAll('.links-grid');
    if (linkGrids.length > 0) {
        const qLinks = config.quickLinks || [];
        linkGrids.forEach(grid => {
            grid.innerHTML = ''; // Always match the database 1:1, clear placeholders
            qLinks.forEach(link => {
                grid.innerHTML += `<a href="${link.url}" target="_blank" class="link-card">
                    <i class="${link.icon || 'fas fa-link'}"></i>
                    <span>${link.text || 'Link'}</span>
                </a>`;
            });
        });
    }
});
}

let unsubscribeProjects = null;
function loadSlider() {
    const slider = document.getElementById('projectSlider');
    if (!slider || !db) return;

    if (unsubscribeProjects) unsubscribeProjects();

    slider.innerHTML = 'Loading creations...';

    unsubscribeProjects = db.collection('projects').onSnapshot(snapshot => {
        let projects = [];
        snapshot.forEach(doc => {
            projects.push({ id: doc.id, ...doc.data() });
        });

        // Filter for home page showcased projects
        projects = projects.filter(proj => proj.showOnHome === true);

        // Fallback to demo data if no projects are highlighted
        if (projects.length === 0) {
            projects = demoProjects.map((p, i) => ({ ...p, name: p.title, media: [{ url: p.img, type: 'image' }] }));
        }

        // Ensure max 8 just in case
        projects = projects.slice(0, 8);

        slider.innerHTML = '';
    projects.forEach((proj, idx) => {
        const card = document.createElement('div');
        card.className = 'project-card';
        const thumb = proj.media?.[0]?.url || proj.img || 'https://via.placeholder.com/300/200';
        card.innerHTML = `
            <img src="${thumb}" alt="${proj.name || proj.title}">
            <div class="project-info">
                <strong>${proj.name || proj.title}</strong>
            </div>
        `;
        card.onclick = () => {
            // Reformat project to match blogMedia expectations if needed
            // The openOverlay in blog.js uses the 'blogMedia' global or whatever is passed
            // We'll update blog.js to be more flexible
            window._currentProjects = projects;
            openOverlay(idx, projects);
        };
        slider.appendChild(card);
    });
});
}

let movingTextInterval = null;
function initMovingText() {
    const texts = window._movingWords && window._movingWords.length > 0 ? window._movingWords : ["Creative Developer", "AI Artist", "Full-Stack Architect", "Interactive Designer"];
    let idx = 0;

    const el = document.getElementById('movingText');
    if (el && texts.length > 0) {
        el.innerText = texts[0]; // Set initial
    }

    if (movingTextInterval) clearInterval(movingTextInterval);

    movingTextInterval = setInterval(() => {
        const el = document.getElementById('movingText');
        if (el && texts.length > 0) {
            el.innerText = texts[idx % texts.length];
            idx++;
        }
    }, 4000);
}

function initHomeButtons() {
    const jobProposalBtn = document.getElementById('jobProposalBtnHome');
    const contactProposalBtn = document.getElementById('contactProposalBtn');
    const emailBtn = document.getElementById('emailMeBtnHome');
    const buyCoffeeBtn = document.getElementById('buyCoffeeBtn');
    const closeCoffeeBtn = document.getElementById('closeCoffeeBtn');

    if (buyCoffeeBtn) {
        buyCoffeeBtn.addEventListener('click', () => {
            const modal = document.getElementById('coffeeModal');
            if (modal) modal.classList.add('active');
        });
    }

    if (closeCoffeeBtn) {
        closeCoffeeBtn.addEventListener('click', () => {
            const modal = document.getElementById('coffeeModal');
            if (modal) modal.classList.remove('active');
        });
    }

    if (jobProposalBtn) {
        jobProposalBtn.addEventListener('click', () => {
            document.querySelector('[data-page="chat"]').click();
            setTimeout(() => {
                openProposalModal();
            }, 300);
        });
    }

    if (contactProposalBtn) {
        contactProposalBtn.addEventListener('click', () => {
            document.querySelector('[data-page="chat"]').click();
            setTimeout(() => {
                openProposalModal();
            }, 300);
        });
    }

    if (emailBtn) {
        emailBtn.addEventListener('click', () => {
            // email logic is handled in applyHomeConfig if data exists
            // but we keep this as fallback if needed or if data doesn't load
        });
    }
}

function initSocialLinks() {
    const linkedin = document.getElementById('linkedinLink');
    const facebook = document.getElementById('facebookLink');
    const github = document.getElementById('githubLink');

    if (linkedin) linkedin.href = "https://linkedin.com/in/example";
    if (facebook) facebook.href = "https://facebook.com/example";
    if (github) github.href = "https://github.com/example";
}

function initViewMoreButton() {
    const viewMoreBtn = document.getElementById('viewMoreBtn');
    if (viewMoreBtn) {
        viewMoreBtn.addEventListener('click', () => {
            document.querySelector('[data-page="blog"]').click();
        });
    }
}

function initSliderScroll() {
    const leftBtn = document.getElementById('scrollLeftBtn');
    const rightBtn = document.getElementById('scrollRightBtn');
    const slider = document.getElementById('projectSlider');

    if (leftBtn && slider) {
        leftBtn.addEventListener('click', () => {
            const scrollAmount = slider.clientWidth * 0.8; 
            slider.scrollBy({ left: -scrollAmount, behavior: 'smooth' });
        });
    }

    if (rightBtn && slider) {
        rightBtn.addEventListener('click', () => {
            const scrollAmount = slider.clientWidth * 0.8;
            slider.scrollBy({ left: scrollAmount, behavior: 'smooth' });
        });
    }
}

