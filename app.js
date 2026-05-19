document.addEventListener('DOMContentLoaded', () => {
    // Total number of animation frames (assets/1.png to assets/8.png)
    const TOTAL_FRAMES = 8;
    const FRAME_DURATION = 80; // ms per frame
    
    // Elements
    const envelopeImg = document.getElementById('envelope-img');
    const envelopeContainer = document.getElementById('envelope-container');
    const envelopeComposed = document.getElementById('envelope-composed');
    const headerSubtitle = document.querySelector('.elegant-subtitle');
    const invitationDetails = document.getElementById('invitation-details');
    
    // Array to hold preloaded images
    const preloadedImages = [];
    let imagesLoaded = 0;
    let isAnimating = false;
    let isOpen = false;

    // List of assets to preload
    const assetsToPreload = [];
    for (let i = 1; i <= TOTAL_FRAMES; i++) {
        assetsToPreload.push(`assets/${i}.png`);
    }
    assetsToPreload.push('assets/top.png', 'assets/body.png');

    // 1. Preload all images to ensure smooth animation without flickering
    function preloadImages() {
        assetsToPreload.forEach(src => {
            const img = new Image();
            img.src = src;
            img.onload = () => {
                imagesLoaded++;
                if (imagesLoaded === assetsToPreload.length) {
                    console.log("All envelope frames and composed layers loaded perfectly.");
                    envelopeContainer.style.cursor = 'pointer'; // Ready to click
                }
            };
            img.onerror = () => {
                console.error(`Failed to load asset: ${src}`);
                imagesLoaded++; // Still count to prevent lock
            };
            preloadedImages.push(img);
        });
    }

    // 2. Play the frame-by-frame animation
    function openEnvelope() {
        if (isAnimating || isOpen) return;
        isAnimating = true;
        
        envelopeContainer.classList.add('animating');
        
        let currentFrame = 1;
        
        // Hide the subtitle smoothly
        if (headerSubtitle) {
            headerSubtitle.style.transition = 'opacity 0.5s ease';
            headerSubtitle.style.opacity = '0';
        }

        const animationInterval = setInterval(() => {
            currentFrame++;
            
            if (currentFrame <= TOTAL_FRAMES) {
                envelopeImg.src = `assets/${currentFrame}.png`;
            } else {
                // Animation of frames 1-6 complete
                clearInterval(animationInterval);
                
                // Swap the single image for the composed multilayer open envelope
                envelopeImg.classList.add('hidden');
                envelopeComposed.classList.remove('hidden');
                
                // Small delay to trigger the CSS transition for sliding the card up
                setTimeout(() => {
                    envelopeComposed.classList.add('open');
                    isAnimating = false;
                    isOpen = true;
                    
                    // Show the details button nicely below
                    showInvitationDetails();
                }, 50);
            }
        }, FRAME_DURATION);
    }

    // 3. Show details after envelope opens
    function showInvitationDetails() {
        if (invitationDetails) {
            invitationDetails.classList.remove('hidden');
            setTimeout(() => {
                invitationDetails.classList.add('visible');
            }, 300); // Wait slightly for the card to start sliding up
        }
    }

    // Initialize
    preloadImages();
    
    // Event listener for click
    envelopeContainer.addEventListener('click', openEnvelope);
    
    // Countdown Timer Logic
    function initializeCountdown() {
        // Target Date: June 1, 2026, 00:00:00 Bangladesh Time (UTC+6)
        const targetDate = new Date('2026-06-01T00:00:00+06:00').getTime();
        
        const daysEl = document.getElementById('countdown-days');
        const hoursEl = document.getElementById('countdown-hours');
        const minutesEl = document.getElementById('countdown-minutes');
        const secondsEl = document.getElementById('countdown-seconds');

        if (!daysEl) return; // Guard clause

        function updateTimer() {
            const now = new Date().getTime();
            const distance = targetDate - now;

            if (distance <= 0) {
                daysEl.innerText = "00";
                hoursEl.innerText = "00";
                minutesEl.innerText = "00";
                secondsEl.innerText = "00";
                return;
            }

            const days = Math.floor(distance / (1000 * 60 * 60 * 24));
            const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((distance % (1000 * 60)) / 1000);

            daysEl.innerText = days.toString().padStart(2, '0');
            hoursEl.innerText = hours.toString().padStart(2, '0');
            minutesEl.innerText = minutes.toString().padStart(2, '0');
            secondsEl.innerText = seconds.toString().padStart(2, '0');
        }

        updateTimer();
        setInterval(updateTimer, 1000);
    }
    
    initializeCountdown();
});
