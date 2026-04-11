(async function() {
    console.log("Syllabus Harvester: [Restored] Stage 12.0 (Golden Logic) Active.");

    /**
     * Persona: [Syllabus Architect Agent]
     * Goal: Recover Golden Logic for BGU Moodle structure and nested redirects.
     */

    // --- State Management: Persona [QA Agent] ---
    let isExtracting = false;

    // --- Stage 1: Locate Course Context ---
    const getCourseName = () => {
        const titleSelectors = ['h1', '.page-header-headings h1', '.breadcrumb-item a[title]'];
        for (const selector of titleSelectors) {
            const el = document.querySelector(selector);
            if (el?.innerText?.trim()) return el.innerText.trim();
        }
        return "Unknown Course";
    };

    const courseName = getCourseName();
    const links = Array.from(document.querySelectorAll('a'));
    const syllabusLinkElement = links.find(link => {
        const text = link.innerText || "";
        return /סילבוס|Syllabus/i.test(text);
    });

    if (!syllabusLinkElement) {
        console.warn("Syllabus Harvester: [WAIT] No syllabus link detected on this page.");
        return;
    }

    const syllabusHref = syllabusLinkElement.href;

    // --- Stage 3: UI Injection (Safe Injection Strategy) ---
    const activityWrapper = syllabusLinkElement?.closest?.('li.activity') || 
                            syllabusLinkElement?.closest?.('.activity-item') || 
                            syllabusLinkElement?.closest?.('.mod-indent-outer') ||
                            syllabusLinkElement?.parentElement;

    if (!activityWrapper) {
        console.error("Syllabus Harvester: [DOM] Could not find a suitable container for the button.");
        return;
    }

    // Ensure relative positioning for the button anchor
    if (getComputedStyle(activityWrapper).position === 'static') {
        activityWrapper.style.position = 'relative';
    }

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.id = 'student-os-harvest-btn';
    btn.innerText = "ייבא ל-Student OS";
    
    btn.style.cssText = `
        position: absolute;
        left: 10px;
        top: 50%;
        transform: translateY(-50%);
        padding: 5px 14px;
        background-color: #6200ee;
        color: white;
        border: none;
        border-radius: 16px;
        cursor: pointer;
        font-family: 'Inter', 'Segoe UI', system-ui, sans-serif;
        font-size: 11px;
        font-weight: 700;
        text-transform: uppercase;
        box-shadow: 0 3px 6px rgba(0,0,0,0.2);
        transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
        z-index: 9999; 
    `;

    btn.onmouseover = () => { if (!btn.disabled) { btn.style.backgroundColor = '#3700b3'; btn.style.transform = 'translateY(-50%) scale(1.05)'; } };
    btn.onmouseout = () => { if (!btn.disabled) { btn.style.backgroundColor = '#6200ee'; btn.style.transform = 'translateY(-50%) scale(1)'; } };

    activityWrapper.appendChild(btn);

    const resetButton = () => {
        isExtracting = false;
        btn.innerText = "ייבא ל-Student OS";
        btn.disabled = false;
        btn.style.backgroundColor = '#6200ee';
        btn.style.cursor = 'pointer';
        btn.style.opacity = '1';
    };

    // --- Triggered Extraction ---
    btn.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        if (isExtracting) return;
        isExtracting = true;

        btn.innerText = "Extracting...";
        btn.disabled = true;
        btn.style.backgroundColor = '#808080';
        btn.style.cursor = 'wait';
        btn.style.opacity = '0.8';

        if (!chrome.runtime?.id) {
            alert("Extension context invalidated. Please refresh Moodle.");
            resetButton();
            return;
        }

        try {
            console.log("Syllabus Harvester: Starting deep extraction for:", syllabusHref);
            
            /**
             * Recursive Buffer Fetcher
             * Persona: [Syllabus Architect Agent] - Follows Moodle wrappers (view.php).
             */
            async function getSyllabusBuffer(url, depth = 0) {
                if (depth > 3) {
                    throw new Error("Maximum redirect depth exceeded (Nested Wrapper Loop).");
                }
                
                const response = await fetch(url);
                if (!response || !response.ok) {
                    throw new Error(`Fetch failed with status: ${response?.status}`);
                }
                
                const contentType = response.headers.get('Content-Type') || "";
                
                // Case A: Moodle HTML Wrapper (view.php / resource page)
                if (contentType.includes('text/html')) {
                    const html = await response.text();
                    const doc = new DOMParser().parseFromString(html, 'text/html');
                    
                    // Look for embedded resources (iFrames, Objects)
                    const embed = doc?.querySelector?.('iframe#pdf-embed, iframe, embed, object');
                    if (embed?.src && !embed.src.includes('about:blank')) {
                        console.log(`[Depth ${depth}] Found embedded resource:`, embed.src);
                        return getSyllabusBuffer(embed.src, depth + 1);
                    }
                    
                    // Look for manual download links
                    const downloadLinks = [
                        '.resource-download-link a',
                        'a[href*="pluginfile.php"][href*=".pdf"]',
                        'a[href*="pluginfile.php"][href*=".docx"]',
                        'a[href*="pluginfile.php"][href*=".doc"]',
                        '.resourcelinkdetails a'
                    ];
                    
                    for (const selector of downloadLinks) {
                        const link = doc?.querySelector?.(selector);
                        if (link?.href) {
                            console.log(`[Depth ${depth}] Found download link:`, link.href);
                            return getSyllabusBuffer(link.href, depth + 1);
                        }
                    }
                    
                    throw new Error("No PDF or Word document found within Moodle wrapper.");
                }
                
                // Case B: Binary Resource
                const buffer = await response.arrayBuffer();
                if (!buffer || buffer.byteLength === 0) {
                    throw new Error("Received empty binary buffer.");
                }
                return { buffer, finalUrl: url };
            }

            const { buffer, finalUrl } = await getSyllabusBuffer(syllabusHref);
            
            // --- Magic Number Validation ---
            const uint8 = new Uint8Array(buffer.slice(0, 4));
            const signature = Array.from(uint8).map(b => b.toString(16).padStart(2, '0')).join('').toLowerCase();
            
            console.log("Magic Number Signature:", signature, "URL:", finalUrl);

            const isPdf = (signature === '25504446') || finalUrl.toLowerCase().split('?')[0].endsWith('.pdf');
            const isDocx = (signature === '504b0304') || finalUrl.toLowerCase().split('?')[0].endsWith('.docx');
            const isDoc = (signature === 'd0cf11e0') || finalUrl.toLowerCase().split('?')[0].endsWith('.doc');

            let extractedText = "";
            let extractionAttempted = false;

            if (isPdf) {
                extractedText = await extractTextFromPdf(buffer);
                extractionAttempted = true;
            } else if (isDocx) {
                extractedText = await extractTextFromDocx(buffer);
                extractionAttempted = true;
            } else if (isDoc) {
                console.warn("Legacy Word (.doc) detected. Skipping binary extraction to prevent crash.");
                extractedText = "[Syllabus detected as Legacy .doc file. Metadata preserved. Please upload PDF for full AI extraction.]";
                extractionAttempted = false; // We don't block on this
            } else {
                throw new Error(`Unsupported file type (Signature: ${signature}). Please upload PDF or DOCX manually.`);
            }

            // --- Validation Post-Extraction ---
            if (extractionAttempted && (!extractedText || extractedText.trim().length === 0)) {
                throw new Error("Target file was found but no text could be extracted.");
            }

            const payload = {
                courseName,
                syllabusHref: finalUrl,
                extractedText,
                timestamp: new Date().toISOString(),
                source: "MOODLE_HARVESTER_V2"
            };

            await chrome.storage.local.set({ pendingSyllabusImport: payload });
        try {
            if (!chrome.runtime?.id) throw new Error("Extension invalid");
            chrome.runtime.sendMessage({ action: "open_student_os" });
        } catch (e) {
            console.error("Student OS: Could not open dashboard - extension disconnected.");
        }
            
        } catch (error) {
            console.error("Syllabus Harvester [CRASH]:", error);
            alert("Extraction Failed: " + error.message);
        } finally {
            resetButton();
        }
    });

    // --- Helpers: Persona [QA Agent] - Safe Implementations ---
    async function extractTextFromPdf(data) {
        try {
            if (!chrome.runtime?.id) throw new Error("Extension invalid");
            pdfjsLib.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL('lib/pdf.worker.min.js');
            const loadingTask = pdfjsLib.getDocument({ data: data });
            const pdf = await loadingTask.promise;
            let fullText = "";

            for (let i = 1; i <= (pdf?.numPages || 0); i++) {
                const page = await pdf.getPage(i);
                const textContent = await page?.getTextContent?.();
                const pageText = textContent?.items?.map(item => item.str)?.join(" ") || "";
                fullText += pageText + "\n";
            }
            return fullText;
        } catch (e) {
            console.error("PDF Extraction Failed:", e);
            throw new Error("PDF processing failed. The file might be corrupted or password-protected.");
        }
    }

    async function extractTextFromDocx(data) {
        try {
            const result = await mammoth.extractRawText({ arrayBuffer: data });
            return result?.value || "";
        } catch (e) {
            console.error("DOCX Extraction Failed:", e);
            throw new Error("Word document processing failed. Please convert to PDF.");
        }
    }

})();
