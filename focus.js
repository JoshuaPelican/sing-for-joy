let wakeLock = null;
let focusModeActive = false;

const focusButton = document.getElementById("focusButton");
focusButton.addEventListener("click", toggleFocusMode);

// Handle visibility change for wake lock
document.addEventListener('visibilitychange', async () => {
    if (focusModeActive && document.visibilityState === 'visible') {
        await requestWakeLock();
    }
});

async function toggleFocusMode() {
    if (focusModeActive) {
        await exitFocusMode();
    } else {
        await enterFocusMode();
    }
}

async function enterFocusMode() {
    focusModeActive = true;
    
    // Try fullscreen
    await requestFullscreen();
    
    // Try wake lock
    await requestWakeLock();
}

async function exitFocusMode() {
    focusModeActive = false;
    
    // Exit fullscreen
    if (document.fullscreenElement) {
        try {
            await document.exitFullscreen();
        } catch (err) {
            console.log('Fullscreen exit failed:', err);
        }
    }
    
    // Release wake lock
    if (wakeLock) {
        try {
            await wakeLock.release();
            wakeLock = null;
        } catch (err) {
            console.log('Wake lock release failed:', err);
        }
    }
}

async function requestFullscreen() {
    try {
        const elem = document.documentElement;
        
        // Try different fullscreen methods for compatibility
        if (elem.requestFullscreen) {
            await elem.requestFullscreen();
        } else if (elem.webkitRequestFullscreen) { // Safari
            await elem.webkitRequestFullscreen();
        } else if (elem.mozRequestFullScreen) { // Firefox
            await elem.mozRequestFullScreen();
        } else if (elem.msRequestFullscreen) { // IE/Edge
            await elem.msRequestFullscreen();
        }
    } catch (err) {
        console.log('Fullscreen not supported or denied:', err);
    }
}

async function requestWakeLock() {
    // Check if Wake Lock API is supported
    if (!('wakeLock' in navigator)) {
        console.log('Wake Lock API not supported');
        return;
    }
    
    try {
        wakeLock = await navigator.wakeLock.request('screen');
        
        // Listen for wake lock release
        wakeLock.addEventListener('release', () => {
            console.log('Wake lock released');
        });
        
    } catch (err) {
        console.log('Wake lock request failed:', err);
    }
}

// Auto-exit focus mode when fullscreen is exited by user (ESC key)
document.addEventListener('fullscreenchange', () => {
    if (!document.fullscreenElement && focusModeActive) {
        exitFocusMode();
    }
});

// Handle webkit fullscreen change (Safari)
document.addEventListener('webkitfullscreenchange', () => {
    if (!document.webkitFullscreenElement && focusModeActive) {
        exitFocusMode();
    }
});

// Handle moz fullscreen change (Firefox)
document.addEventListener('mozfullscreenchange', () => {
    if (!document.mozFullScreenElement && focusModeActive) {
        exitFocusMode();
    }
});