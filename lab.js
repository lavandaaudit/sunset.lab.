document.addEventListener('DOMContentLoaded', () => {
    const videoPlayer = document.getElementById('lab-video-player');
    const playlistContainer = document.getElementById('playlist-container');
    const titleHUD = document.getElementById('current-video-title');
    const dateHUD = document.getElementById('current-video-date');
    const photoGrid = document.getElementById('photo-gallery-grid');
    const photoStats = document.getElementById('photo-stats');
    
    // Modal elements
    const modal = document.getElementById('photo-modal');
    const modalImg = document.getElementById('modal-img');
    const modalCaption = document.getElementById('modal-caption');
    const closeModalBtn = document.querySelector('.modal-close');

    let videoPlaylist = [];
    let photoPlaylist = [];
    let currentVideoIndex = 0;

    const MAX_ITEMS = 1000;
    
    // Base directories (assuming 'media/videos' and 'media/photos' or just root)
    // We will assume they are in 'videos/' and 'photos/' relative to root.
    const VIDEO_DIR = 'videos/';
    const PHOTO_DIR = 'photos/';

    async function probeFiles() {
        console.log("Starting media search...");
        
        // 1. Probe Videos
        playlistContainer.innerHTML = '<div class="loading-feed">ПОШУК ВІДЕО...</div>';
        videoPlaylist = await findSequentialFiles(VIDEO_DIR, 'mp4', 1, MAX_ITEMS);
        
        if (videoPlaylist.length === 0) {
            playlistContainer.innerHTML = '<div class="loading-feed" style="color:var(--neon-red)">ВІДЕО НЕ ЗНАЙДЕНО (папка videos/)</div>';
        } else {
            renderPlaylist();
            playVideo(0);
        }

        // 2. Probe Photos
        photoGrid.innerHTML = '<div class="loading-feed" style="grid-column: 1/-1; padding: 40px;">ПОШУК ФОТО...</div>';
        photoPlaylist = await findSequentialFiles(PHOTO_DIR, 'jpg', 1, MAX_ITEMS);
        
        if (photoPlaylist.length === 0) {
            // Also try trying jpeg
            photoPlaylist = await findSequentialFiles(PHOTO_DIR, 'jpeg', 1, MAX_ITEMS);
        }

        if (photoPlaylist.length === 0) {
            photoGrid.innerHTML = '<div class="loading-feed" style="color:var(--neon-red); grid-column:1/-1; padding:40px;">ФОТО НЕ ЗНАЙДЕНО (папка photos/)</div>';
        } else {
            renderGallery();
        }
    }

    // Helper to probe files sequentially until a 404 is hit
    async function findSequentialFiles(dir, ext, start, max) {
        let found = [];
        // Optional: batch checking to speed things up
        const batchSize = 3;
        let p = start;
        let keepSearching = true;

        while(keepSearching && p <= max) {
            let promises = [];
            for (let i = 0; i < batchSize && (p + i) <= max; i++) {
                let url = `${dir}${p + i}.${ext}`;
                promises.push(checkFile(url, p + i));
            }
            
            let results = await Promise.all(promises);
            for (let res of results) {
                if (res.exists) {
                    found.push({
                        id: res.id,
                        url: res.url,
                        date: res.date
                    });
                } else {
                    // First miss, stop searching to avoid 1000 404s in console
                    keepSearching = false;
                    break;
                }
            }
            p += batchSize;
        }
        return found;
    }

    async function checkFile(url, id) {
        try {
            const response = await fetch(url + '?v=' + new Date().getTime(), { method: 'HEAD' });
            if (response.ok) {
                // Try to get Last-Modified date from server
                let lastModified = response.headers.get('Last-Modified');
                let dateStr = "Unknown Date";
                if (lastModified) {
                    const d = new Date(lastModified);
                    dateStr = d.toLocaleDateString('uk-UA', { 
                        year: 'numeric', 
                        month: 'short', 
                        day: 'numeric' 
                    });
                } else {
                    // Mock a date if server doesn't provide it
                    dateStr = `FILE #${id}`;
                }
                return { exists: true, url, date: dateStr, id };
            }
        } catch (e) {
            // Network error
        }
        return { exists: false };
    }

    function renderPlaylist() {
        playlistContainer.innerHTML = '';
        videoPlaylist.forEach((video, index) => {
            const item = document.createElement('div');
            item.className = 'playlist-item';
            item.dataset.index = index;
            
            item.innerHTML = `
                <div class="playlist-item-title">ВІДЕО #${video.id}</div>
                <div class="playlist-item-date">${video.date}</div>
            `;
            
            item.addEventListener('click', () => {
                playVideo(index);
            });
            
            playlistContainer.appendChild(item);
        });
    }

    function playVideo(index) {
        if (index < 0 || index >= videoPlaylist.length) return;
        
        currentVideoIndex = index;
        const video = videoPlaylist[index];
        
        // Highlight active item
        document.querySelectorAll('.playlist-item').forEach(el => el.classList.remove('active'));
        const activeItem = document.querySelector(`.playlist-item[data-index="${index}"]`);
        if (activeItem) {
            activeItem.classList.add('active');
            activeItem.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }

        // Set video source
        videoPlayer.src = video.url;
        videoPlayer.play().catch(e => console.error("Auto-play prevented", e));
        
        // Update HUD
        titleHUD.textContent = `FILE: ${video.id}.MP4`;
        dateHUD.textContent = `DATE: ${video.date}`;
    }

    // Auto-play next video
    videoPlayer.addEventListener('ended', () => {
        let nextIndex = currentVideoIndex + 1;
        if (nextIndex < videoPlaylist.length) {
            playVideo(nextIndex);
        } else {
            // Loop back to start if at the end of playlist
            playVideo(0);
        }
    });

    function renderGallery() {
        photoGrid.innerHTML = '';
        photoStats.textContent = `Знайдено: ${photoPlaylist.length}`;

        photoPlaylist.forEach((photo) => {
            const item = document.createElement('div');
            item.className = 'lab-photo-item';
            
            item.innerHTML = `
                <img src="${photo.url}" alt="Archive Photo ${photo.id}" loading="lazy">
                <div class="lab-photo-overlay">
                    <span class="photo-id">IMG_${photo.id}</span>
                    <span class="photo-date">${photo.date}</span>
                </div>
            `;
            
            item.addEventListener('click', () => {
                openModal(photo.url, `FILE: ${photo.id}.JPG`, `DATE: ${photo.date}`);
            });
            
            photoGrid.appendChild(item);
        });
    }

    // Modal logic
    function openModal(imgUrl, title, info) {
        modal.style.display = "flex";
        modal.style.position = "fixed";
        modal.style.top = "0";
        modal.style.left = "0";
        modal.style.width = "100vw";
        modal.style.height = "100vh";
        modal.style.zIndex = "10000";
        modal.style.backgroundColor = "rgba(0,0,0,0.9)";
        modal.style.backdropFilter = "blur(10px)";
        modal.style.alignItems = "center";
        modal.style.justifyContent = "center";
        modal.style.flexDirection = "column";

        modalImg.src = imgUrl;
        modalImg.style.maxWidth = "90%";
        modalImg.style.maxHeight = "80vh";
        modalImg.style.border = "2px solid #00f3ff";
        modalImg.style.borderRadius = "10px";
        modalImg.style.boxShadow = "0 0 30px rgba(0, 243, 255, 0.5)";

        modalCaption.innerHTML = `<strong style="color:#00f3ff; font-size:1.2rem;">${title}</strong><br><span style="font-size: 0.9rem; color: #ccc; margin-top:10px; display:block;">${info}</span>`;
        modalCaption.style.backgroundColor = "rgba(10, 15, 25, 0.9)";
        modalCaption.style.padding = "20px";
        modalCaption.style.marginTop = "15px";
        modalCaption.style.borderRadius = "10px";
        modalCaption.style.textAlign = "center";
        modalCaption.style.maxWidth = "80%";
    }

    function closeModal() {
        modal.style.display = "none";
        modalImg.src = "";
    }

    if (closeModalBtn) closeModalBtn.addEventListener('click', closeModal);
    window.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
    window.addEventListener('keydown', (e) => { if (e.key === "Escape") closeModal(); });

    // Init
    probeFiles();
});
