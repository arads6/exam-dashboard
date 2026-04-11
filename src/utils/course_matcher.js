/**
 * CourseMatcher Utility
 * High-precision matching engine to prevent accidental course merges.
 */
export class CourseMatcher {
    
    /**
     * Normalizes a string by lowercasing and stripping metadata noise (Semesters, Moeds).
     */
    static normalize(str) {
        if (!str) return '';
        let clean = str.toLowerCase();
        
        // Strip Semester & Moed Noise
        const noise = [
            /סמסטר [אבגקיץ]/g, /סמ' [אבגקיץ]/g, /סמ [אבגקיץ]/g,
            /מועד [אבג]/g, /מועדי [אבג]/g,
            /semester [abc]/gi, /sem [abc]/gi, /moed [abc]/gi,
            /['"״׳`´]/g
        ];
        noise.forEach(pattern => { clean = clean.replace(pattern, ' '); });

        // Remove Hebrew punctuation, dashes, spaces, etc.
        return clean.replace(/[^a-z0-9א-ת]/g, '');
    }

    /**
     * Extracts an array of "clean" words for keyword analysis.
     */
    static getWords(str) {
        if (!str) return [];
        return str.toLowerCase()
            .replace(/['"״׳`´]/g, '')
            .replace(/[-\s.,:()|_]+/g, ' ')
            .trim()
            .split(' ')
            .filter(w => w.length > 0);
    }

    /**
     * Identifies if two titles have a "Keyword Conflict" (e.g. Intro vs Advanced).
     */
    static hasConflict(name1, name2) {
        const words1 = this.getWords(name1);
        const words2 = this.getWords(name2);

        // Pairs of words that indicate different courses even if the rest is similar
        const oppositePairs = [
            ['א', 'ב'], ['1', '2'], ['א', '1'], ['ב', '2'],
            ['מבוא', 'מתקדם'], ['intro', 'advanced'],
            ['מקרו', 'מיקרו'], ['macro', 'micro'],
            ['מעבדה', 'תיאוריה'], ['lab', 'theory']
        ];

        for (const [a, b] of oppositePairs) {
            const hasA1 = words1.includes(a);
            const hasB1 = words1.includes(b);
            const hasA2 = words2.includes(a);
            const hasB2 = words2.includes(b);
            if ((hasA1 && hasB2) || (hasB1 && hasA2)) return true;
        }

        // Numeric Identifier Check (Physics 1 vs Physics 2)
        const nums1 = name1.match(/\b\d+\b/g) || [];
        const nums2 = name2.match(/\b\d+\b/g) || [];
        
        if (nums1.length > 0 && nums2.length > 0) {
            const set1 = new Set(nums1);
            const set2 = new Set(nums2);
            for (const n of set1) if (!set2.has(n)) return true;
            for (const n of set2) if (!set1.has(n)) return true;
        }

        return false;
    }

    /**
     * Returns a match analysis for a given portal title against existing courses.
     */
    static analyzeMatch(portalTitle, existingCourses) {
        const candidates = [];

        for (const course of existingCourses) {
            const score = this.calculateSimilarity(portalTitle, course.title);
            
            if (score >= 0.4) {
                console.log(`IDENTITY: Match score for [${portalTitle}] vs [${course.title}] is [${Math.round(score * 100)}%].`);
                
                let type = 'candidate';
                if (score > 0.85 && !this.hasConflict(portalTitle, course.title)) {
                    type = 'auto';
                } else if (this.hasConflict(portalTitle, course.title)) {
                    type = 'conflict';
                }

                candidates.push({ course, score, type });
            }
        }

        // Sort by score descending
        candidates.sort((a, b) => b.score - a.score);

        return {
            candidates,
            best: candidates[0] || null,
            type: candidates.length > 0 ? (candidates[0].type || 'candidate') : 'none'
        };
    }

    /**
     * Calculates Levenshtein Similarity (0 to 1) with Zero-Word-Overlap Guard and Hard Digit Penalty.
     */
    static calculateSimilarity(s1, s2) {
        const n1 = this.normalize(s1);
        const n2 = this.normalize(s2);
        if (n1 === n2) return 1.0;
        if (n1.length === 0 || n2.length === 0) return 0.0;

        // Phase 11.19: Zero Word Overlap Guard (First Check)
        const words1 = this.getWords(s1).filter(w => w.length > 1);
        const words2 = this.getWords(s2).filter(w => w.length > 1);
        const set1 = new Set(words1);
        const intersection = words2.filter(w => set1.has(w));
        
        if (intersection.length === 0) {
            console.log(`IDENTITY: Zero word overlap for [${s1}] vs [${s2}]. Score forced to 0%.`);
            return 0.0;
        }

        const matrix = [];
        for (let i = 0; i <= n2.length; i++) matrix[i] = [i];
        for (let j = 0; j <= n1.length; j++) matrix[0][j] = j;

        for (let i = 1; i <= n2.length; i++) {
            for (let j = 1; j <= n1.length; j++) {
                if (n2.charAt(i - 1) === n1.charAt(j - 1)) {
                    matrix[i][j] = matrix[i - 1][j - 1];
                } else {
                    matrix[i][j] = Math.min(
                        matrix[i-1][j-1] + 1,
                        Math.min(matrix[i][j-1] + 1, matrix[i-1][j] + 1)
                    );
                }
            }
        }
        
        const dist = matrix[n2.length][n1.length];
        const maxLen = Math.max(n1.length, n2.length);
        let score = 1.0 - (dist / maxLen);

        // Phase 11.21: Subset-Based Digit Comparison (Existing numbers must be in Syllabus)
        const numsSyllabus = n1.match(/\d+/g) || [];
        const numsExisting = n2.match(/\d+/g) || [];
        const setSyllabus = new Set(numsSyllabus);
        const setExisting = new Set(numsExisting);
        
        let digitMismatch = false;
        if (numsExisting.length > 0) {
            // If any mandatory digit from the existing course is missing in the syllabus, it's a mismatch
            for (const n of setExisting) {
                if (!setSyllabus.has(n)) {
                    digitMismatch = true;
                    break;
                }
            }
        }
        
        if (digitMismatch && (numsSyllabus.length > 0 || numsExisting.length > 0)) {
            console.log(`IDENTITY: Digit Mismatch [${numsExisting.join(',')}] not in [${numsSyllabus.join(',')}]. Applying 50% penalty.`);
            score *= 0.5;
        }

        console.log(`IDENTITY: Match score for [${s1}] vs [${s2}] is [${Math.round(score * 100)}%] (Shared: [${intersection.join(', ')}])`);
        return score;
    }
}
