import { blogMedia } from './main.js';
import { getDocs } from './firebase-helpers.js';
import { db } from './firebase-config.js';

let allProjects = [];
let currentFilter = 'All';

export function initBlogPage() {
    loadBlogGrid();
    initOverlay();
    initFilters();
}

let unsubscribeBlogProjects = null;

function loadBlogGrid() {
    const grid = document.getElementById('blogGrid');
    if (!grid || !db) return;

    grid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 2rem;">Loading projects...</div>';

    if (unsubscribeBlogProjects) unsubscribeBlogProjects();

    unsubscribeBlogProjects = db.collection('projects').onSnapshot(snapshot => {
        allProjects = [];
        snapshot.forEach(doc => {
            allProjects.push({ id: doc.id, ...doc.data() });
        });
        
        const filtered = currentFilter === 'All' ? allProjects : allProjects.filter(p => p.category === currentFilter);
        renderGrid(filtered);
    });
}

function renderGrid(projects) {
    const grid = document.getElementById('blogGrid');
    grid.innerHTML = '';

    if (projects.length === 0) {
        grid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 2rem; color: #8b949e;">No projects found in this category.</div>';
        return;
    }

    projects.forEach((item, idx) => {
        const card = document.createElement('div');
        card.className = 'media-card';

        const mainMedia = item.media?.[0] || { url: 'https://via.placeholder.com/400x300', type: 'image' };
        
        if (mainMedia.type === 'image') {
            const img = document.createElement('img');
            img.src = mainMedia.url;
            img.alt = item.name;
            card.appendChild(img);
        } else {
            const video = document.createElement('video');
            video.src = mainMedia.url;
            video.muted = true;
            card.appendChild(video);
        }

        const infoDiv = document.createElement('div');
        infoDiv.className = 'project-info';
        infoDiv.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: start;">
                <div class="project-name">${item.name}</div>
                <span class="category-badge">${item.category || ''}</span>
            </div>
            <div class="project-languages">${item.languages || ''}</div>
            <a href="${item.link}" target="_blank" class="project-link" onclick="event.stopPropagation();">
                <i class="fas fa-external-link-alt"></i> View Project
            </a>
        `;

        card.appendChild(infoDiv);

        card.addEventListener('click', () => {
            openOverlay(idx, projects);
        });

        grid.appendChild(card);
    });
}

function initFilters() {
    const blogHeader = document.querySelector('#blog-page h1');
    if (!blogHeader) return;

    // Check if filter bar already exists
    if (document.querySelector('.filter-bar')) return;

    const filterBar = document.createElement('div');
    filterBar.className = 'filter-bar';
    const categories = ['All', 'Websites', 'Apps', 'Games', 'AI'];
    
    categories.forEach(cat => {
        const btn = document.createElement('button');
        btn.className = `filter-btn ${cat === currentFilter ? 'active' : ''}`;
        btn.innerText = cat;
        btn.onclick = () => {
            currentFilter = cat;
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            const filtered = cat === 'All' ? allProjects : allProjects.filter(p => p.category === cat);
            renderGrid(filtered);
        };
        filterBar.appendChild(btn);
    });

    blogHeader.after(filterBar);
}

export function openOverlay(startIdx, projectList) {
    const overlay = document.getElementById('mediaOverlay');
    const thumbsDiv = document.getElementById('thumbnailsContainer');

    if (!overlay) return;

    // Use passed projects or global projects
    const targetProject = projectList ? projectList[startIdx] : allProjects[startIdx];
    if (!targetProject) return;

    const mediaItems = targetProject.media || [];
    if (mediaItems.length === 0) return;

    // Create main media container
    const mainMediaContainer = document.createElement('div');
    mainMediaContainer.style.width = '100%';
    mainMediaContainer.style.display = 'flex';
    mainMediaContainer.style.justifyContent = 'center';
    mainMediaContainer.style.alignItems = 'center';

    let currentIdx = 0;

    function updateMainMedia(idx) {
        currentIdx = idx;
        let media = mediaItems[idx];
        if (!media) return;

        // Clear previous media
        while (mainMediaContainer.firstChild) {
            mainMediaContainer.removeChild(mainMediaContainer.firstChild);
        }

        if (media.type === 'image') {
            const img = document.createElement('img');
            img.src = media.url;
            img.alt = media.name || 'Project';
            img.className = 'main-media';
            img.style.maxWidth = '100%';
            img.style.maxHeight = '65vh';
            img.style.borderRadius = '12px';
            img.style.objectFit = 'contain';
            mainMediaContainer.appendChild(img);
        } else {
            const video = document.createElement('video');
            video.src = media.url;
            video.controls = true;
            video.autoplay = false;
            video.className = 'main-media';
            video.style.maxWidth = '100%';
            video.style.maxHeight = '65vh';
            video.style.borderRadius = '12px';
            mainMediaContainer.appendChild(video);
        }

        // Update active thumbnail
        document.querySelectorAll('.thumb').forEach((thumb, i) => {
            if (i === idx) {
                thumb.classList.add('active-thumb');
            } else {
                thumb.classList.remove('active-thumb');
            }
        });
    }

    // Insert main media container into overlay
    const existingMainMedia = overlay.querySelector('.main-media-container');
    if (existingMainMedia) {
        existingMainMedia.remove();
    }
    mainMediaContainer.className = 'main-media-container';
    const overlayBody = overlay.querySelector('.overlay-content');
    const closeBtn = overlay.querySelector('#closeOverlayBtn');

    // Insert after thumbnails or at appropriate position
    const thumbsContainer = overlay.querySelector('#thumbnailsContainer');
    if (thumbsContainer) {
        overlayBody.insertBefore(mainMediaContainer, thumbsContainer);
    } else {
        overlayBody.insertBefore(mainMediaContainer, closeBtn);
    }

    // Set up navigation buttons
    const prevBtn = document.getElementById('overlayPrevBtn');
    const nextBtn = document.getElementById('overlayNextBtn');

    if (prevBtn) {
        prevBtn.style.display = mediaItems.length > 1 ? 'flex' : 'none';
        prevBtn.onclick = (e) => {
            e.stopPropagation();
            const newIdx = (currentIdx - 1 + mediaItems.length) % mediaItems.length;
            updateMainMedia(newIdx);
        };
    }

    if (nextBtn) {
        nextBtn.style.display = mediaItems.length > 1 ? 'flex' : 'none';
        nextBtn.onclick = (e) => {
            e.stopPropagation();
            const newIdx = (currentIdx + 1) % mediaItems.length;
            updateMainMedia(newIdx);
        };
    }

    // Swipe detection for mobile
    let touchStartX = 0;
    let touchEndX = 0;

    mainMediaContainer.ontouchstart = (e) => {
        touchStartX = e.changedTouches[0].screenX;
    };

    mainMediaContainer.ontouchend = (e) => {
        touchEndX = e.changedTouches[0].screenX;
        handleSwipe();
    };

    function handleSwipe() {
        if (mediaItems.length <= 1) return;
        const threshold = 50;
        if (touchEndX < touchStartX - threshold) {
            // Swiped left -> Next
            const newIdx = (currentIdx + 1) % mediaItems.length;
            updateMainMedia(newIdx);
        }
        if (touchEndX > touchStartX + threshold) {
            // Swiped right -> Prev
            const newIdx = (currentIdx - 1 + mediaItems.length) % mediaItems.length;
            updateMainMedia(newIdx);
        }
    }

    // Clear existing thumbnails
    thumbsDiv.innerHTML = '';

    // Build thumbnails
    mediaItems.forEach((item, i) => {
        let thumb = document.createElement('div');
        thumb.className = 'thumb';
        if (item.type === 'image') {
            thumb.innerHTML = `<img src="${item.url}" alt="thumb">`;
        } else {
            thumb.innerHTML = `<i class="fas fa-play" style="color:white;"></i>`;
            thumb.style.display = 'flex';
            thumb.style.alignItems = 'center';
            thumb.style.justifyContent = 'center';
            thumb.style.background = '#1a1e2a';
        }

        thumb.onclick = (e) => {
            e.stopPropagation();
            updateMainMedia(i);
        };

        thumbsDiv.appendChild(thumb);
    });

    // Initial load
    updateMainMedia(0); // Start with first media of the project
    overlay.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function initOverlay() {
    const closeBtn = document.getElementById('closeOverlayBtn');
    const overlay = document.getElementById('mediaOverlay');

    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            overlay.classList.remove('active');
            document.body.style.overflow = '';
        });
    }

    if (overlay) {
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                overlay.classList.remove('active');
                document.body.style.overflow = '';
            }
        });
    }

    // Close on ESC key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && overlay && overlay.classList.contains('active')) {
            overlay.classList.remove('active');
            document.body.style.overflow = '';
        }
    });
}