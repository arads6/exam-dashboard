/**
 * CourseMatcher Utility
 * High-precision matching engine to prevent accidental course merges.
 */
export class CourseMatcher {
    
    /**
     * Normalizes a string by lowercasing and stripping all non-alphanumeric characters.
     */
    static normalize(str) {
        if (!str) return '';
        // Explicitly strip Hebrew quotes, apostrophes, and standard quotes
        let clean = str.toLowerCase().replace(/['"״׳`´]/g, '');
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
            ['א', 'ב'],
            ['1', '2'],
            ['מבוא', 'מתקדם'],
            ['intro', 'advanced'],
            ['מקרו', 'מיקרו'],
            ['macro', 'micro'],
            ['מעבדה', 'תיאוריה'],
            ['lab', 'theory']
        ];

        for (const [a, b] of oppositePairs) {
            const hasA1 = words1.includes(a);
            const hasB1 = words1.includes(b);
            const hasA2 = words2.includes(a);
            const hasB2 = words2.includes(b);

            // Conflict Case 1: One has 'A', the other has 'B'
            if ((hasA1 && hasB2) || (hasB1 && hasA2)) return true;
            
            // Conflict Case 2: One has 'A', the other has neither (Potential new sequence)
            // But we only flag if the word 'A' or 'B' is a distinct suffix/identifier
        }

        // Numeric Identifier Check (Physics 1 vs Physics 2)
        const nums1 = name1.match(/\b\d+\b/g) || [];
        const nums2 = name2.match(/\b\d+\b/g) || [];
        
        if (nums1.length > 0 && nums2.length > 0) {
            // If they have numbers, they MUST match exactly to avoid conflict
            const set1 = new Set(nums1);
            const set2 = new Set(nums2);
            for (const n of set1) {
                if (!set2.has(n)) return true;
            }
            for (const n of set2) {
                if (!set1.has(n)) return true;
            }
        }

        return false;
    }

    /**
     * Returns a match analysis for a given portal title against existing courses.
     */
    static analyzeMatch(portalTitle, existingCourses) {
        const normPortal = this.normalize(portalTitle);
        
        let bestCandidate = null;
        let matchType = 'none';

        for (const course of existingCourses) {
            const normExisting = this.normalize(course.title);
            
            // 1. Literal Equality
            if (normPortal === normExisting) {
                return { course, type: 'auto' };
            }

            // 2. Fuzzy/Keyword Check
            // We use the storage's fuzzy logic as a base, then run our conflict check
            const isFuzzy = this.simpleFuzzy(portalTitle, course.title);
            
            if (isFuzzy) {
                if (this.hasConflict(portalTitle, course.title)) {
                    // Conflict found! Flag for manual or default to 'new'
                    return { course, type: 'conflict' };
                } else {
                    // Similar enough and no conflicts
                    bestCandidate = course;
                    matchType = 'auto';
                }
            }
        }

        return { course: bestCandidate, type: matchType };
    }

    /**
     * Simple internal fuzzy check (similar to storage.isFuzzyMatch but cleaner for this context)
     */
    static simpleFuzzy(s1, s2) {
        const n1 = this.normalize(s1);
        const n2 = this.normalize(s2);
        if (n1 === n2) return true;
        

        if (n1.length === 0 || n2.length === 0) return false;

        const matrix = [];
        for (let i = 0; i <= n2.length; i++) {
            matrix[i] = [i];
        }
        for (let j = 0; j <= n1.length; j++) {
            matrix[0][j] = j;
        }
        for (let i = 1; i <= n2.length; i++) {
            for (let j = 1; j <= n1.length; j++) {
                if (n2.charAt(i - 1) === n1.charAt(j - 1)) {
                    matrix[i][j] = matrix[i - 1][j - 1];
                } else {
                    matrix[i][j] = Math.min(
                        matrix[i - 1][j - 1] + 1,
                        Math.min(matrix[i][j - 1] + 1, matrix[i - 1][j] + 1)
                    );
                }
            }
        }
        
        const dist = matrix[n2.length][n1.length];
        const maxDist = Math.max(1, Math.floor(Math.min(n1.length, n2.length) / 4));
        return dist <= maxDist;
    }
}
