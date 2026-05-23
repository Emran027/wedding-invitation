/**
 * Wedding Invitation – app.js
 * Optimised for Core Web Vitals:
 *  • rAF-driven frame animation  → no layout-forcing setInterval ticks
 *  • All DOM queries cached once → no repeated layout reads
 *  • Passive event listeners     → instant INP / scroll response
 *  • requestIdleCallback         → non-critical work deferred
 */
document.addEventListener('DOMContentLoaded', () => {
    const TOTAL_FRAMES   = 8;
    const FRAME_DURATION = 80; // ms per frame

    /* ── Cached DOM refs (single query each) ── */
    const envelopeImg      = document.getElementById('envelope-img');
    const envelopeContainer= document.getElementById('envelope-container');
    const envelopeComposed = document.getElementById('envelope-composed');
    const headerTitle      = document.querySelector('.elegant-title');
    const headerSubtitle   = document.querySelector('.elegant-subtitle');
    const invitationDetails= document.getElementById('invitation-details');
    const ctaButton        = document.querySelector('.cta-button');
    const ambientBg        = document.querySelector('.ambient-background');

    let isAnimating = false;
    let isOpen      = false;

    // Slider offset – lifted to outer scope so backToDetails() can reset it
    let sliderCurrentOffset = 0;

    // Firework audio and cleanup state
    const fireworkAudio = new Audio('assets/firework.mp3');
    fireworkAudio.preload = 'auto';
    let currentFireworksCleanup = null;
    let audioUnlocked = false;

    // Mobile browsers block autoplay unless audio is first triggered inside a user gesture.
    // We play + immediately pause on first touch anywhere — this "unlocks" the audio context.
    function unlockAudio() {
        if (audioUnlocked) return;
        audioUnlocked = true;
        fireworkAudio.play().then(() => {
            fireworkAudio.pause();
            fireworkAudio.currentTime = 0;
        }).catch(() => {});
        document.removeEventListener('touchstart', unlockAudio);
        document.removeEventListener('mousedown',  unlockAudio);
    }
    document.addEventListener('touchstart', unlockAudio, { passive: true });
    document.addEventListener('mousedown',  unlockAudio, { passive: true });

    /* ─────────────────────────────────────────
       1. Image preloading
       Uses decode() so frames are GPU-ready before swap → no jank
    ───────────────────────────────────────── */
    const frameSrcs = Array.from({ length: TOTAL_FRAMES }, (_, i) => `assets/${i + 1}.png`);
    const extraSrcs = ['assets/top.png', 'assets/body.png', 'assets/card-bg.png'];
    const allSrcs   = [...frameSrcs, ...extraSrcs];

    // Pre-decode every frame into memory
    const decodedFrames = new Array(TOTAL_FRAMES);

    function preloadImages() {
        let loaded = 0;
        allSrcs.forEach((src, idx) => {
            const img = new Image();
            img.src   = src;
            // decode() resolves when GPU texture is ready
            img.decode()
                .catch(() => {}) // silently ignore missing assets
                .finally(() => {
                    if (idx < TOTAL_FRAMES) decodedFrames[idx] = img;
                    loaded++;
                    if (loaded === allSrcs.length) {
                        envelopeContainer.style.cursor = 'pointer';
                    }
                });
        });
    }

    /* ─────────────────────────────────────────
       2. rAF-driven frame animation (replaces setInterval)
       Benefits:
         • Tied to display refresh rate → no over/under-firing
         • Automatically pauses in background tabs
         • No main-thread timer jitter
    ───────────────────────────────────────── */
    function openEnvelope() {
        if (isAnimating || isOpen) return;
        isAnimating = true;
        envelopeContainer.classList.add('animating');

        // Fade header out with CSS transition (no style recalc in loop)
        if (headerTitle)    headerTitle.style.cssText    += ';transition:opacity .5s ease;opacity:0';
        if (headerSubtitle) headerSubtitle.style.cssText += ';transition:opacity .5s ease;opacity:0';

        let currentFrame = 1;
        let lastTime     = 0;

        function tick(timestamp) {
            if (timestamp - lastTime < FRAME_DURATION) {
                requestAnimationFrame(tick);
                return;
            }
            lastTime = timestamp;
            currentFrame++;

            if (currentFrame <= TOTAL_FRAMES) {
                // Use pre-decoded src when available
                envelopeImg.src = decodedFrames[currentFrame - 1]?.src
                                  ?? `assets/${currentFrame}.png`;
                requestAnimationFrame(tick);
            } else {
                finishOpen();
            }
        }

        requestAnimationFrame(tick);
    }

    function finishOpen() {
        envelopeImg.style.visibility = 'hidden';
        envelopeComposed.classList.remove('hidden');

        // Single rAF to batch DOM writes in one frame
        requestAnimationFrame(() => {
            envelopeComposed.classList.add('open');
            envelopeContainer.classList.add('moved-up');
            if (ambientBg) ambientBg.classList.add('blurred');
            isAnimating = false;
            isOpen      = true;
            showInvitationDetails();
        });
    }

    /* ─────────────────────────────────────────
       3. Show "See Details" button
    ───────────────────────────────────────── */
    function showInvitationDetails() {
        if (!invitationDetails) return;
        invitationDetails.classList.remove('hidden');
        // Use rAF to avoid forced style recalc immediately after classList change
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                invitationDetails.classList.add('visible');
            });
        });
    }

    /* ─────────────────────────────────────────
       4. Fly-away + show details page
       Non-critical DOM work deferred via requestIdleCallback
    ───────────────────────────────────────── */
    function flyAwayDetails() {
        if (!isOpen) return;

        // Critical: start CSS animation immediately (INP-sensitive)
        envelopeContainer.classList.add('fly-away');
        if (ambientBg) ambientBg.classList.remove('blurred');

        if (invitationDetails) {
            invitationDetails.style.opacity    = '0';
            invitationDetails.style.transition = 'opacity 0.5s ease';
        }

        // Non-critical: show details page (deferred ~idle)
        const showDetails = () => {
            if (invitationDetails) invitationDetails.classList.add('hidden');

            const detailsPage = document.getElementById('details-page');
            if (!detailsPage) return;

            detailsPage.classList.remove('hidden');

            // Double-rAF ensures display:none cleared before opacity kicks in
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    detailsPage.classList.add('visible');

                    // Staggered box animations + one-shot border beam
                    const boxes = [
                        ...detailsPage.querySelectorAll('.side'),
                        detailsPage.querySelector('.schedule'),
                        detailsPage.querySelector('.footer-info'),
                    ];
                    boxes.forEach((el, i) => {
                        if (!el) return;
                        setTimeout(() => {
                            el.classList.add('animated');
                            if (el.matches('.side, .schedule')) {
                                createBorderBeam(el);
                            }
                        }, 350 + i * 140);
                    });

                    // Init slider after page is rendered (needs layout dimensions)
                    setTimeout(initSlider, 600);
                });
            });
        };

        // Use requestIdleCallback if available, else fallback to setTimeout
        if ('requestIdleCallback' in window) {
            requestIdleCallback(showDetails, { timeout: 600 });
        } else {
            setTimeout(showDetails, 550);
        }
    }

    /* ─────────────────────────────────────────
       5. Border beam: one-shot golden light traveling the perimeter
       Uses CSS offset-path with a dynamically computed SVG rounded-rect path
    ───────────────────────────────────────── */
    function createBorderBeam(el) {
        // Read live dimensions after the element is in the DOM
        const rect   = el.getBoundingClientRect();
        const w      = rect.width;
        const h      = rect.height;
        const r      = 16; // matches border-radius in CSS

        // SVG rounded-rectangle path (clockwise from top-left arc)
        const path =
            `M ${r},0 ` +
            `H ${w - r} Q ${w},0 ${w},${r} ` +
            `V ${h - r} Q ${w},${h} ${w - r},${h} ` +
            `H ${r} Q 0,${h} 0,${h - r} ` +
            `V ${r} Q 0,0 ${r},0 Z`;

        // Build elements
        const beam = document.createElement('div');
        beam.className = 'border-beam';

        const dot = document.createElement('div');
        dot.className = 'border-beam-dot';
        dot.style.offsetPath = `path("${path}")`;

        beam.appendChild(dot);
        el.appendChild(beam);

        // Self-clean after animation ends (1.6s + small buffer)
        dot.addEventListener('animationend', () => beam.remove(), { once: true });
    }

    /* ─────────────────────────────────────────
       5b. Fireworks & Audio Effects
    ───────────────────────────────────────── */
    function triggerFireworks() {
        if (currentFireworksCleanup) {
            currentFireworksCleanup();
        }

        fireworkAudio.currentTime = 0;
        fireworkAudio.play().catch(err => {
            console.log('Audio play blocked:', err);
        });

        const canvas = document.createElement('canvas');
        canvas.style.position = 'fixed';
        canvas.style.top = '0';
        canvas.style.left = '0';
        canvas.style.width = '100%';
        canvas.style.height = '100%';
        canvas.style.pointerEvents = 'none';
        canvas.style.zIndex = '9999';
        document.body.appendChild(canvas);

        const ctx = canvas.getContext('2d');
        let width = canvas.width = window.innerWidth;
        let height = canvas.height = window.innerHeight;

        const handleResize = () => {
            width = canvas.width = window.innerWidth;
            height = canvas.height = window.innerHeight;
        };
        window.addEventListener('resize', handleResize);

        let particles = [];
        let active = true;

        class Particle {
            constructor(x, y, color) {
                this.x = x;
                this.y = y;
                this.color = color;
                const angle = Math.random() * Math.PI * 2;
                const speed = Math.random() * 6 + 1.5;
                this.vx = Math.cos(angle) * speed;
                this.vy = Math.sin(angle) * speed;
                this.gravity = 0.06;
                this.resistance = 0.95;
                this.alpha = 1;
                this.decay = Math.random() * 0.015 + 0.008;
                this.size = Math.random() * 2 + 1.2;
                this.trail = [];
                this.maxTrailLength = 5;
            }
            update() {
                this.trail.push({ x: this.x, y: this.y });
                if (this.trail.length > this.maxTrailLength) {
                    this.trail.shift();
                }
                this.vx *= this.resistance;
                this.vy *= this.resistance;
                this.vy += this.gravity;
                this.x += this.vx;
                this.y += this.vy;
                this.alpha -= this.decay;
            }
            draw(ctx) {
                if (this.alpha <= 0) return;
                ctx.save();
                ctx.globalAlpha = this.alpha;
                
                if (this.trail.length > 1) {
                    ctx.beginPath();
                    ctx.moveTo(this.trail[0].x, this.trail[0].y);
                    for (let i = 1; i < this.trail.length; i++) {
                        ctx.lineTo(this.trail[i].x, this.trail[i].y);
                    }
                    ctx.strokeStyle = this.color;
                    ctx.lineWidth = this.size * 0.65;
                    ctx.lineCap = 'round';
                    ctx.stroke();
                }
                
                ctx.beginPath();
                ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
                ctx.fillStyle = this.color;
                ctx.shadowBlur = 6;
                ctx.shadowColor = this.color;
                ctx.fill();
                ctx.restore();
            }
        }

        const colors = [
            '#ff3b30', '#ff9500', '#ffcc00', '#4cd964', '#5ac8fa', '#007aff', '#5856d6', '#ff2d55', 
            '#ffd700', '#ff69b4', '#00ffff', '#ff00ff', '#e0aaff', '#c8b6ff', '#b8c0ff'
        ];

        function createBurst(x, y) {
            const color = colors[Math.floor(Math.random() * colors.length)];
            const pCount = 75;
            for (let i = 0; i < pCount; i++) {
                particles.push(new Particle(x, y, color));
            }
        }

        let burstCount = 0;
        const maxBursts = 8;
        const triggerNextBurst = () => {
            if (!active || burstCount >= maxBursts) return;
            const x = Math.random() * (width * 0.7) + (width * 0.15);
            const y = Math.random() * (height * 0.45) + (height * 0.1);
            createBurst(x, y);
            burstCount++;
            setTimeout(triggerNextBurst, Math.random() * 250 + 250);
        };

        triggerNextBurst();

        const animate = () => {
            if (!active) return;
            ctx.clearRect(0, 0, width, height);
            particles = particles.filter(p => p.alpha > 0);
            particles.forEach(p => {
                p.update();
                p.draw(ctx);
            });

            if (particles.length > 0 || burstCount < maxBursts) {
                requestAnimationFrame(animate);
            } else {
                cleanup();
            }
        };

        const cleanup = () => {
            if (!active) return;
            active = false;
            window.removeEventListener('resize', handleResize);
            if (canvas.parentNode) {
                canvas.parentNode.removeChild(canvas);
            }
            if (currentFireworksCleanup === cleanup) {
                currentFireworksCleanup = null;
            }
        };

        currentFireworksCleanup = cleanup;
        requestAnimationFrame(animate);
    }

    function stopFireworkAudio() {
        fireworkAudio.pause();
        fireworkAudio.currentTime = 0;
        if (currentFireworksCleanup) {
            currentFireworksCleanup();
        }
    }


    /* ─────────────────────────────────────────
       6. Countdown timer (rAF loop – no setInterval drift)
    ───────────────────────────────────────── */
    function initializeCountdown() {
        const targetDate = new Date('2026-06-01T00:00:00+06:00').getTime();
        const els = {
            d: document.getElementById('countdown-days'),
            h: document.getElementById('countdown-hours'),
            m: document.getElementById('countdown-minutes'),
            s: document.getElementById('countdown-seconds'),
        };
        if (!els.d) return;

        let lastSec = -1;

        function tick(timestamp) {
            const now  = Date.now();
            const sec  = Math.floor(now / 1000);

            // Only update DOM when the second actually changes
            if (sec !== lastSec) {
                lastSec = sec;
                const dist = targetDate - now;

                if (dist <= 0) {
                    els.d.textContent = els.h.textContent =
                    els.m.textContent = els.s.textContent = '00';
                } else {
                    els.d.textContent = String(Math.floor(dist / 86400000)).padStart(2, '0');
                    els.h.textContent = String(Math.floor((dist % 86400000) / 3600000)).padStart(2, '0');
                    els.m.textContent = String(Math.floor((dist % 3600000)  / 60000)).padStart(2, '0');
                    els.s.textContent = String(Math.floor((dist % 60000)    / 1000)).padStart(2, '0');
                }
            }
            requestAnimationFrame(tick);
        }

        requestAnimationFrame(tick);
    }

    /* ─────────────────────────────────────────
       7. Event listeners
    ───────────────────────────────────────── */
    envelopeContainer.addEventListener('click', openEnvelope);
    if (ctaButton) ctaButton.addEventListener('click', flyAwayDetails);

    /* ─────────────────────────────────────────
       8. Slide-to-see-pictures slider
       • Drag/touch thumb → groom & bride move toward center proportionally
       • Full slide (≥95%) → gallery page transition
    ───────────────────────────────────────── */
    function initSlider() {
        const thumb   = document.getElementById('slide-thumb');
        const track   = document.getElementById('slide-track');
        const label   = document.getElementById('slide-label');
        const groom   = document.getElementById('groom-cartoon');
        const bride   = document.getElementById('bride-cartoon');
        if (!thumb || !track || !groom || !bride) return;

        let isDragging   = false;
        let startClientX = 0;
        // NOTE: sliderCurrentOffset lives in outer scope for cross-function reset

        // Cached once at drag start – prevents shrinking-distance bug
        let cachedMaxDrag    = 0;
        let cachedGroomTravel = 0;

        function measureOnce() {
            // Slider drag range
            cachedMaxDrag = track.clientWidth - thumb.offsetWidth - 6;

            // Reset groom & bride so measurement starts from position 0
            groom.style.setProperty('--groom-x', '0px');
            bride.style.setProperty('--bride-x', '0px');

            // Use element widths directly — immune to scroll/viewport issues
            const containerW     = groom.parentElement.clientWidth;
            const groomW         = groom.offsetWidth;
            const brideW         = bride.offsetWidth;
            cachedGroomTravel    = Math.max(0, containerW - groomW - brideW);
        }

        function applyProgress(progress) {
            const thumbX  = progress * cachedMaxDrag;

            // Groom moves right by half the gap, Bride moves left by half the gap
            const groomX  = progress * (cachedGroomTravel / 2);
            const brideX  = -progress * (cachedGroomTravel / 2);

            thumb.style.transform = `translateX(${thumbX}px)`;
            groom.style.setProperty('--groom-x', `${groomX}px`);
            bride.style.setProperty('--bride-x', `${brideX}px`);
            track.style.setProperty('--fill-pct', `${progress * 100}%`);
            if (label) label.style.opacity = String(Math.max(0, 1 - progress * 1.6));
        }

        function onStart(e) {
            measureOnce(); // snapshot dimensions BEFORE any movement
            isDragging   = true;
            // Use outer-scope sliderCurrentOffset so it's always in sync
            startClientX = (e.touches ? e.touches[0].clientX : e.clientX) - sliderCurrentOffset;

            // Kill any transition so movement is instant
            thumb.style.transition = 'none';
            groom.style.transition = 'none';
            bride.style.transition = 'none';
        }

        function onMove(e) {
            if (!isDragging) return;
            const clientX = e.touches ? e.touches[0].clientX : e.clientX;
            const raw     = clientX - startClientX;
            sliderCurrentOffset = Math.min(Math.max(0, raw), cachedMaxDrag);
            const progress = sliderCurrentOffset / cachedMaxDrag;
            applyProgress(progress);

            if (progress >= 0.98) {
                isDragging = false;
                applyProgress(1); // snap to exactly 100%
                setTimeout(triggerGallery, 150);
            }
        }

        function onEnd() {
            if (!isDragging) return;
            isDragging = false;
            const progress = sliderCurrentOffset / cachedMaxDrag;

            if (progress >= 0.95) {
                applyProgress(1);
                setTimeout(triggerGallery, 150);
            } else {
                // Snap back
                sliderCurrentOffset = 0;
                thumb.style.transition = 'transform 0.4s cubic-bezier(0.25,1,0.5,1)';
                groom.style.transition = 'transform 0.4s cubic-bezier(0.25,1,0.5,1)';
                bride.style.transition = 'transform 0.4s cubic-bezier(0.25,1,0.5,1)';
                applyProgress(0);
            }
        }

        // Mouse
        thumb.addEventListener('mousedown',   onStart);
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup',   onEnd);
        // Touch
        thumb.addEventListener('touchstart',  onStart, { passive: true });
        document.addEventListener('touchmove', onMove,  { passive: true });
        document.addEventListener('touchend',  onEnd);
    }

    /* ─────────────────────────────────────────
       9. Gallery transitions & Back Button Logic
    ───────────────────────────────────────── */
    function triggerGallery() {
        const detailsPage = document.getElementById('details-page');
        const galleryPage = document.getElementById('gallery-page');
        if (!galleryPage) return;

        // First fade OUT details page, then show gallery (no overlap)
        const showGallery = () => {
            galleryPage.classList.remove('hidden');
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    galleryPage.classList.add('visible');
                    triggerFireworks(); // Fireworks play when entering gallery page
                });
            });
        };

        if (detailsPage && !detailsPage.classList.contains('hidden')) {
            detailsPage.style.transition = 'opacity 0.5s ease';
            detailsPage.style.opacity    = '0';
            setTimeout(() => {
                detailsPage.classList.add('hidden');
                detailsPage.classList.remove('visible');
                detailsPage.style.opacity    = '';
                detailsPage.style.transition = '';
                showGallery(); // Show gallery only after details is fully gone
            }, 520);
        } else {
            showGallery();
        }
    }

    function backToEnvelope() {
        const detailsPage = document.getElementById('details-page');

        stopFireworkAudio(); // Stop fireworks when going back to envelope

        // Fade out details page
        if (detailsPage) {
            detailsPage.style.transition = 'opacity 0.6s ease';
            detailsPage.style.opacity    = '0';
            setTimeout(() => {
                detailsPage.classList.add('hidden');
                detailsPage.classList.remove('visible');
                detailsPage.style.opacity    = '';
                detailsPage.style.transition = '';
            }, 600);
        }

        // Full envelope reset — user must re-open from scratch
        setTimeout(() => {
            // 1. Hide composed (open) envelope, show frame img again
            envelopeComposed.classList.add('hidden');
            envelopeComposed.classList.remove('open');
            envelopeImg.src = decodedFrames[0]?.src ?? 'assets/1.png';
            envelopeImg.style.visibility = 'visible';

            // 2. Reset container classes & position
            envelopeContainer.classList.remove('fly-away', 'moved-up', 'animating');

            // 3. Reset state flags
            isAnimating = false;
            isOpen      = false;

            // 4. Restore header
            if (headerTitle)    { headerTitle.style.opacity = ''; headerTitle.style.transition = ''; }
            if (headerSubtitle) { headerSubtitle.style.opacity = ''; headerSubtitle.style.transition = ''; }

            // 5. Hide details button
            if (invitationDetails) {
                invitationDetails.classList.add('hidden');
                invitationDetails.classList.remove('visible');
                invitationDetails.style.opacity    = '';
                invitationDetails.style.transition = '';
            }

            // 6. Remove blur from background
            if (ambientBg) ambientBg.classList.remove('blurred');
        }, 650);
    }

    function backToDetails() {
        const detailsPage = document.getElementById('details-page');
        const galleryPage = document.getElementById('gallery-page');

        // Fade out gallery
        if (galleryPage) {
            galleryPage.classList.remove('visible');
            setTimeout(() => galleryPage.classList.add('hidden'), 800);
        }

        // Show details page
        if (detailsPage) {
            detailsPage.classList.remove('hidden');
            // Clear any inline styles that might interfere with fade-in
            detailsPage.style.opacity = '';
            detailsPage.style.transition = '';
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    detailsPage.classList.add('visible');
                });
            });
        }

        // Reset slider offset in outer scope — prevents instant-trigger on next touch
        sliderCurrentOffset = 0;

        // Reset slider visual elements
        const thumb = document.getElementById('slide-thumb');
        const groom = document.getElementById('groom-cartoon');
        const bride = document.getElementById('bride-cartoon');
        const track = document.getElementById('slide-track');
        const label = document.getElementById('slide-label');
        if (thumb && groom && bride && track) {
            thumb.style.transition = 'none';
            groom.style.transition = 'none';
            bride.style.transition = 'none';
            track.style.setProperty('--fill-pct', '0%');
            thumb.style.transform = 'translateX(0px)';
            groom.style.setProperty('--groom-x', '0px');
            bride.style.setProperty('--bride-x', '0px');
            if (label) label.style.opacity = '1';
        }
    }

    // Attach Back Button Event Listeners
    const btnBackToEnvelope = document.getElementById('back-to-envelope');
    const btnBackToDetails  = document.getElementById('back-to-details');
    if (btnBackToEnvelope) btnBackToEnvelope.addEventListener('click', backToEnvelope);
    if (btnBackToDetails)  btnBackToDetails.addEventListener('click', backToDetails);

    /* ── Boot ── */
    preloadImages();
    initializeCountdown();
});

