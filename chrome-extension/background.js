const DASHBOARD_URL = 'http://localhost:8080';

// Background service worker to handle tab management
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "open_student_os") {
        console.log("Stage 10.2 Global Sync: Orchestrating tab and data flow...");
        
        const hostname = new URL(DASHBOARD_URL).hostname;
        const matchPatterns = [
            `*://${hostname}/*`,
            `*://127.0.0.1/*`
        ];

        chrome.tabs.query({ url: matchPatterns }, (tabs) => {
            if (tabs.length > 0) {
                console.log("Found existing tab. Focusing and signaling...");
                const targetTab = tabs[0];
                
                // 1. Focus
                chrome.tabs.update(targetTab.id, { active: true });
                chrome.windows.update(targetTab.windowId, { focused: true });
                
                // 2. Direct Messaging (Fast lane)
                if (message.payload) {
                    chrome.tabs.sendMessage(targetTab.id, { 
                        type: 'SYNC_GRADES_PERSISTENT', 
                        payload: message.payload 
                    });

                    // 3. Fallback/Persistent Storage (Postal lane)
                    const storeData = () => {
                        chrome.storage.local.set({ 
                            pendingGradesImport: {
                                data: message.payload,
                                shouldPop: true,
                                timestamp: Date.now()
                            }
                        });
                    };

                    if (targetTab.status === 'complete') {
                        setTimeout(storeData, 300);
                    } else {
                        const listener = (tabId, changeInfo) => {
                            if (tabId === targetTab.id && changeInfo.status === 'complete') {
                                setTimeout(storeData, 300);
                                chrome.tabs.onUpdated.removeListener(listener);
                            }
                        };
                        chrome.tabs.onUpdated.addListener(listener);
                    }
                }
                sendResponse({ status: "tab_focused" });
            } else {
                console.log("No tab found. Creating new one at analytics hub...");
                chrome.tabs.create({ url: `${DASHBOARD_URL}/analytics.html` }, (newTab) => {
                    if (message.payload) {
                        chrome.storage.local.set({ 
                            pendingGradesImport: {
                                data: message.payload,
                                shouldPop: true,
                                timestamp: Date.now()
                            }
                        });
                    }
                    sendResponse({ status: "tab_created" });
                });
            }
        });
        return true; 
    }
});
