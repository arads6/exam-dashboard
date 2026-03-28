// Background service worker to handle tab management
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "open_student_os") {
        console.log("Stage 6.6 Bridge: Attempting to find and focus Student OS tab...");
        
        const matchPatterns = [
            "http://localhost/*",
            "http://127.0.0.1/*"
        ];

        chrome.tabs.query({ url: matchPatterns }, (tabs) => {
            if (tabs.length > 0) {
                console.log("Found existing tab. Focusing...");
                const targetTab = tabs[0];
                chrome.tabs.update(targetTab.id, { active: true });
                chrome.windows.update(targetTab.windowId, { focused: true });
                sendResponse({ status: "tab_focused" });
            } else {
                console.log("No tab found. Creating new one...");
                chrome.tabs.create({ url: "http://localhost:8080/" }, (newTab) => {
                    sendResponse({ status: "tab_created" });
                });
            }
        });
        return true; // Keep message port open for async sendResponse
    }
});
