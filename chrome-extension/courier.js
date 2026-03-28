(async function() {
    console.log("Syllabus Harvester: Courier Active - Checking for pending imports...");

    try {
        // 1. Check if there is a pending syllabus waiting in storage
        const result = await chrome.storage.local.get('pendingSyllabusImport');
        
        if (result && result.pendingSyllabusImport) {
            console.log("Courier: Pending syllabus found. Delivering to Student OS...");
            
            // 2. Perform the Handshake via postMessage
            // This sends the data into the page's JavaScript context
            window.postMessage({
                source: 'SYLLABUS_EXTENSION',
                type: 'IMPORT_READY',
                payload: result.pendingSyllabusImport
            }, '*');

            // 3. CRITICAL: Clear the storage immediately after delivery 
            // This ensures the import doesn't trigger again if the user refreshes the page
            await chrome.storage.local.remove('pendingSyllabusImport');
            console.log("Courier: Delivery successful. Storage cleared.");
        } else {
            console.log("Courier: No pending syllabus import found.");
        }
    } catch (error) {
        console.error("Courier: Error during handshake:", error);
    }
})();
