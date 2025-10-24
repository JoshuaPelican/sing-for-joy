let wakeLock = null;
let focusModeActive = false;

async function focusMode() {
   // Toggle fullscreen
   if (document.fullscreenElement) {
       await document.exitFullscreen();
   } else {
       await document.documentElement.requestFullscreen();
   }
   
   // Toggle wake lock
   if (focusModeActive && wakeLock) {
       // Disable wake lock
       await wakeLock.release();
       wakeLock = null;
       focusModeActive = false;
   } else {
       // Enable wake lock
       try {
           wakeLock = await navigator.wakeLock.request('screen');
           focusModeActive = true;
           
           // Reacquire if page becomes visible again
           document.addEventListener('visibilitychange', async () => {
               if (focusModeActive && wakeLock !== null && document.visibilityState === 'visible') {
                   wakeLock = await navigator.wakeLock.request('screen');
               }
           });
       } catch (err) {
           
        // Silently fail if not supported
       }
   }
}