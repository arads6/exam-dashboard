/**
 * Security Service - The Vault
 * Zero-Trust architecture for storing API keys securely locally using AES-256-GCM.
 * Hardware-bound encryption via browser fingerprinting.
 */

class SecurityService {
    constructor() {
        this._initialized = this._init();
    }

    async _init() {
        // Enforce Phase 11.23 Security Policy: Scrub plaintext keys immediately
        if (localStorage.getItem('GEMINI_API_KEY')) {
            console.warn("🛡️ SECURITY: Legacy plaintext Gemini API Key detected. Scrubbing per Zero-Trust policy.");
            localStorage.removeItem('GEMINI_API_KEY');
        }
        
        // Generate a machine-bound fingerprint. Note: Not cryptographically perfect,
        // but solves the "casual copy-paste of localStorage" threat vector.
        const fingerprint = [
            navigator.userAgent,
            screen.width,
            screen.height,
            "STUDENT_OS_VAULT_SALT_v1"
        ].join('|');
        
        const encoder = new TextEncoder();
        const data = encoder.encode(fingerprint);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        
        this.aesKey = await crypto.subtle.importKey(
            'raw',
            hashBuffer,
            { name: 'AES-GCM' },
            false,
            ['encrypt', 'decrypt']
        );
    }

    async saveKey(provider, plainKey) {
        await this._initialized;
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const encodedPlaintext = new TextEncoder().encode(plainKey);
        
        const ciphertextBuffer = await crypto.subtle.encrypt(
            { name: 'AES-GCM', iv: iv },
            this.aesKey,
            encodedPlaintext
        );
        
        // Bundle IV and Ciphertext together for storage
        const bundle = new Uint8Array(iv.length + ciphertextBuffer.byteLength);
        bundle.set(iv, 0);
        bundle.set(new Uint8Array(ciphertextBuffer), iv.length);
        
        // Convert to Base64
        const base64Str = btoa(String.fromCharCode.apply(null, bundle));
        localStorage.setItem(`ENCRYPTED_${provider.toUpperCase()}_KEY`, base64Str);
    }

    hasKey(provider) {
        return !!localStorage.getItem(`ENCRYPTED_${provider.toUpperCase()}_KEY`);
    }

    clearKey(provider) {
        localStorage.removeItem(`ENCRYPTED_${provider.toUpperCase()}_KEY`);
    }

    /**
     * Executes a callback with the decrypted key in scope, then releases it immediately.
     * Prevents keys from lingering in global memory spaces.
     */
    async withKey(provider, callback) {
        await this._initialized;
        const base64Str = localStorage.getItem(`ENCRYPTED_${provider.toUpperCase()}_KEY`);
        
        if (!base64Str) {
            throw new Error(`Missing API Key for provider: ${provider}. Please configure it in your settings.`);
        }
        
        let plainKey;
        try {
            const bundleString = atob(base64Str);
            const bundle = new Uint8Array(bundleString.length);
            for (let i = 0; i < bundleString.length; i++) {
                bundle[i] = bundleString.charCodeAt(i);
            }
            
            const iv = bundle.slice(0, 12);
            const ciphertext = bundle.slice(12);
            
            const decryptedBuffer = await crypto.subtle.decrypt(
                { name: 'AES-GCM', iv: iv },
                this.aesKey,
                ciphertext
            );
            
            plainKey = new TextDecoder().decode(decryptedBuffer);
        } catch (error) {
            console.error(`🛡️ Vault Decryption Error for ${provider}:`, error);
            throw new Error(`Corrupted or Invalid API Key for ${provider}. Please re-enter it in Settings.`);
        }
        
        // Execute the guarded callback outside the encryption try/catch to preserve actual network/model errors
        return await callback(plainKey);
    }
}

export const securityService = new SecurityService();
