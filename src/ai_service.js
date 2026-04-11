/**
 * AI Service Layer - Student OS
 * Secure LLM integrations with Phase 11.23 Vault zero-trust storage.
 * Multi-Provider Support (Gemini Primary, Groq Fallback).
 */

import { securityService } from './security_service.js';

class AIService {
    constructor() {
        this.MODEL_NAME = 'gemini-1.5-flash';
        this.API_VERSION = 'v1';
    }

    async _sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Call the AI Agent to parse syllabus text.
     * Enforces the Syllabus_Specialist schema and Failover Logic.
     */
    async callSyllabusAgent(rawText, metadata) {
        
        const systemPrompt = `
        Role: Academic Data Extraction Specialist (BGU Syllabus Harvester)
        Objective: Transform unstructured syllabus text into strict JSON format.
        
        Input Context:
        - Moodle Course Name: "${metadata.moodleName}"
        - Syllabus URL: "${metadata.url}"
        
        Extraction Rules:
        1. Grade Weights: Strictly numerical (e.g., 80, not "80%").
        2. Shields (מגן): phrases like "ציון הגבוה מבין השניים", "מגן" -> set "isShield": true.
        3. Hurdles: "ציון עובר במבחן" -> set "minPassGrade" (default 56 for BGU).
        4. Name Normalization: Clean "${metadata.moodleName}" as "cleanName".
        5. Staff Extraction (STRICT): Search for names near "מרצה", "ד"ר", "פרופ'", "סגל הוראה", "Lecturer", "מתרגל", "TA". 
           - IF FOUND: Return the exact academic name string. 
           - IF NOT FOUND: You MUST return strictly null. Do not include debug text.
        6. Language: Supports Hebrew and English. Preserve original script for names.
        7. Anti-Hallucination: Use Only provided data. No guessing.
        
        Output Format (STRICT JSON ONLY):
        {
          "courseInfo": {
            "moodleName": "${metadata.moodleName}",
            "cleanName": "Clean Title Here",
            "originalSyllabusUrl": "${metadata.url}",
            "staff": {
                "type": "object",
                "properties": {
                    "lecturer": { "type": ["string", "null"], "description": "Full name of the main lecturer. IF NOT FOUND RETURN null." },
                    "ta": { "type": ["string", "null"], "description": "Full name of the TA. IF NOT FOUND RETURN null." }
                }
            },
            "term": {
                "type": "object",
                "properties": {
                    "year": { "type": ["string", "null"], "description": "Academic year. e.g. 2025, תשפ'ה" },
                    "semester": { "type": ["string", "null"], "description": "Semester. e.g. Fall, A, סתו, אביב" }
                }
            }
          },
          "required": ["cleanName", "moodleName", "staff"]
        },
        "gradeComponents": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "name": { "type": "string" },
                    "weight": { "type": "string", "description": "e.g. '20%'" },
                    "isShield": { "type": "boolean" },
                    "score": { "type": "number", "description": "NULL unless explicitly stated as a grade." }
                },
                "required": ["name", "weight", "isShield"]
            }
        }
        
        You must extract ONLY academic names. If a field contains 'Semester', 'Group', or dates, leave it strictly null. If no names are found, return null.
        `;

        let lastError = null;

        // --- PRIMARY ROUTE: GEMINI 1.5 FLASH (3 TRIES) ---
        if (securityService.hasKey('gemini')) {
            for (let attempt = 1; attempt <= 3; attempt++) {
                try {
                    return await securityService.withKey('gemini', async (geminiKey) => {
                        const url = `https://generativelanguage.googleapis.com/${this.API_VERSION}/models/${this.MODEL_NAME}:generateContent?key=${geminiKey}`;
                        
                        console.log(`🤖 AI Service: Calling Gemini (Attempt ${attempt}/3) for course: ${metadata.moodleName}`);
                        
                        const response = await fetch(url, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                contents: [{ parts: [{ text: `${systemPrompt}\n\nRAW SYLLABUS TEXT TO PROCESS:\n${rawText}` }] }],
                                generationConfig: { response_mime_type: "application/json", temperature: 0.1 }
                            })
                        });

                        if (!response.ok) {
                            const errorData = await response.json().catch(()=>({}));
                            throw new Error(JSON.stringify({ status: response.status, message: errorData.error?.message || response.statusText }));
                        }

                        const data = await response.json();
                        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
                        if (!text) throw new Error(JSON.stringify({ status: 500, message: "Empty response from Gemini Agent."}));
                        return JSON.parse(text);
                    });
                } catch (err) {
                    lastError = err;
                    let status = 500;
                    try {
                        const parsed = JSON.parse(err.message);
                        status = parsed.status;
                    } catch(e) {}
                    
                    if (attempt < 3 && (status === 429 || status === 503)) {
                        const delay = attempt === 1 ? 1000 : (attempt === 2 ? 2000 : 4000);
                        console.warn(`Gemini 429/503 detected. Retrying in ${delay/1000}s...`);
                        await this._sleep(delay);
                    } else {
                        break; 
                    }
                }
            }
        } else {
            lastError = new Error("No primary Gemini key configured in Vault.");
        }

        // --- FALLBACK ROUTE: GROQ ---
        if (securityService.hasKey('groq')) {
            console.warn("🔄 Gemini exhausted. Switching to Groq fallback...");
            
            // Phase 11.23: UI Notification for Fallback
            // If the app is using AnalyticsApp, we can dispatch a globally catchable event.
            // Or since AnalyticsApp creates toast dynamically, we can just dispatch to window.
            window.dispatchEvent(new CustomEvent('analytics_toast', { detail: "Gemini busy, switching to backup AI..." }));
            
            try {
                return await securityService.withKey('groq', async (groqKey) => {
                    const url = `https://api.groq.com/openai/v1/chat/completions`;
                    console.log(`🤖 AI Service: Calling Groq (llama-3.3-70b-versatile) for course: ${metadata.moodleName}`);
                    
                    const response = await fetch(url, {
                        method: 'POST',
                        headers: { 
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${groqKey}`
                        },
                        body: JSON.stringify({
                            model: "llama-3.3-70b-versatile",
                            messages: [
                                { role: "system", content: systemPrompt },
                                { role: "user", content: `RAW SYLLABUS TEXT TO PROCESS:\n${rawText}` }
                            ],
                            response_format: { type: "json_object" },
                            temperature: 0.1
                        })
                    });

                    if (!response.ok) {
                        const errorData = await response.json().catch(()=>({}));
                        throw new Error(`Groq API Error: ${errorData.error?.message || response.statusText}`);
                    }

                    const data = await response.json();
                    const text = data.choices?.[0]?.message?.content;
                    if (!text) throw new Error("Empty response from Groq Agent.");
                    return JSON.parse(text);
                });
            } catch (err) {
                console.error("❌ Groq Fallback Error:", err);
                // Parse Gemini JSON Error if present
                let geminiStr = "None";
                if (lastError) {
                    try {
                        const parsedGemini = JSON.parse(lastError.message);
                        geminiStr = `Status ${parsedGemini.status}: ${parsedGemini.message}`;
                    } catch(e) {
                        geminiStr = lastError.message;
                    }
                }
                throw new Error(`AI Extraction Failed. Gemini -> [${geminiStr}] | Groq Fallback -> [${err.message}]`);
            }
        } else {
             throw new Error(`System Error: Primary LLM failed and no Fallback Groq Key is stored in the Vault. (${lastError.message})`);
        }
    }
}

export const aiService = new AIService();
