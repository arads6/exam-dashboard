import { storage } from './storage.js';
import { aiService } from './ai_service.js';

class App {
    constructor() {
        // DOM Elements
        this.addBtn = document.getElementById('add-exam-btn');
        this.modal = document.getElementById('exam-modal');
        this.closeModalBtn = document.getElementById('close-modal-btn');
        this.form = document.getElementById('exam-form');
        this.checklistInput = document.getElementById('checklist-item-input');
        this.addChecklistBtn = document.getElementById('add-checklist-item-btn');
        this.checklistPreview = document.getElementById('checklist-preview');
        this.examsGrid = document.getElementById('exams-grid');
        this.closestExamSection = document.getElementById('closest-exam-section');
        this.modalTitle = document.querySelector('.modal-header h2');
        
        // Time Filter Elements
        this.filterBtns = document.querySelectorAll('.filter-btn');
        this.filterStartDate = document.getElementById('filter-start-date');
        this.filterEndDate = document.getElementById('filter-end-date');
        this.applyCustomFilterBtn = document.getElementById('apply-custom-filter-btn');
        this.currentFilter = 'all'; // Default to all upcoming

        // Smart Import Elements
        this.smartImportBtn = document.getElementById('smart-import-btn');
        this.importModal = document.getElementById('import-modal');
        this.closeImportBtn = document.getElementById('close-import-btn');
        this.importText = document.getElementById('import-text');
        this.parseTextBtn = document.getElementById('parse-text-btn');
        this.confirmImportBtn = document.getElementById('confirm-import-btn');
        this.backToEditBtn = document.getElementById('back-to-edit-btn');
        this.importActions = document.getElementById('import-actions');
        this.importPreviewSection = document.getElementById('import-preview-section');
        this.importPreviewList = document.getElementById('import-preview-list');
        this.detectedCount = document.getElementById('detected-count');

        // Vault Sidebar Elements
        this.vaultSidebar = document.getElementById('special-vault');
        this.openVaultBtn = document.getElementById('open-vault-btn');
        this.closeVaultBtn = document.getElementById('close-vault-btn');
        this.vaultGrid = document.getElementById('vault-grid');
        this.dashboardMain = document.querySelector('.dashboard');

        // Conflict Resolution Elements
        this.conflictModal = document.getElementById('conflict-modal');
        this.closeConflictBtn = document.getElementById('close-conflict-btn');
        this.conflictOptionsContainer = document.getElementById('conflict-options');
        this.saveConflictBtn = document.getElementById('save-conflict-btn');

        // Compare Modal
        this.compareModal = document.getElementById('compare-modal');
        this.closeCompareBtn = document.getElementById('close-compare-btn');
        this.closeCompareFooterBtn = document.getElementById('close-compare-footer-btn');
        this.undoConflictBtn = document.getElementById('undo-conflict-btn');
        this.switchConflictBtn = document.getElementById('switch-conflict-btn');
        this.compareGrid = document.getElementById('compare-grid');
        this.currentCompareBaseId = null;
        this.currentCompareConflicts = [];

        // API Key Modal managed by apiModalManager

        this.currentChecklist = [];
        this.exams = [];
        this.countdownIntervals = {};
        this.editingExamId = null;
        this.editingChecklistIndex = null;
        this.parsedExams = [];
        this.resolvingExamIds = null; // store array of IDs being resolved
        this.historicalGPA = 0; // State for calculated GPA
        this.isProcessingSyllabus = false; // State for AI Harvester flow (QA Review)

        this.init();
    }

    escapeHTML(str) {
        if (!str) return '';
        return String(str).replace(/[&<>'"]/g, 
            tag => ({
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                "'": '&#39;',
                '"': '&quot;'
            }[tag])
        );
    }

    async init() {
        this.bindEvents();
        await this.loadExams();
        this.render();

        // Update countdowns every minute
        setInterval(() => this.updateAllCountdowns(), 60000);
    }

    closeCompareModal() {
        const resetState = () => {
            this.compareModal.classList.remove('active', 'closing');
            this.currentCompareBaseId = null;
            this.currentCompareConflicts = [];
        };
        if (this.compareModal.classList.contains('active')) {
            this.compareModal.classList.add('closing');
            setTimeout(resetState, 190);
        } else {
            resetState();
        }
    }

    openCompareModal(baseId, conflictingIds) {
        this.currentCompareBaseId = baseId;
        this.currentCompareConflicts = conflictingIds;
        this.compareGrid.innerHTML = ''; // Clear previous

        const allIds = [baseId, ...conflictingIds];
        allIds.forEach(id => {
            const exam = this.exams.find(e => e.id === id);
            if (exam) {
                // Pass true for isCompareView to prevent rendering nested stacks/buttons inside the modal
                this.compareGrid.innerHTML += this.generateExamCard(exam, false, null, null, false, true);
            }
        });

        // Bind events specifically to the newly injected modal cards to prevent missing standard functionality
        this.bindCardEvents(this.compareGrid);

        this.compareModal.classList.add('active');
    }

    closeModal() {
        const resetState = () => {
            this.modal.classList.remove('active', 'closing');
            
            // FULL RESET: No ghost data
            this.form.reset(); 
            document.getElementById('exam-title').value = '';
            document.getElementById('exam-date').value = '';
            document.getElementById('exam-time').value = '';
            document.getElementById('exam-moed').value = '';
            
            this.currentChecklist = [];
            this.editingExamId = null;
            this.editingChecklistIndex = null;
            this.addChecklistBtn.textContent = 'Add';
            this.checklistInput.value = '';
            if (this.modalTitle) this.modalTitle.textContent = 'Add New Exam';
            this.renderChecklistPreview();
        };

        if (this.modal.classList.contains('active')) {
            this.modal.classList.add('closing');
            setTimeout(resetState, 200);
        } else {
            resetState();
        }
    }

    closeImportModal() {
        const resetState = () => {
            this.importModal.classList.remove('active', 'closing');
            this.importText.value = '';
            this.importPreviewSection.style.display = 'none';
            this.importActions.style.display = 'none';
            this.parseTextBtn.style.display = 'block';
            this.importText.style.display = 'block';
            this.importPreviewList.innerHTML = '';
            this.detectedCount.textContent = '0';
            this.parsedExams = [];
        };

        if (this.importModal.classList.contains('active')) {
            this.importModal.classList.add('closing');
            setTimeout(resetState, 190);
        } else {
            resetState();
        }
    }

    closeConflictModal() {
        const resetState = () => {
            this.conflictModal.classList.remove('active', 'closing');
            this.resolvingExamIds = null;
            this.conflictOptionsContainer.innerHTML = '';
        };

        if (this.conflictModal.classList.contains('active')) {
            this.conflictModal.classList.add('closing');
            setTimeout(resetState, 190);
        } else {
            resetState();
        }
    }

    openEditModal(id) {
        const exam = this.exams.find(e => e.id === id);
        if (!exam) return;

        this.editingExamId = id;
        if (this.modalTitle) this.modalTitle.textContent = 'Edit Exam';

        // ... rest of openEditModal
    }

    // --- API Key Modal Methods --- //

    // API Modal methods removed - handled by apiModalManager
    openEditModal(id) {
        const exam = this.exams.find(e => e.id === id);
        if (!exam) return;

        this.editingExamId = id;
        if (this.modalTitle) this.modalTitle.textContent = 'Edit Exam';

        document.getElementById('exam-title').value = exam.title;
        document.getElementById('exam-date').value = exam.date;
        document.getElementById('exam-time').value = exam.time;
        document.getElementById('exam-moed').value = exam.moed || '';
        
        // Deep copy checklist so we don't mutate original until save
        this.currentChecklist = JSON.parse(JSON.stringify(exam.checklist));
        this.renderChecklistPreview();

        this.modal.classList.add('active');
    }

    openConflictModal(baseId, conflictingIdsStr) {
        const conflictIds = conflictingIdsStr.split(',');
        this.resolvingExamIds = [baseId, ...conflictIds];

        const examsToResolve = this.resolvingExamIds.map(id => this.exams.find(e => e.id === id)).filter(Boolean);

        this.conflictOptionsContainer.innerHTML = '';

        examsToResolve.forEach((exam, index) => {
            let badge = exam.moed ? `<span class="moed-badge" style="background:var(--primary-color);color:#000;">${exam.moed}</span>` : '';
            const isSelected = index === 0 ? 'selected' : '';
            this.conflictOptionsContainer.innerHTML += `
                <div class="conflict-option ${isSelected}" data-id="${exam.id}">
                    <input type="radio" name="attend-choice" value="${exam.id}" ${index === 0 ? 'checked' : ''} style="cursor:pointer; accent-color: var(--secondary-color);">
                    <div>
                        <div style="font-weight: 600;">${exam.title} ${badge}</div>
                        <div style="font-size: 0.8rem; color: var(--text-secondary);">${exam.date} | ${exam.time}</div>
                    </div>
                </div>
            `;
        });

        const options = this.conflictOptionsContainer.querySelectorAll('.conflict-option');
        options.forEach(opt => {
            opt.addEventListener('click', () => {
                options.forEach(o => o.classList.remove('selected'));
                opt.classList.add('selected');
                opt.querySelector('input').checked = true;
            });
        });

        this.conflictModal.classList.add('active');
    }

    async saveConflictResolution() {
        const selectedRadio = this.conflictOptionsContainer.querySelector('input[name="attend-choice"]:checked');
        if (!selectedRadio) return;

        const attendingId = selectedRadio.value;

        for (const id of this.resolvingExamIds) {
            const exam = this.exams.find(e => e.id === id);
            if (exam) {
                if (exam.id === attendingId) {
                    exam.decisionState = 'Taking';
                } else {
                    exam.decisionState = 'Skipping';
                }
                await this.handleMoedCSync(exam, exam.decisionState);
                await storage.updateExam(exam);
            }
        }

        this.closeConflictModal();
        await this.loadExams();
        this.render();
    }

    /**
     * Stage 5 (REAL): Secure AI Protocol (UX Upgrade)
     * Orchestrates the Gemini API call with a persistence-safe custom Modal.
     */
    async processSyllabusWithAgent(rawText, metadata) {
        let apiKey = localStorage.getItem('GEMINI_API_KEY');

        if (!apiKey) {
            // Open modal via manager and return a promise
            if (window.apiModalManager) window.apiModalManager.openModal();
            
            return new Promise((resolve, reject) => {
                const onSave = async () => {
                    window.removeEventListener('api_key_saved', onSave);
                    window.removeEventListener('api_key_cancelled', onCancel);
                    const newKey = localStorage.getItem('GEMINI_API_KEY');
                    if (newKey) {
                        try {
                            const result = await aiService.callSyllabusAgent(rawText, metadata);
                            resolve(result);
                        } catch (err) { reject(err); }
                    }
                };
                
                const onCancel = () => {
                    window.removeEventListener('api_key_saved', onSave);
                    window.removeEventListener('api_key_cancelled', onCancel);
                    reject(new Error("AI Process cancelled by user."));
                };

                window.addEventListener('api_key_saved', onSave);
                window.addEventListener('api_key_cancelled', onCancel);
            });
        }

        return await aiService.callSyllabusAgent(rawText, metadata);
    }

    /**
     * Stage 6: Grading Engine Integration
     * Merges AI-parsed data into the persistent storage.
     */
    async applyAgentResultsToCourse(agentResponse) {
        console.log("🛠️ [Stage 7.5] Integrating AI data for:", agentResponse.courseInfo.moodleName);
        
        try {
            // 1. Load latest courses from storage
            const allCourses = await storage.getCourses();
            
            // 2. Find ALL matching courses by clean name (Advanced Fuzzy Match with Guardrails)
            const cleanNameTarget = agentResponse.courseInfo.cleanName;
            const moodleNameTarget = agentResponse.courseInfo.moodleName;
            
            const matches = allCourses.filter(c => {
                return storage.isFuzzyMatch(c.title, cleanNameTarget) || 
                       (c.moodleName && storage.isFuzzyMatch(c.moodleName, cleanNameTarget)) ||
                       (c.moodleName && moodleNameTarget && storage.isFuzzyMatch(c.moodleName, moodleNameTarget));
            });

            let updatedCourse;

            if (matches.length === 0) {
                console.log(`✨ [Stage 6.1] Course "${cleanNameTarget}" not found. Auto-creating new entry...`);
                
                updatedCourse = {
                    id: 'course_' + Date.now().toString(),
                    title: agentResponse.courseInfo.cleanName,
                    moodleName: agentResponse.courseInfo.moodleName,
                    gradeComponents: agentResponse.gradeComponents.map(c => ({ ...c, score: null })),
                    topics: agentResponse.topics || [],
                    staffMetadata: agentResponse.courseInfo.staff || {},
                    isConfigured: (agentResponse.gradeComponents.reduce((s, c) => s + (c.weight || 0), 0) === 100),
                    lastSyllabusUpdate: new Date().toISOString(),
                    checklist: agentResponse.topics ? agentResponse.topics.map(t => ({ text: t, completed: false })) : [],
                    date: "TBD",
                    time: "TBD",
                    nekaz: null 
                };

                await storage.saveCourse(updatedCourse); 
            } else {
                // STAGE 7.5: Merge duplicates logic
                const existingCourse = matches[0]; // Primary record
                const duplicates = matches.slice(1);

                if (duplicates.length > 0) {
                    console.log(`🧹 [Stage 7.6] Merging ${duplicates.length} duplicate(s)...`);
                    for (const dup of duplicates) {
                        try {
                            await storage.deleteCourse(dup.id);
                        } catch (e) {
                            console.warn("Failed to delete duplicate course:", dup.id, e);
                        }
                    }
                }

                // Merge Grade Components (Preserving manual scores from primary)
                const mergedComponents = agentResponse.gradeComponents.map(newComp => {
                    const existingComp = (existingCourse.gradeComponents || []).find(c => 
                        c.name.toLowerCase().trim() === newComp.name.toLowerCase().trim()
                    );

                    return {
                        ...newComp,
                        score: existingComp ? existingComp.score : null 
                    };
                });

                const totalWeight = mergedComponents.reduce((sum, comp) => sum + (comp.weight || 0), 0);
                const isConfigured = (totalWeight === 100);

                updatedCourse = {
                    ...existingCourse,
                    gradeComponents: mergedComponents,
                    isConfigured: isConfigured,
                    topics: agentResponse.topics || existingCourse.topics,
                    staffMetadata: agentResponse.courseInfo.staff || existingCourse.staffMetadata,
                    lastSyllabusUpdate: new Date().toISOString(),
                    checklist: (existingCourse.checklist && existingCourse.checklist.length > 0) 
                                ? existingCourse.checklist 
                                : (agentResponse.topics ? agentResponse.topics.map(t => ({ text: t, completed: false })) : [])
                };

                await storage.updateCourse(updatedCourse);
            }
            
            console.log("✅ Course successfully synchronized: ", updatedCourse);
            
            // 7. Refresh UI
            await this.loadExams();
            this.render();

        } catch (error) {
            console.error("❌ Stage 7.5 Synchronization Failed:", error);
            throw error;
        }
    }

    bindEvents() {
        if (this.addBtn) this.addBtn.addEventListener('click', () => {
            this.closeModal();
            this.modal.classList.add('active');
        });

        if (this.closeModalBtn) this.closeModalBtn.addEventListener('click', () => this.closeModal());

        // Vault Event Listeners
        if (this.openVaultBtn) this.openVaultBtn.addEventListener('click', () => {
            if (this.vaultSidebar) this.vaultSidebar.classList.toggle('open');
            if (this.dashboardMain) this.dashboardMain.classList.toggle('vault-open');
        });

        if (this.closeVaultBtn) this.closeVaultBtn.addEventListener('click', () => {
            if (this.vaultSidebar) this.vaultSidebar.classList.remove('open');
            if (this.dashboardMain) this.dashboardMain.classList.remove('vault-open');
        });

        // Time Filter Listeners
        if (this.filterBtns) this.filterBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.filterBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.currentFilter = btn.dataset.filter;
                this.render();
            });
        });

        if (this.applyCustomFilterBtn) this.applyCustomFilterBtn.addEventListener('click', () => {
            if (this.filterStartDate?.value || this.filterEndDate?.value) {
                if (this.filterBtns) this.filterBtns.forEach(b => b.classList.remove('active')); // Deselect predefined
                this.currentFilter = 'custom';
                this.render();
            }
        });

        // Smart Import Listeners
        if (this.smartImportBtn) this.smartImportBtn.addEventListener('click', () => {
            this.closeImportModal();
            this.importModal?.classList.add('active');
        });
        if (this.closeImportBtn) this.closeImportBtn.addEventListener('click', () => this.closeImportModal());
        if (this.parseTextBtn) this.parseTextBtn.addEventListener('click', () => this.parseImportText());
        if (this.backToEditBtn) this.backToEditBtn.addEventListener('click', () => {
            if (this.importPreviewSection) this.importPreviewSection.style.display = 'none';
            if (this.importActions) this.importActions.style.display = 'none';
            if (this.parseTextBtn) this.parseTextBtn.style.display = 'block';
            if (this.importText) {
                this.importText.style.display = 'block';
                this.importText.focus();
            }
        });

        // Auto-revert to "Preview" button if user edits the text
        if (this.importText) this.importText.addEventListener('input', () => {
            if (this.importPreviewSection?.style.display === 'block') {
                this.importPreviewSection.style.display = 'none';
                if (this.importActions) this.importActions.style.display = 'none';
                if (this.parseTextBtn) this.parseTextBtn.style.display = 'block';
            }
        });
        if (this.confirmImportBtn) this.confirmImportBtn.addEventListener('click', () => this.importParsedExams());

        // Compare Modal Listeners
        if (this.closeCompareBtn) this.closeCompareBtn.addEventListener('click', () => this.closeCompareModal());
        if (this.closeCompareFooterBtn) this.closeCompareFooterBtn.addEventListener('click', () => this.closeCompareModal());

        if (this.switchConflictBtn) this.switchConflictBtn.addEventListener('click', async () => {
            if (this.currentCompareBaseId) {
                await this.switchConflict(this.currentCompareBaseId, this.currentCompareConflicts);
            }
        });

        if (this.undoConflictBtn) this.undoConflictBtn.addEventListener('click', async () => {
            if (this.currentCompareBaseId) {
                await this.resetConflict(this.currentCompareBaseId, this.currentCompareConflicts.join(','));
                this.closeCompareModal();
            }
        });

        // Conflict Modal Listeners
        if (this.closeConflictBtn) this.closeConflictBtn.addEventListener('click', () => this.closeConflictModal());
        if (this.saveConflictBtn) this.saveConflictBtn.addEventListener('click', () => this.saveConflictResolution());

        // Close on outside click
        // Same-tab Sync (dispatched from storage.js)
        window.addEventListener('storage_updated', () => {
            console.log('[Main App Sync] storage_updated event detected (same-tab). Debouncing refresh...');
            clearTimeout(this.syncTimeout);
            this.syncTimeout = setTimeout(() => {
                this.loadExams();
            }, 50);
        });

        // Cross-tab Sync
        window.addEventListener('storage', (e) => {
            if (e.key === 'student_os_data') {
                console.log('[Main App Sync] Storage change detected (cross-tab). Debouncing refresh...');
                clearTimeout(this.syncTimeout);
                this.syncTimeout = setTimeout(() => {
                    this.loadExams();
                }, 50);
            }
        });

        // --- Syllabus Extension Handshake Receiver ---
        window.addEventListener('message', async (event) => {
            // Stage 6.10: Removed strict window source check to prevent cross-context silent failures
            if (this.isProcessingSyllabus) return;

            const message = event.data;
            if (message && message.source === 'SYLLABUS_EXTENSION' && message.type === 'IMPORT_READY') {
                const payload = message.payload;
                const safeName = this.escapeHTML(payload.courseName);
                
                console.log("✅ SUCCESS! Extension Handshake Complete for:", safeName);
                this.isProcessingSyllabus = true;

                try {
                    // Stage 5: Call the Agent
                    const jsonResponse = await this.processSyllabusWithAgent(payload.extractedText, {
                        moodleName: payload.courseName,
                        url: payload.syllabusHref
                    });

                    console.log("Agent Response (Syllabus_Specialist):", jsonResponse);
                    
                    // Stage 6: Integrate with Grading Engine
                    await this.applyAgentResultsToCourse(jsonResponse);
                } catch (error) {
                    console.error("Sync Logic Crashed:", error);
                } finally {
                    this.isProcessingSyllabus = false;
                    alert("Syllabus import process completed!");
                }
            }
        });

        // API Key Modal Listeners removed - handled by apiModalManager (Stage 6.6+)

        // Close on outside click
        window.addEventListener('click', (e) => {
            if (e.target === this.modal) this.closeModal();
            if (e.target === this.importModal) this.closeImportModal();
            if (e.target === this.conflictModal) this.closeConflictModal();
            if (e.target === this.compareModal) this.closeCompareModal();
        });

        if (this.addChecklistBtn) this.addChecklistBtn.addEventListener('click', () => this.addChecklistItem());
        if (this.checklistInput) this.checklistInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                this.addChecklistItem();
            }
        });

        if (this.checklistPreview) this.checklistPreview.addEventListener('click', (e) => {
            const deleteBtn = e.target.closest('.delete-preview-btn');
            if (deleteBtn) {
                const id = deleteBtn.dataset.id;
                this.removeChecklistItemPreview(id);
                return;
            }
            const editBtn = e.target.closest('.edit-preview-btn');
            if (editBtn) {
                const index = editBtn.dataset.index;
                this.editChecklistItem(index);
            }
        });

        if (this.form) this.form.addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.handleExamSubmit();
        });
    }

    addChecklistItem() {
        const text = this.checklistInput.value.trim();
        if (text) {
            if (this.editingChecklistIndex !== null && this.editingChecklistIndex !== undefined) {
                this.currentChecklist[this.editingChecklistIndex].text = text;
                this.editingChecklistIndex = null;
                this.addChecklistBtn.textContent = 'Add';
            } else {
                this.currentChecklist.push({
                    id: Date.now().toString() + Math.random().toString(36).substring(2),
                    text: text,
                    completed: false
                });
            }
            this.checklistInput.value = '';
            this.renderChecklistPreview();
        }
    }

    editChecklistItem(index) {
        const item = this.currentChecklist[index];
        this.checklistInput.value = item.text;
        this.editingChecklistIndex = index;
        this.addChecklistBtn.textContent = 'Update';
        this.checklistInput.focus();
    }

    removeChecklistItemPreview(id) {
        this.currentChecklist = this.currentChecklist.filter(item => item.id !== id);
        this.renderChecklistPreview();
    }

    renderChecklistPreview() {
        this.checklistPreview.innerHTML = '';
        this.currentChecklist.forEach((item, index) => {
            const li = document.createElement('li');
            li.innerHTML = `
                <span>${item.text}</span>
                <div class="preview-actions">
                    <button type="button" class="icon-btn edit-preview-btn" data-index="${index}">
                        <i class='bx bx-edit-alt'></i>
                    </button>
                    <button type="button" class="icon-btn danger-btn delete-preview-btn" data-id="${item.id}">
                        <i class='bx bx-trash'></i>
                    </button>
                </div>
            `;
            this.checklistPreview.appendChild(li);
        });
    }

    async handleExamSubmit() {
        const title = document.getElementById('exam-title').value;
        const date = document.getElementById('exam-date').value;
        let time = document.getElementById('exam-time').value;
        if (!time) time = 'TBD';
        const moed = document.getElementById('exam-moed').value;
        
        const examData = {
            title,
            date,
            time,
            moed,
            decisionState: 'Pending', // New state field for overlaps
            checklist: [...this.currentChecklist]
        };

        if (this.editingExamId) {
            examData.id = this.editingExamId;
            const oldExam = this.exams.find(e => e.id === this.editingExamId);
            if (oldExam) {
                if (oldExam.decisionState) examData.decisionState = oldExam.decisionState;
                if (oldExam.courseId) examData.courseId = oldExam.courseId;
                if (oldExam.grade !== undefined) examData.grade = oldExam.grade;
            }
            await storage.updateExam(examData);
        } else {
            // Validation: Limit to 3 Moeds
            const coreName = this.getCoreSubjectName(examData.title);
            const normalizedCoreName = storage.normalizeCourseName(coreName);
            const existingExamsWithCoreName = this.exams.filter(e => storage.normalizeCourseName(this.getCoreSubjectName(e.title)) === normalizedCoreName);
            if (existingExamsWithCoreName.length >= 3) {
                alert(`You can only have a maximum of 3 exams (Moed A, B, C) for the subject "${coreName}".`);
                return; // Prevent saving
            }
            examData.courseId = await this.ensureCourseExists(coreName);
            const savedExam = await storage.saveExam(examData);
            examData.id = savedExam.id;
        }

        this.closeModal();
        await this.loadExams();
        this.updateCourseDatalist(); // Refresh list if new course was auto-created
        await this.syncChecklists(examData.id, examData.checklist);

        // If the Edit Modal was opened from within the Compare Modal, we need to refresh the Compare Modal
        if (this.compareModal && this.compareModal.classList.contains('active') && this.currentCompareBaseId) {
            this.openCompareModal(this.currentCompareBaseId, this.currentCompareConflicts);
        }

        this.render();
    }

    parseImportText() {
        const text = this.importText.value;
        if (!text.trim()) return;

        this.parsedExams = [];
        const lines = text.split('\n');

        // Advanced regex to catch various date formats including without year (DD/MM, DD.MM.YYYY, Month DD)
        const dateRegex = /(\d{1,2}[-/.]\d{1,2}(?:[-/.]\d{2,4})?)|((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[A-Za-z]*\s+\d{1,2}(?:st|nd|rd|th)?(?:,?\s+\d{4})?)/i;
        const timeRegex = /(\d{1,2}[:.]\d{2}\s*(?:am|pm)?)|(\d{1,2}\s*(?:am|pm))/i;

        lines.forEach(line => {
            if (!line.trim()) return;

            let dateMatch = line.match(dateRegex);
            let timeMatch = line.match(timeRegex);

            if (dateMatch) {
                let nameStr = line;
                let dateStr = dateMatch[0];
                let timeStr = timeMatch ? timeMatch[0] : '09:00'; // Default time

                // Advanced AI Parsing: Moed & Priority
                let moed = "";
                if (/מועד\s*א|מועד\s*a|moed\s*a/i.test(line)) moed = "A";
                else if (/מועד\s*ב|מועד\s*b|moed\s*b/i.test(line)) moed = "B";
                else if (/מועד\s*ג|מועד\s*c|moed\s*c|מיוחד|special/i.test(line)) moed = "C";

                // Remove date, time, moed strings from name to get just the clean title
                // We use a more careful approach to avoid "smashing" words
                let tempName = line;
                if (dateMatch) tempName = tempName.replace(dateMatch[0], ' ');
                if (timeMatch) tempName = tempName.replace(timeMatch[0], ' ');
                
                nameStr = tempName;
                nameStr = nameStr.replace(/Add\s*Exam:/gi, ''); // Strip prefix if present
                nameStr = nameStr.replace(/מועד\s*[אבגa-c]|moed\s*[a-c]|מיוחד|special/gi, '');
                
                // Robust Spacing & Cleaning
                nameStr = nameStr.replace(/[\u00A0\u1680\u180E\u2000-\u200B\u202F\u205F\u3000\uFEFF]/g, ' '); // Normalize all weird Unicode spaces
                nameStr = nameStr.replace(/([a-zA-Zא-ת])(\d)/g, '$1 $2'); // Force space between letter (Eng/Heb) and number
                nameStr = nameStr.replace(/(\d)([a-zA-Zא-ת])/g, '$1 $2'); // Force space between number and letter
                nameStr = nameStr.replace(/([א-ת])([a-zA-Z])/g, '$1 $2'); // Space between Hebrew and English
                nameStr = nameStr.replace(/([a-zA-Z])([א-ת])/g, '$1 $2'); // Space between English and Hebrew
                
                nameStr = nameStr.replace(/^[-\s|:.,()]+/, '').replace(/[-\s|:.,()]+$/, '').trim(); // clean up edges
                nameStr = nameStr.replace(/\s+/g, ' '); // Force single spacing between words

                // Apply Title Case specifically to English words (e.g., 'data structures' -> 'Data Structures')
                nameStr = nameStr.replace(/\b([a-zA-Z])([a-zA-Z]*)\b/g, (match, p1, p2) => p1.toUpperCase() + p2.toLowerCase());

                if (!nameStr) nameStr = "Unnamed Exam";

                // Attempt to standardize date to YYYY-MM-DD for HTML input compatibility
                let standardDate = new Date(dateStr);
                let standardDateStr = '';

                // If JS parses it properly (like YYYY-MM-DD or Month DD, YYYY) AND it actually contains a word or year
                if (!isNaN(standardDate.getTime()) && dateStr.length > 5 && dateStr.match(/[a-zA-Z]|\d{4}/)) {
                    standardDateStr = standardDate.toISOString().split('T')[0];
                } else {
                    // Manual parsing for standard Israeli/Euro format DD/MM/YYYY
                    let parts = dateStr.split(/[-/.]/);
                    if (parts.length >= 2) {
                        let day = parseInt(parts[0], 10);
                        let month = parseInt(parts[1], 10);
                        if (month > 12 && day <= 12) {
                            let temp = day; day = month; month = temp;
                        }

                        let year = new Date().getFullYear();

                        if (parts.length === 3 && parts[2].length > 0) {
                            year = parts[2].length === 2 ? parseInt('20' + parts[2], 10) : parseInt(parts[2], 10);
                        } else {
                            // Smart Year Inference:
                            // If the date is more than a month in the past from TODAY, assume it means NEXT year.
                            let now = new Date();
                            let parsedDate = new Date(year, month - 1, day);
                            let oneMonthAgo = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());

                            if (parsedDate < oneMonthAgo) {
                                year += 1; // Assume next year!
                            }
                        }

                        // Reconstruct to YYYY-MM-DD
                        standardDateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                    }
                }

                // Standardize time (very basic 12->24hr conversion fallback)
                let finalTime = '09:00';
                if (timeStr.toLowerCase().includes('pm') && !timeStr.includes('12')) {
                    let h = parseInt(timeStr) + 12;
                    finalTime = `${h}:00`;
                } else {
                    let matches = timeStr.match(/\d{1,2}:\d{2}/);
                    if (matches) finalTime = matches[0].padStart(5, '0');
                }

                this.parsedExams.push({
                    title: nameStr,
                    date: standardDateStr || dateStr, // keep original if parsing failed completely
                    time: finalTime,
                    moed: moed,
                    decisionState: moed === 'C' ? 'Vaulted' : 'Pending',
                    checklist: []
                });
            }
        });

        this.renderImportPreview();
    }

    renderImportPreview() {
        this.importPreviewList.innerHTML = '';
        this.detectedCount.textContent = this.parsedExams.length;

        if (this.parsedExams.length === 0) {
            this.importPreviewList.innerHTML = '<p style="color: var(--danger-color); font-size: 0.9rem;">No dates detected. Try standard formats like DD/MM/YYYY.</p>';
        } else {
            this.parsedExams.forEach((exam, index) => {
                let moedBadge = exam.moed ? `<span class="moed-badge" style="background:var(--primary-color);color:#000;font-size:0.65rem;margin-left:4px;">Moed ${exam.moed}</span>` : '';

                this.importPreviewList.innerHTML += `
                    <div style="padding: 8px; border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center;">
                        <div>
                            <div style="font-weight: 600; font-size: 0.95rem;">${exam.title} ${moedBadge}</div>
                            <div style="font-size: 0.8rem; color: var(--text-secondary);"><i class='bx bx-calendar'></i> ${exam.date} &nbsp; <i class='bx bx-time'></i> ${exam.time}</div>
                        </div>
                        <input type="checkbox" checked id="import-check-${index}" style="accent-color: var(--primary-color); width: 16px; height: 16px; cursor: pointer;">
                    </div>
                `;
            });
            this.importActions.style.display = 'flex';
            this.parseTextBtn.style.display = 'none';
        }

        this.importPreviewSection.style.display = 'block';
    }

    async ensureCourseExists(coreTitle) {
        let courses = await storage.getCourses();
        let course = courses.find(c => storage.isFuzzyMatch(c.title, coreTitle));
        if (!course) {
            course = await storage.saveCourse({ title: coreTitle, nekaz: null });
        }
        return course.id;
    }

    async importParsedExams() {
        const checkboxes = document.querySelectorAll('[id^="import-check-"]');
        let importedCount = 0;

        for (let i = 0; i < checkboxes.length; i++) {
            if (checkboxes[i].checked) {
                const examObj = this.parsedExams[i];
                const coreName = this.getCoreSubjectName(examObj.title);
                examObj.courseId = await this.ensureCourseExists(coreName);
                await storage.saveExam(examObj);
                importedCount++;
            }
        }

        this.closeImportModal();
        await this.loadExams();
        this.render();

        if (importedCount > 0) {
            console.log(`Successfully imported ${importedCount} exams.`);
        }
    }

    async loadExams() {
        this.courses = await storage.getCourses();
        try {
            const rawExams = await storage.getExams();
            console.log('Exams found:', rawExams); // Debug log to see incoming local storage data
            this.exams = (Array.isArray(rawExams) ? rawExams : []).map(exam => {
                // Defensive data mapping to ensure UI rendering never crashes
                return {
                    id: String(exam.id || Date.now().toString() + Math.random().toString(36).substring(2)),
                    title: String(exam.title || "Unnamed Exam"),
                    date: String(exam.date || ""),
                    time: String(exam.time || ""),
                    moed: String(exam.moed || ""),
                    grade: exam.grade !== undefined && exam.grade !== null ? Number(exam.grade) : null,
                    nekaz: exam.nekaz !== undefined && exam.nekaz !== null ? Number(exam.nekaz) : null,
                    priority: String(exam.priority || "Medium"),
                    decisionState: String(exam.decisionState || "Pending"),
                    isEligibleForSpecial: !!exam.isEligibleForSpecial,
                    checklist: Array.isArray(exam.checklist) ? exam.checklist : [],
                    completedTopics: Array.isArray(exam.completedTopics) ? exam.completedTopics : []
                };
            });
        } catch (error) {
            console.error("Failed to load exams safely:", error);
            this.exams = [];
        }

        await this.autoAssignMoeds();
        this.render();
        await this.updateCourseDatalist();
    }

    async updateCourseDatalist() {
        const courseList = document.getElementById('course-list');
        if (!courseList) return;
        
        try {
            const courses = await storage.getCourses();
            courseList.innerHTML = courses
                .map(c => `<option value="${this.escapeHTML(c.title)}">`)
                .join('');
        } catch (e) {
            console.warn("Failed to update datalist:", e);
        }
    }

    getCoreSubjectName(title) {
        return storage.getCoreSubjectName(title);
    }

    getCanonicalCourseName(examTitle) {
        const coreName = this.getCoreSubjectName(examTitle);
        // Step 1: Check against known courses using intelligent fuzzy match
        if (this.courses && this.courses.length > 0) {
            const matchedCourse = this.courses.find(c => storage.isFuzzyMatch(c.title, coreName));
            if (matchedCourse) return matchedCourse.title; // Return canonical name so grouping works perfectly
        }
        
        // Step 2: Fallback to standard baseline if no course is defined yet
        return storage.normalizeCourseName(coreName);
    }

    async autoAssignMoeds() {
        console.log("[AutoMoed] Running autoAssignMoeds...");
        // Auto-Moed Assignment based on chronological order per subject
        const groupedBySubject = {};
        this.exams.forEach(exam => {
            const canonicalName = this.getCanonicalCourseName(exam.title);
            if (!groupedBySubject[canonicalName]) groupedBySubject[canonicalName] = [];
            groupedBySubject[canonicalName].push(exam);
        });

        const moedLabels = ['A', 'B', 'C'];
        let needsSave = false;

        for (const [coreName, group] of Object.entries(groupedBySubject)) {
            if (group.length > 1) {
                // sort chronologically with deterministic tie-breakers and TBD fallback
                group.sort((a, b) => {
                    const timeA = a.time === 'TBD' ? '00:00' : a.time;
                    const timeB = b.time === 'TBD' ? '00:00' : b.time;
                    const valA = new Date(`${a.date}T${timeA}`).getTime();
                    const valB = new Date(`${b.date}T${timeB}`).getTime();
                    const isNaNA = isNaN(valA);
                    const isNaNB = isNaN(valB);

                    if (isNaNA && isNaNB) return (a.id || '').localeCompare(b.id || '');
                    if (isNaNA) return 1;
                    if (isNaNB) return -1;
                    if (valA === valB) return (a.id || '').localeCompare(b.id || '');
                    
                    return valA - valB;
                });
                group.forEach((exam, index) => {
                    const assignedMoed = moedLabels[index] || 'C'; // fallback to C if more than 3
                    let updated = false;

                    if (!exam.moed || exam.moed !== assignedMoed) {
                        console.log(`[AutoMoed] Assigning Moed ${assignedMoed} to exam: ${exam.title}`);
                        exam.moed = assignedMoed;
                        updated = true;
                    }

                    if (assignedMoed === 'C' && exam.decisionState !== 'Vaulted' && !exam.isEligibleForSpecial) {
                        console.log(`[AutoMoed] Vaulting Moed C: ${exam.title}`);
                        exam.decisionState = 'Vaulted';
                        updated = true;
                    } else if (assignedMoed !== 'C' && exam.decisionState === 'Vaulted') {
                        // Upgrade out of the vault if Moed logic shifts
                        console.log(`[AutoMoed] Unvaulting Moed ${assignedMoed}: ${exam.title}`);
                        exam.decisionState = 'Pending';
                        updated = true;
                    }

                    if (updated) {
                        needsSave = true;
                    }
                });
            }
        }

        if (needsSave) {
            console.log("[AutoMoed] Saving updated Moeds to storage.");
            // Save updated moeds to storage
            for (const exam of this.exams) {
                await storage.updateExam(exam);
            }
        }
    }

    async toggleChecklistItem(examId, itemId) {
        const exam = this.exams.find(e => e.id === examId);
        if (exam) {
            const item = exam.checklist.find(i => i.id === itemId);
            if (item) {
                item.completed = !item.completed;
                await storage.updateExam(exam);
                await this.syncChecklists(exam.id, exam.checklist);
                this.render();
            }
        }
    }

    async toggleExamTopic(examId, topicIdx, checkboxEl) {
        const exam = this.exams.find(e => e.id === examId);
        if (exam) {
            if (!exam.completedTopics) exam.completedTopics = [];
            const idxPos = exam.completedTopics.indexOf(topicIdx);
            
            const isChecked = checkboxEl ? checkboxEl.checked : (idxPos === -1);
            if (isChecked && idxPos === -1) {
                exam.completedTopics.push(topicIdx);
            } else if (!isChecked && idxPos !== -1) {
                exam.completedTopics.splice(idxPos, 1);
            }
            await storage.updateExam(exam, true);
            
            if (checkboxEl) {
                const card = document.getElementById(`exam-${exam.id}`);
                if (card) {
                    const label = checkboxEl.closest('label');
                    if (label) {
                        label.style.textDecoration = isChecked ? 'line-through' : 'none';
                        label.style.color = isChecked ? 'var(--text-secondary)' : 'var(--text-primary)';
                    }
                    
                    const cleanTitle = storage.normalizeCourseName(this.getCoreSubjectName(exam.title));
                    const course = this.courses ? this.courses.find(c => storage.normalizeCourseName(c.title) === cleanTitle) : null;
                    const totalTopics = course?.topics?.length || 0;
                    const completedCount = exam.completedTopics.length;
                    const progress = totalTopics > 0 ? Math.round((completedCount / totalTopics) * 100) : 0;
                    
                    const pContainer = card.querySelector('.progress-container');
                    if (pContainer) {
                        const pctSpan = pContainer.querySelector('.progress-header span:last-child');
                        if (pctSpan) pctSpan.textContent = `${progress}%`;
                        const fill = pContainer.querySelector('.progress-fill');
                        if (fill) fill.style.width = `${progress}%`;
                    }
                    
                    const details = card.querySelector('details');
                    if (details) {
                        const sumSpan = details.querySelector('summary span');
                        if (sumSpan) sumSpan.textContent = `🎯 Study Checklist (${completedCount}/${totalTopics})`;
                    }
                }
            } else {
                this.render();
            }
        }
    }

    async syncChecklists(baseExamId, newChecklist) {
        console.log(`[Sync] Running syncChecklists for baseExamId: ${baseExamId}`);
        const baseExam = this.exams.find(e => e.id === baseExamId);
        if (!baseExam) {
            console.warn(`[Sync] baseExam not found in this.exams array for ID: ${baseExamId}`);
            return;
        }

        const canonicalTitle = this.getCanonicalCourseName(baseExam.title);
        console.log(`[Sync] Found canonical subject name: "${canonicalTitle}"`);

        let syncedCount = 0;
        for (const exam of this.exams) {
            if (exam.id === baseExamId) continue;

            if (canonicalTitle === this.getCanonicalCourseName(exam.title)) {
                // Deep copy to prevent reference mutation bugs
                exam.checklist = JSON.parse(JSON.stringify(newChecklist));
                await storage.updateExam(exam);
                syncedCount++;
            }
        }
        console.log(`[Sync] Synced checklist to ${syncedCount} other exams.`);
    }

    async deleteExam(id) {
        if (confirm('Are you sure you want to delete this exam?')) {
            await storage.deleteExam(id);

            // If we are currently viewing the Compare Modal and delete one of the cards inside it
            if (this.currentCompareBaseId) {
                const allCompareIds = [this.currentCompareBaseId, ...this.currentCompareConflicts];
                if (allCompareIds.includes(id)) {
                    // Close the modal entirely since the stack is now broken
                    this.closeCompareModal();
                }
            }

            await this.loadExams();
            this.render();
        }
    }

    calculateProgress(checklist) {
        if (!checklist || checklist.length === 0) return 0;
        const completed = checklist.filter(i => i.completed).length;
        return Math.round((completed / checklist.length) * 100);
    }

    getCountdownString(dateStr, timeStr) {
        const effectiveTime = timeStr === 'TBD' ? '00:00' : timeStr;
        const targetDate = new Date(`${dateStr}T${effectiveTime}`);
        const now = new Date();
        const diff = targetDate - now;

        if (isNaN(diff)) return "Invalid Date";
        if (diff <= 0) return "Exam time has passed!";

        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

        if (timeStr === 'TBD') {
            if (days > 0) return `${days} days away`;
            return `Today! (TBD)`;
        }

        if (days > 0) return `${days}d ${hours}h left`;
        if (hours > 0) return `${hours}h ${minutes}m left`;
        return `${minutes}m left`;
    }

    updateAllCountdowns() {
        const countdownElements = document.querySelectorAll('[data-countdown]');
        countdownElements.forEach(el => {
            const date = el.getAttribute('data-date');
            const time = el.getAttribute('data-time');
            el.textContent = this.getCountdownString(date, time);
        });
    }

    isUpcoming(dateStr, timeStr) {
        const target = new Date(`${dateStr}T${timeStr}`);
        if (isNaN(target.getTime())) return false;
        return target > new Date();
    }

    render() {
        try {
            // Clear existing rendering intervals
            Object.values(this.countdownIntervals).forEach(clearInterval);
            this.countdownIntervals = {};

            this.examsGrid.innerHTML = '';
            this.closestExamSection.innerHTML = '';

            if (this.exams.length === 0) {
                this.examsGrid.innerHTML = '<p style="color: var(--text-secondary); grid-column: 1/-1; text-align: center; padding: 40px;">No exams added yet. Click "Add Exam" to get started.</p>';
                return;
            }

            // --- Sequence Context & Advanced Overlap Logic --- //
            let groupedExams = {};
            // Make sure sorting in render uses the stable TBD-safe fallback
            const sortedForLogic = [...this.exams].sort((a, b) => {
                const timeA = a.time === 'TBD' ? '00:00' : a.time;
                const timeB = b.time === 'TBD' ? '00:00' : b.time;
                const valA = new Date(`${a.date}T${timeA}`).getTime();
                const valB = new Date(`${b.date}T${timeB}`).getTime();
                const isNaNA = isNaN(valA);
                const isNaNB = isNaN(valB);

                if (isNaNA && isNaNB) return (a.id || '').localeCompare(b.id || '');
                if (isNaNA) return 1;
                if (isNaNB) return -1;
                if (valA === valB) return (a.id || '').localeCompare(b.id || '');
                return valA - valB;
            });

            sortedForLogic.forEach(exam => {
                let canonicalTitle = this.getCanonicalCourseName(exam.title);
                if (!groupedExams[canonicalTitle]) groupedExams[canonicalTitle] = [];
                groupedExams[canonicalTitle].push(exam);
            });

            // Track overlaps: conflictsMap maps exam ID to an array of conflicting exam IDs
            const conflictsMap = {};
            const validExamsForLogic = sortedForLogic.filter(e => !isNaN(new Date(`${e.date}T${e.time}`).getTime()));

            for (let i = 0; i < validExamsForLogic.length; i++) {
                for (let j = i + 1; j < validExamsForLogic.length; j++) {
                    let e1 = validExamsForLogic[i];
                    let e2 = validExamsForLogic[j];

                    // Compare calendar days explicitly (ignore exact time)
                    let d1 = new Date(`${e1.date}T00:00:00`);
                    let d2 = new Date(`${e2.date}T00:00:00`);
                    let diffDays = Math.abs(d2 - d1) / (1000 * 60 * 60 * 24);

                    let title1 = this.getCanonicalCourseName(e1.title);
                    let title2 = this.getCanonicalCourseName(e2.title);

                    // If exams occur on same day or consecutive days, they conflict
                    if (diffDays <= 1) {
                        if (!conflictsMap[e1.id]) conflictsMap[e1.id] = [];
                        if (!conflictsMap[e2.id]) conflictsMap[e2.id] = [];

                        if (!conflictsMap[e1.id].includes(e2.id)) conflictsMap[e1.id].push(e2.id);
                        if (!conflictsMap[e2.id].includes(e1.id)) conflictsMap[e2.id].push(e1.id);
                    }
                }
            }
            // ---------------------------------------- //

            const closestExam = this.exams.find(e => e.decisionState !== 'Vaulted' && this.isUpcoming(e.date, e.time));

            let closestHTML = '';
            let gridHTML = '';
            let vaultHTML = '';
            const renderedIds = new Set();

            // Pre-calculate which courses have a Vaulted (Moed C / Special) exam
            const coursesWithVault = new Set();
            this.exams.forEach(e => {
                if (e.decisionState === 'Vaulted') {
                    coursesWithVault.add(this.getCanonicalCourseName(e.title));
                }
            });

            // Apply filtering logic
            // Phase 6.5: Filter out TBD exams from the main upcoming view
            let filteredExams = this.exams.filter(e => e.date !== 'TBD');
            
            if (this.currentFilter === 'today') {
                const tzOffset = (new Date()).getTimezoneOffset() * 60000;
                const today = (new Date(Date.now() - tzOffset)).toISOString().split('T')[0];
                filteredExams = filteredExams.filter(e => e.date === today);
            } else if (this.currentFilter === 'week') {
                const today = new Date();
                today.setHours(0,0,0,0);
                const nextWeek = new Date(today);
                nextWeek.setDate(nextWeek.getDate() + 7);
                filteredExams = this.exams.filter(e => {
                    const d = new Date(`${e.date}T00:00:00`);
                    return d >= today && d <= nextWeek;
                });
            } else if (this.currentFilter === 'custom' && (this.filterStartDate.value || this.filterEndDate.value)) {
                const start = this.filterStartDate.value ? new Date(`${this.filterStartDate.value}T00:00:00`) : new Date('1970-01-01');
                const end = this.filterEndDate.value ? new Date(`${this.filterEndDate.value}T23:59:59`) : new Date('2100-01-01');
                filteredExams = this.exams.filter(e => {
                    const d = new Date(`${e.date}T00:00:00`);
                    return d >= start && d <= end;
                });
            }

            filteredExams.forEach(exam => {
                try {
                    if (renderedIds.has(exam.id)) return;

                    const isClosest = closestExam && exam.id === closestExam.id;
                    let canonicalTitle = this.getCanonicalCourseName(exam.title);
                    const hasVaultOption = coursesWithVault.has(canonicalTitle);

                    // Build Sequence Context
                    let group = groupedExams[canonicalTitle] || [];
                    let groupIndex = group.findIndex(e => e.id === exam.id) + 1;
                    let groupMeta = { index: groupIndex, total: group.length };
                    const conflictingIds = conflictsMap[exam.id];
                    let cardHTML = '';

                    // If this exam has conflicts and is chosen as the one to take, handle stacking
                    if (exam.decisionState === 'Taking' && conflictingIds && conflictingIds.length > 0) {
                        // Find all delayed exams that conflict with this main one
                        let delayedExams = [];
                        if (this.resolvingExamIds && this.resolvingExamIds.includes(exam.id)) {
                            // Being newly resolved in memory
                            delayedExams = this.resolvingExamIds
                                .map(id => this.exams.find(e => e.id === id))
                                .filter(e => e && e.decisionState === 'Skipping' && !renderedIds.has(e.id));
                        } else {
                            // Already resolved previously
                            delayedExams = conflictingIds
                                .map(id => this.exams.find(e => e.id === id))
                                .filter(e => e && e.decisionState === 'Skipping' && !renderedIds.has(e.id));
                        }
                        if (delayedExams.length > 0) {
                            cardHTML += `<div class="exam-stack" data-baseid="${exam.id}" data-conflicts="${conflictingIds.join(',')}">`;
                            // Render delayed exams first so they stack fully behind
                            delayedExams.forEach(delayedExam => {
                                let dGroupIndex = group.findIndex(e => e.id === delayedExam.id) + 1;
                                let dGroupMeta = { index: dGroupIndex, total: group.length };
                                cardHTML += this.generateExamCard(delayedExam, false, dGroupMeta, conflictsMap[delayedExam.id], true, false, hasVaultOption);
                                renderedIds.add(delayedExam.id);
                            });
                            // Then render the main focus exam on top
                            cardHTML += this.generateExamCard(exam, isClosest, groupMeta, conflictingIds, false, false, hasVaultOption);
                            cardHTML += `</div>`;
                        } else {
                            cardHTML = this.generateExamCard(exam, isClosest, groupMeta, conflictingIds, false, false, hasVaultOption);
                        }
                    } else if (exam.decisionState === 'Skipping') {
                        // Normally this is handled by the Taking condition above.
                        // If this Skipped exam has a Taking counterpart, wait for the Taking exam to render it in a stack.
                        const hasTakingCounterpart = conflictingIds && conflictingIds.some(id => {
                            const taking = this.exams.find(e => e.id === id);
                            return taking && taking.decisionState === 'Taking';
                        });

                        if (hasTakingCounterpart) {
                            return; // Skip rendering individually, let the counterpart stack it
                        }

                        cardHTML = this.generateExamCard(exam, isClosest, groupMeta, conflictingIds, false, false, hasVaultOption);
                    } else {
                        cardHTML = this.generateExamCard(exam, isClosest, groupMeta, conflictingIds, false, false, hasVaultOption);
                    }

                    renderedIds.add(exam.id);

                    if (exam.decisionState === 'Vaulted') {
                        vaultHTML += this.generateExamCard(exam, false, groupMeta, null, false, false, false);
                    } else if (isClosest) {
                        closestHTML += cardHTML;
                    } else {
                        gridHTML += cardHTML;
                    }
                } catch (itemErr) {
                    console.error("Failed to render individual exam item:", exam, itemErr);
                }
            });

            this.closestExamSection.innerHTML = closestHTML;
            this.examsGrid.innerHTML = gridHTML;
            this.vaultGrid.innerHTML = vaultHTML || '<p style="color: var(--text-secondary); text-align: center; font-size: 0.9rem;">No special dates vaulted right now.</p>';

            // Ensure countdowns are updated immediately
            this.updateAllCountdowns();
            this.bindCardEvents();
        } catch (globalErr) {
            console.error("Critical rendering error:", globalErr);
            if (this.examsGrid) {
                this.examsGrid.innerHTML = `<p style="color: var(--danger-color); padding: 20px; text-align: center; grid-column: 1/-1;">A critical error occurred while rendering the dashboard. Some data might be corrupted. Check the console for details.</p>`;
            }
        }
    }

    bindCardEvents(container = document) {
        container.querySelectorAll('.delete-exam-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation(); // Prevent opening the Compare Modal if inside a stack
                const id = e.currentTarget.dataset.id;
                this.deleteExam(id);
            });
        });

        container.querySelectorAll('.edit-exam-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation(); // Prevent opening the Compare Modal if inside a stack
                const id = e.currentTarget.dataset.id;
                this.openEditModal(id);
            });
        });

        container.querySelectorAll('.topic-check-input').forEach(input => {
            input.addEventListener('change', (e) => {
                e.stopPropagation();
                const examId = e.target.dataset.examid;
                const topicIdx = parseInt(e.target.dataset.topicidx, 10);
                this.toggleExamTopic(examId, topicIdx, e.target);
            });
        });

        container.querySelectorAll('.open-resolve-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const baseId = e.currentTarget.dataset.baseid;
                const conflictsStr = e.currentTarget.dataset.conflicts;
                this.openConflictModal(baseId, conflictsStr);
            });
        });

        // Lift Interaction: Click stack to open Compare Modal
        container.querySelectorAll('.exam-stack').forEach(stack => {
            stack.addEventListener('click', () => {
                const baseId = stack.dataset.baseid;
                const conflictsStr = stack.dataset.conflicts;
                if (baseId && conflictsStr) {
                    this.openCompareModal(baseId, conflictsStr.split(','));
                }
            });
        });
    }

    async resetConflict(baseId, conflictingIdsStr) {
        const conflictIds = conflictingIdsStr ? conflictingIdsStr.split(',') : [];
        const resolvingExamIds = [baseId, ...conflictIds].filter(Boolean);

        for (const id of resolvingExamIds) {
            const exam = this.exams.find(e => e.id === id);
            if (exam) {
                exam.decisionState = 'Pending';
                await this.handleMoedCSync(exam, 'Pending');
                await storage.updateExam(exam);
            }
        }

        await this.loadExams();
        this.render();
    }

    async handleMoedCSync(exam, newDecisionState) {
        let canonicalTitle = this.getCanonicalCourseName(exam.title);

        if (newDecisionState === 'Skipping') {
            // Find if there's a corresponding Moed C that is currently Vaulted
            const vaultedExam = this.exams.find(e => e.decisionState === 'Vaulted' && this.getCanonicalCourseName(e.title) === canonicalTitle);

            if (vaultedExam) {
                vaultedExam.decisionState = 'Pending';
                vaultedExam.isEligibleForSpecial = true;
                await storage.updateExam(vaultedExam);
                this.showToast(`Special Eligibility triggered! ${vaultedExam.title} unlocked from Vault.`);
            }
        } else if (newDecisionState === 'Taking' || newDecisionState === 'Pending') {
            // Re-vault if it was previously extracted
            const extractedExam = this.exams.find(e => e.isEligibleForSpecial && e.decisionState !== 'Vaulted' && this.getCanonicalCourseName(e.title) === canonicalTitle);

            if (extractedExam) {
                extractedExam.decisionState = 'Vaulted';
                extractedExam.isEligibleForSpecial = false;
                await storage.updateExam(extractedExam);
                this.showToast(`Conflict resolved differently. ${extractedExam.title} returned to Vault.`);
            }
        }
    }

    showToast(message) {
        // Remove any existing toasts to prevent doubling when bidirectional sync hits twice
        const existingToasts = document.querySelectorAll('.ui-toast');
        existingToasts.forEach(t => t.remove());

        let toast = document.createElement('div');
        toast.className = 'ui-toast';
        toast.innerHTML = `<i class='bx bxs-star'></i> <span>${message}</span>`;
        document.body.appendChild(toast);

        // Trigger reflow for animation
        void toast.offsetWidth;
        toast.classList.add('show');

        setTimeout(() => {
            if (document.body.contains(toast)) {
                toast.classList.remove('show');
                setTimeout(() => {
                    if (document.body.contains(toast)) toast.remove();
                }, 300);
            }
        }, 4000);
    }

    async switchConflict(baseId, conflictIds) {
        const resolvingExamIds = [baseId, ...conflictIds].filter(Boolean);

        for (const id of resolvingExamIds) {
            const exam = this.exams.find(e => e.id === id);
            if (exam && (exam.decisionState === 'Taking' || exam.decisionState === 'Skipping')) {
                // Swap the statuses
                exam.decisionState = exam.decisionState === 'Taking' ? 'Skipping' : 'Taking';
                await this.handleMoedCSync(exam, exam.decisionState);
                await storage.updateExam(exam);
            }
        }

        await this.loadExams();
        this.render(); // Update background main UI

        // Instantly refresh the modal cards to show the new state
        if (this.compareModal.classList.contains('active')) {
            this.openCompareModal(this.currentCompareBaseId, this.currentCompareConflicts);
        }
    }

    generateExamCard(exam, isHighlighted = false, groupMeta = null, conflictingIds = null, isStackedBehind = false, isCompareView = false, hasVaultOption = false) {
        const canonicalTitle = this.getCanonicalCourseName(exam.title);
        const course = this.courses ? this.courses.find(c => c.title === canonicalTitle) : null;
        const courseTopics = course?.topics || [];
        
        if (!exam.completedTopics) exam.completedTopics = [];
        const totalTopics = courseTopics.length;
        const completedCount = exam.completedTopics.length;
        const progress = totalTopics > 0 ? Math.round((completedCount / totalTopics) * 100) : 0;

        // State detection
        let isUnresolvedConflict = conflictingIds && conflictingIds.length > 0 && (!exam.decisionState || exam.decisionState === 'Pending');
        let cardClass = isHighlighted ? 'exam-card highlighted' : 'exam-card';
        if (isUnresolvedConflict) {
            cardClass += ' overlap';
        }
        if (exam.decisionState === 'Skipping') {
            cardClass += ' delayed';
        }
        if (isStackedBehind) {
            cardClass += ' stacked-behind';
        }

        // Format date gracefully
        const effectiveTime = exam.time === 'TBD' ? '00:00' : exam.time;
        const dateObj = new Date(`${exam.date}T${effectiveTime}`);
        let formattedDate = exam.date;
        let formattedTime = exam.time;

        if (!isNaN(dateObj.getTime())) {
            formattedDate = dateObj.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
            if (exam.time !== 'TBD') {
                formattedTime = dateObj.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
            }
        }

        // Moed Badge
        let moedHTML = exam.moed ? `<span class="moed-badge">Moed ${exam.moed}</span>` : '';

        // Sequence Context (Removed redundant 'Exam 1 of 2' as requested by user)
        let sequenceStr = '';

        // Conflict & Decision State HTML
        let stateHTML = '';
        if (exam.decisionState === 'Taking') {
            stateHTML = `<div class="badge-attending" style="margin-bottom:8px;"><i class='bx bxs-check-circle'></i> Taking</div>`;
        } else if (exam.decisionState === 'Skipping') {
            stateHTML = `<div class="badge-special" style="margin-bottom:8px;"><i class='bx bx-time-five'></i> Skipping (Moed B/Special)</div>`;
        } else if (isUnresolvedConflict) {
            stateHTML = `
                <div style="margin-bottom: 12px;">
                    <div class="badge-overlap" title="Overlap detected. Choose one to attend; the other may be eligible for a Special Date (Moed C). Priority should be given to a repeating mandatory course.">
                        <i class='bx bx-error'></i> Overlap Detected
                    </div>
                    <button class="resolve-btn open-resolve-btn" data-baseid="${exam.id}" data-conflicts="${conflictingIds.join(',')}">Resolve Conflict</button>
                </div>
            `;
        }

        // Force consistent title formatting for the UI and escape HTML to prevent XSS
        let displayTitle = this.escapeHTML(exam.title.replace(/(?:-?\s*(?:מועד|moed)\s*[אבגa-c])/gi, '').replace(/[\s\-_]+/g, ' ').trim());

        // Mini Label for Stacked Back Cards
        let miniLabelHTML = '';
        if (isStackedBehind) {
            miniLabelHTML = `<div class="stacked-mini-label">${displayTitle}</div>`;
        }

        return `
            <div class="${cardClass}" id="exam-${exam.id}">
                ${miniLabelHTML}
                <div class="card-header">
                    <div style="width: 100%;">
                        <h3 class="exam-title">${displayTitle} ${moedHTML}</h3>
                        <div class="exam-date-time">
                            <span><i class='bx bx-calendar'></i> ${formattedDate}</span>
                            <span><i class='bx bx-time'></i> ${formattedTime}</span>
                        </div>
                    </div>
                    <div class="card-actions">
                        <button class="icon-btn edit-btn edit-exam-btn" title="Edit Exam" data-id="${exam.id}">
                            <i class='bx bx-edit-alt'></i>
                        </button>
                        <button class="icon-btn danger-btn delete-exam-btn" title="Delete Exam" data-id="${exam.id}">
                            <i class='bx bx-trash'></i>
                        </button>
                    </div>
                </div>

                ${sequenceStr}
                ${stateHTML}

                <div class="countdown" data-countdown="true" data-date="${exam.date}" data-time="${exam.time}">
                    ${this.getCountdownString(exam.date, exam.time)}
                </div>

                ${courseTopics.length > 0 ? `
                    <div class="progress-container" style="margin-top: 16px;">
                        <div class="progress-header" style="display: flex; justify-content: space-between; font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 6px; font-weight: 500;">
                            <span>Study Progress</span>
                            <span style="color: var(--secondary-color); font-weight: 700;">${progress}%</span>
                        </div>
                        <div class="progress-bar" style="background: rgba(255, 255, 255, 0.1); border-radius: 4px; height: 6px; overflow: hidden;">
                            <div class="progress-fill" style="width: ${progress}%; background: var(--secondary-color); height: 100%; transition: width 0.3s ease;"></div>
                        </div>
                    </div>

                    <details style="padding: 12px; background: rgba(255, 255, 255, 0.02); border: 1px solid var(--border-color); border-radius: 8px; margin-top: 16px;">
                        <summary style="cursor: pointer; font-size: 0.85rem; font-weight: 600; color: var(--text-primary); user-select: none; display: flex; align-items: center; justify-content: space-between;">
                            <span>🎯 Study Checklist (${completedCount}/${totalTopics})</span>
                            <i class='bx bx-chevron-down' style="color: var(--text-secondary);"></i>
                        </summary>
                        <div style="margin-top: 12px; display: flex; flex-direction: column; gap: 8px;">
                            ${courseTopics.map((topic, idx) => {
                                const isChecked = exam.completedTopics.includes(idx);
                                const checkAttr = isChecked ? 'checked' : '';
                                const txtColor = isChecked ? 'var(--text-secondary)' : 'var(--text-primary)';
                                const txtDeco = isChecked ? 'line-through' : 'none';
                                
                                return '<label style="display: flex; align-items: flex-start; gap: 10px; font-size: 0.85rem; color: ' + txtColor + '; cursor: pointer; text-decoration: ' + txtDeco + '; line-height: 1.4;">' +
                                    '<input type="checkbox" class="topic-check-input" data-examid="' + exam.id + '" data-topicidx="' + idx + '" ' + checkAttr + ' style="accent-color: var(--secondary-color); width: 16px; height: 16px; min-width: 16px; cursor: pointer; margin-top: 2px;">' +
                                    '<span>' + this.escapeHTML(topic) + '</span>' +
                                '</label>';
                            }).join('')}
                        </div>
                    </details>
                ` : `
                    <div style="padding: 12px; background: rgba(255,255,255,0.02); border-radius: 8px; border: 1px dotted var(--border-color); text-align: center; margin-top: 16px;">
                        <p style="font-size: 0.8rem; color: var(--text-secondary); margin: 0;">Syllabus topics not available.</p>
                    </div>
                `}
            </div>
        `;
    }


}

// Initialize and export to window for inline HTML onclick handlers
document.addEventListener('DOMContentLoaded', () => {
    window.app = new App();
});
