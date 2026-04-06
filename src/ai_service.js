/**
 * AI Service Layer - Student OS
 * Handles all LLM interactions with Gemini API using BYOK (Bring Your Own Key).
 */

class AIService {
    constructor() {
        this.MODEL_NAME = 'gemini-2.5-flash';
        this.API_VERSION = 'v1beta';
    }

    getApiKey() {
        return localStorage.getItem('GEMINI_API_KEY');
    }

    /**
     * Call the Gemini API to parse syllabus text.
     * Enforces the Syllabus_Specialist schema.
     */
    async callSyllabusAgent(rawText, metadata) {
        const apiKey = this.getApiKey();
        if (!apiKey) throw new Error("Missing Gemini API Key. Please configure it in your settings.");

        const url = `https://generativelanguage.googleapis.com/${this.API_VERSION}/models/${this.MODEL_NAME}:generateContent?key=${apiKey}`;

        // Constructing the strict system prompt from Syllabus_Specialist SKILL.md rules
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
        5. Staff Extraction: Search for names near "מרצה", "Lecturer", "מתרגל", "TA". Use null if not found. NEVER use "TBD".
        6. Language: Supports Hebrew and English. Preserve original script for names.
        7. Anti-Hallucination: Use Only provided data. No guessing.
        
        Output Format (STRICT JSON ONLY):
        {
          "courseInfo": {
            "moodleName": "${metadata.moodleName}",
            "cleanName": "Clean Title Here",
            "originalSyllabusUrl": "${metadata.url}",
            "staff": { "lecturer": "Name or null", "ta": "Name or null" }
          },
          "gradeComponents": [
            { "name": "Final Exam", "weight": 80, "isShield": false, "minPassGrade": 56, "isRequiredToPassCourse": true }
          ],
          "topics": ["Topic 1", "Topic 2"]
        }
        `;

        const requestBody = {
            contents: [{
                parts: [{
                    text: `${systemPrompt}\n\nRAW SYLLABUS TEXT TO PROCESS:\n${rawText}`
                }]
            }],
            generationConfig: {
                response_mime_type: "application/json",
                temperature: 0.1
            }
        };

        try {
            console.log(`🤖 AI Service: Calling ${this.MODEL_NAME} for course: ${metadata.moodleName}`);
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(`Gemini API Error: ${errorData.error?.message || response.statusText}`);
            }

            const data = await response.json();
            const textResponse = data.candidates?.[0]?.content?.parts?.[0]?.text;

            if (!textResponse) throw new Error("Empty response from AI Agent.");

            return JSON.parse(textResponse);

        } catch (error) {
            console.error("❌ AIService Error:", error);
            throw error;
        }
    }
}

export const aiService = new AIService();
