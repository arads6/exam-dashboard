(async function() {
    console.log("Syllabus Harvester: Stage 3 (UI Isolation Fix) Active.");

    // --- Stage 1: Locate ---
    const courseTitleElement = document.querySelector('h1');
    const courseName = courseTitleElement ? courseTitleElement.innerText.trim() : "Unknown Course";

    const links = Array.from(document.querySelectorAll('a'));
    const syllabusLinkElement = links.find(link => {
        const text = link.innerText || "";
        return /סילבוס|Syllabus/i.test(text);
    });

    if (!syllabusLinkElement) {
        console.log("Syllabus Harvester: No syllabus link found on this page.");
        return;
    }

    const syllabusHref = syllabusLinkElement.href;

    // --- Stage 3: UI Injection (Far-Left Strategy) ---
    // 1. Find the main activity container
    const activityWrapper = syllabusLinkElement.closest('li.activity') || 
                            syllabusLinkElement.closest('.activity-item') || 
                            syllabusLinkElement.closest('.mod-indent-outer');

    if (!activityWrapper) {
        console.warn("Could not find a suitable container for the button.");
        return;
    }

    // 2. Ensure the container is a relative anchor for our absolute button
    activityWrapper.style.position = 'relative';

    // 3. Create the button
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.innerText = "ייבא ל-Student OS";
    
    // Style: Far-left positioning
    btn.style.cssText = `
        position: absolute;
        left: 15px;
        top: 50%;
        transform: translateY(-50%);
        padding: 4px 12px;
        background-color: #6200ee;
        color: white;
        border: none;
        border-radius: 12px;
        cursor: pointer;
        font-family: 'Segoe UI', system-ui, sans-serif;
        font-size: 11px;
        font-weight: 700;
        text-transform: uppercase;
        box-shadow: 0 2px 4px rgba(0,0,0,0.3);
        transition: all 0.2s ease;
        z-index: 10001; 
    `;

    // Visual feedback on hover
    btn.onmouseover = () => { btn.style.backgroundColor = '#3700b3'; btn.style.boxShadow = '0 4px 8px rgba(0,0,0,0.4)'; };
    btn.onmouseout = () => { btn.style.backgroundColor = '#6200ee'; btn.style.boxShadow = '0 2px 4px rgba(0,0,0,0.3)'; };

    // 4. Append directly to the top-level activity container (outside all <a> tags)
    activityWrapper.appendChild(btn);

    // --- Triggered Extraction ---
    btn.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        btn.innerText = "Extracting...";
        btn.disabled = true;
        btn.style.backgroundColor = '#808080';
        btn.style.cursor = 'wait';

        if (!chrome.runtime?.id) {
            alert("Extension context was invalidated (likely due to an update). Please refresh this Moodle page.");
            resetButton();
            return;
        }

        try {
            console.log("Harvesting syllabus from:", syllabusHref);
            const response = await fetch(syllabusHref);
            const arrayBuffer = await response.arrayBuffer();
            
            const isPdf = syllabusHref.toLowerCase().endsWith('.pdf') || (response.headers.get('Content-Type') && response.headers.get('Content-Type').includes('pdf'));
            const isDocx = syllabusHref.toLowerCase().endsWith('.docx') || (response.headers.get('Content-Type') && response.headers.get('Content-Type').includes('officedocument'));

            let extractedText = "";

            if (isPdf) {
                extractedText = await extractTextFromPdf(arrayBuffer);
            } else if (isDocx) {
                extractedText = await extractTextFromDocx(arrayBuffer);
            } else {
                alert("Format Error: Only PDF and DOCX supported.");
                resetButton();
                return;
            }

            const payload = {
                courseName,
                syllabusHref,
                extractedText,
                timestamp: new Date().toISOString()
            };

            await chrome.storage.local.set({ pendingSyllabusImport: payload });
            chrome.runtime.sendMessage({ action: "open_student_os" });
            
            resetButton();

        } catch (error) {
            console.error("Harvesting failed:", error);
            alert("An error occurred while extracting the syllabus.");
            resetButton();
        }
    });

    function resetButton() {
        btn.innerText = "ייבא ל-Student OS";
        btn.disabled = false;
        btn.style.backgroundColor = '#6200ee';
        btn.style.cursor = 'pointer';
    }

    // --- Helpers ---
    async function extractTextFromPdf(data) {
        pdfjsLib.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL('lib/pdf.worker.min.js');
        const loadingTask = pdfjsLib.getDocument({ data: data });
        const pdf = await loadingTask.promise;
        let fullText = "";

        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            const pageText = textContent.items.map(item => item.str).join(" ");
            fullText += pageText + "\n";
        }
        return fullText;
    }

    async function extractTextFromDocx(data) {
        const result = await mammoth.extractRawText({ arrayBuffer: data });
        return result.value;
    }

})();
