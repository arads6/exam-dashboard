/**
 * GradeEngine - Pure Logic Module
 * Phase 9: The Grade & GPA Engine
 * Handles all grade calculations, GPA computations, and semester logic.
 * No side-effects, no localStorage access.
 */

export class GradeEngine {
    /**
     * Calculates the final grade for a specific course based on its components.
     * Implements "Shield Grade" logic: includes shield only if it improves the score.
     * @param {Object} course The course object
     * @returns {number|null} The final grade (0-100) or null if incomplete
     */
    static calculateFinalGrade(course) {
        if (!course || !course.isConfigured || !course.gradeComponents || course.gradeComponents.length === 0) {
            return null;
        }

        const components = course.gradeComponents.map(c => ({
            ...c,
            score: c.score !== null && c.score !== undefined ? parseFloat(c.score) : null,
            weight: parseFloat(c.weight)
        }));

        const allScored = components.every(c => c.score !== null && !isNaN(c.score));
        if (!allScored) return null;

        const calculateWeighted = (activeComponents) => {
            const totalWeight = activeComponents.reduce((sum, c) => sum + c.weight, 0);
            if (totalWeight === 0) return 0;
            const rawSum = activeComponents.reduce((sum, c) => sum + (c.score * c.weight), 0);
            return rawSum / totalWeight;
        };
        
        // Filter shields: remove shields that pull the grade down
        let finalComponents = [...components];
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

        const finalGrade = calculateWeighted(finalComponents);
        return GradeEngine.clampGrade(finalGrade);
    }

    /**
     * Calculates the global GPA and total earned credits.
     * Excludes `isBinary` courses from GPA average, but includes their passed credits.
     * @param {Array} courses List of all course objects
     * @returns {Object} { gpa: number, totalCredits: number, earnedCredits: number, pendingCount: number }
     */
    static calculateGPA(courses) {
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

        activeCourses.forEach(course => {
            const finalGrade = GradeEngine.calculateFinalGrade(course);
            const nekaz = parseFloat(course.nekaz);

            if (course.isConfigured && !isNaN(nekaz)) {
                totalAssignedCredits += nekaz;
                
                if (finalGrade !== null) {
                    const isPassed = finalGrade >= 60; // Assumed minimum pass grade

                    if (course.isBinary) {
                        // Pass/Fail only contributes to credits
                        if (isPassed) {
                            totalEarnedCredits += nekaz;
                        }
                    } else {
                        // Numeric Grade contributes to both GPA and credits
                        if (isPassed) {
                            totalEarnedCredits += nekaz;
                        }
                        totalWeightedGrades += (finalGrade * nekaz);
                        totalNekazForGpa += nekaz;
                    }
                } else {
                    pendingCount++;
                }
            }
        });

        const gpa = totalNekazForGpa > 0 ? (totalWeightedGrades / totalNekazForGpa) : 0;

        return {
            gpa: Number(gpa.toFixed(2)),
            totalAssignedCredits: Number(totalAssignedCredits.toFixed(1)),
            earnedCredits: Number(totalEarnedCredits.toFixed(1)),
            pendingCount
        };
    }

    /**
     * Detects the semester for a course based on its earliest exam date.
     * Jan-Feb = A, June-July = B, Sept-Oct = Summer
     * @param {string} courseId The course ID
     * @param {Array} allExams The full list of exams
     * @returns {string|null} "A", "B", "Summer", or null
     */
    static detectSemester(courseId, allExams) {
        if (!allExams || allExams.length === 0) return null;

        const courseExams = allExams.filter(e => e.courseId === courseId || (e.courseTitle && e.courseTitle.includes(courseId)));
        if (courseExams.length === 0) return null;

        courseExams.sort((a, b) => new Date(a.date) - new Date(b.date));
        const examDate = new Date(courseExams[0].date);
        
        if (isNaN(examDate.getTime())) return null;

        const month = examDate.getMonth() + 1; // 1-12
        if (month >= 1 && month <= 3) return 'A';
        if (month >= 5 && month <= 8) return 'B';
        if (month >= 9 && month <= 10) return 'Summer';

        return null;
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
