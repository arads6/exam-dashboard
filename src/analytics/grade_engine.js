/**
 * GradeEngine - Pure Logic Module
 * Phase 9: The Grade & GPA Engine
 * Handles all grade calculations, GPA computations, and semester logic.
 * No side-effects, no localStorage access.
 */

export class GradeEngine {
    static DEFAULT_MIN_PASS_GRADE = 56;

    /**
     * Calculates the final grade for a specific course based on its components.
     * Implements "Shield Grade" logic: includes shield only if it improves the score.
     * @param {Object} course The course object
     * @returns {number|null} The final grade (0-100) or null if incomplete
     */
    static calculateFinalGrade(course) {
        if (!course) return null;
        
        // 1. User Override
        if (course.userOverrideGrade !== undefined && course.userOverrideGrade !== null) {
            return GradeEngine.clampGrade(course.userOverrideGrade);
        }

        // 2. Source of Truth: The University Portal Overrides All
        if (course.officialGrade !== undefined && course.officialGrade !== null) {
            return GradeEngine.clampGrade(course.officialGrade);
        }

        // 3. Fallback to Local Computation
        return GradeEngine.calculateComputedGrade(course);
    }

    /**
     * Extracts the raw mathematical grade based on the components setup
     * regardless of official records, allowing UI tracking for "drift".
     * Supports "isOffset" components for manual adjustments.
     */
    static calculateComputedGrade(course) {
        if (!course || !course.isConfigured || !course.gradeComponents || course.gradeComponents.length === 0) {
            return null;
        }

        const components = course.gradeComponents.map(c => ({
            ...c,
            score: c.score !== null && c.score !== undefined ? parseFloat(c.score) : null,
            weight: parseFloat(c.weight)
        }));

        // Separate normal components from offsets
        const normalComponents = components.filter(c => !c.isOffset && c.score !== null && !isNaN(c.score) && c.weight > 0);
        const offsetComponents = components.filter(c => c.isOffset && c.score !== null && !isNaN(c.score));

        if (normalComponents.length === 0 && offsetComponents.length === 0) return null;

        const calculateWeighted = (activeComponents) => {
            const totalWeight = activeComponents.reduce((sum, c) => sum + c.weight, 0);
            if (totalWeight === 0) return 0;
            const rawSum = activeComponents.reduce((sum, c) => sum + (c.score * c.weight), 0);
            return rawSum / totalWeight;
        };
        
        // Filter shields: remove shields that pull the grade down
        let finalComponents = [...normalComponents];
        let changed = true;

        while (changed) {
            changed = false;
            const currentGrade = calculateWeighted(finalComponents);
            const badShieldIndex = finalComponents.findIndex(c => c.isShield && c.score < currentGrade);
            
            if (badShieldIndex !== -1) {
                finalComponents.splice(badShieldIndex, 1);
                changed = true;
            }
        }

        // Calculate base weighted grade
        let finalGrade = normalComponents.length > 0 ? calculateWeighted(finalComponents) : 0;

        // Apply offsets (Flat additions)
        offsetComponents.forEach(offset => {
            finalGrade += offset.score;
        });

        return GradeEngine.clampGrade(finalGrade);
    }

    /**
     * Calculates the global GPA and total earned credits.
     * Excludes `isBinary` courses from GPA average, but includes their passed credits.
     * @param {Array} courses List of all course objects
     * @returns {Object} { gpa: number, totalCredits: number, earnedCredits: number, pendingCount: number }
     */
    static calculateGPA(courses, suppressLog = false) {
        let totalWeightedGrades = 0;
        let totalNekazForGpa = 0;
        let totalEarnedCredits = 0;
        let totalAssignedCredits = 0;
        let pendingCount = 0;

        // Group courses by normalized title to apply grading policy (best_counts vs last_counts)
        const courseGroups = {};
        courses.forEach(course => {
            const name = (course.title || '').toLowerCase().trim();
            if (!courseGroups[name]) courseGroups[name] = [];
            courseGroups[name].push(course);
        });

        const activeCourses = [];
        for (const [name, group] of Object.entries(courseGroups)) {
            const policy = group[0].gradingPolicy || 'last_counts';
            
            if (group.length === 1) {
                activeCourses.push(group[0]);
            } else {
                if (policy === 'best_counts') {
                    // Sort by highest grade
                    const graded = group.filter(c => GradeEngine.calculateFinalGrade(c) !== null);
                    if (graded.length > 0) {
                        graded.sort((a, b) => GradeEngine.calculateFinalGrade(b) - GradeEngine.calculateFinalGrade(a));
                        activeCourses.push(graded[0]);
                    } else {
                        // Fallback to last if no grades exist
                        activeCourses.push(group[group.length - 1]);
                    }
                } else {
                    // default: last_counts
                    activeCourses.push(group[group.length - 1]);
                }
            }
        }

        if (!suppressLog) {
            console.group('📊 GPA Calculation Audit');
        }
        
        totalWeightedGrades = 0;
        totalNekazForGpa = 0;
        totalEarnedCredits = 0;
        totalAssignedCredits = 0;
        pendingCount = 0;

        activeCourses.forEach(course => {
            const finalGrade = GradeEngine.calculateFinalGrade(course);
            const nekaz = parseFloat(course.nekaz) || 0;
            const title = course.title || 'Unknown Course';

            // Phase 11 & 11.2: Total Credits includes EVERYTHING in the library
            totalAssignedCredits += nekaz;

            // Phase 11.2: Exemption Logic (Include in Credits, Exclude from GPA)
            if (course.isExemption) {
                totalEarnedCredits += nekaz;
                if (!suppressLog) console.log(`[Exempt]   ${title.padEnd(30)} | Status: Ptor | Credits: ${nekaz} | (Excluded from GPA)`);
                return; // Skip remaining GPA-related logic for exemptions
            }

            // Phase 12: Skip courses without a defined chronological term (General) from GPA
            const termStr = (course.term && typeof course.term === 'object') ? course.term.term_raw : (course.term || 'General');
            if (termStr === 'General') {
                pendingCount++;
                if (!suppressLog) console.log(`[Pending]  ${title.padEnd(30)} | Grade: ---  | Credits: ${nekaz} | (Term Missing - Skipped)`);
                return; // Treat exactly like Pending
            }

            // Phase 12.1: Skip courses with null/undefined credits (data missing)
            // NOTE: nekaz === 0 is a valid "Obligation" course and is also skipped from GPA math (can't weight with 0)
            if (course.nekaz === null || course.nekaz === undefined) {
                pendingCount++;
                if (!suppressLog) console.log(`[Pending]  ${title.padEnd(30)} | Grade: ---  | Credits: null | (Credits Missing - Skipped)`);
                return;
            }
            if (nekaz === 0) {
                // 0-credit obligation: counts toward assigned credits, contributes nothing to GPA numerator/denominator
                if (!suppressLog) console.log(`[Obligat]  ${title.padEnd(30)} | Grade: ${finalGrade !== null ? finalGrade : '---'} | Credits: 0   | (Obligation - Skipped from GPA)`);
                return;
            }

            if (finalGrade !== null) {
                const isPassed = finalGrade >= (course.minPassGrade || GradeEngine.DEFAULT_MIN_PASS_GRADE);

                if (course.isBinary) {
                    // Binary Case (Pass/Fail)
                    if (isPassed) totalEarnedCredits += nekaz;
                    if (!suppressLog) console.log(`[Binary]   ${title.padEnd(30)} | Grade: Pass | Credits: ${nekaz} | (Excluded from GPA)`);
                } else {
                    // Numeric Case
                    if (isPassed) totalEarnedCredits += nekaz;
                    totalWeightedGrades += (finalGrade * nekaz);
                    totalNekazForGpa += nekaz;
                    if (!suppressLog) console.log(`[Numeric]  ${title.padEnd(30)} | Grade: ${finalGrade.toString().padEnd(4)} | Credits: ${nekaz.toString().padEnd(3)} | Points: ${(finalGrade * nekaz).toFixed(1)}`);
                }
            } else {
                // No grade yet
                pendingCount++;
                if (!suppressLog) console.log(`[Pending]  ${title.padEnd(30)} | Grade: ---  | Credits: ${nekaz} | (Skipped)`);
            }
        });

        const gpa = totalNekazForGpa > 0 ? (totalWeightedGrades / totalNekazForGpa) : 0;
        
        if (!suppressLog) {
            console.log('--------------------------------------------------------------------------------');
            console.log(`Summary: Total Weighted Points (${totalWeightedGrades.toFixed(1)}) / Total GPA Credits (${totalNekazForGpa.toFixed(1)}) = ${gpa.toFixed(4)}`);
            console.groupEnd();
        }

        return {
            gpa: Number(gpa.toFixed(2)),
            totalAssignedCredits: Number(totalAssignedCredits.toFixed(1)),
            earnedCredits: Number(totalEarnedCredits.toFixed(1)),
            totalWeightedGrades: Number(totalWeightedGrades.toFixed(1)),
            pendingCount
        };
    }

    /**
     * ETL Transformer: Normalizes a raw academic term string into a structured data object.
     * Extracts Hebrew year, semester mapping, and calculates a chronological term_id.
     */
    static normalizeTermData(rawTermStr) {
        // Fail-Safe Default
        const defaultTerm = { term_raw: rawTermStr || 'General', term_id: 0, academic_year: 0, semester: 0 };
        if (!rawTermStr || typeof rawTermStr !== 'string' || rawTermStr === 'General') return defaultTerm;

        // Sanitization: Strip quotes and normalize spaces
        const cleanStr = rawTermStr.replace(/["']/g, '').replace(/\s+/g, ' ').trim();

        let yearVal = 0;
        let semVal = 0;

        // Year Extraction (Prioritize longest prefix first)
        const hebrewYears = [
            ['תשפט', 2029], ['תשפח', 2028], ['תשפז', 2027], ['תשפו', 2026], 
            ['תשפה', 2025], ['תשפד', 2024], ['תשפג', 2023], ['תשפב', 2022], 
            ['תשפא', 2021], ['תשץ', 2030], ['תשפ', 2020]
        ];
        for (const [key, val] of hebrewYears) {
            if (cleanStr.includes(key)) {
                yearVal = val;
                break;
            }
        }
        
        // Fallback to Gregorian year if Hebrew year not found
        if (yearVal === 0) {
            const numMatch = cleanStr.match(/20\d{2}/);
            if (numMatch) {
                yearVal = parseInt(numMatch[0], 10);
            }
        }

        // Semester Dictionary Mapping
        const semGroup1 = ["א", "סתו", "סתיו", "חורף", "a", "fall"];
        const semGroup2 = ["ב", "אביב", "b", "spring"];
        const semGroup3 = ["קיץ", "ג", "summer", "c"];

        const words = cleanStr.toLowerCase().split(/[\s/\-()]+/);
        
        for (const word of words) {
            if (semGroup1.includes(word)) { semVal = 1; break; }
            if (semGroup2.includes(word)) { semVal = 2; break; }
            if (semGroup3.includes(word)) { semVal = 3; break; }
        }

        // Return structured object
        return {
            term_raw: rawTermStr,
            term_id: (yearVal > 0 && semVal > 0) ? (yearVal * 10) + semVal : 0,
            academic_year: yearVal,
            semester: semVal
        };
    }

    /**
     * Enhanced Semester Detection (Smart Fallback)
     */
    static detectSemester(course, allExams) {
        if (!course) return 'General';

        // Priority 1: Normalized ETL Term Object
        if (course.term && typeof course.term === 'object' && course.term.term_raw) {
             return course.term.term_raw;
        }

        // Priority 2: Native Portal / AI Term Payload (Legacy string)
        if (course.term && typeof course.term === 'string' && course.term !== 'General') {
             return course.term;
        } else if (course.term && typeof course.term === 'object') {
             const year = course.term.year || '';
             const sem = course.term.semester || '';
             if (year || sem) return `${year} ${sem}`.trim();
        }

        // Priority 3: Semantic Name Analysis (Hebrew / English)
        const title = (course.title || '').toUpperCase();
        
        // Match explicit words
        if (/(סמסטר א|סמ' א|SEMESTER A|FALL)/.test(title)) return 'A';
        if (/(סמסטר ב|סמ' ב|SEMESTER B|SPRING)/.test(title)) return 'B';
        if (/(סמסטר קיץ|סמ' קיץ|SUMMER)/.test(title)) return 'Summer';
        
        const cleanTitle = title.replace(/מועד\s*[אבגA-C]+/g, '').replace(/MOED\s*[A-C]+/g, '');
        if (/\bא[']?\b$/.test(cleanTitle)) return 'A';
        if (/\bב[']?\b$/.test(cleanTitle)) return 'B';

        // Priority 4: Exam Dates
        if (allExams && allExams.length > 0) {
            const courseExams = allExams.filter(e => e.courseId === course.id || (e.courseTitle && e.courseTitle.includes(course.title)));
            if (courseExams.length > 0) {
                courseExams.sort((a, b) => new Date(a.date) - new Date(b.date));
                const examDate = new Date(courseExams[0].date);
                if (!isNaN(examDate.getTime())) {
                    const month = examDate.getMonth() + 1;
                    if (month >= 1 && month <= 4) return 'A';
                    if (month >= 5 && month <= 8) return 'B';
                    if (month >= 9 && month <= 10) return 'Summer';
                }
            }
        }

        // Priority 5: Manual or General
        return course.semester || 'General';
    }

    /**
     * Clamps a grade between 0 and 100
     * @param {number} score 
     * @returns {number}
     */
    static clampGrade(score) {
        if (isNaN(score)) return 0;
        return Number(Math.min(Math.max(score, 0), 100).toFixed(2));
    }
}
