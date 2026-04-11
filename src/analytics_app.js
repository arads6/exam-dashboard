import { storage } from './storage.js';
import { GradeEngine } from './analytics/grade_engine.js';
import { ImportEngine } from './analytics/import_engine.js';
import { CourseMatcher } from './utils/course_matcher.js';

class AnalyticsApp {
    constructor() {
        this.addBtn = document.getElementById('add-course-btn');
        this.modal = document.getElementById('course-modal');
        this.closeModalBtn = document.getElementById('close-course-modal-btn');
        this.form = document.getElementById('course-form');
        this.courseTitleInput = document.getElementById('course-title');
        this.coursesGrid = document.getElementById('courses-grid');
        this.coursesEmptyState = document.getElementById('courses-empty-state');
        this.exemptionsSection = document.getElementById('exemptions-section');
        this.exemptionsGrid = document.getElementById('exemptions-grid');
        this.courseNekazInput = document.getElementById('course-nekaz');
        this.courseGradeInput = document.getElementById('course-grade');
        this.courseMatchFeedback = document.getElementById('course-match-feedback');
        this.saveCourseSubmitBtn = document.getElementById('save-course-btn');
        
        // Sidebar and Empty State Buttons
        this.addBtnEmpty = document.getElementById('add-course-empty-btn'); 
        this.coursesEmptyState = document.getElementById('courses-empty-state');
        this.unassignedContainer = document.getElementById('nekaz-action-section');
        this.unassignedList = document.getElementById('nekaz-action-list');

        // Summary Card Elements
        this.summaryGpa = document.getElementById('summary-gpa');
        this.summaryCredits = document.getElementById('summary-credits');
        this.summaryPending = document.getElementById('summary-pending');
        this.summaryCourses = document.getElementById('summary-courses');
        this.unassignedCount = document.getElementById('unassigned-count');

        // Grade Builder Modal Elements
        this.gradeModal = document.getElementById('grade-builder-modal');
        this.closeGradeModalBtn = document.getElementById('close-grade-builder-btn');
        this.addComponentBtn = document.getElementById('add-component-btn');
        this.saveGradeSetupBtn = document.getElementById('save-grade-setup-btn');
        this.gradeComponentsList = document.getElementById('grade-components-list');
        this.totalWeightDisplay = document.getElementById('total-weight-display');
        this.gradeBuilderCourseNameInput = document.getElementById('grade-builder-course-name-input');
        this.gradeBuilderNekaz = document.getElementById('grade-builder-nekaz');
        
        // Phase 11.3: Settings UI
        this.settingsModal = document.getElementById('dashboard-settings-modal');
        this.closeSettingsBtn = document.getElementById('close-settings-modal-btn');
        this.saveSettingsBtn = document.getElementById('save-settings-btn');
        this.prefEnglishExemption = document.getElementById('pref-english-exemption');

        this.currentEditingCourseId = null;
        this.tempComponents = [];

        this.courses = [];
        this.exams = [];
        this.analyticsModule = null;

        // Phase 9: Simulation State
        this.simulationMode = false;
        this.simulationState = [];
        this.autoSaveTimeout = null;

        this.trendChart = null;
        this.targetCredits = parseInt(localStorage.getItem('targetCredits')) || 120;

        // Phase 10: Import Engine UI
        this.importModal = document.getElementById('magic-import-modal');
        this.openImportBtn = document.getElementById('magic-import-btn');
        this.closeImportBtn = document.getElementById('close-import-modal-btn');
        this.importTextarea = document.getElementById('magic-import-textarea');
        this.importPreviewList = document.getElementById('import-preview-list');
        this.importCountBadge = document.getElementById('import-count-badge');
        this.commitImportBtn = document.getElementById('commit-import-btn');
        this.importTimeout = null;
        this.stagedImports = [];

        // Phase 10.5: BroadcastChannel for instant triggering on already-open tabs
        this.syncChannel = new BroadcastChannel('student_os_sync');
        this.syncChannel.onmessage = (event) => {
            if (event.data.type === 'SYNC_GRADES_SUCCESS') {
                console.log("Analytics App: Broadcast received! Triggering Import UI...");
                this.triggerGradeImport(event.data.data);
            }
        };

        this.selectedIds = new Set();
        this.isSelectionMode = false;
        this.isSyncing = false; // Phase 11: Sync Lock
        this.isProcessingSyllabus = false; // Phase 11.14

        // Identity Resolution Modal (Phase 11.14)
        this.identityModal = document.getElementById('identity-modal');
        this.closeIdentityBtn = document.getElementById('close-identity-btn');
        this.mergeIdentityBtn = document.getElementById('merge-identity-btn');
        this.newIdentityBtn = document.getElementById('new-identity-btn');
        this.cancelIdentityBtn = document.getElementById('cancel-identity-btn');
        this.syllabusCourseNameLabel = document.getElementById('syllabus-course-name');
        this.matchedCourseNameLabel = document.getElementById('matched-course-name');
        this.pendingAgentResponse = null;
        this.pendingMatchedCourse = null;

        this.prefs = JSON.parse(localStorage.getItem('student_os_prefs') || '{}');
        this.init();
    }

    async init() {
        console.log("APP: Initializing Analytics Hub logic...");
        this.checkPostBox(); // Priority 1: Check mailbox before anything else
        
        try {
            this.analyticsModule = await import('./analytics/index.js');
        } catch(e) {
            console.warn("Analytics logic module missing:", e);
        }

        // Phase 9: Inject Simulation Toggle UI into Header
        const header = document.querySelector('.app-header');
        if (header) {
            const toggleWrapper = document.createElement('div');
            toggleWrapper.style.cssText = 'display: flex; align-items: center; gap: 8px; margin-top: 16px; padding: 12px; background: var(--surface-color); border: 1px solid var(--border-color); border-radius: 8px; width: fit-content;';
            toggleWrapper.innerHTML = `
                <i class='bx bx-flask' style="font-size: 1.2rem; color: var(--text-secondary);"></i>
                <span id="sim-mode-label" style="font-size: 0.9rem; font-weight: 500; margin-right: 8px; color: var(--text-secondary);">Simulation: <strong style="color:var(--text-primary)">OFF</strong></span>
                <label class="switch" style="position: relative; display: inline-block; width: 44px; height: 24px;">
                    <input type="checkbox" id="sim-mode-toggle" style="opacity: 0; width: 0; height: 0;">
                    <span class="slider round" style="position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: var(--border-color); transition: .4s; border-radius: 24px;"></span>
                </label>
                <button id="clear-library-btn" class="secondary-btn" style="margin-left: 16px; border-color: rgba(207, 102, 121, 0.3); color: #cf6679; padding: 4px 10px; font-size: 0.8rem; display: flex; align-items: center; gap: 4px;">
                    <i class='bx bx-trash' style="font-size: 0.9rem;"></i> Clear Library
                </button>
                <button id="selection-toggle-btn" class="secondary-btn" style="margin-left: 12px; border-color: var(--text-secondary); color: var(--text-secondary); padding: 4px 12px; font-size: 0.8rem; font-weight: 600; display: flex; align-items: center; gap: 4px; border-radius: 6px;">
                    <i class='bx bx-check-square'></i> Select
                </button>
                <button id="select-all-toggle-btn" class="secondary-btn" style="display: none; margin-left: 8px; border-color: var(--text-secondary); color: var(--text-secondary); padding: 4px 12px; font-size: 0.8rem; font-weight: 600; align-items: center; gap: 4px; border-radius: 6px;">
                    <i class='bx bx-list-check'></i> Select All
                </button>
                <button id="delete-selected-btn" class="secondary-btn" style="display: none; margin-left: 12px; border-color: #cf6679; background: rgba(207, 102, 121, 0.05); color: #cf6679; padding: 4px 12px; font-size: 0.8rem; font-weight: 600; align-items: center; gap: 4px; border-radius: 6px;">
                    <i class='bx bx-check-double'></i> Delete Selected (<span id="selected-count">0</span>)
                </button>
                <div style="flex: 1;"></div>
                <button id="open-settings-btn" class="icon-btn" style="color: var(--text-secondary); font-size: 1.4rem; padding: 8px; transition: all 0.2s;" title="Dashboard Settings">
                    <i class='bx bx-cog'></i>
                </button>
            `;
            header.appendChild(toggleWrapper);

            // Simulation Control Bar injected into App Container
            const controlBar = document.createElement('div');
            controlBar.id = 'sim-control-bar';
            controlBar.style.cssText = 'display: none; justify-content: space-between; align-items: center; background: rgba(255, 152, 0, 0.05); border: 1px solid rgba(255, 152, 0, 0.3); padding: 12px 24px; border-radius: 8px; margin-bottom: 24px;';
            controlBar.innerHTML = `
                <div style="display: flex; align-items: center; gap: 8px; color: #ff9800; font-weight: 500;">
                    <i class='bx bx-info-circle'></i> Simulation Mode: Changes are temporary.
                </div>
                <div style="display: flex; gap: 12px;">
                    <button id="sim-reset-btn" class="secondary-btn" style="border-color: rgba(255,152,0,0.5); color: #ff9800;">Reset</button>
                    <button id="sim-commit-btn" class="primary-btn" style="background: #ff9800; color: #000; border: none;">Commit Changes</button>
                </div>
            `;
            header.parentNode.insertBefore(controlBar, header.nextSibling);

            document.getElementById('sim-reset-btn').addEventListener('click', () => {
                this.simulationState = JSON.parse(JSON.stringify(this.courses)); // reload from persistent
                this.render();
            });

            document.getElementById('sim-commit-btn').addEventListener('click', async () => {
                if (confirm("Save these simulated grades as your actual scores?")) {
                    for (const course of this.simulationState) {
                        await storage.updateCourse(course);
                    }
                    await this.loadData();
                    document.getElementById('sim-mode-toggle').click(); // toggle off seamlessly
                }
            });

            document.getElementById('sim-mode-toggle').addEventListener('change', (e) => {
                this.simulationMode = e.target.checked;
                if (this.simulationMode) {
                    this.simulationState = JSON.parse(JSON.stringify(this.courses)); // Fork state
                    document.body.classList.add('simulation-active-body');
                    document.getElementById('sim-mode-label').innerHTML = `Simulation: <strong style="color:#ff9800">ON</strong>`;
                    document.getElementById('sim-control-bar').style.display = 'flex';
                } else {
                    document.body.classList.remove('simulation-active-body');
                    document.getElementById('sim-mode-label').innerHTML = `Simulation: <strong style="color:var(--text-primary)">OFF</strong>`;
                    document.getElementById('sim-control-bar').style.display = 'none';
                }
                this.render();
            });

            document.getElementById('clear-library-btn')?.addEventListener('click', () => {
                this.handleClearAllCourses();
            });

            document.getElementById('delete-selected-btn')?.addEventListener('click', () => {
                this.handleDeleteSelected();
            });

            document.getElementById('selection-toggle-btn')?.addEventListener('click', () => {
                this.toggleSelectionMode();
            });

            document.getElementById('select-all-toggle-btn')?.addEventListener('click', () => {
                this.handleSelectAllToggle();
            });
        }

        // STAGE 7.5: Inject Global CSS for UI Polish
        const style = document.createElement('style');
        style.textContent = `
            /* Hide number input spinners */
            input::-webkit-outer-spin-button,
            input::-webkit-inner-spin-button {
                -webkit-appearance: none;
                margin: 0;
            }
            input[type=number] {
                -moz-appearance: textfield;
            }
            
            /* Actionable Credits Hover */
            .credit-badge-actionable {
                cursor: pointer;
                transition: all 0.2s;
                padding: 2px 6px;
                border-radius: 4px;
            }
            .credit-badge-actionable:hover {
                background: rgba(187, 134, 252, 0.15);
                color: var(--primary-color) !important;
            }
            .trash-btn {
                position: absolute;
                top: 12px;
                right: 12px;
                z-index: 5;
                font-size: 1rem;
                padding: 6px;
                border: 1px solid transparent;
                border-radius: 6px;
                color: var(--text-secondary);
                transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
                opacity: 0.2;
                background: transparent;
            }
            .course-card:hover .trash-btn {
                opacity: 0.8;
            }
            .trash-btn:hover {
                color: #cf6679 !important;
                background: rgba(207, 102, 121, 0.1) !important;
                border-color: rgba(207, 102, 121, 0.2) !important;
                opacity: 1 !important;
            }
            .course-select-check {
                position: absolute;
                top: 14px;
                left: 14px;
                z-index: 10;
                width: 18px;
                height: 18px;
                cursor: pointer;
                accent-color: var(--primary-color);
                border: 2px solid var(--border-color);
                border-radius: 4px;
                background: var(--surface-color);
                transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1);
            }
            .course-select-check:hover {
                transform: scale(1.1);
            }
            .course-select-check:checked {
                opacity: 1;
                background: var(--primary-color);
            }
            .conflict-select {
                background: rgba(255, 183, 77, 0.05);
                border: 1px solid rgba(255, 183, 77, 0.3);
                color: #ffb74d;
                font-size: 0.75rem;
                padding: 2px 6px;
                border-radius: 4px;
                cursor: pointer;
                outline: none;
            }
            .conflict-select:focus {
                border-color: #ffb74d;
            }
            /* Phase 9 Polish for Grade Inputs */
            .comp-grade-input {
                transition: all 0.3s ease;
            }
            .comp-grade-input:focus {
                outline: none;
                border-color: var(--primary-color) !important;
                box-shadow: 0 0 8px rgba(187, 134, 252, 0.4);
            }
            .simulation-active-body .comp-grade-input:focus {
                border-color: #ff9800 !important;
                box-shadow: 0 0 8px rgba(255, 152, 0, 0.4) !important;
            }
            /* Toggle Switch CSS */
            .slider:before {
                position: absolute; content: ""; height: 18px; width: 18px; left: 3px; bottom: 3px; background-color: white; transition: .4s; border-radius: 50%;
            }
            input:checked + .slider { background-color: #ff9800; }
            input:checked + .slider:before { transform: translateX(20px); }
            
            @keyframes pulseAmber {
                0% { box-shadow: 0 0 0 0 rgba(255, 152, 0, 0.4); }
                70% { box-shadow: 0 0 0 15px rgba(255, 152, 0, 0); }
                100% { box-shadow: 0 0 0 0 rgba(255, 152, 0, 0); }
            }
            .simulation-active-body .gpa-circle {
                animation: pulseAmber 2s infinite;
                border-color: #ff9800 !important;
            }
            .simulation-active-body .app-header {
                border-bottom: 2px solid #ff9800;
                box-shadow: 0 4px 20px rgba(255, 152, 0, 0.1);
            }
            .simulation-glow {
                color: #ff9800 !important;
                text-shadow: 0 0 8px rgba(255, 152, 0, 0.4);
            }
            .simulation-active-body #degree-progress-fill {
                background-color: #ff9800 !important;
                box-shadow: 0 0 12px rgba(255, 152, 0, 0.5);
            }
            .fade-out-exit {
                opacity: 0;
                transform: translateX(20px);
                max-height: 0;
                margin-top: 0 !important;
                margin-bottom: 0 !important;
                padding-top: 0 !important;
                padding-bottom: 0 !important;
                overflow: hidden;
                transition: all 0.4s ease;
                pointer-events: none;
            }
        `;
        document.head.appendChild(style);

        this.bindEvents();
        this.bindIdentityEvents(); // Phase 11.14
        
        // Phase 9.2: Target Credits Input Link
        const tcInput = document.getElementById('target-credits-input');
        if (tcInput) {
            tcInput.value = this.targetCredits;
            tcInput.addEventListener('change', (e) => {
                const val = parseInt(e.target.value);
                if (val > 0) {
                    this.targetCredits = val;
                    localStorage.setItem('targetCredits', val);
                    this.updateGlobalGPA(); // trigger progress bar re-render
                }
            });
        }
        
        await this.loadData();
    }

    bindEvents() {
        const openModal = () => {
            this.courseTitleInput.value = '';
            this.courseNekazInput.value = '';
            if (this.courseGradeInput) this.courseGradeInput.value = '';
            if (this.courseMatchFeedback) {
                this.courseMatchFeedback.style.display = 'none';
                this.courseMatchFeedback.innerHTML = '';
            }
            if (this.saveCourseSubmitBtn) this.saveCourseSubmitBtn.textContent = 'Add New Course';
            this.modal.classList.add('active');
        };

        if (this.courseTitleInput) {
            this.courseTitleInput.addEventListener('input', (e) => this.handleCourseTitleInput(e));
        }

        if (this.addBtn) this.addBtn.addEventListener('click', openModal);
        const addCourseBtnHeader = document.getElementById('add-course-btn');
        if (addCourseBtnHeader) addCourseBtnHeader.addEventListener('click', openModal);
        if (this.addBtnEmpty) this.addBtnEmpty.addEventListener('click', openModal);

        this.closeModalBtn.addEventListener('click', () => {
            this.modal.classList.add('closing');
            setTimeout(() => {
                this.modal.classList.remove('active', 'closing');
            }, 200);
        });

        this.form.addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.handleCourseSubmit();
        });

        // Grade Builder Events
        const deleteCourseBtn = document.getElementById('delete-course-from-modal-btn');
        if (deleteCourseBtn) {
            deleteCourseBtn.addEventListener('click', async () => {
                const courseTitle = this.courses.find(c => c.id === this.currentEditingCourseId)?.title || 'this course';
                if (confirm(`⚠️ Delete ${courseTitle} permanently?\n\nAll syllabus data and grade history will be lost.`)) {
                    this.courses = this.courses.filter(c => c.id !== this.currentEditingCourseId);
                    await storage.deleteCourse(this.currentEditingCourseId);
                    this.gradeModal.classList.remove('active');
                    this.render();
                    this.updateGlobalGPA();
                    this.showToast(`🗑️ Course deleted.`);
                }
            });
        }

        this.closeGradeModalBtn.addEventListener('click', () => {
            this.gradeModal.classList.remove('active');
        });

        this.addComponentBtn.addEventListener('click', () => {
            this.tempComponents.push({ name: '', weight: 0, isShield: false, score: null, minPassGrade: GradeEngine.DEFAULT_MIN_PASS_GRADE });
            this.renderGradeBuilderList();
        });

        this.saveGradeSetupBtn.addEventListener('click', async () => {
            await this.saveGradeSetup();
        });

        window.addEventListener('click', (e) => {
            if (e.target === this.modal) {
                this.modal.classList.add('closing');
                setTimeout(() => {
                    this.modal.classList.remove('active', 'closing');
                }, 200);
            }
            if (e.target === this.gradeModal) {
                this.gradeModal.classList.remove('active');
            }
        });

        // Critical Fix: Cross-tab Data Synchronization
        window.addEventListener('storage', (e) => {
            if (e.key === 'student_os_data') {
                clearTimeout(this.syncTimeout);
                this.syncTimeout = setTimeout(() => {
                    this.loadData();
                }, 50);
            }
            if (e.key === 'STUDENT_OS_PENDING_SYLLABUS') {
                console.log("ANALYTICS: Syllabus storage event detected!");
                this.checkPostBox();
            }
        });

        // Sync for same-tab updates (dispatched from storage.js)
        window.addEventListener('storage_updated', () => {
            clearTimeout(this.syncTimeout);
            this.syncTimeout = setTimeout(() => {
                this.loadData();
            }, 50);
        });

        // Settings Modal Events (Phase 11.3)
        const openSettingsBtn = document.getElementById('open-settings-btn');
        if (openSettingsBtn) {
            openSettingsBtn.addEventListener('click', () => {
                const currentPref = !!this.courses.find(c => c.isExemption && c.title.toLowerCase().includes('english'));
                if (this.prefEnglishExemption) this.prefEnglishExemption.checked = currentPref;
                this.settingsModal.classList.add('active');
            });
        }

        if (this.closeSettingsBtn) {
            this.closeSettingsBtn.addEventListener('click', () => this.settingsModal.classList.remove('active'));
        }

        if (this.saveSettingsBtn) {
            this.saveSettingsBtn.addEventListener('click', async () => {
                const desired = this.prefEnglishExemption.checked;
                this.prefs.englishExemption = desired;
                localStorage.setItem('student_os_prefs', JSON.stringify(this.prefs));
                
                await this.syncEnglishExemption(desired);
                
                this.settingsModal.classList.remove('active');
                this.showToast("⚙️ Preferences saved.");
            });
        }

        this.bindImportEvents();
        
        // Signal to Extension Courier that we are ready to receive any pending data
        window.postMessage({ type: 'STUDENT_OS_APP_READY' }, '*');
    }

    bindIdentityEvents() {
        if (this.closeIdentityBtn) this.closeIdentityBtn.onclick = () => this.closeIdentityModal();
        if (this.cancelIdentityBtn) this.cancelIdentityBtn.onclick = () => this.closeIdentityModal();
        
        if (this.mergeIdentityBtn) {
            this.mergeIdentityBtn.onclick = async () => {
                if (this.pendingAgentResponse) {
                    // Phase 11.18: Get selected candidate from the list
                    const selectedRadio = document.querySelector('input[name="candidate-selection"]:checked');
                    if (!selectedRadio) {
                        this.showToast("⚠️ Please select an existing course to merge into.");
                        return;
                    }
                    
                    const candidateId = selectedRadio.value;
                    const course = this.courses.find(c => c.id === candidateId);
                    
                    if (course) {
                        await this.executeSurgicalMerge(this.pendingAgentResponse, course);
                        this.closeIdentityModal();
                    }
                }
            };
        }

        if (this.newIdentityBtn) {
            this.newIdentityBtn.onclick = async () => {
                if (this.pendingAgentResponse) {
                    await this.executeCreateNewFromSyllabus(this.pendingAgentResponse);
                    this.closeIdentityModal();
                }
            };
        }
    }

    closeIdentityModal() {
        if (this.identityModal) {
            this.identityModal.classList.remove('active');
            this.identityModal.classList.add('closing');
            setTimeout(() => {
                this.identityModal.classList.remove('closing');
            }, 200);
        }
        this.pendingAgentResponse = null;
        this.pendingMatchedCourse = null;
    }

    bindImportEvents() {
        if (!this.importModal) return;

        window.addEventListener('analytics_toast', (e) => {
            if (e.detail) this.showToast(`⚠️ ${e.detail}`);
        });

        window.addEventListener('message', (event) => {
            if (!event.data) return;
            
            switch (event.data.type) {
                case 'GRADE_IMPORT_READY':
                case 'PORTAL_SYNC': // Phase 11.22: Unified message handling
                    console.log("Analytics Hub: Received Extracted Grades payload from Portal/Harvester!");
                    this.triggerGradeImport(event.data.payload, true);
                    break;
                case 'SYLLABUS_IMPORT_READY':
                    if (event.data.source === 'SYLLABUS_EXTENSION') {
                        console.log("Analytics Hub: Syllabus payload detected via message bridge!");
                        this.triggerSyllabusImport(event.data.payload);
                    }
                    break;
            }
        });

        this.openImportBtn.addEventListener('click', () => {
            if (this.importTextarea) {
                this.importTextarea.value = '';
                this.importTextarea.parentElement.style.display = 'block';
                this.importTextarea.parentElement.parentElement.style.gridTemplateColumns = '1fr 1.5fr';
            }
            this.stagedImports = [];
            this.renderImportPreview();
            this.importModal.classList.add('active');
        });

        this.cancelIdentityBtn.addEventListener('click', () => {
             // Phase 11.26 explicitly requested: CLEAR Mailbox upon abort
             window.localStorage.removeItem('STUDENT_OS_PENDING_SYLLABUS');
             this.identityModal.classList.remove('active');
             this.isProcessingSyllabus = false;
             this.showToast("Syllabus logic bypassed. Mailbox cleared.");
        });

        this.closeImportBtn.addEventListener('click', () => {
            this.importModal.classList.remove('active');
            this.isSyncing = false; // Phase 11: Release lock on close
        });

        if (this.importTextarea) {
            this.importTextarea.addEventListener('input', (e) => {
                clearTimeout(this.importTimeout);
                this.importTimeout = setTimeout(() => {
                    const rawText = e.target.value;
                    const candidates = ImportEngine.parseText(rawText);
                    
                    // Cross Reference
                    this.stagedImports = candidates.map(c => {
                        const analysis = CourseMatcher.analyzeMatch(c.title, this.courses);
                        const isAuto = analysis.type === 'auto';
                        const existing = isAuto && analysis.best ? analysis.best.course : null; // Phase 11.22 Guard
                        if (existing) {
                            return { ...c, isDuplicate: true, existingId: existing.id, isConflict: false, selected: false };
                        }
                        return { ...c, isDuplicate: false, isConflict: analysis.type === 'conflict', selected: true };
                    });
                    
                    this.renderImportPreview();
                }, 400); // 400ms debounce
            });
        }

        if (this.commitImportBtn) {
            this.commitImportBtn.addEventListener('click', async () => {
                let added = 0;
                let updated = 0;

                for (const c of this.stagedImports) {
                    if (!c.selected) continue; // Skip unchecked items
                    
                    // Manual Override Logic: Use manualTargetId if provided
                    const targetId = c.manualTargetId || c.existingId;
                    const isManualMerge = !!c.manualTargetId;

                    if (targetId) {
                        const existing = this.courses.find(ex => ex.id === targetId);
                        if (existing) {
                            // SOURCE OF TRUTH: Update officialGrade AND Credits but preserve manual metadata
                            existing.officialGrade = c.officialGrade;
                            existing.nekaz = c.nekaz; // Update weights for GPA accuracy
                            existing.isConfigured = true;
                            existing.isBinary = c.isBinary;
                            
                            if (!existing.gradeComponents || existing.gradeComponents.length === 0) {
                                existing.gradeComponents = [{ name: 'BGU Sync', weight: 100, score: c.score, isShield: false }];
                            }
                            
                            await storage.updateCourse(existing);
                            updated++;
                        }
                    } else {
                        const newCourse = {
                            id: 'course_' + Date.now() + Math.random().toString(36).substring(2, 7),
                            title: c.title,
                            nekaz: parseFloat(c.nekaz) || 0,
                            topics: [],
                            isConfigured: true,
                            isBinary: c.isBinary,
                            officialGrade: c.officialGrade, // Store as Truth
                            gradingPolicy: 'last_counts',
                            minPassGrade: GradeEngine.DEFAULT_MIN_PASS_GRADE,
                            gradeComponents: [{ name: 'BGU Sync', weight: 100, score: c.score, isShield: false }],
                            semester: 'General'
                        };
                        await storage.saveCourse(newCourse);
                        added++;
                    }
                }
                
                this.importModal.classList.remove('active');
                this.isSyncing = false; // Phase 11: Release lock on commit
                await this.loadData();
                this.updateGlobalGPA(); // Ensure everything syncs visually
            });
        }
    }

    triggerGradeImport(payload, isAutoSync = false) {
        if (!payload || !Array.isArray(payload) || this.isSyncing) return;
        
        // Phase 11.5: Enforce strict session guard to prevent extension refresh loops
        if (isAutoSync) {
            if (sessionStorage.getItem('student_os_import_triggered')) {
                window.localStorage.removeItem('STUDENT_OS_PENDING_SYNC');
                return;
            }
            sessionStorage.setItem('student_os_import_triggered', 'true');
        }
        
        this.isSyncing = true; // Phase 11: Activate lock

        this.stagedImports = payload.map(c => {
            // Phase 11.4: Strict Library-only matching for candidates and aggressive unchecking
            const analysis = CourseMatcher.analyzeMatch(c.title, this.courses);
            const isAuto = (analysis.type === 'auto');
            const isConflict = (analysis.type === 'conflict');
            
            // Only auto-matches (including minor discrepancies) are considered 'existing'. 
            // Conflicts (e.g. Micro vs Macro) are fundamentally different courses and MUST NOT be unchecked.
            const existing = isAuto && analysis.best ? analysis.best.course : null; 
            
            // Phase 11.22 Guard: Data Integrity Shield to protect against null reference on minPassGrade
            let threshold = GradeEngine.DEFAULT_MIN_PASS_GRADE;
            if (existing && existing.minPassGrade !== undefined) {
                threshold = existing.minPassGrade;
            }
            
            // Phase 11: Exactly 56 is a pass.
            const isFailing = c.score !== null && c.score < threshold;
            const needsStatusCheck = c.score !== null && c.score >= threshold && c.score < 60;
            
            // Credits Discrepancy detection
            const nekazDiscrepancy = isAuto && existing && Math.abs((existing.nekaz || 0) - (c.nekaz || 0)) > 0.01;
            
            // Binary logic override
            const passStatus = c.isBinary ? false : (isFailing || needsStatusCheck);

            return { 
                ...c, 
                isDuplicate: !!existing, 
                existingId: existing ? existing.id : null, 
                isConflict: isConflict,
                selected: !existing, // Safety: UNCHECK immediately if there is ANY match
                threshold: threshold,
                isFailing: c.isBinary ? false : isFailing,
                needsStatusCheck: passStatus,
                nekazDiscrepancy: nekazDiscrepancy
            };
        });
        
        if (this.importTextarea) {
            this.importTextarea.parentElement.style.display = 'none';
            this.importTextarea.parentElement.parentElement.style.gridTemplateColumns = '1fr';
        }
        
        this.renderImportPreview();
        this.importModal.classList.add('active');
        this.showToast("✅ Grades synced successfully from BGU Portal! Reviewing now...");
    }

    /**
     * Phase 11.14: Native Syllabus Mailbox 
     */
    checkPostBox() {
        console.log("ANALYTICS: Checking mailbox for syllabus...");
        const pendingSyllabus = window.localStorage.getItem('STUDENT_OS_PENDING_SYLLABUS');
        if (pendingSyllabus) {
            console.log("Analytics Hub: Syllabus payload detected! Processing...");
            try {
                window.localStorage.removeItem('STUDENT_OS_PENDING_SYLLABUS');
                const payload = JSON.parse(pendingSyllabus);
                this.triggerSyllabusImport(payload);
            } catch (e) {
                console.error("Mailbox Error:", e);
            }
        }
        const pendingValue = window.localStorage.getItem('STUDENT_OS_PENDING_SYNC');
        if (pendingValue) {
            try {
                const payload = JSON.parse(pendingValue);
                console.log("Analytics Hub: Mailbox hit! Processing pending sync...");
                
                // Allow the UI a small frame to settle before popping the modal
                setTimeout(() => {
                    this.triggerGradeImport(payload.data, true);
                    window.localStorage.removeItem('STUDENT_OS_PENDING_SYNC');
                }, 100);
            } catch (e) {
                console.error("Analytics Hub: Failed to parse sync mailbox:", e);
                window.localStorage.removeItem('STUDENT_OS_PENDING_SYNC');
            }
        }
    }

    renderImportPreview() {
        if (!this.importPreviewList) return;
        this.importPreviewList.innerHTML = '';
        
        let validToCommit = 0;

        if (this.stagedImports.length === 0) {
            this.importPreviewList.innerHTML = `<tr><td colspan="4" style="text-align: center; padding: 40px 20px; color: var(--text-secondary);"><i class='bx bx-paste' style="font-size: 2rem; margin-bottom: 8px; opacity: 0.5;"></i><br>Waiting for input...</td></tr>`;
            if (this.commitImportBtn) {
                this.commitImportBtn.textContent = 'Commit 0 Courses to Library';
                this.commitImportBtn.disabled = true;
            }
            if (this.importCountBadge) this.importCountBadge.textContent = '0 Detected';
            return;
        }

        this.stagedImports.forEach((c, index) => {
            const tr = document.createElement('tr');
            tr.style.borderBottom = '1px solid var(--border-color)';
            
            // Universal Checkbox logic
            const syncHtml = `<input type="checkbox" class="import-row-check" data-index="${index}" ${c.selected ? 'checked' : ''}>`;
            if (c.selected) validToCommit++;
            
            // Drift / Validation Check
            let driftIcon = '';
            if (c.isDuplicate) {
                const existing = this.courses.find(ex => ex.id === c.existingId);
                const computed = GradeEngine.calculateComputedGrade(existing);
                if (computed !== null && c.score !== null) {
                    if (Math.abs(computed - c.score) < 0.1) {
                        driftIcon = `<i class='bx bxs-check-shield' style="color: var(--primary-color); font-size: 1rem;" title="Verified: Matches local breakdown"></i>`;
                    } else {
                        driftIcon = `<i class='bx bx-error-circle' style="color: #ffb74d; font-size: 1rem;" title="Discrepancy: Official ${c.score} vs Computed ${computed}"></i>`;
                    }
                }
            }

            // Contextual Visual Badges
            let badges = '';
            
            // Phase 11.30: UI Term Detection Preview
            const termBadge = `<span style="background: var(--bg-color); border: 1px solid var(--border-color); color: var(--text-secondary); padding: 2px 6px; border-radius: 4px; font-size: 0.7rem; margin-right: 4px;" title="Detected Semester"><i class='bx bx-time-five' style="vertical-align: middle; margin-right: 2px;"></i>${c.term && c.term !== 'General' ? this.escapeHTML(c.term) : 'Unknown'}</span>`;
            badges += termBadge;

            if (c.isDuplicate) badges += `<span style="background: rgba(255, 152, 0, 0.2); color: #ff9800; padding: 2px 6px; border-radius: 4px; font-size: 0.7rem; margin-right: 4px;">Existing Candidate</span>`;
            
            if (c.isConflict) {
                // Task 2: Interactive Dropdown for Manual Matching
                const options = this.courses.map(ex => `<option value="${ex.id}" ${c.manualTargetId === ex.id ? 'selected' : ''}>Merge: ${ex.title}</option>`).join('');
                badges += `
                    <select class="conflict-select" data-index="${index}">
                        <option value="">Add as New Course</option>
                        ${options}
                    </select>
                `;
            } else {
                if (c.isBinary) {
                    badges += `<span style="background: rgba(3, 218, 198, 0.2); color: var(--secondary-color); padding: 2px 6px; border-radius: 4px; font-size: 0.7rem;">Verified Pass</span>`;
                } else if (c.isPending) {
                    badges += `<span style="background: rgba(187, 134, 252, 0.2); color: #bb86fc; padding: 2px 6px; border-radius: 4px; font-size: 0.7rem; margin-right: 4px;">Pending Status</span>`;
                }
                // Phase 11.4: Render ZERO textual badges for numeric grades (failing or low pass).
                // They will rely exclusively on the CSS text/background color of the grade itself.
            }

            tr.innerHTML = `
                <td style="text-align: center; padding: 10px;">${syncHtml}</td>
                <td style="padding: 10px;">
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <div style="font-weight: 500; color: var(--text-primary);">${this.escapeHTML(c.title)}</div>
                        ${driftIcon}
                    </div>
                    <div style="margin-top: 4px;">${badges}</div>
                </td>
                <td style="padding: 10px; font-weight: 500; color: ${c.nekazDiscrepancy ? '#ffb74d' : 'var(--text-secondary)'};" 
                    title="${c.nekazDiscrepancy ? 'Discrepancy: Portal value differs from local' : ''}">
                    ${c.nekaz} ${c.nekazDiscrepancy ? '⚠️' : ''}
                </td>
                <td style="padding: 10px; font-weight: 600; color: ${c.isFailing ? '#cf6679' : (c.needsStatusCheck ? '#ffb74d' : 'var(--text-primary)')};">${c.score !== null ? c.score : '-'}</td>
            `;
            this.importPreviewList.appendChild(tr);
        });

        // Bind Row Checkboxes
        this.importPreviewList.querySelectorAll('.import-row-check').forEach(chk => {
            chk.addEventListener('change', (e) => {
                const idx = e.target.dataset.index;
                this.stagedImports[idx].selected = e.target.checked;
                this.renderImportPreview(); 
            });
        });

        // Bind Conflict Selects
        this.importPreviewList.querySelectorAll('.conflict-select').forEach(sel => {
            sel.addEventListener('change', (e) => {
                const idx = e.target.dataset.index;
                this.stagedImports[idx].manualTargetId = e.target.value;
                this.renderImportPreview();
            });
        });

        // Bind Select All
        const selectAll = document.getElementById('import-select-all');
        if (selectAll) {
            selectAll.onclick = (e) => {
                this.stagedImports.forEach(c => c.selected = e.target.checked);
                this.renderImportPreview();
            };
        }

        if (this.importCountBadge) this.importCountBadge.textContent = `${this.stagedImports.length} Detected`;
        if (this.commitImportBtn) {
            this.commitImportBtn.textContent = `Commit ${validToCommit} Courses to Library`;
            this.commitImportBtn.disabled = validToCommit === 0;
        }
    }

    showToast(message, duration = 3000) {
        let toast = document.getElementById('global-toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'global-toast';
            toast.className = 'ui-toast';
            document.body.appendChild(toast);
        }
        
        toast.innerHTML = `<span style="font-weight: 600;">${message}</span>`;
        
        // Force reflow
        void toast.offsetWidth;
        
        toast.classList.add('show');
        
        if (this.toastTimeout) clearTimeout(this.toastTimeout);
        this.toastTimeout = setTimeout(() => {
            toast.classList.remove('show');
        }, duration);
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

    async loadData() {
        this.isInitialLoad = true;
        this.courses = await storage.getCourses();
        this.exams = await storage.getExams();
        
        // Final UI/UX Polish: render handles summary updates
        this.render();
    }

    async handleCourseSubmit() {
        const title = this.courseTitleInput.value.trim();
        const nekazRaw = this.courseNekazInput.value;
        const gradeRaw = this.courseGradeInput ? this.courseGradeInput.value : '';
        
        if (!title) return;

        const nekaz = parseFloat(nekazRaw) || 0;
        const grade = gradeRaw !== '' ? parseFloat(gradeRaw) : null;

        let normalizedTitle = CourseMatcher.normalize(title);
        let existingCourse = this.courses.find(c => CourseMatcher.normalize(c.title) === normalizedTitle);
        
        if (existingCourse) {
            existingCourse.nekaz = nekaz;
            if (grade !== null) {
                // If a grade is provided manually, ensure a Final Grade component exists
                if (!existingCourse.gradeComponents) existingCourse.gradeComponents = [];
                let finalComp = existingCourse.gradeComponents.find(c => c.name.toLowerCase().includes('final'));
                if (!finalComp) {
                    finalComp = { name: 'Final Grade', weight: 100, isShield: false, score: grade, minPassGrade: GradeEngine.DEFAULT_MIN_PASS_GRADE };
                    existingCourse.gradeComponents.push(finalComp);
                } else {
                    finalComp.score = grade;
                }
                existingCourse.isConfigured = true;
            }
            await storage.updateCourse(existingCourse);
            this.showToast(`✅ ${existingCourse.title} updated.`);
        } else {
            const newCourse = { title, nekaz };
            if (grade !== null) {
                newCourse.gradeComponents = [{ name: 'Final Grade', weight: 100, isShield: false, score: grade, minPassGrade: GradeEngine.DEFAULT_MIN_PASS_GRADE }];
                newCourse.isConfigured = true;
            }
            await storage.saveCourse(newCourse);
            this.showToast(`✨ ${title} added to Library.`);
        }

        this.modal.classList.remove('active');
        await this.loadData();
    }

    handleCourseTitleInput(e) {
        const val = e.target.value.trim();
        if (!val || val.length < 2) {
            if (this.courseMatchFeedback) this.courseMatchFeedback.style.display = 'none';
            if (this.saveCourseSubmitBtn) this.saveCourseSubmitBtn.textContent = 'Add New Course';
            return;
        }

        const match = CourseMatcher.analyzeMatch(val, this.courses);
        
        if (match.type === 'auto') {
            const c = match.course;
            this.courseMatchFeedback.style.display = 'block';
            this.courseMatchFeedback.innerHTML = `
                <div style="color: var(--primary-color); font-weight: 600; margin-bottom: 4px;">
                    <i class='bx bx-check-circle'></i> Found in Library
                </div>
                <div style="color: var(--text-secondary); line-height: 1.4;">
                    Credits: ${c.nekaz || '0'} | Current Grade: ${this.getDisplayGrade(c)}
                </div>
            `;
            this.saveCourseSubmitBtn.textContent = 'Update Existing Course';
            // Optional: Auto-fill nekaz if currently empty
            if (!this.courseNekazInput.value) this.courseNekazInput.value = c.nekaz || '';
        } else {
            // Check Exams if not in library
            const examMatch = this.exams.find(ex => CourseMatcher.normalize(ex.title) === CourseMatcher.normalize(val));
            if (examMatch) {
                this.courseMatchFeedback.style.display = 'block';
                this.courseMatchFeedback.innerHTML = `
                    <div style="color: #ffb74d; font-weight: 600; margin-bottom: 4px;">
                        <i class='bx bx-info-circle'></i> Found in Exam Schedule
                    </div>
                    <div style="color: var(--text-secondary);">This course is on your schedule but not yet in the Library.</div>
                `;
                this.saveCourseSubmitBtn.textContent = 'Add Course to Library';
            } else {
                this.courseMatchFeedback.style.display = 'none';
                this.saveCourseSubmitBtn.textContent = 'Add New Course';
            }
        }
    }

    getDisplayGrade(course) {
        if (!course.gradeComponents || course.gradeComponents.length === 0) return 'N/A';
        const final = course.gradeComponents.find(c => c.name.toLowerCase().includes('final'));
        return final && final.score !== null ? final.score : 'Pending';
    }

    openGradeBuilder(courseId) {
        const course = this.courses.find(c => c.id === courseId);
        if (!course) return;

        this.currentEditingCourseId = courseId;
        if (this.gradeBuilderCourseNameInput) this.gradeBuilderCourseNameInput.value = course.title;
        if (this.gradeBuilderNekaz) this.gradeBuilderNekaz.value = course.nekaz || 0;
        
        // Deep clone components to temp
        this.tempComponents = course.gradeComponents ? JSON.parse(JSON.stringify(course.gradeComponents)) : [];
        
        // Ensure at least one component if empty
        if (this.tempComponents.length === 0) {
            this.tempComponents.push({ name: 'Final Exam', weight: 100, isShield: false, score: null, minPassGrade: GradeEngine.DEFAULT_MIN_PASS_GRADE });
        }

        this.gradeModal.classList.add('active');
        this.renderGradeBuilderList();
    }

    renderGradeBuilderList() {
        this.gradeComponentsList.innerHTML = '';
        let totalWeight = 0;

        this.tempComponents.forEach((comp, index) => {
            totalWeight += parseFloat(comp.weight || 0);
            
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td style="padding: 8px;"><input type="text" class="comp-name" data-index="${index}" value="${this.escapeHTML(comp.name)}" placeholder="e.g. Midterm" style="width: 100%; padding: 6px; background: var(--bg-color); border: 1px solid var(--border-color); color: var(--text-primary); border-radius: 4px;"></td>
                <td style="padding: 8px;"><input type="number" class="comp-weight" data-index="${index}" value="${comp.weight}" min="0" max="100" style="width: 100%; padding: 6px; background: var(--bg-color); border: 1px solid var(--border-color); color: var(--text-primary); border-radius: 4px;"></td>
                <td style="padding: 8px; text-align: center;"><input type="checkbox" class="comp-shield" data-index="${index}" ${comp.isShield ? 'checked' : ''}></td>
                <td style="padding: 8px; text-align: right;"><button class="icon-btn remove-comp-btn" data-index="${index}" style="color: var(--error-color);"><i class='bx bx-trash'></i></button></td>
            `;
            this.gradeComponentsList.appendChild(tr);
        });

        this.totalWeightDisplay.textContent = `${totalWeight}%`;
        this.totalWeightDisplay.style.color = totalWeight === 100 ? 'var(--secondary-color)' : 'var(--error-color)';

        // Bind inner events
        this.gradeComponentsList.querySelectorAll('input').forEach(input => {
            input.addEventListener('change', (e) => {
                const index = e.target.dataset.index;
                if (e.target.classList.contains('comp-name')) {
                    this.tempComponents[index].name = e.target.value;
                } else if (e.target.classList.contains('comp-weight')) {
                    this.tempComponents[index].weight = parseFloat(e.target.value || 0);
                    this.renderGradeBuilderList(); // Re-render to update total weight
                } else if (e.target.classList.contains('comp-shield')) {
                    this.tempComponents[index].isShield = e.target.checked;
                }
            });
        });

        this.gradeComponentsList.querySelectorAll('.remove-comp-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const index = e.target.closest('button').dataset.index;
                this.tempComponents.splice(index, 1);
                this.renderGradeBuilderList();
            });
        });
    }

    async saveGradeSetup() {
        const total = this.tempComponents.reduce((sum, c) => sum + (c.weight || 0), 0);
        if (total !== 100) {
            alert(`Total weight must be exactly 100% (Currently ${total}%).`);
            return;
        }

        const course = this.courses.find(c => c.id === this.currentEditingCourseId);
        if (course) {
            // Phase 11.2: Rename Support
            if (this.gradeBuilderCourseNameInput) {
                course.title = this.gradeBuilderCourseNameInput.value.trim() || course.title;
            }
            if (this.gradeBuilderNekaz) {
                course.nekaz = parseFloat(this.gradeBuilderNekaz.value) || 0;
            }
            course.gradeComponents = this.tempComponents;
            course.isConfigured = true;
            await storage.updateCourse(course);
            this.showToast(`✅ ${course.title} saved.`);
            this.gradeModal.classList.remove('active');
            await this.loadData();
            this.updateGlobalGPA(); // Instant refresh
        }
    }

    async handleComponentGradeUpdate(courseId, compIndex, scoreStr) {
        const score = scoreStr.trim() === '' ? null : parseFloat(scoreStr);
        
        const applyUpdate = (courseObj) => {
            if (courseObj && courseObj.gradeComponents[compIndex]) {
                courseObj.gradeComponents[compIndex].score = score;
                
                // Update specific DOM element without wiping focus
                const finalGrade = GradeEngine.calculateFinalGrade(courseObj);
                const gradePill = document.getElementById(`final-grade-${courseObj.id}`);
                if (gradePill) {
                    if (finalGrade !== null && !isNaN(finalGrade)) {
                        gradePill.innerHTML = `${finalGrade.toFixed(1)}`;
                        gradePill.style.cssText = "font-size: 1.2rem; font-weight: 700; color: var(--secondary-color);";
                    } else {
                        gradePill.innerHTML = "Pending Scores";
                        gradePill.style.cssText = "font-size: 0.75rem; font-weight: 600; color: #ff9800; background: rgba(255,152,0,0.1); padding: 4px 8px; border-radius: 4px; text-transform: uppercase;";
                    }
                }
                this.updateGlobalGPA();
            }
        };

        if (this.simulationMode) {
            const course = this.simulationState.find(c => c.id === courseId);
            applyUpdate(course);
        } else {
            const course = this.courses.find(c => c.id === courseId);
            applyUpdate(course);
            
            if (course) {
                // Phase 9.1: Auto-save debounce without reloading UI data during typing
                clearTimeout(this.autoSaveTimeout);
                this.autoSaveTimeout = setTimeout(async () => {
                    await storage.updateCourse(course);
                }, 1000);
            }
        }
    }

    async updateCourseNekaz(courseId, value) {
        const course = this.courses.find(c => c.id === courseId);
        if (course) {
            course.nekaz = parseFloat(value);
            await storage.updateCourse(course);
            await this.loadData();
        }
    }

    render() {
        if (this.isSyncing || this.isProcessingSyllabus) {
            console.log("APP: Render deferred - Handshake lock active.");
            return;
        }

        if (this._renderDebounce) clearTimeout(this._renderDebounce);
        this._renderDebounce = setTimeout(() => {
            this._executeRender();
        }, 250);
    }

    _executeRender() {
        if (!this.coursesGrid || !this.exemptionsGrid) return;

        this.coursesGrid.innerHTML = '';
        this.exemptionsGrid.innerHTML = '';
        
        const coursesToRender = this.simulationMode ? this.simulationState : this.courses;
        const exemptionCourses = coursesToRender.filter(c => c.isExemption);
        const standardCourses = coursesToRender.filter(c => !c.isExemption);

        // 1. Handle Exemptions Visibility
        if (this.exemptionsSection) {
            this.exemptionsSection.style.display = exemptionCourses.length > 0 ? 'block' : 'none';
        }

        // 2. Handle Regular Empty State
        if (standardCourses.length === 0) {
            this.coursesEmptyState.style.display = 'block';
            this.coursesGrid.style.display = 'none';
        } else {
            this.coursesEmptyState.style.display = 'none';
            this.coursesGrid.style.display = 'grid';
        }

        // 3. Main Render Loop
        coursesToRender.forEach(course => {
            try {
                const targetGrid = course.isExemption ? this.exemptionsGrid : this.coursesGrid;
                const courseTitle = course?.title || 'Untitled Course';
                const courseNekaz = course?.nekaz;
                
                let gradeDisplay = '';
                let actionButton = '';

                if (course.isExemption) {
                    // Exemption Layout: Simple, distinct coloring
                    gradeDisplay = `
                        <div style="background: rgba(79, 172, 254, 0.1); color: var(--secondary-color); font-size: 0.75rem; font-weight: 700; padding: 4px 10px; border-radius: 20px; border: 1px solid rgba(79, 172, 254, 0.3); text-transform: uppercase; letter-spacing: 0.5px;">
                            Academic Exemption
                        </div>
                    `;
                    // Delete button for exemptions
                    actionButton = `
                        <button class="icon-btn delete-exemption-btn" data-courseid="${course.id}" title="Remove Exemption" style="color: var(--error-color); opacity: 0.6;">
                            <i class='bx bx-trash'></i>
                        </button>
                    `;
                } else if (!course.isExemption) {
                    // Standard Course Layout (Always shows Cog and Grade/Pending)
                    const finalGrade = GradeEngine.calculateFinalGrade(course);
                    const computedGrade = GradeEngine.calculateComputedGrade(course);
                    
                    if (finalGrade !== null && !isNaN(finalGrade)) {
                        let statusBadge = '';
                        if (course.officialGrade !== undefined && course.officialGrade !== null) {
                            if (Math.abs(finalGrade - computedGrade) < 0.1) {
                                statusBadge = `<i class='bx bxs-check-shield' title="Verified by University Portal" style="color: var(--primary-color); font-size: 0.9rem; margin-left: 6px;"></i>`;
                            } else {
                                statusBadge = `<i class='bx bx-error-circle' title="Discrepancy: Portal (${finalGrade}) overrides local components" style="color: #ffb74d; font-size: 0.9rem; margin-left: 6px;"></i>`;
                            }
                        }

                        let gradeColor = 'var(--secondary-color)';
                        if (finalGrade < 56) gradeColor = 'var(--error-color)';
                        else if (finalGrade < 60) gradeColor = '#ffb74d';

                        gradeDisplay = `
                            <div style="display: flex; align-items: center;">
                                <div id="final-grade-${course.id}" style="font-size: 1.2rem; font-weight: 700; color: ${gradeColor};">${finalGrade.toFixed(1)}</div>
                                ${statusBadge}
                            </div>
                        `;
                    } else {
                        // Phase 11.11 Fix: Show "Pending" instead of empty if not configured
                        gradeDisplay = `<div id="final-grade-${course.id}" style="font-size: 0.75rem; font-weight: 600; color: #ff9800; background: rgba(255,152,0,0.1); padding: 4px 8px; border-radius: 4px; text-transform: uppercase;">Pending Scores</div>`;
                    }

                    // Phase 11.11 Fix: Always show Cog if record is not an exemption
                    actionButton = `
                        <button class="icon-btn setup-grade-btn" data-courseid="${course.id}" title="Setup Grade Breakdown" style="margin-right: -4px;">
                            <i class='bx bx-cog'></i>
                        </button>
                    `;
                }

                // Components HTML (Only for non-exemptions)
                let componentsHTML = '';
                if (!course.isExemption) {
                    const components = course?.gradeComponents || [];
                    // Phase 11.11 Fix: Show components even if not fully configured (allows user to see what's wrong)
                    if (components.length > 0) {
                        componentsHTML = `
                            <div style="padding-top: 12px; border-top: 1px dashed var(--border-color);">
                                <h4 style="font-size: 0.8rem; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px;">Grade Breakdown</h4>
                                ${components.map((comp, idx) => `
                                    <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 8px;">
                                        <div style="font-size: 0.85rem; color: var(--text-secondary);">
                                            ${this.escapeHTML(comp.name)} <span style="font-size: 0.75rem;">(${comp.weight}%)</span>
                                        </div>
                                        <input type="number" class="comp-grade-input" data-courseid="${course.id}" data-index="${idx}" value="${comp.score !== null ? comp.score : ''}" placeholder="-" style="width: 50px; padding: 2px 4px; border-radius: 4px; border: 1px solid var(--border-color); background: var(--bg-color); color: var(--text-primary); text-align: center; font-size: 0.85rem;">
                                    </div>
                                `).join('')}
                            </div>
                        `;
                    }
                }

                let syllabusMetaHTML = '';
                let topicsHTML = '';
                if (!course.isExemption) {
                    const lecturer = course?.lecturer || '-';
                    const ta = course?.ta || '-';
                    const topics = course?.topics || [];
                    if (lecturer !== '-' || ta !== '-' || topics.length > 0) {
                        syllabusMetaHTML = `
                            <div style="padding: 12px; background: rgba(187, 134, 252, 0.03); border: 1px dashed rgba(187, 134, 252, 0.2); border-radius: 8px; margin-top: 12px;">
                                <div style="font-size: 0.75rem; color: var(--primary-color); text-transform: uppercase; font-weight: 600; margin-bottom: 8px; letter-spacing: 0.5px;">Syllabus Intelligence</div>
                                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
                                    <div>
                                        <div style="font-size: 0.7rem; color: var(--text-secondary);">Lecturer</div>
                                        <div style="font-size: 0.8rem; color: var(--text-primary); font-weight: 500;">${this.escapeHTML(lecturer)}</div>
                                    </div>
                                    <div>
                                        <div style="font-size: 0.7rem; color: var(--text-secondary);">Teaching Asst.</div>
                                        <div style="font-size: 0.8rem; color: var(--text-primary); font-weight: 500;">${this.escapeHTML(ta)}</div>
                                    </div>
                                </div>
                            </div>
                        `;
                    }
                    if (topics && topics.length > 0) {
                        const listItems = topics.map(t => `<li style="margin-bottom: 6px; color: var(--text-secondary);">${this.escapeHTML(t)}</li>`).join('');
                        topicsHTML = `
                            <details open style="padding: 12px; background: rgba(255, 255, 255, 0.02); border: 1px solid var(--border-color); border-radius: 8px; margin-top: 12px;">
                                <summary style="cursor: pointer; font-size: 0.85rem; font-weight: 600; color: var(--text-primary); user-select: none;">
                                    📖 Course Syllabus Topics
                                </summary>
                                <ol style="margin-top: 12px; padding-left: 24px; font-size: 0.85rem; margin-bottom: 0;">
                                    ${listItems}
                                </ol>
                            </details>
                        `;
                    }
                }

        const cardHTML = `
            <div class="course-card" style="position: relative; background: var(--surface-color); border-radius: 12px; padding: 24px; border: 1px solid var(--border-color); display: flex; flex-direction: column; gap: 16px;">
                <input type="checkbox" class="course-select-check" data-courseid="${course.id}" style="display: ${this.isSelectionMode ? 'block' : 'none'};" ${this.selectedIds.has(course.id) ? 'checked' : ''}>
                <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                    <div style="padding-left: ${this.isSelectionMode ? '16px' : '0'}; transition: padding 0.2s;">
                                <h3 style="font-size: 1.1rem; color: var(--text-primary); margin-bottom: 4px;">${this.escapeHTML(courseTitle)}</h3>
                                <div style="display: flex; align-items: center; gap: 12px;">
                                    <span class="credit-badge-actionable" data-courseid="${course.id}" style="font-size: 0.85rem; color: var(--text-secondary);">
                                        <i class='bx bx-coin-stack'></i> ${courseNekaz || 0} Nekaz
                                    </span>
                                    ${gradeDisplay || ''}
                                </div>
                            </div>
                            ${actionButton}
                        </div>
                        ${syllabusMetaHTML}
                        ${topicsHTML}
                        ${componentsHTML}
                    </div>
                `;
                targetGrid.innerHTML += cardHTML;
            } catch (cardError) {
                console.error("Failed to render course card:", course, cardError);
            }
        });

        // 4. Bind Events (Cog, Delete Exemption, Inputs)
        this.bindCardEvents();

        // 5. Update Alerts & Summary
        this.renderNekazActions();
        this.updateGlobalGPA();
    }

    bindCardEvents() {
        document.querySelectorAll('.setup-grade-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const cid = e.target.closest('.setup-grade-btn').dataset.courseid;
                this.openGradeBuilder(cid);
            });
        });

        document.querySelectorAll('.delete-exemption-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const cid = e.target.closest('button').dataset.courseid;
                if (confirm("Remove this exemption permanently?")) {
                    this.courses = this.courses.filter(c => c.id !== cid);
                    await storage.deleteCourse(cid);
                    this.render();
                    this.updateGlobalGPA();
                }
            });
        });

        // Phase 11.5: Bind selection checkboxes so the "Delete Selected" button appears
        document.querySelectorAll('.course-select-check').forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                const cid = e.target.dataset.courseid;
                if (e.target.checked) {
                    this.selectedIds.add(cid);
                } else {
                    this.selectedIds.delete(cid);
                }
                
                // Update Multi-Delete Button state dynamically without a full re-render
                const btn = document.getElementById('delete-selected-btn');
                const countSpan = document.getElementById('selected-count');
                if (btn && countSpan) {
                    countSpan.textContent = this.selectedIds.size;
                    btn.style.display = (this.isSelectionMode && this.selectedIds.size > 0) ? 'flex' : 'none';
                }
            });
        });

        document.querySelectorAll('.comp-grade-input').forEach(input => {
            input.addEventListener('input', (e) => {
                const cid = e.target.dataset.courseid;
                const idx = e.target.dataset.index;
                this.handleComponentGradeUpdate(cid, idx, e.target.value);
            });
        });
    }

    renderNekazActions() {
        if (!this.unassignedContainer) return;
        
        // Safety Fallback for settings
        this.prefs = this.prefs || JSON.parse(localStorage.getItem('student_os_prefs') || '{}');
        
        // Skip properties check if library is empty
        const isLibraryEmpty = !this.courses || this.courses.length === 0;
        const englishMissing = isLibraryEmpty || !this.courses.some(c => c.isExemption && (c.title.toLowerCase().includes('english') || c.title.includes('אנגלית')));
        const showEnglishRec = englishMissing && !this.prefs?.dismissedEnglishRec;

        const limboCourses = isLibraryEmpty ? [] : this.courses.filter(c => c.nekaz === undefined || c.nekaz === null || c.nekaz === '' || isNaN(parseFloat(c.nekaz)));

        // Show if EITHER credits are missing OR English Recommendation is active
        if (limboCourses.length === 0 && !showEnglishRec) {
            this.unassignedContainer.style.display = 'none';
            return;
        }

        this.unassignedContainer.style.display = 'block';
        
        // Use a persistent shell and only update the inner list to maintain focus
        if (!this.unassignedContainer.querySelector('details')) {
            this.unassignedContainer.innerHTML = `
                <details open style="background: rgba(255, 152, 0, 0.05); border: 1px solid rgba(255, 152, 0, 0.3); border-radius: 12px; padding: 20px;">
                    <summary style="cursor: pointer; list-style: none; display: flex; align-items: center; justify-content: space-between;">
                        <h3 style="font-size: 1rem; color: #ff9800; margin: 0; display: flex; align-items: center; gap: 8px;">
                            <i class='bx bx-error-circle'></i> <span id="nekaz-alert-title">Scholarship Hub: Active Recommendations</span>
                        </h3>
                        <i class='bx bx-chevron-down' style="color: #ff9800;"></i>
                    </summary>
                    <div id="nekaz-action-list" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 12px; margin-top: 16px;">
                        <!-- Items will be injected below -->
                    </div>
                    <!-- Phase 11.3: Global quick fixes (dismissible) -->
                    <div id="global-quick-fixes" style="margin-top: 16px; padding-top: 16px; border-top: 1px solid rgba(255,152,0,0.2); display: flex; gap: 12px; flex-wrap: wrap; align-items: center;">
                        <div id="english-ptor-container" style="display: ${showEnglishRec ? 'flex' : 'none'}; align-items: center; gap: 12px; width: 100%;">
                            <button class="primary-btn" id="add-english-ptor-btn" style="background: linear-gradient(135deg, var(--primary-color), var(--secondary-color)); color: #000; border: none; font-size: 0.85rem; padding: 10px 20px; font-weight: 600; box-shadow: 0 4px 12px rgba(3, 218, 198, 0.3);">
                                <i class='bx bx-party'></i> Add English Exemption (2 Units)
                            </button>
                            <button id="dismiss-english-rec-btn" class="icon-btn" style="color: var(--text-secondary); opacity: 0.7;" title="Don't show again">
                                <i class='bx bx-x-circle' style="font-size: 1.4rem;"></i>
                            </button>
                            <div style="font-size: 0.75rem; color: var(--text-secondary); margin-left: 8px;">Recommended for BGU students with 'Ptor' status.</div>
                        </div>
                    </div>
                </details>
            `;

            // 2. English Ptor Quick Fix
            const englishBtn = this.unassignedContainer.querySelector('#add-english-ptor-btn');
            if (englishBtn) {
                englishBtn.addEventListener('click', () => {
                    this.handleEnglishPtor();
                    this.prefs.englishExemption = true;
                    localStorage.setItem('student_os_prefs', JSON.stringify(this.prefs));
                });
            }

            const dismissBtn = this.unassignedContainer.querySelector('#dismiss-english-rec-btn');
            if (dismissBtn) {
                dismissBtn.addEventListener('click', () => {
                    this.prefs.dismissedEnglishRec = true;
                    localStorage.setItem('student_os_prefs', JSON.stringify(this.prefs));
                    this.render();
                });
            }
            
            // Task 10.11: Event Delegation at the parent level
            const actionList = this.unassignedContainer.querySelector('#nekaz-action-list');
            
            // 1. Capture 'Save' clicks
            actionList.addEventListener('click', (e) => {
                const btn = e.target.closest('.nekaz-save-btn');
                if (btn) {
                    const id = btn.dataset.id;
                    const input = document.getElementById(`nekaz-input-${id}`);
                    const val = input ? input.value : '';
                    if (val && !isNaN(parseFloat(val))) {
                        this.handleNekazSaveAtomic(id, val, btn);
                    }
                }
            });


            // 3. Capture 'Input' changes to prevent data loss during partial renders
            actionList.addEventListener('input', (e) => {
                if (e.target.tagName === 'INPUT') {
                    const id = e.target.id.replace('nekaz-input-', '');
                    const val = e.target.value;
                    const course = this.courses.find(c => c.id === id);
                    if (course) {
                        course.nekaz = val ? parseFloat(val) : null;
                    }
                }
            });
        }

        const titleSpan = this.unassignedContainer.querySelector('#nekaz-alert-title');
        if (titleSpan) {
            if (limboCourses.length > 0) {
                titleSpan.textContent = `Action Required: Missing Credits (${limboCourses.length})`;
            } else {
                titleSpan.textContent = `Scholarship Hub: Active Recommendations`;
            }
        }

        const listContainer = this.unassignedContainer.querySelector('#nekaz-action-list');
        listContainer.innerHTML = '';

        limboCourses.forEach(course => {
            const div = document.createElement('div');
            div.className = 'nekaz-row-item';
            div.style.background = 'var(--surface-color)';
            div.style.padding = '12px 16px';
            div.style.borderRadius = '8px';
            div.style.border = '1px solid var(--border-color)';
            div.style.display = 'flex';
            div.style.justifyContent = 'space-between';
            div.style.alignItems = 'center';
            div.style.gap = '12px';

            div.innerHTML = `
                <div style="font-weight: 600; font-size: 0.9rem; color: var(--text-primary); flex: 1;">${this.escapeHTML(course.title)}</div>
                <div style="display: flex; gap: 8px; align-items: center;">
                    <input type="number" step="0.5" id="nekaz-input-${course.id}" value="${course.nekaz || ''}" placeholder="Nekaz" style="width: 70px; padding: 6px; border-radius: 4px; border: 1px solid var(--border-color); background: var(--bg-color); color: var(--text-primary);">
                    <button class="primary-btn nekaz-save-btn" data-id="${course.id}" style="padding: 6px 12px; font-size: 0.8rem;">Save</button>
                </div>
            `;
            listContainer.appendChild(div);
        });
    }

    async handleNekazSaveAtomic(id, value, btn) {
        const row = btn.closest('.nekaz-row-item');
        if (!row) return;

        // 1. Visual Feedback
        row.style.background = 'rgba(76, 175, 80, 0.1)';
        row.style.borderColor = '#4caf50';
        btn.innerHTML = "<i class='bx bx-check'></i>";
        btn.disabled = true;

        // 2. Persist locally first to prevent re-render loss
        const course = this.courses.find(c => c.id === id);
        if (course) {
            course.nekaz = parseFloat(value);
            // Async background save
            storage.updateCourse(course).then(() => {
                console.log(`Student OS: Atomic save complete for ${course.title}`);
            });
        }

        // 3. Update GPA & Progress Bar immediately (no full render)
        this.updateGlobalGPA();

        // 4. Animate Out
        setTimeout(() => {
            row.classList.add('fade-out-exit');
            setTimeout(() => {
                row.remove();
                
                // Update Alert Summary dynamically
                const limboRemaining = this.courses.filter(c => c.nekaz === undefined || c.nekaz === null || c.nekaz === '' || isNaN(parseFloat(c.nekaz)));
                const titleSpan = this.unassignedContainer.querySelector('#nekaz-alert-title');
                if (titleSpan) titleSpan.textContent = `Action Required: Missing Credits (${limboRemaining.length})`;
                
                if (limboRemaining.length === 0) {
                    this.unassignedContainer.style.background = 'rgba(76, 175, 80, 0.05)';
                    this.unassignedContainer.style.border = '1px solid #4caf50';
                    setTimeout(() => {
                        this.unassignedContainer.classList.add('fade-out-exit');
                        setTimeout(() => this.unassignedContainer.style.display = 'none', 400);
                    }, 500);
                }
            }, 400);
        }, 300);
    }

    renderUnassignedExams() {
        // Stage 6.8 & 6.10: Replaced by renderNekazActions
        if (this.unassignedContainer && !this.unassignedList) {
            this.unassignedContainer.style.display = 'none';
        }
    }

    updateGlobalGPA() {
        if (this._gpaDebounce) clearTimeout(this._gpaDebounce);
        this._gpaDebounce = setTimeout(() => {
            this._executeGlobalGPA();
        }, 250);
    }

    _executeGlobalGPA() {
        const suppressLog = !this.isInitialLoad;
        const coursesToRender = this.simulationMode ? this.simulationState : this.courses;
        const stats = GradeEngine.calculateGPA(coursesToRender, suppressLog);
        
        if (this.isInitialLoad) {
            this.isInitialLoad = false;
        }

        this.summaryGpa.textContent = stats.gpa.toFixed(2);
        if (document.getElementById('gpa-big-display')) {
            document.getElementById('gpa-big-display').textContent = stats.gpa.toFixed(2);
        }

        this.summaryCredits.textContent = stats.earnedCredits.toFixed(1);
        if (document.getElementById('earned-credits-display')) {
            document.getElementById('earned-credits-display').textContent = stats.earnedCredits.toFixed(1);
        }

        // Degree Progress Bar Logic
        const progressFill = document.getElementById('degree-progress-fill');
        if (progressFill) {
            const percentage = Math.min((stats.earnedCredits / this.targetCredits) * 100, 100);
            progressFill.style.width = `${percentage}%`;
        }

        this.summaryPending.textContent = stats.pendingCount;
        this.summaryCourses.textContent = stats.totalAssignedCredits.toFixed(1); // Phase 11: Show total credits

        // Render the Trend Chart
        this.renderGPAChart(coursesToRender);

        // Add visual glow in Simulation Mode
        if (this.simulationMode) {
            this.summaryGpa.classList.add('simulation-glow');
            if (document.getElementById('gpa-big-display')) document.getElementById('gpa-big-display').classList.add('simulation-glow');
            if (progressFill) progressFill.classList.add('simulation-glow'); // Re-uses amber-glow from CSS inject logic implicitly via background/box-shadow targeting body
        } else {
            this.summaryGpa.classList.remove('simulation-glow');
            if (document.getElementById('gpa-big-display')) document.getElementById('gpa-big-display').classList.remove('simulation-glow');
            if (progressFill) progressFill.classList.remove('simulation-glow');
        }

        const insightsEmptyState = document.getElementById('insights-empty-state');
        const insightsData = document.getElementById('insights-data');
        if (stats.gpa > 0 || stats.totalAssignedCredits > 0) {
            if (insightsEmptyState) insightsEmptyState.style.display = 'none';
            if (insightsData) insightsData.style.display = 'block';
        } else {
            if (insightsEmptyState) insightsEmptyState.style.display = 'block';
            if (insightsData) insightsData.style.display = 'none';
        }
    }

    async handleEnglishPtor() {
        const englishExists = this.courses.find(c => c.title.toLowerCase().includes('english') || c.title.includes('אנגלית'));
        if (englishExists && (englishExists.nekaz > 0 || englishExists.isExemption)) {
            alert("English record already exists in your library.");
            return;
        }

        const englishExemption = {
            id: 'exemption-english-' + Date.now(),
            title: 'English (Academic Exemption)',
            nekaz: 2.0,
            isBinary: true,
            isExemption: true,
            isConfigured: true,
            gradeComponents: [{ name: 'Exemption', weight: 100, score: 100, isShield: false }]
        };

        this.courses.push(englishExemption);
        await storage.saveCourse(englishExemption);
        await this.loadData();
    }

    async syncEnglishExemption(desired) {
        const existing = this.courses.find(c => c.isExemption && (c.title.toLowerCase().includes('english') || c.title.includes('אנגלית')));
        
        if (desired && !existing) {
            await this.handleEnglishPtor();
        } else if (!desired && existing) {
            await storage.deleteCourse(existing.id);
            await this.loadData();
        }
    }

    renderGPAChart(activeCourses) {
        if (!window.Chart) return;
        
        const canvas = document.getElementById('semester-trend-chart');
        if (!canvas) return;

        // Group active courses by detected semester
        const semesterBuckets = {};
        const passedCourses = activeCourses.filter(c => {
            const grade = GradeEngine.calculateFinalGrade(c);
            return grade !== null && grade >= (c.minPassGrade || GradeEngine.DEFAULT_MIN_PASS_GRADE);
        });

        passedCourses.forEach(course => {
            const sem = GradeEngine.detectSemester(course, this.exams);
            if (!semesterBuckets[sem]) semesterBuckets[sem] = [];
            semesterBuckets[sem].push(course);
        });

        // Time sorting mapping
        const order = Object.keys(semesterBuckets).map(key => {
            let earliest = Infinity;
            semesterBuckets[key].forEach(c => {
                const exams = this.exams.filter(e => e.courseId === c.id || (e.courseTitle && e.courseTitle.includes(c.title)));
                exams.forEach(e => {
                    const d = new Date(e.date).getTime();
                    if (d < earliest) earliest = d;
                });
            });
            return { key, time: earliest === Infinity ? 0 : earliest };
        });
        
        order.sort((a,b) => a.time - b.time); // sorted chronologically
        
        const labels = [];
        const dataPoints = [];
        
        let cumulativeCourses = [];
        
        order.forEach(item => {
            labels.push(item.key);
            cumulativeCourses = cumulativeCourses.concat(semesterBuckets[item.key]);
            const stats = GradeEngine.calculateGPA(cumulativeCourses, true);
            dataPoints.push(stats.gpa);
        });

        const globalStats = GradeEngine.calculateGPA(activeCourses, true);
        const globalGpaPoints = labels.map(() => globalStats.gpa);

        const primaryColor = this.simulationMode ? '#ff9800' : '#03dac6';
        const bgColor = this.simulationMode ? 'rgba(255, 152, 0, 0.1)' : 'rgba(3, 218, 198, 0.1)';

        if (this.trendChart) {
            this.trendChart.data.labels = labels;
            this.trendChart.data.datasets[0].data = dataPoints;
            this.trendChart.data.datasets[0].borderColor = primaryColor;
            this.trendChart.data.datasets[0].pointBackgroundColor = primaryColor;
            this.trendChart.data.datasets[0].pointBorderColor = primaryColor;
            this.trendChart.data.datasets[0].backgroundColor = bgColor;
            
            this.trendChart.data.datasets[1].data = globalGpaPoints;
            this.trendChart.update();
            return;
        }

        const ctx = canvas.getContext('2d');
        this.trendChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Semester GPA',
                        data: dataPoints,
                        borderColor: primaryColor,
                        backgroundColor: bgColor,
                        borderWidth: 2,
                        pointBackgroundColor: primaryColor,
                        pointBorderColor: primaryColor,
                        pointRadius: 4,
                        pointHoverRadius: 6,
                        fill: true,
                        tension: 0.3
                    },
                    {
                        label: 'Global GPA',
                        data: globalGpaPoints,
                        borderColor: 'rgba(255, 255, 255, 0.3)',
                        borderWidth: 1,
                        borderDash: [5, 5],
                        pointRadius: 0,
                        fill: false,
                        tension: 0
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                color: '#b3b3b3',
                scales: {
                    y: {
                        min: 50,
                        max: 100,
                        grid: { color: 'rgba(255,255,255,0.05)' }
                    },
                    x: {
                        grid: { color: 'rgba(255,255,255,0.05)' }
                    }
                },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: '#1e1e1e',
                        titleColor: '#fff',
                        bodyColor: primaryColor,
                        borderColor: 'rgba(255,255,255,0.1)',
                        borderWidth: 1
                    }
                }
            }
        });
    }

    async handleDeleteCourse(id) {
        const course = this.courses.find(c => c.id === id);
        if (!course) return;
        if (confirm(`Are you sure you want to delete "${course.title}"? \n\nIMPORTANT: All syllabus data, topics, and grade breakdown for this course will be permanently lost.`)) {
            this.selectedIds.delete(id); // Cleanup if selected
            await storage.deleteCourse(id);
            this.showToast(`🗑️ ${course.title} deleted.`);
            this.gradeModal.classList.remove('active'); // Close modal if open
            await this.loadData();
        }
    }

    handleCheckboxChange(id, checked) {
        if (checked) {
            this.selectedIds.add(id);
        } else {
            this.selectedIds.delete(id);
        }
        
        // Update Multi-Delete Button state
        const btn = document.getElementById('delete-selected-btn');
        const countSpan = document.getElementById('selected-count');
        
        if (btn && countSpan) {
            const count = this.selectedIds.size;
            countSpan.textContent = count;
            btn.style.display = (this.isSelectionMode && count > 0) ? 'flex' : 'none';
        }

        // Sync Select All button text
        const selectAllBtn = document.getElementById('select-all-toggle-btn');
        if (selectAllBtn) {
            const allSelected = this.courses.length > 0 && this.selectedIds.size === this.courses.length;
            selectAllBtn.innerHTML = allSelected ? `<i class='bx bx-list-minus'></i> Deselect All` : `<i class='bx bx-list-check'></i> Select All`;
        }
    }

    toggleSelectionMode() {
        this.isSelectionMode = !this.isSelectionMode;
        if (!this.isSelectionMode) {
            this.selectedIds.clear();
        }
        
        const toggleBtn = document.getElementById('selection-toggle-btn');
        const clearBtn = document.getElementById('clear-library-btn');
        const deleteSelectedBtn = document.getElementById('delete-selected-btn');
        const addCourseBtn = document.getElementById('add-course-btn');
        const magicImportBtn = document.getElementById('magic-import-btn');
        const selectAllBtn = document.getElementById('select-all-toggle-btn');

        if (toggleBtn) {
            toggleBtn.innerHTML = this.isSelectionMode ? `<i class='bx bx-x'></i> Cancel` : `<i class='bx bx-check-square'></i> Select`;
            toggleBtn.style.borderColor = this.isSelectionMode ? 'var(--text-secondary)' : 'var(--text-secondary)';
            toggleBtn.style.background = this.isSelectionMode ? 'rgba(255,255,255,0.05)' : 'transparent';
        }

        if (selectAllBtn) {
            selectAllBtn.style.display = this.isSelectionMode ? 'flex' : 'none';
            selectAllBtn.innerHTML = `<i class='bx bx-list-check'></i> Select All`;
        }

        if (clearBtn) clearBtn.style.display = this.isSelectionMode ? 'none' : 'flex';
        if (addCourseBtn) addCourseBtn.style.display = this.isSelectionMode ? 'none' : 'flex';
        if (magicImportBtn) magicImportBtn.style.display = this.isSelectionMode ? 'none' : 'flex';
        
        if (deleteSelectedBtn) {
            deleteSelectedBtn.style.display = (this.isSelectionMode && this.selectedIds.size > 0) ? 'flex' : 'none';
        }

        this.render();
    }

    handleSelectAllToggle() {
        const allSelected = this.courses.length > 0 && this.selectedIds.size === this.courses.length;
        
        if (allSelected) {
            this.selectedIds.clear();
        } else {
            this.courses.forEach(c => this.selectedIds.add(c.id));
        }

        // Sync UI
        const countSpan = document.getElementById('selected-count');
        const deleteBtn = document.getElementById('delete-selected-btn');
        const selectAllBtn = document.getElementById('select-all-toggle-btn');

        if (countSpan) countSpan.textContent = this.selectedIds.size;
        if (deleteBtn) deleteBtn.style.display = this.selectedIds.size > 0 ? 'flex' : 'none';
        if (selectAllBtn) {
            selectAllBtn.innerHTML = this.selectedIds.size === this.courses.length && this.courses.length > 0
                ? `<i class='bx bx-list-minus'></i> Deselect All` 
                : `<i class='bx bx-list-check'></i> Select All`;
        }

        this.render();
    }

    async handleDeleteSelected() {
        const count = this.selectedIds.size;
        if (count === 0) return;

        if (confirm(`Are you sure you want to delete the ${count} selected courses? \n\nIMPORTANT: All associated syllabus data and grades will be permanently lost.`)) {
            for (const id of this.selectedIds) {
                await storage.deleteCourse(id);
            }
            this.selectedIds.clear();
            this.isSelectionMode = false; // Exit selection mode after deletion
            this.toggleSelectionMode(); // Refresh UI state
            this.showToast(`🗑️ ${count} courses deleted.`);
            await this.loadData();
        }
    }

    async handleClearAllCourses() {
        if (confirm("⚠️ Are you sure you want to CLEAR the entire library? \n\nIMPORTANT: All syllabus data, topics, and grade breakdown for ALL courses will be permanently lost.")) {
            this.selectedIds.clear();
            await storage.clearAllCourses();
            
            // Phase 11.28: Settings Recovery & Reset English Recommendation
            if (this.prefs) {
                delete this.prefs.dismissedEnglishRec;
                delete this.prefs.englishExemption;
                localStorage.setItem('student_os_prefs', JSON.stringify(this.prefs));
            }

            this.showToast("🗑️ Library cleared.");
            await this.loadData();
        }
    }

    /**
     * Phase 11.16: Resilient Syllabus Import (Unified Data Contract)
     */
    async triggerSyllabusImport(payload) {
        console.log("DEBUG: Payload structure:", payload);
        if (!payload || this.isProcessingSyllabus) return;
        
        // Data Contract Mapping (Raw vs Agent Results)
        const moodleName = payload?.courseInfo?.moodleName || payload?.courseName;
        const syllabusUrl = payload?.courseInfo?.originalSyllabusUrl || payload?.syllabusHref;
        
        if (!moodleName) {
            console.error("Syllabus Harvester: [Contract] No course name found in payload.", payload);
            this.showToast("❌ Invalid payload received.");
            return;
        }

        this.isProcessingSyllabus = true;
        this.showToast("🧠 AI Agent: Harvesting syllabus data...");

        // Smart Logic: If payload is raw (extracted text), call the AI Agent first
        let processedResults = payload;
        if (payload?.extractedText && !payload?.gradeComponents) {
            try {
                console.log("Analytics Hub: Raw text detected. Triggering AI extraction...");
                const { aiService } = await import('./ai_service.js');
                processedResults = await aiService.callSyllabusAgent(payload.extractedText, {
                    moodleName,
                    url: syllabusUrl
                });
                console.log("AI Extraction Result:", processedResults);
            } catch (e) {
                console.error("AI Extraction Failed:", e);
                this.showToast("❌ AI Extraction Failed. Manual entry required.");
                this.isProcessingSyllabus = false;
                return;
            }
        }

        try {
            const match = CourseMatcher.analyzeMatch(moodleName, this.courses);
            
            // Phase 11.18: Block Auto-Create. If any match exists (Auto, Candidate, or Conflict), pop the modal.
            if (match.type !== 'none' && match.candidates.length > 0) {
                console.log(`IDENTITY: ${match.candidates.length} potential matches detected. Enforcing user resolution.`);
                this.showIdentityResolutionModal(processedResults, match.candidates);
            } else {
                console.log("No identity candidates found. Proceeding with new course creation.");
                await this.executeCreateNewFromSyllabus(processedResults);
            }
        } catch (e) {
            console.error("Syllabus Import Error:", e);
            this.showToast("❌ Error processing syllabus.");
        } finally {
            this.isProcessingSyllabus = false;
        }
    }

    async applyAgentResultsToCourse(course, payload) {
        if (!course || !payload) return;

        // Phase 11.26: Grade Shield Logic (Preserve both explicit scores AND the Official top level grade)
        if (!course.gradeComponents || course.gradeComponents.length === 0 || (course.gradeComponents.length === 1 && course.gradeComponents[0].name === 'BGU Transcript Sync' && course.gradeComponents[0].score === null)) {
             // If local is entirely blank or just a pending placeholder, accept the AI's component breakdown
             course.gradeComponents = payload.gradeComponents.map(c => ({
                 name: c.name,
                 weight: parseFloat(c.weight) || 0,
                 isShield: !!c.isShield,
                 score: c.score || null,
                 minPassGrade: c.minPassGrade || GradeEngine.DEFAULT_MIN_PASS_GRADE
             }));
        } else {
             // Deep Merge Shield: If they already have a real structure, DO NOT BLANK IT OUT.
             // We only map incoming scores to existing components if they explicitly match.
             const incomingScores = new Map();
             (payload.gradeComponents || []).forEach(c => {
                 if (c.score !== null && c.score !== undefined) incomingScores.set(c.name, c.score);
             });
             
             course.gradeComponents = course.gradeComponents.map(c => {
                 const newSyllabusScore = incomingScores.get(c.name);
                 return {
                     ...c,
                     score: c.score ?? (newSyllabusScore ?? null) // existing wins
                 };
             });
        }

        course.topics = (course.topics && course.topics.length > 0) ? course.topics : (payload.topics || []);
        course.syllabusUrl = course.syllabusUrl || payload.courseInfo?.originalSyllabusUrl || null;
        
        // Clean metadata & Handle Term Persistence prioritizing Portal Extracted String
        course.lecturer = course.lecturer || payload.courseInfo?.staff?.lecturer || null;
        course.ta = course.ta || payload.courseInfo?.staff?.ta || null;
        
        // Term Merge
        if (!course.term || course.term === 'General') {
             course.term = payload.courseInfo?.term || 'General';
        }

        course.isConfigured = true;

        await storage.updateCourse(course);
        this.render();
        this.showToast(`✅ ${course.title} synced with AI Syllabus!`);
    }

    showIdentityResolutionModal(payload, candidates) {
        this.pendingAgentResponse = payload;
        
        if (this.syllabusCourseNameLabel) {
            this.syllabusCourseNameLabel.textContent = payload?.courseInfo?.moodleName || 'Unknown Course';
        }
        
        const listContainer = document.getElementById('identity-candidates-list');
        const targetInstruction = document.getElementById('identity-target-instruction');
        const targetNameLabel = document.getElementById('identity-target-name');
        
        if (this.mergeIdentityBtn) {
            this.mergeIdentityBtn.disabled = true;
            this.mergeIdentityBtn.style.opacity = '0.5';
        }

        if (listContainer) {
            listContainer.innerHTML = ''; // Force clear
            
            const candidateArray = Array.isArray(candidates) ? candidates : [candidates];
            console.log(`IDENTITY UI: Attempting to render ${candidateArray.length} items to the modal.`);

            try {
                if (candidateArray.length === 0) throw new Error("candidates array is empty.");

                candidateArray.forEach((cand) => {
                    if (!cand || !cand.course) return;

                    const itemLabel = document.createElement('label');
                    itemLabel.className = 'identity-candidate-item'; 
                    itemLabel.style.display = 'flex';
                    itemLabel.style.alignItems = 'center';
                    itemLabel.style.gap = '12px';
                    itemLabel.style.padding = '12px 16px';
                    itemLabel.style.background = 'rgba(187, 134, 252, 0.1)';
                    itemLabel.style.border = '2px solid #555';
                    itemLabel.style.borderRadius = '8px';
                    itemLabel.style.cursor = 'pointer';
                    itemLabel.style.transition = 'all 0.2s';
                    itemLabel.style.marginBottom = '8px'; // Ensure visual separation
                    itemLabel.style.color = 'var(--text-primary)';
                    
                    itemLabel.innerHTML = `
                        <input type="radio" name="candidate-selection" value="${cand.course.id}" style="width: 20px; height: 20px; accent-color: var(--primary-color);">
                        <div style="flex: 1;">
                            <div style="font-weight: 700; margin-bottom: 2px;">${cand.course.title || 'Untitled Course'}</div>
                            <div style="font-size: 0.8rem; color: #a5a5a5;">Match Confidence: ${Math.round((cand.score || 0) * 100)}%</div>
                        </div>
                    `;
                    
                    itemLabel.addEventListener('click', () => {
                        // Reset all borders
                        listContainer.querySelectorAll('.identity-candidate-item').forEach(l => {
                            l.style.borderColor = '#555';
                        });
                        itemLabel.style.borderColor = 'var(--primary-color)';
                        
                        const radio = itemLabel.querySelector('input');
                        if (radio) radio.checked = true;

                        if (targetInstruction && targetNameLabel) {
                            targetInstruction.style.display = 'block';
                            targetNameLabel.textContent = cand.course.title;
                            
                            if (cand.score < 0.6) {
                                targetNameLabel.style.color = '#cf6679';
                                targetNameLabel.style.fontWeight = '900';
                            } else {
                                targetNameLabel.style.color = 'var(--primary-color)';
                                targetNameLabel.style.fontWeight = '700';
                            }
                        }
                        
                        if (this.mergeIdentityBtn) {
                            this.mergeIdentityBtn.disabled = false;
                            this.mergeIdentityBtn.style.opacity = '1';
                        }
                    });
                    
                    listContainer.appendChild(itemLabel);
                });

                if (listContainer.children.length === 0) {
                    throw new Error("No valid candidate elements were created.");
                }

                console.log(`IDENTITY UI: Injection complete. Total children: ${listContainer.children.length}`);

            } catch (error) {
                console.error("IDENTITY UI: Rendering failed. Activating fallback. Error:", error);
                
                // Fallback rendering
                listContainer.innerHTML = '';
                const fallbackMessage = document.createElement('div');
                fallbackMessage.style.color = 'var(--text-primary)';
                fallbackMessage.style.marginBottom = '8px';
                fallbackMessage.innerHTML = '<strong>Fallback Mode: Visual rendering failed. Candidates:</strong>';
                listContainer.appendChild(fallbackMessage);

                const fallbackUl = document.createElement('ul');
                fallbackUl.style.color = 'var(--text-primary)';
                fallbackUl.style.paddingLeft = '20px';
                
                candidateArray.forEach(cand => {
                    if (!cand || !cand.course) return;
                    const li = document.createElement('li');
                    li.textContent = `${cand.course.title} (${Math.round((cand.score || 0) * 100)}%) - ID: ${cand.course.id}`;
                    fallbackUl.appendChild(li);
                });
                
                listContainer.appendChild(fallbackUl);

                // Disable merge since radio buttons aren't reliable in fallback
                if (targetInstruction) {
                    targetInstruction.innerHTML = '<span style="color: #cf6679"><i class="bx bx-error-circle"></i> UI Error: Please cancel and create new course manually.</span>';
                    targetInstruction.style.display = 'block';
                }
            }
        }

        if (this.identityModal) {
            this.identityModal.classList.remove('closing');
            this.identityModal.classList.add('active');
        }
    }

    async executeCreateNewFromSyllabus(payload) {
        const id = 'course_' + Date.now() + Math.random().toString(36).substring(2, 7);
        const newCourse = {
            id,
            title: payload.courseInfo.cleanName || payload.courseInfo.moodleName,
            nekaz: 0, 
            officialGrade: null,
            gradingPolicy: 'last_counts',
            isConfigured: true,
            gradeComponents: payload.gradeComponents.map(c => ({
                name: c.name,
                weight: parseFloat(c.weight) || 0,
                isShield: !!c.isShield,
                score: null,
                minPassGrade: c.minPassGrade || GradeEngine.DEFAULT_MIN_PASS_GRADE
            })),
            topics: payload.topics || [],
            syllabusUrl: payload.courseInfo.originalSyllabusUrl,
            lecturer: payload.courseInfo.staff?.lecturer || null,
            ta: payload.courseInfo.staff?.ta || null
        };

        await storage.saveCourse(newCourse);
        window.localStorage.removeItem('STUDENT_OS_PENDING_SYLLABUS');
        await this.loadData();
        this.showToast(`✨ ${newCourse.title} added via AI.`);
    }

    async executeSurgicalMerge(payload, course) {
        this.showToast(`Merging AI data into ${course.title}...`);
        await this.applyAgentResultsToCourse(course, payload);
        window.localStorage.removeItem('STUDENT_OS_PENDING_SYLLABUS');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.analyticsApp = new AnalyticsApp();
});
