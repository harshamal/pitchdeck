/**
 * Navigation Script for Pitch Deck Slides
 * 
 * Provides a "Google Slides" like experience:
 * - Keyboard navigation (Left/Right/Space/PageUp/PageDown)
 * - Click anywhere to advance (except buttons/links)
 * - Sleek, auto-hiding presenter control bar
 * - Progress bar and slide counter
 * - Fullscreen support
 * - Smooth fade-in transitions
 * - LIVE Slide Preview Menu (using iframes)
 */

document.addEventListener('DOMContentLoaded', () => {
    // 0. Prevent recursion inside preview iframes
    if (window.self !== window.top) {
        // Only show content, disable all scripts/interactions inside thumbnails
        document.body.style.pointerEvents = 'none';
        document.body.style.userSelect = 'none';
        return;
    }

    const totalSlides = 19;

    // 1. Unified Styles for Deck & Preview Menu
    const style = document.createElement('style');
    style.innerHTML = `
        @keyframes slideFadeIn {
            from { opacity: 0; transform: scale(0.98) translateY(10px); }
            to { opacity: 1; transform: scale(1) translateY(0); }
        }
        .slide-container {
            view-transition-name: slide-wrapper;
        }
        body {
            animation: slideFadeIn 0.4s cubic-bezier(0.2, 0.8, 0.2, 1) forwards;
            cursor: default;
            background-color: #0B1120;
            will-change: opacity, transform;
        }
        #presenter-controls {
            transition: opacity 0.3s ease, transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
            opacity: 0;
            transform: translateY(20px) scale(0.95);
        }
        #presenter-controls.visible {
            opacity: 1;
            transform: translateY(0) scale(1);
        }
        .nav-btn:hover {
            background: rgba(255, 255, 255, 0.15) !important;
            transform: translateY(-2px);
        }
        .nav-btn:active {
            transform: scale(0.9);
        }
        #progress-bar {
            position: fixed;
            bottom: 0;
            left: 0;
            height: 4px;
            background: linear-gradient(90deg, #3b82f6, #60a5fa);
            z-index: 10001;
            transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            box-shadow: 0 0 15px rgba(59, 130, 246, 0.6);
        }

        /* Horizontal Slide Preview Row (Centered) */
        #slide-menu {
            position: fixed;
            bottom: 90px;
            left: 50%;
            transform: translateX(-50%) translateY(20px);
            background: rgba(10, 15, 28, 0.9);
            backdrop-filter: blur(30px);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 20px;
            padding: 15px;
            display: flex;
            flex-direction: row;
            gap: 12px;
            z-index: 10002;
            box-shadow: 0 20px 60px rgba(0,0,0,0.8);
            visibility: hidden;
            opacity: 0;
            transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
            max-width: 85vw;
            overflow-x: auto;
            overflow-y: hidden;
        }
        #slide-menu.active {
            visibility: visible;
            opacity: 1;
            transform: translateX(-50%) translateY(0);
        }
        #slide-menu::-webkit-scrollbar {
            height: 6px;
        }
        #slide-menu::-webkit-scrollbar-thumb {
            background: rgba(255,255,255,0.15);
            border-radius: 4px;
        }

        .menu-item {
            position: relative;
            flex: 0 0 160px; /* Precise width for the row */
            aspect-ratio: 16/9;
            background: #0f172a;
            border-radius: 10px;
            cursor: pointer;
            border: 2px solid rgba(255,255,255,0.05);
            transition: all 0.3s ease;
            overflow: hidden;
        }
        .menu-item:hover {
            transform: translateY(-8px);
            border-color: #3b82f6;
            box-shadow: 0 10px 25px rgba(59, 130, 246, 0.3);
        }
        .menu-item.current {
            border-color: #3b82f6;
            box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.3);
            background: #1e293b;
        }

        /* Iframe Preview Logic */
        .preview-iframe {
            width: 1280px;
            height: 720px;
            border: none;
            transform: scale(0.125); /* 160 / 1280 = 0.125 */
            transform-origin: 0 0;
            pointer-events: none;
            position: absolute;
            top: 0;
            left: 0;
            opacity: 0.7;
            transition: opacity 0.3s;
        }
        .menu-item:hover .preview-iframe {
            opacity: 1;
        }

        .slide-num-badge {
            position: absolute;
            top: 10px;
            left: 10px;
            background: rgba(0,0,0,0.7);
            color: white;
            padding: 2px 10px;
            border-radius: 6px;
            font-size: 11px;
            font-weight: 800;
            font-family: 'Inter', sans-serif;
            z-index: 20;
            box-shadow: 0 2px 5px rgba(0,0,0,0.5);
            border: 1px solid rgba(255,255,255,0.1);
        }
        .menu-item:hover .slide-num-badge {
            background: #3b82f6;
            border-color: #60a5fa;
        }
    `;
    document.head.appendChild(style);

    // 2. Helper to get current index
    function getSlideIndex(path) {
        // Handle root, directory paths, and index.html
        if (path.endsWith('/') || path.endsWith('index.html') || path.endsWith('pitchdeck')) {
            return 1;
        }

        const filename = decodeURIComponent(path.substring(path.lastIndexOf('/') + 1));
        if (filename === 'index.html' || filename === '' || filename === 'pitchdeck') return 1;

        const match = filename.match(/slides\s*\((\d+)\)\.html/i);
        return match ? parseInt(match[1], 10) : null;
    }

    let currentSlideIndex = getSlideIndex(window.location.pathname);
    if (currentSlideIndex === null) return;

    // 3. Seamless SPA-Style Navigation
    async function navigateTo(index, pushState = true) {
        if (index < 1 || index > totalSlides) return;
        if (index === currentSlideIndex && pushState) return;

        const url = index === 1 ? 'index.html' : `slides (${index}).html`;
        const isLocalFile = window.location.protocol === 'file:';

        // Update URL - Skip pushState on local file:// to avoid SecurityError
        if (pushState && !isLocalFile) {
            try {
                window.history.pushState({ index }, '', url);
            } catch (e) {
                console.warn('History API not available (local file?)');
            }
        }

        const performTransition = async () => {
            try {
                // Fetch might also fail on some local setups due to CORS
                const response = await fetch(url);
                if (!response.ok) throw new Error('Fetch failed');

                const html = await response.text();
                const parser = new DOMParser();
                const newDoc = parser.parseFromString(html, 'text/html');

                // Update current index
                currentSlideIndex = index;

                // 1. Update Title
                document.title = newDoc.title;

                // 2. Swap Content
                const newContent = newDoc.querySelector('.slide-container');
                const oldContainer = document.querySelector('.slide-container');

                if (newContent && oldContainer) {
                    oldContainer.innerHTML = newContent.innerHTML;
                    oldContainer.className = newContent.className;
                } else {
                    throw new Error('Container not found');
                }

                // 3. Update Progress Bar
                if (progressBar) {
                    progressBar.style.width = `${(currentSlideIndex / totalSlides) * 100}%`;
                }

                // 4. Update Presenter Controls Text
                const counter = document.querySelector('#presenter-controls div[style*="min-width: 60px"]');
                if (counter) {
                    counter.innerText = `${currentSlideIndex} / ${totalSlides}`;
                }

                // 5. Update Menu Item Active State
                document.querySelectorAll('.menu-item').forEach((item, idx) => {
                    item.classList.toggle('current', (idx + 1) === currentSlideIndex);
                });

                // 6. Execute Scripts
                const scripts = newDoc.querySelectorAll('script');
                scripts.forEach(oldScript => {
                    if (oldScript.src && (
                        oldScript.src.includes('navigation.js') ||
                        oldScript.src.includes('tailwindcss') ||
                        oldScript.src.includes('echarts')
                    )) return;

                    const newScript = document.createElement('script');
                    if (oldScript.src) {
                        newScript.src = oldScript.src;
                    } else {
                        newScript.textContent = oldScript.textContent;
                    }
                    document.body.appendChild(newScript);
                    if (!oldScript.src) newScript.remove();
                });

            } catch (err) {
                // Fallback to traditional navigation if SPA fails
                window.location.href = url;
            }
        };

        // Use View Transitions API if available
        if (document.startViewTransition) {
            document.startViewTransition(performTransition);
        } else {
            performTransition();
        }
    }

    // Handle Browser Back/Forward
    window.addEventListener('popstate', (e) => {
        const index = e.state ? e.state.index : getSlideIndex(window.location.pathname);
        if (index) {
            navigateTo(index, false);
        }
    });

    // 4. Input Events
    document.addEventListener('keydown', (e) => {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
        switch (e.key) {
            case 'ArrowRight':
            case 'ArrowDown':
            case ' ':
            case 'PageDown':
            case 'Enter':
                navigateTo(currentSlideIndex + 1);
                break;
            case 'ArrowLeft':
            case 'ArrowUp':
            case 'PageUp':
            case 'Backspace':
                navigateTo(currentSlideIndex - 1);
                break;
            case 'f':
            case 'F':
                toggleFullScreen();
                break;
            case 'm':
            case 'M':
                toggleMenu();
                break;
            case 'Escape':
                menu.classList.remove('active');
                break;
        }
    });

    document.addEventListener('click', (e) => {
        if (e.target.closest('button, a, #presenter-controls, #slide-menu')) return;
        navigateTo(currentSlideIndex + 1);
    });

    // 5. Progress Bar
    const progressBar = document.createElement('div');
    progressBar.id = 'progress-bar';
    progressBar.style.width = `${(currentSlideIndex / totalSlides) * 100}%`;
    document.body.appendChild(progressBar);

    // 6. UI Controls
    const controls = document.createElement('div');
    controls.id = 'presenter-controls';
    controls.style.cssText = `
        position: fixed;
        bottom: 30px;
        right: 40px;
        background: rgba(15, 23, 42, 0.85);
        backdrop-filter: blur(15px);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 100px;
        padding: 8px 16px;
        display: flex;
        align-items: center;
        gap: 12px;
        z-index: 10000;
        box-shadow: 0 10px 40px rgba(0,0,0,0.5);
    `;

    const btnStyle = `
        width: 38px;
        height: 38px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 50%;
        background: transparent;
        border: none;
        color: white;
        cursor: pointer;
        transition: all 0.2s;
        font-size: 14px;
    `;

    controls.innerHTML = `
        <button id="nav-menu" class="nav-btn" style="${btnStyle}" title="Slide Overview (M)">
            <i class="fas fa-th-large"></i>
        </button>
        <div style="width: 1px; height: 16px; background: rgba(255,255,255,0.1);"></div>
        <button id="nav-prev" class="nav-btn" style="${btnStyle}" title="Previous">
            <i class="fas fa-chevron-left"></i>
        </button>
        <div style="color: rgba(255,255,255,1); font-size: 13px; font-weight: 800; font-family: 'Inter', sans-serif; padding: 0 4px; min-width: 60px; text-align: center;">
            ${currentSlideIndex} / ${totalSlides}
        </div>
        <button id="nav-next" class="nav-btn" style="${btnStyle}" title="Next">
            <i class="fas fa-chevron-right"></i>
        </button>
        <div style="width: 1px; height: 16px; background: rgba(255,255,255,0.1);"></div>
        <button id="nav-fullscreen" class="nav-btn" style="${btnStyle}" title="Fullscreen (F)">
            <i class="fas fa-expand"></i>
        </button>
    `;
    document.body.appendChild(controls);

    // 7. Preview Menu Implementation (Lazy Loaded)
    const menu = document.createElement('div');
    menu.id = 'slide-menu';
    document.body.appendChild(menu);

    let menuInitialized = false;
    function initMenu() {
        if (menuInitialized) return;

        for (let i = 1; i <= totalSlides; i++) {
            const item = document.createElement('div');
            item.className = `menu-item ${i === currentSlideIndex ? 'current' : ''}`;

            // Add Slide Number Badge
            const badge = document.createElement('div');
            badge.className = 'slide-num-badge';
            badge.innerText = i;
            item.appendChild(badge);

            // Add Live Preview Iframe
            const iframe = document.createElement('iframe');
            iframe.className = 'preview-iframe';
            iframe.src = i === 1 ? 'index.html' : `slides (${i}).html`;
            iframe.loading = 'lazy';
            item.appendChild(iframe);

            item.onclick = (e) => {
                e.stopPropagation();
                navigateTo(i);
            };
            menu.appendChild(item);
        }
        menuInitialized = true;
    }

    // 8. Prefetching for Speed
    function addPrefetch(index) {
        if (index < 1 || index > totalSlides) return;
        const url = index === 1 ? 'index.html' : `slides (${index}).html`;
        const link = document.createElement('link');
        link.rel = 'prefetch';
        link.href = url;
        document.head.appendChild(link);
    }

    // Prefetch next and previous
    addPrefetch(currentSlideIndex + 1);
    addPrefetch(currentSlideIndex - 1);

    // Listeners
    document.getElementById('nav-menu').onclick = (e) => { e.stopPropagation(); toggleMenu(); };
    document.getElementById('nav-prev').onclick = (e) => { e.stopPropagation(); navigateTo(currentSlideIndex - 1); };
    document.getElementById('nav-next').onclick = (e) => { e.stopPropagation(); navigateTo(currentSlideIndex + 1); };
    document.getElementById('nav-fullscreen').onclick = (e) => { e.stopPropagation(); toggleFullScreen(); };

    let hideTimeout;
    function showControls(e) {
        // Only trigger if mouse is in the bottom 100px of the screen
        const isNearBottom = e && (window.innerHeight - e.clientY < 100);

        if (isNearBottom || menu.classList.contains('active')) {
            controls.classList.add('visible');
            clearTimeout(hideTimeout);
            hideTimeout = setTimeout(() => {
                if (!menu.classList.contains('active')) controls.classList.remove('visible');
            }, 2000);
        }
    }

    document.addEventListener('mousemove', (e) => showControls(e));
    // Initial reveal
    controls.classList.add('visible');
    setTimeout(() => { if (!menu.classList.contains('active')) controls.classList.remove('visible'); }, 2000);

    function toggleMenu() {
        initMenu(); // Initialize on demand
        menu.classList.toggle('active');
        if (menu.classList.contains('active')) {
            controls.classList.add('visible');
            clearTimeout(hideTimeout);
        }
    }

    document.addEventListener('mousedown', (e) => {
        if (!e.target.closest('#slide-menu') && !e.target.closest('#nav-menu')) {
            menu.classList.remove('active');
        }
    });

    function toggleFullScreen() {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen();
            document.getElementById('nav-fullscreen').innerHTML = '<i class="fas fa-compress"></i>';
        } else {
            if (document.exitFullscreen) {
                document.exitFullscreen();
                document.getElementById('nav-fullscreen').innerHTML = '<i class="fas fa-expand"></i>';
            }
        }
    }
});
