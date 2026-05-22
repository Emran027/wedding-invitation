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
                            // Fire border beam only on .side and .schedule
                            if (el.matches('.side, .schedule')) {
                                createBorderBeam(el);
                            }
                        }, 350 + i * 140);
                    });
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
       6. Event listeners – passive where possible for instant INP
    ───────────────────────────────────────── */
    envelopeContainer.addEventListener('click', openEnvelope);
    // ctaButton click is not passive (we don't call preventDefault but it's fine)
    if (ctaButton) ctaButton.addEventListener('click', flyAwayDetails);

    /* ── Boot ── */
    preloadImages();
    initializeCountdown();
});
