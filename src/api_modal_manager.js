/**
 * Stage 6.6: Centralized API Modal Manager
 * Handles Modal Injection, Save/Clear logic, and state synchronization across all pages.
 */
class APIModalManager {
    constructor() {
        this.injectModalHTML();
        
        // DOM Elements (Centralized)
        this.modal = document.getElementById('api-key-modal');
        this.keyInput = document.getElementById('api-key-input');
        this.aliasInput = document.getElementById('api-key-alias');
        this.saveBtn = document.getElementById('save-api-key-btn');
        this.clearBtn = document.getElementById('clear-api-key-btn');
        this.closeBtn = document.getElementById('close-api-modal-btn');
        
        // Global Settings Buttons (can exist on multiple pages)
        this.apiSettingsBtns = document.querySelectorAll('#api-settings-btn');
        this.apiLabels = document.querySelectorAll('#api-key-label');

        this.init();
    }

    injectModalHTML() {
        if (document.getElementById('api-key-modal')) return;

        const modalHTML = `
            <div id="api-key-modal" class="modal">
                <div class="modal-content" style="max-width: 450px;">
                    <div class="modal-header">
                        <h2><i class='bx bx-lock-alt'></i> LLM Configuration</h2>
                        <button class="close-btn" id="close-api-modal-btn"><i class='bx bx-x'></i></button>
                    </div>
                    <div style="padding: 16px 0;">
                        <p style="color: var(--text-secondary); margin-bottom: 20px; font-size: 0.9rem; line-height: 1.5;">
                            Enter your <strong>Gemini API Key</strong> to enable the Syllabus Harvester. 
                            <br><a href="https://aistudio.google.com/app/apikey" target="_blank" style="color: var(--primary-color);">Get a key from Google AI Studio &rarr;</a>
                        </p>
                        <div class="form-group" style="margin-bottom: 16px;">
                            <label for="api-key-alias">Key Alias / Nickname</label>
                            <input type="text" id="api-key-alias" placeholder="e.g., My Personal Key" 
                                   style="width: 100%; padding: 12px; border-radius: 8px; background: var(--bg-color); border: 1px solid var(--border-color); color: var(--text-primary); margin-top: 4px;">
                        </div>
                        <div class="form-group">
                            <label for="api-key-input">Gemini API Key</label>
                            <input type="password" id="api-key-input" placeholder="Paste your key here..." 
                                   style="width: 100%; padding: 12px; border-radius: 8px; background: var(--bg-color); border: 1px solid var(--border-color); color: var(--text-primary); margin-top: 4px;">
                        </div>
                    </div>
                    <div class="modal-footer" style="display: flex; gap: 12px;">
                        <button id="clear-api-key-btn" class="danger-btn" style="flex: 1;">Clear Key</button>
                        <button id="save-api-key-btn" class="primary-btn" style="flex: 2;">Save Key</button>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHTML);
    }

    init() {
        this.bindEvents();
        this.updateUIStatus();
        
        // Listen for storage changes to sync UI across tabs
        window.addEventListener('storage', (e) => {
            if (e.key === 'GEMINI_API_KEY' || e.key === 'GEMINI_KEY_ALIAS') {
                this.updateUIStatus();
            }
        });
    }

    bindEvents() {
        // Global Delegation (Stage 6.8): Ensures the button works reliably across all pages
        document.body.addEventListener('click', (e) => {
            const btn = e.target.closest('#api-settings-btn');
            if (btn) {
                e.preventDefault();
                this.openModal();
            }
        });

        if (this.closeBtn) this.closeBtn.addEventListener('click', () => this.closeModal());
        if (this.saveBtn) this.saveBtn.addEventListener('click', () => this.saveKey());
        if (this.clearBtn) this.clearBtn.addEventListener('click', () => this.clearKey());

        // Modal backdrop click
        window.addEventListener('click', (e) => {
            if (this.modal && e.target === this.modal) this.closeModal();
        });
    }

    openModal() {
        if (!this.modal) return;
        const key = localStorage.getItem('GEMINI_API_KEY');
        const alias = localStorage.getItem('GEMINI_KEY_ALIAS');
        
        if (this.keyInput) this.keyInput.value = key || '';
        if (this.aliasInput) this.aliasInput.value = alias || '';
        
        this.modal.classList.add('active');
    }

    closeModal() {
        if (!this.modal) return;
        const reset = () => {
            this.modal.classList.remove('active', 'closing');
            if (this.keyInput) this.keyInput.value = '';
            if (this.aliasInput) this.aliasInput.value = '';
        };

        if (this.modal.classList.contains('active')) {
            this.modal.classList.add('closing');
            setTimeout(reset, 200);
            window.dispatchEvent(new CustomEvent('api_key_cancelled'));
        } else {
            reset();
        }
    }

    saveKey() {
        if (!this.keyInput) return;
        const key = this.keyInput.value.trim();
        const alias = this.aliasInput ? this.aliasInput.value.trim() : "Main Key";
        
        if (key) {
            localStorage.setItem('GEMINI_API_KEY', key);
            localStorage.setItem('GEMINI_KEY_ALIAS', alias);
            this.updateUIStatus();
            this.closeModal();
            window.dispatchEvent(new CustomEvent('api_key_saved'));
        } else {
            alert("Please enter a valid API key.");
        }
    }

    clearKey() {
        if (confirm("Are you sure you want to clear your API Key?")) {
            localStorage.removeItem('GEMINI_API_KEY');
            localStorage.removeItem('GEMINI_KEY_ALIAS');
            this.updateUIStatus();
            this.closeModal();
        }
    }

    updateUIStatus() {
        const alias = localStorage.getItem('GEMINI_KEY_ALIAS');
        const hasKey = !!localStorage.getItem('GEMINI_API_KEY');

        const labels = document.querySelectorAll('#api-key-label');
        labels.forEach(label => {
            label.textContent = hasKey ? `Active: ${alias || 'Key Set'}` : "Setup AI";
        });

        const btns = document.querySelectorAll('#api-settings-btn');
        btns.forEach(btn => {
            if (hasKey) btn.classList.add('active');
            else btn.classList.remove('active');
        });
    }
}

// Singleton export
export const apiModalManager = new APIModalManager();
window.apiModalManager = apiModalManager; // For debugging
