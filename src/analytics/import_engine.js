/**
 * ImportEngine - Transcript Parsing Module
 * Phase 10: The Smart Import Engine
 */

export class ImportEngine {

    /**
     * Fixes inverted Hebrew strings caused by PDF RTL/LTR mixing.
     * Often, PDFs paste Hebrew backwards (e.g., "הקיזיפ" instead of "פיזיקה").
     */
    static fixRTL(str) {
        if (!str) return '';
        const hebrewPattern = /[\u0590-\u05FF]/;
        if (!hebrewPattern.test(str)) return str;

        // Split by spaces, reverse each Hebrew word, then reverse the sentence order
        const words = str.split(/\s+/);
        const reversedWords = words.map(word => {
            if (hebrewPattern.test(word) && !/\d{2,}/.test(word)) { // Don't reverse strings containing numbers like "2023"
                return word.split('').reverse().join('');
            }
            return word;
        });
        
        return reversedWords.reverse().join(' ');
    }

    /**
     * Heuristic parser to turn a messy wall of raw text into structured course objects.
     */
    static parseText(rawText) {
        if (!rawText || rawText.trim() === '') return [];
        
        const lines = rawText.split(/[\r\n]+/);
        const results = [];
        
        lines.forEach(line => {
            let cleanLine = line.trim();
            if (cleanLine.length < 4) return; 

            // Boss Mode: Delimiter Support (Phase 11.1)
            const delimiter = ['|', ',', '-'].find(d => cleanLine.includes(d));
            if (delimiter) {
                const parts = cleanLine.split(delimiter).map(p => p.trim());
                if (parts.length >= 2) {
                    const titleRaw = parts[0];
                    const creditRaw = parts[1];
                    const gradeRaw = parts[2] || null;

                    const pNekaz = parseFloat(creditRaw);
                    const pScore = gradeRaw ? parseFloat(gradeRaw) : null;

                    if (!isNaN(pNekaz)) {
                        results.push({
                            title: titleRaw.replace(/[^a-zA-Zא-ת\d\s-"]/g, ' ').replace(/\s+/g, ' ').trim(),
                            nekaz: pNekaz,
                            score: pScore,
                            isBinary: false,
                            needsRetake: pScore !== null && pScore < 56,
                            isConfigured: true,
                            gradeComponents: pScore !== null ? [{ name: 'Imported Score', weight: 100, score: pScore, isShield: false }] : []
                        });
                        return; // Done with this line
                    }
                }
            }

            let score = null;
            let nekaz = null;
            let isPending = false;
            let isBinary = false;
            let needsRetake = false;

            // 1. Pending Status Check (existing heuristic below...)
            const pendingMatch = cleanLine.match(/(====|לא השלים|חסר|Incomplete|Pending)/i);
            if (pendingMatch) {
                isPending = true;
                cleanLine = cleanLine.replace(pendingMatch[0], ' ').trim();
            }

            // 2. Binary / Fail Keywords extraction
            const binaryPassMatch = cleanLine.match(/\b(עובר|פטור|Pass|Exempt|\*)\b/i);
            const binaryFailMatch = cleanLine.match(/\b(נכשל|Fail|F)\b/i);

            if (binaryPassMatch) {
                isBinary = true;
                score = 100; // Implicit 100 for passing binary
                cleanLine = cleanLine.replace(binaryPassMatch[0], ' ').trim();
            } else if (binaryFailMatch) {
                score = 0;
                needsRetake = true;
                cleanLine = cleanLine.replace(binaryFailMatch[0], ' ').trim();
            }

            // 3. Extract all valid numbers from the line for Nekaz & Grade
            const numbers = [...cleanLine.matchAll(/\b\d+(\.\d+)?\b/g)].map(m => parseFloat(m[0]));
            if (numbers.length > 0) {
                // Heuristic filtering: 
                // Grades are typically > 40 (or 0 failing). 
                // Numbers 1-9 are almost always course levels (Calc 1, Phys 2).
                const potentialGrades = numbers.filter(n => n >= 0 && n <= 100 && Number.isInteger(n));
                const potentialCredits = numbers.filter(n => n >= 0.5 && n <= 20);

                if (!isBinary && !isPending && !needsRetake) {
                    // Level Guardrail: If highest potential grade is < 20, it's likely a course level (1, 2, 3), not a grade.
                    const maxGrade = potentialGrades.length > 0 ? Math.max(...potentialGrades) : null;
                    if (maxGrade !== null && maxGrade >= 20) {
                        score = maxGrade;
                    } else if (maxGrade !== null && maxGrade === 0 && numbers.length > 1) {
                        // 0 could be a failing grade if there are other numbers (like nekaz)
                        score = 0;
                    } else {
                        score = null; // Ignore low numbers as grades
                    }
                }

                if (potentialCredits.length > 0) {
                    const remaining = numbers.filter(n => n !== score);
                    if (remaining.length > 0) {
                        // Credit Pattern Check:
                        // 1. Prioritize decimals (4.0, 3.5)
                        const decimalNekaz = remaining.find(n => !Number.isInteger(n) || line.includes(n.toFixed(1)));
                        // 2. If no decimal, prioritize common integer credits (2, 3, 4, 5) if they aren't level indicators
                        const commonIntNekaz = remaining.find(n => n >= 2 && n <= 10);
                        
                        if (decimalNekaz !== undefined) {
                            nekaz = decimalNekaz;
                        } else if (commonIntNekaz !== undefined && (remaining.length > 1 || commonIntNekaz > 5)) {
                            // Only pick a small integer (<=5) as credits if there's another number or it's > 5
                            nekaz = commonIntNekaz;
                        } else if (remaining.length > 0 && Math.max(...remaining) > 5) {
                            nekaz = Math.max(...remaining);
                        }
                    } else if (numbers.length === 1 && score === null && numbers[0] > 5) {
                        // If it's the only number and it's > 5, it's likely credits (e.g. "Theory 6")
                        nekaz = numbers[0];
                    }
                }

                // Non-Destructive Stripping: 
                // Only strip from the name string if we are reasonably sure it's NOT a level identifier.
                // If it's a level identifier (1, 2, 3) it should stay in the title.
                if (score !== null && score >= 20) {
                    cleanLine = cleanLine.replace(new RegExp(`\\b${score}\\b`), ' ');
                }
                if (nekaz !== null && (nekaz > 5 || !Number.isInteger(nekaz))) {
                    cleanLine = cleanLine.replace(new RegExp(`\\b${nekaz}\\b`), ' ');
                }
            }

            // Mark numeric failures (Phase 11: BGU 56 Rule)
            if (score !== null && score < 56 && !isBinary) {
                needsRetake = true;
            }

            // 4. Clean Course Name (Allow " for Hebrew acronyms like חדו"א)
            let title = cleanLine.replace(/[^a-zA-Zא-ת\d\s-"]/g, ' ').replace(/\s+/g, ' ').trim();

            if (title.length > 2) {
                // Extreme PDF Bidi hotfix check: If the title starts with a final-form Hebrew letter
                const hebrewSuffixes = /^[םןףץך]/;
                if (hebrewSuffixes.test(title)) {
                    title = ImportEngine.fixRTL(title);
                }

                results.push({
                    title: title,
                    nekaz: nekaz !== null ? nekaz : 0,
                    score: isPending ? null : score,
                    isBinary: isBinary,
                    needsRetake: needsRetake,
                    isConfigured: true,
                    gradeComponents: (isPending || score === null) ? [] : [{
                        name: 'Imported Score',
                        weight: 100,
                        score: score,
                        isShield: false
                    }]
                });
            }
        });

        // Deduplicate the extracted batch locally
        const unique = [];
        results.forEach(res => {
            if (!unique.find(u => u.title === res.title)) {
                unique.push(res);
            }
        });

        return unique;
    }
}
