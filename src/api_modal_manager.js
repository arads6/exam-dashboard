import { securityService } from './security_service.js';

/**
 * Stage 6.6 & Phase 11.23: Centralized API Modal Manager (Secure Vault)
 * Handles Modal Injection, Save/Clear logic, and state synchronization.
 * Integrates with zero-trust SecurityService for AES-256 key storage.
 */
class APIModalManager {
    constructor() {
        this.injectModalHTML();
        
        // DOM Elements (Centralized)
        this.modal = document.getElementById('api-key-modal');
        this.keyInput = document.getElementById('api-key-input');
        this.groqKeyInput = document.getElementById('groq-key-input');
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
                        <h2><i class='bx bx-lock-alt'></i> Secure LLM Vault</h2>
                        <button class="close-btn" id="close-api-modal-btn"><i class='bx bx-x'></i></button>
                    </div>
                    <div style="padding: 16px 0;">
                        <p style="color: var(--text-secondary); margin-bottom: 20px; font-size: 0.9rem; line-height: 1.5;">
                            Enter your API Keys to enable the Syllabus Harvester. Keys are encrypted locally using AES-256. 
                            <br><a href="https://aistudio.google.com/app/apikey" target="_blank" style="color: var(--primary-color);">Get a Gemini Key &rarr;</a>
                             | <a href="https://console.groq.com/keys" target="_blank" style="color: var(--primary-color);">Get a Groq Key &rarr;</a>
                        </p>
                        <div class="form-group" style="margin-bottom: 16px;">
                            <label for="api-key-alias">Vault Alias / Nickname</label>
                            <input type="text" id="api-key-alias" placeholder="e.g., My Secure Vault" 
                                   style="width: 100%; padding: 12px; border-radius: 8px; background: var(--bg-color); border: 1px solid var(--border-color); color: var(--text-primary); margin-top: 4px;">
                        </div>
                        <div class="form-group" style="margin-bottom: 16px;">
                            <label for="api-key-input">Primary Key (Gemini) <span style="color: #cf6679">*</span></label>
                            <input type="password" id="api-key-input" placeholder="Paste Gemini key here..." 
                                   style="width: 100%; padding: 12px; border-radius: 8px; background: var(--bg-color); border: 1px solid var(--border-color); color: var(--text-primary); margin-top: 4px;">
                        </div>
                        <div class="form-group">
                            <label for="groq-key-input">Fallback Key (Groq) <span style="font-size: 0.8em; color: var(--text-secondary);">(Optional)</span></label>
                            <input type="password" id="groq-key-input" placeholder="Paste Groq key here..." 
                                   style="width: 100%; padding: 12px; border-radius: 8px; background: var(--bg-color); border: 1px solid var(--border-color); color: var(--text-primary); margin-top: 4px;">
                        </div>
                    </div>
                    <div class="modal-footer" style="display: flex; gap: 12px;">
                        <button id="clear-api-key-btn" class="danger-btn" style="flex: 1;">Clear Vault</button>
                        <button id="save-api-key-btn" class="primary-btn" style="flex: 2;">Encrypt & Save</button>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHTML);
    }

    init() {
        this.bindEvents();
        this.updateUIStatus();
        
        window.addEventListener('storage', (e) => {
            if (e.key === 'ENCRYPTED_GEMINI_KEY' || e.key === 'GEMINI_KEY_ALIAS') {
                this.updateUIStatus();
            }
        });
    }

    bindEvents() {
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

        window.addEventListener('click', (e) => {
            if (this.modal && e.target === this.modal) this.closeModal();
        });
    }

    openModal() {
        if (!this.modal) return;
        const alias = localStorage.getItem('GEMINI_KEY_ALIAS');
        
        // Phase 11.23 Security: Keys are never displayed back in plaintext
        if (this.keyInput) this.keyInput.value = securityService.hasKey('gemini') ? "********" : "";
        if (this.groqKeyInput) this.groqKeyInput.value = securityService.hasKey('groq') ? "********" : "";
        if (this.aliasInput) this.aliasInput.value = alias || '';
        
        this.modal.classList.add('active');
    }

    closeModal() {
        if (!this.modal) return;
        const reset = () => {
            this.modal.classList.remove('active', 'closing');
            if (this.keyInput) this.keyInput.value = '';
            if (this.groqKeyInput) this.groqKeyInput.value = '';
        };

        if (this.modal.classList.contains('active')) {
            this.modal.classList.add('closing');
            setTimeout(reset, 200);
            window.dispatchEvent(new CustomEvent('api_key_cancelled'));
        } else {
            reset();
        }
    }

    async saveKey() {
        if (!this.keyInput) return;
        const key = this.keyInput.value.trim();
        const groqKey = this.groqKeyInput ? this.groqKeyInput.value.trim() : "";
        const alias = this.aliasInput ? this.aliasInput.value.trim() : "Secure Vault";
        
        // Prevent saving literal "********" mask
        if (key && key !== "********") {
            await securityService.saveKey('gemini', key);
            localStorage.setItem('GEMINI_KEY_ALIAS', alias);
        }
        
        if (groqKey && groqKey !== "********") {
            await securityService.saveKey('groq', groqKey);
        }

        if (securityService.hasKey('gemini')) {
            this.updateUIStatus();
            this.closeModal();
            window.dispatchEvent(new CustomEvent('api_key_saved'));
        } else {
            alert("A valid Primary Gemini Key is required to power the AI Harvester.");
        }
    }

    clearKey() {
        if (confirm("🛡️ Are you sure you want to permanently delete all encrypted keys from this device?")) {
            securityService.clearKey('gemini');
            securityService.clearKey('groq');
            localStorage.removeItem('GEMINI_KEY_ALIAS');
            this.updateUIStatus();
            this.closeModal();
        }
    }

    updateUIStatus() {
        const alias = localStorage.getItem('GEMINI_KEY_ALIAS');
        const hasKey = securityService.hasKey('gemini');

        const labels = document.querySelectorAll('#api-key-label');
        labels.forEach(label => {
            label.textContent = hasKey ? `Active: ${alias || 'Secured'}` : "Setup AI Vault";
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
