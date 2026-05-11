class ThemeManager {
    constructor() {
        this.pageSettings = []; // Array of { onInit, onSave, onCancel }
        this.prefs = JSON.parse(localStorage.getItem('student_os_prefs') || '{}');
        // Canonical source of truth for rollback — the standalone 'theme' key
        this._savedTheme = localStorage.getItem('theme') || 'dark';
    }

    init() {
        this.injectModal();
        this.injectCog();
        this.bindEvents();
    }

    // Apply the last COMMITTED theme — used for rollback on cancel
    applySavedTheme() {
        document.documentElement.setAttribute('data-theme', this._savedTheme);
    }

    injectModal() {
        const modalHtml = `
            <div class="modal" id="global-settings-modal">
                <div class="modal-content" style="max-width: 460px;">
                    <div class="modal-header">
                        <h2>Dashboard Preferences</h2>
                        <button class="icon-btn" id="close-global-settings-btn"
                            style="background:transparent; border:none; color:var(--text-secondary); cursor:pointer; font-size:1.5rem;">
                            <i class='bx bx-x'></i>
                        </button>
                    </div>

                    <div style="padding: 20px 0;">
                        <!-- Global Settings Section -->
                        <div style="margin-bottom: 32px;">
                            <h3 style="font-size: 0.75rem; text-transform: uppercase; letter-spacing: 1.5px;
                                color: var(--text-secondary); margin-bottom: 20px;
                                border-bottom: 1px solid var(--border-color); padding-bottom: 8px;">
                                🌐 Global Settings
                            </h3>

                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                                <div style="flex: 1;">
                                    <p style="font-size: 0.82rem; color: var(--text-secondary); margin: 0; line-height: 1.4;">
                                        Applies across all pages immediately. Close without saving to preview only.
                                    </p>
                                </div>
                                <label class="modern-toggle-wrapper" style="margin-left: 16px;">
                                    <input type="checkbox" class="modern-toggle-input" id="pref-theme-toggle">
                                    <span class="modern-toggle-slider"></span>
                                    <span class="modern-toggle-label" id="theme-toggle-label">Dark Mode 🌙</span>
                                </label>
                            </div>
                        </div>

                        <!-- Page Specific Settings Section -->
                        <div id="page-specific-settings-section" style="display: none;">
                            <h3 style="font-size: 0.75rem; text-transform: uppercase; letter-spacing: 1.5px;
                                color: var(--text-secondary); margin-bottom: 20px;
                                border-bottom: 1px solid var(--border-color); padding-bottom: 8px;">
                                📄 Page Specific Settings
                            </h3>
                            <div id="page-specific-container"></div>
                        </div>
                    </div>

                    <div class="modal-footer" style="text-align: right; border-top: 1px solid var(--border-color); padding-top: 20px;">
                        <button id="save-global-settings-btn" class="primary-btn" style="padding: 10px 32px;">
                            Save Preferences
                        </button>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHtml);

        this.modal = document.getElementById('global-settings-modal');
        this.closeBtn = document.getElementById('close-global-settings-btn');
        this.saveBtn = document.getElementById('save-global-settings-btn');
        this.themeToggle = document.getElementById('pref-theme-toggle');
        this.themeLabel = document.getElementById('theme-toggle-label');
        this.pageSpecificSection = document.getElementById('page-specific-settings-section');
        this.pageSpecificContainer = document.getElementById('page-specific-container');
    }

    injectCog() {
        const container = document.querySelector('.header-settings-container');
        if (container && !document.getElementById('open-settings-btn')) {
            container.insertAdjacentHTML('beforeend', `
                <button id="open-settings-btn" title="Dashboard Settings">
                    <i class='bx bx-cog'></i>
                </button>
            `);
        }
        this.openBtn = document.getElementById('open-settings-btn');
    }

    bindEvents() {
        if (this.openBtn) {
            this.openBtn.addEventListener('click', () => this.openModal());
        }

        if (this.closeBtn) {
            this.closeBtn.addEventListener('click', () => this.closeModal());
        }

        window.addEventListener('click', (e) => {
            if (e.target === this.modal) this.closeModal();
        });

        if (this.themeToggle) {
            this.themeToggle.addEventListener('change', (e) => this.handleThemePreview(e.target.checked));
        }

        if (this.saveBtn) {
            this.saveBtn.addEventListener('click', () => this.saveSettings());
        }
    }

    openModal() {
        const isLight = document.documentElement.getAttribute('data-theme') === 'light';
        this.themeToggle.checked = isLight;
        this.updateThemeUI(isLight);

        this.pageSettings.forEach(setting => {
            if (setting.onInit) setting.onInit();
        });

        this.modal.classList.add('active');
    }

    closeModal() {
        this.modal.classList.remove('active');
        // Rollback: revert to last SAVED theme without touching localStorage
        this.applySavedTheme();

        this.pageSettings.forEach(setting => {
            if (setting.onCancel) setting.onCancel();
        });
    }

    // Live preview — updates DOM immediately, does NOT write localStorage
    handleThemePreview(isLight) {
        document.documentElement.setAttribute('data-theme', isLight ? 'light' : 'dark');
        this.updateThemeUI(isLight);
    }

    updateThemeUI(isLight) {
        if (this.themeLabel) {
            this.themeLabel.textContent = isLight ? 'Light Mode ☀️' : 'Dark Mode 🌙';
        }
    }

    // Commit — only writes localStorage when user clicks Save
    async saveSettings() {
        const isLight = this.themeToggle.checked;
        const theme = isLight ? 'light' : 'dark';

        // Write to the standalone 'theme' key (read by the blocking head script on next load)
        localStorage.setItem('theme', theme);
        // Keep prefs object in sync
        this.prefs.theme = theme;
        localStorage.setItem('student_os_prefs', JSON.stringify(this.prefs));
        // Update rollback target
        this._savedTheme = theme;

        for (const setting of this.pageSettings) {
            if (setting.onSave) await setting.onSave();
        }

        this.modal.classList.remove('active');
        this.showToast('⚙️ Preferences saved.');
    }

    showToast(message, duration = 3000) {
        const toast = document.createElement('div');
        toast.style.cssText = `
            position: fixed; bottom: 30px; left: 50%; transform: translateX(-50%);
            background: var(--surface-color); color: var(--text-primary);
            padding: 12px 24px; border-radius: 30px;
            box-shadow: 0 10px 40px rgba(0,0,0,0.4);
            border: 1px solid var(--primary-color); z-index: 9999;
            font-size: 0.9rem; font-weight: 600;
            display: flex; align-items: center; gap: 10px;
            animation: slideUp 0.3s ease;
        `;
        toast.innerHTML = `<i class='bx bx-check-circle' style='color: var(--primary-color); font-size: 1.1rem'></i> ${message}`;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), duration);
    }

    /**
     * Public API for page-level scripts to inject settings into the "Page Specific" section.
     * @param {string}   htmlTemplate - HTML string to inject
     * @param {function} onInit       - Called when modal opens; sync UI to live state
     * @param {function} onSave       - Called when Save is clicked (async-friendly)
     * @param {function} onCancel     - Called when modal closes without saving
     */
    addPageSpecificSetting(htmlTemplate, onInit, onSave, onCancel) {
        if (!this.pageSpecificContainer) return;

        this.pageSpecificSection.style.display = 'block';
        this.pageSpecificContainer.insertAdjacentHTML('beforeend', htmlTemplate);

        this.pageSettings.push({ onInit, onSave, onCancel });
    }
}

export const themeManager = new ThemeManager();
