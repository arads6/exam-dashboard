import { storage } from './storage.js';
import { GradeEngine } from './analytics/grade_engine.js';

class AnalyticsApp {
    constructor() {
        this.addBtn = document.getElementById('add-course-btn');
        this.modal = document.getElementById('course-modal');
        this.closeModalBtn = document.getElementById('close-course-modal-btn');
        this.form = document.getElementById('course-form');
        this.coursesGrid = document.getElementById('courses-grid');
        
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
        this.gradeBuilderCourseName = document.getElementById('grade-builder-course-name');

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

        this.init();
    }

    async init() {
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
        `;
        document.head.appendChild(style);

        this.bindEvents();
        
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
            document.getElementById('course-title').value = '';
            document.getElementById('course-nekaz').value = '';
            this.modal.classList.add('active');
        };

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
        this.closeGradeModalBtn.addEventListener('click', () => {
            this.gradeModal.classList.remove('active');
        });

        this.addComponentBtn.addEventListener('click', () => {
            this.tempComponents.push({ name: '', weight: 0, isShield: false, score: null, minPassGrade: 60 });
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
        });

        // Sync for same-tab updates (dispatched from storage.js)
        window.addEventListener('storage_updated', () => {
            clearTimeout(this.syncTimeout);
            this.syncTimeout = setTimeout(() => {
                this.loadData();
            }, 50);
        });
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
        this.courses = await storage.getCourses();
        this.exams = await storage.getExams();
        
        // Final UI/UX Polish: render handles summary updates
        this.render();
    }

    async handleCourseSubmit() {
        const title = document.getElementById('course-title').value.trim();
        const nekaz = parseFloat(document.getElementById('course-nekaz').value);

        if (!title || isNaN(nekaz)) return;

        let normalizedTitle = storage.normalizeCourseName(title);
        let existingCourse = this.courses.find(c => storage.normalizeCourseName(c.title) === normalizedTitle);
        if (existingCourse) {
            existingCourse.nekaz = nekaz;
            await storage.updateCourse(existingCourse);
        } else {
            await storage.saveCourse({ title, nekaz });
        }

        this.modal.classList.remove('active');
        await this.loadData();
    }

    openGradeBuilder(courseId) {
        const course = this.courses.find(c => c.id === courseId);
        if (!course) return;

        this.currentEditingCourseId = courseId;
        this.gradeBuilderCourseName.textContent = course.title;
        // Deep clone components to temp
        this.tempComponents = course.gradeComponents ? JSON.parse(JSON.stringify(course.gradeComponents)) : [];
        
        // Ensure at least one component if empty
        if (this.tempComponents.length === 0) {
            this.tempComponents.push({ name: 'Final Exam', weight: 100, isShield: false, score: null, minPassGrade: 60 });
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
            course.gradeComponents = this.tempComponents;
            course.isConfigured = true;
            await storage.updateCourse(course);
            this.gradeModal.classList.remove('active');
            await this.loadData();
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
        this.coursesGrid.innerHTML = '';
        const coursesToRender = this.simulationMode ? this.simulationState : this.courses;
        
        // 1. Handle Empty State
        if (coursesToRender.length === 0) {
            this.coursesEmptyState.style.display = 'block';
            this.coursesGrid.style.display = 'none';
        } else {
            this.coursesEmptyState.style.display = 'none';
            this.coursesGrid.style.display = 'grid';
            
            // Stage 6.8 & 6.9: Iterate over EVERY course with Error Boundaries
            coursesToRender.forEach(course => {
                try {
                    // QA Rule: Strict safe navigation for all properties
                    const courseTitle = course?.title || 'Untitled Course';
                    const courseNekaz = course?.nekaz;
                    
                    const finalGrade = GradeEngine.calculateFinalGrade(course);
                    const isPending = course?.isConfigured && finalGrade === null;
                    
                    // Final Grade Display
                    let gradeDisplay = '';
                    if (course?.isConfigured) {
                        if (finalGrade !== null && !isNaN(finalGrade)) {
                            gradeDisplay = `<div id="final-grade-${course.id}" style="font-size: 1.2rem; font-weight: 700; color: var(--secondary-color);">${finalGrade.toFixed(1)}</div>`;
                        } else {
                            gradeDisplay = `<div id="final-grade-${course.id}" style="font-size: 0.75rem; font-weight: 600; color: #ff9800; background: rgba(255,152,0,0.1); padding: 4px 8px; border-radius: 4px; text-transform: uppercase;">Pending Scores</div>`;
                        }
                    }

                    // Components HTML
                    let componentsHTML = '';
                    const components = course?.gradeComponents || [];
                    if (course?.isConfigured && components.length > 0) {
                        componentsHTML = components.map((comp, idx) => `
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 8px;">
                                <div style="font-size: 0.85rem; color: var(--text-secondary);">
                                    ${this.escapeHTML(comp.name)} <span style="font-size: 0.75rem;">(${comp.weight}%)</span>
                                    ${comp.isShield ? ' <i class="bx bx-shield" title="Shield Component" style="font-size: 0.8rem; color: var(--primary-color);"></i>' : ''}
                                </div>
                                <input type="number" class="comp-grade-input" data-courseid="${course.id}" data-index="${idx}" value="${comp.score !== null && comp.score !== undefined ? comp.score : ''}" placeholder="-" style="width: 50px; padding: 2px 4px; border-radius: 4px; border: 1px solid var(--border-color); background: var(--bg-color); color: var(--text-primary); text-align: center; font-size: 0.85rem;">
                            </div>
                        `).join('');
                    } else {
                        componentsHTML = `<p style="font-size: 0.8rem; color: var(--text-secondary); font-style: italic;">Grade breakdown not configured.</p>`;
                    }

                    // Syllabus Metadata
                    let syllabusMetaHTML = '';
                    const staff = course?.staffMetadata;
                    const topics = course?.topics || [];
                    if (staff || topics.length > 0) {
                        const lecturer = staff?.lecturer || 'TBD';
                        const ta = staff?.ta || 'TBD';
                        
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

                    let topicsHTML = '';
                    if (topics && topics.length > 0) {
                        const listItems = topics.map(t => `<li style="margin-bottom: 6px; color: var(--text-secondary);">${this.escapeHTML(t)}</li>`).join('');
                        topicsHTML = `
                            <details style="padding: 12px; background: rgba(255, 255, 255, 0.02); border: 1px solid var(--border-color); border-radius: 8px;">
                                <summary style="cursor: pointer; font-size: 0.85rem; font-weight: 600; color: var(--text-primary); user-select: none;">
                                    📖 Course Syllabus Topics
                                </summary>
                                <ol style="margin-top: 12px; padding-left: 24px; font-size: 0.85rem; margin-bottom: 0;">
                                    ${listItems}
                                </ol>
                            </details>
                        `;
                    }

                    const cardHTML = `
                        <div class="course-card" style="background: var(--surface-color); border-radius: 12px; padding: 24px; border: 1px solid var(--border-color); display: flex; flex-direction: column; gap: 16px;">
                            <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                                <div>
                                    <h3 style="font-size: 1.1rem; color: var(--text-primary); margin-bottom: 4px;">${this.escapeHTML(courseTitle)}</h3>
                                    <div style="display: flex; align-items: center; gap: 12px;">
                                        <span class="credit-badge-actionable" data-courseid="${course.id}" style="font-size: 0.85rem; color: ${courseNekaz ? 'var(--text-secondary)' : '#ff9800'}; font-weight: ${courseNekaz ? '400' : '600'};">
                                            <i class='bx bx-coin-stack'></i> ${courseNekaz ? `${courseNekaz} Nekaz` : 'Credits: TBD'}
                                        </span>
                                        ${gradeDisplay || ''}
                                    </div>
                                </div>
                                <button class="icon-btn setup-grade-btn" data-courseid="${course.id}" title="Setup Grade Breakdown">
                                    <i class='bx bx-cog'></i>
                                </button>
                            </div>
                            
                            ${syllabusMetaHTML}
                            ${topicsHTML}

                            <div style="padding-top: 12px; border-top: 1px dashed var(--border-color);">
                                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                                    <h4 style="font-size: 0.8rem; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.5px;">Grade Builder</h4>
                                    <button class="secondary-btn setup-grade-btn" data-courseid="${course.id}" style="font-size: 0.7rem; padding: 2px 8px;">Edit Setup</button>
                                </div>
                                ${componentsHTML}
                            </div>
                        </div>
                    `;
                    this.coursesGrid.innerHTML += cardHTML;
                } catch (cardError) {
                    console.error("Failed to render course card for:", course, cardError);
                    // Silently fail for this card to prevent White Screen of Death
                }
            });

            // Bind Setup Buttons
            document.querySelectorAll('.setup-grade-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const cid = e.target.closest('.setup-grade-btn').dataset.courseid;
                    this.openGradeBuilder(cid);
                });
            });

            // Bind Component Inputs
            document.querySelectorAll('.comp-grade-input').forEach(input => {
                input.addEventListener('input', (e) => {
                    const cid = e.target.dataset.courseid;
                    const idx = e.target.dataset.index;
                    this.handleComponentGradeUpdate(cid, idx, e.target.value);
                });
            });

            // Stage 7.5: Bind Actionable Credit Badges
            document.querySelectorAll('.credit-badge-actionable').forEach(badge => {
                badge.addEventListener('click', async (e) => {
                    e.preventDefault();
                    e.stopPropagation(); // BUG FIX: Prevent opening course modal
                    
                    const cid = e.target.closest('.credit-badge-actionable').dataset.courseid;
                    const course = coursesToRender.find(c => c.id === cid);
                    
                    if (course) {
                        const currentNekaz = course.nekaz || "";
                        const newValRaw = prompt(`Enter new credits (Nekaz) for ${course.title}:`, currentNekaz);
                        
                        // FIX: Only update IF value is different and valid
                        if (newValRaw !== null) {
                            const newVal = parseFloat(newValRaw);
                            if (!isNaN(newVal) && newVal !== parseFloat(currentNekaz)) {
                                this.updateCourseNekaz(cid, newVal);
                            }
                        }
                    }
                });
            });

            // Stage 6.10: Render Nekaz Action Items
            this.renderNekazActions();

            // Bind Setup Buttons
            document.querySelectorAll('.setup-grade-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const cid = e.target.closest('.setup-grade-btn').dataset.courseid;
                    this.openGradeBuilder(cid);
                });
            });
        }

        // 2. Handle Unassigned Exams (Stage 6.8: Disabled as requested)
        // this.renderUnassignedExams();

        // 3. Update Summary
        this.updateGlobalGPA();
    }

    renderNekazActions() {
        if (!this.unassignedList) return;
        this.unassignedList.innerHTML = '';
        
        const limboCourses = this.courses.filter(c => !c.nekaz || isNaN(parseFloat(c.nekaz)));
        
        if (limboCourses.length === 0) {
            this.unassignedContainer.style.display = 'none';
            return;
        }

        this.unassignedContainer.style.display = 'block';
        
        // Stage 7.5: Make Collapsible
        this.unassignedContainer.innerHTML = `
            <details style="background: rgba(255, 152, 0, 0.05); border: 1px solid rgba(255, 152, 0, 0.3); border-radius: 12px; padding: 20px;">
                <summary style="cursor: pointer; list-style: none; display: flex; align-items: center; justify-content: space-between;">
                    <h3 style="font-size: 1rem; color: #ff9800; margin: 0; display: flex; align-items: center; gap: 8px;">
                        <i class='bx bx-error-circle'></i> Action Required: Missing Credits (${limboCourses.length})
                    </h3>
                    <i class='bx bx-chevron-down' style="color: #ff9800;"></i>
                </summary>
                <div id="nekaz-action-list" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 12px; margin-top: 16px;">
                    <!-- Items will be injected below -->
                </div>
            </details>
        `;

        const listContainer = this.unassignedContainer.querySelector('#nekaz-action-list');

        limboCourses.forEach(course => {
            const div = document.createElement('div');
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
                    <input type="number" step="0.5" id="nekaz-input-${course.id}" placeholder="Nekaz" style="width: 70px; padding: 6px; border-radius: 4px; border: 1px solid var(--border-color); background: var(--bg-color); color: var(--text-primary);">
                    <button class="primary-btn nekaz-save-btn" data-id="${course.id}" style="padding: 6px 12px; font-size: 0.8rem;">Save</button>
                </div>
            `;
            listContainer.appendChild(div);
        });

        // Bind Save Buttons
        this.unassignedList.querySelectorAll('.nekaz-save-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.dataset.id;
                const val = document.getElementById(`nekaz-input-${id}`).value;
                if (val && !isNaN(parseFloat(val))) {
                    this.updateCourseNekaz(id, val);
                }
            });
        });
    }

    renderUnassignedExams() {
        // Stage 6.8 & 6.10: Replaced by renderNekazActions
        if (this.unassignedContainer && !this.unassignedList) {
            this.unassignedContainer.style.display = 'none';
        }
    }

    updateGlobalGPA() {
        const coursesToRender = this.simulationMode ? this.simulationState : this.courses;
        const stats = GradeEngine.calculateGPA(coursesToRender);

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
        this.summaryCourses.textContent = coursesToRender.length;

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

    renderGPAChart(activeCourses) {
        if (!window.Chart) return;
        
        const canvas = document.getElementById('semester-trend-chart');
        if (!canvas) return;

        // Group active courses by detected semester
        const semesterBuckets = {};
        const passedCourses = activeCourses.filter(c => {
            const grade = GradeEngine.calculateFinalGrade(c);
            return grade !== null && grade >= (c.minPassGrade || 60);
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
        
        order.forEach(item => {
            labels.push(item.key);
            const stats = GradeEngine.calculateGPA(semesterBuckets[item.key]);
            dataPoints.push(stats.gpa);
        });

        const globalStats = GradeEngine.calculateGPA(activeCourses);
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
                        min: 60,
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
}

document.addEventListener('DOMContentLoaded', () => {
    window.analyticsApp = new AnalyticsApp();
});
