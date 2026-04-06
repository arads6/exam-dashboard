/**
 * Grade Harvester Content Script
 * Injected on: https://portal.bgu.ac.il/private/academy/my-grades
 */

(function initGradeHarvester() {
    console.log("Student OS: Grade Harvester Loaded.");

    let harvestedCourses = [];

    // 1. Event Delegation for robust clicking
    document.addEventListener('click', (e) => {
        const btn = e.target.closest('#os-sync-btn');
        if (btn) {
            console.log("Student OS: Sync Button Clicked!");
            harvestGrades();
        }
    });

    // 2. Observe DOM changes to re-inject button if Angular wipes it
    const observer = new MutationObserver((mutations) => {
        const rows = document.querySelectorAll('mat-row.mat-mdc-row');
        if (rows.length > 0 && !document.getElementById('os-sync-btn')) {
            console.log("Student OS: Grade rows detected, injecting sync button...");
            injectSyncButton();
        }
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true
    });

    // Initial check
    setTimeout(() => {
        if (document.querySelectorAll('mat-row.mat-mdc-row').length > 0) {
            injectSyncButton();
        }
    }, 2000);

    function injectSyncButton() {
        if (document.getElementById('os-sync-btn')) return;

        const btn = document.createElement('button');
        btn.id = 'os-sync-btn';
        btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:6px"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg> Student OS Sync`;
        btn.style.cssText = `
            background-color: transparent;
            color: #666;
            border: 1px solid #ddd;
            border-radius: 4px;
            padding: 4px 10px;
            font-size: 11px;
            font-weight: 500;
            cursor: pointer;
            display: inline-flex;
            align-items: center;
            transition: all 0.2s ease;
            font-family: Arial, sans-serif;
            direction: ltr;
        `;

        // Styling helpers
        btn.onmouseover = () => {
            btn.style.backgroundColor = '#f8f9fa';
            btn.style.color = '#333';
            btn.style.borderColor = '#ccc';
        };
        btn.onmouseout = () => {
            btn.style.backgroundColor = 'transparent';
            btn.style.color = '#666';
            btn.style.borderColor = '#ddd';
        };

        // Try to find the exact header "כל הציונים"
        let targetContainer = null;
        const potentialHeaders = document.querySelectorAll('h1, h2, h3, h4, h5, h6, div, span, mat-card-title');
        for (const el of potentialHeaders) {
            if (!el) continue;
            if (el.textContent.trim() === 'כל הציונים' && el.children?.length === 0) {
                targetContainer = el.parentElement;
                break;
            }
        }

        if (targetContainer) {
            console.log("Student OS: Header container found. Injecting natively.");
            targetContainer.style.display = 'flex';
            targetContainer.style.alignItems = 'center';
            targetContainer.style.gap = '16px';
            targetContainer.appendChild(btn);
        } else {
            console.log("Student OS: Header not found. Injecting floating fallback.");
            btn.style.position = 'fixed';
            btn.style.bottom = '30px';
            btn.style.left = '30px';
            btn.style.zIndex = '999999';
            document.body.appendChild(btn);
        }
    }

    function harvestGrades() {
        console.log("Student OS: Starting grade harvest...");
        
        // 1. Robust Row Selection
        let rows = document.querySelectorAll('mat-row.mat-mdc-row');
        if (rows.length === 0) {
            console.log("Student OS: No mat-row found, trying broader [role='row']...");
            rows = document.querySelectorAll('[role="row"]');
        }

        if (rows.length === 0) {
            console.error("Student OS: No rows found even with fallback selectors.");
            alert('Student OS:\nCould not find any Grade rows. Please make sure you are on the "My Grades" tab.');
            return;
        }

        console.log(`Student OS: Found ${rows.length} potential rows. Parsing...`);
        harvestedCourses = [];

        rows.forEach((row, idx) => {
            try {
                // 2. Target Cells using robust attribute-based or class-based selectors
                const nameEl = row.querySelector('.cdk-column-assignmentText, [mat-column-name="assignmentText"]');
                const ptsEl = row.querySelector('.cdk-column-points, [mat-column-name="points"]');
                const ratingCell = row.querySelector('.cdk-column-rating, [mat-column-name="rating"]');

                if (!nameEl) {
                    // This might be a header or footer row, skip silently unless it has a title
                    return;
                }

                // Clean Title Extraction
                const title = nameEl.innerText.trim();
                if (!title || title === "שם הקורס" || title.includes("סיכום")) {
                    return; // Skip headers or summary rows
                }

                // Credits (Nekaz) - Task 2: Zero-Credit Rule & Parse Fallback
                let nekaz = 0;
                if (ptsEl) {
                    const cleanPts = ptsEl.innerText.trim().replace(/[^\d.]/g, '');
                    nekaz = parseFloat(cleanPts) || 0;
                }

                // Grade Parsing
                let score = null;
                let isBinary = false;
                let isPending = false;

                if (ratingCell) {
                    // Task 3: Broaden cell data extraction
                    const gradeSpan = ratingCell.querySelector('.rating-number');
                    const gradeText = gradeSpan ? gradeSpan.innerText.trim() : ratingCell.innerText.trim();
                    const numVal = parseInt(gradeText, 10);

                    if (/עובר|פטור|Pass|Exempt/i.test(gradeText)) {
                        isBinary = true;
                        score = 100;
                    } 
                    else if (/לא השלים|חסר/i.test(gradeText) || !gradeText || gradeText.includes('---')) {
                        isPending = true;
                    } 
                    else if (!isNaN(numVal)) {
                        score = numVal;
                    } else {
                        isPending = true;
                    }
                } else {
                    isPending = true;
                }

                // Phase 11: Pass/Fail Logic (BGU 56 Rule)
                const needsRetake = (score !== null && score < 56 && !isBinary);

                harvestedCourses.push({
                    title: title,
                    nekaz: nekaz,
                    score: isPending ? null : score,
                    officialGrade: isPending ? null : (isBinary ? 100 : score),
                    isBinary: isBinary,
                    needsRetake: needsRetake,
                    isPending: isPending,
                    isConfigured: true,
                    gradeComponents: (isPending || score === null) ? [] : [{
                        name: 'BGU Transcript Sync',
                        weight: 100,
                        score: score,
                        isShield: false
                    }],
                    rawSource: 'bgu_portal_extension'
                });
            } catch (err) {
                console.error(`Student OS: Failed to parse row ${idx}:`, err);
            }
        });

        console.log(`Student OS: Successfully harvested ${harvestedCourses.length} courses. Notifying background...`);

        if (harvestedCourses.length > 0) {
            try {
                chrome.runtime.sendMessage({ 
                    action: 'open_student_os', 
                    payload: harvestedCourses 
                }, (response) => {
                    if (chrome.runtime.lastError) {
                        console.error("Student OS: Messaging Error:", chrome.runtime.lastError.message);
                    } else {
                        console.log("Student OS: Background sync handshake complete.");
                    }
                });
            } catch (err) {
                console.error("Student OS: Extension disconnected.", err);
                alert("Student OS:\nThe extension connection was reset (likely updated). Please refresh this page (F5) and click Sync again.");
            }
        } else {
            alert("Student OS:\nScraper found 0 courses. Please try scrolling down to load the full table.");
        }
    }

})();
