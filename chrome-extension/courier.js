(async function() {
    const DASHBOARD_URL = 'http://localhost:8080';
    console.log("Syllabus Harvester: Courier Active - Monitoring for Global Sync...");
    
    const bc = new BroadcastChannel('student_os_sync');

    const checkAndDeliver = async () => {
        try {
            const gradeResult = await chrome.storage.local.get('pendingGradesImport');
            if (gradeResult && gradeResult.pendingGradesImport) {
                const payload = gradeResult.pendingGradesImport;
                console.log("Courier: Persistent Payload detected. Syncing...");
                
                // 1. Direct Delivery
                bc.postMessage({ type: 'SYNC_GRADES_SUCCESS', data: payload.data });
                window.postMessage({
                    source: 'SYLLABUS_EXTENSION',
                    type: 'GRADE_IMPORT_READY',
                    payload: payload.data,
                    shouldPop: payload.shouldPop
                }, '*');
                
                // 2. Clear from storage once handled
                await chrome.storage.local.remove('pendingGradesImport');
            }
        } catch (error) {
            console.error("Courier: Sync delivery error:", error);
        }
    };

    // A. Listen for direct messages from Background Script
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.type === 'SYNC_GRADES_PERSISTENT') {
            console.log("Courier: Received GLOBAL SYNC signal. Checking location...");
            
            // 1. Save to Mailbox (LocalStorage) for Cold Starts/Redirects
            window.localStorage.setItem('STUDENT_OS_PENDING_SYNC', JSON.stringify({
                data: message.payload,
                timestamp: Date.now()
            }));

            // 2. Check if on the correct page
            if (!window.location.href.includes('analytics.html')) {
                console.log("Courier: Not on analytics page. Redirecting...");
                window.location.href = `${DASHBOARD_URL}/analytics.html`;
            } else {
                // Already here? Just trigger the pop-up
                bc.postMessage({ type: 'SYNC_GRADES_SUCCESS', data: message.payload });
            }
        }
    });

    // B. Initial Load Check
    await checkAndDeliver();

    // C. Real-time Storage Listener 
    chrome.storage.onChanged.addListener((changes, namespace) => {
        if (namespace === 'local' && changes.pendingGradesImport && changes.pendingGradesImport.newValue) {
            checkAndDeliver();
        }
    });

    // D. Ready Signal from App
    window.addEventListener('message', (event) => {
        if (event.data && event.data.type === 'STUDENT_OS_APP_READY') {
            checkAndDeliver();
        }
    });

})();
