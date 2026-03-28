/**
 * Analytics Module: Predictor
 * 
 * Handles calculations corresponding to the Israeli Academic System.
 * - Grades are strictly 0-100.
 * - Weights are in Nekaz (נק"ז).
 * - Moed B always overwrites Moed A (Latest Grade Counts policy).
 */

/**
 * Calculates the weighted average (GPA) on a 0-100 scale.
 * 
 * @param {Array<{grade: number, nekaz: number}>} courses 
 * @returns {number} The calculated GPA, bounded to 0-100, rounded to 2 decimals.
 */
export function calculateGPA(courses) {
    if (!courses || courses.length === 0) return 0;

    let totalPoints = 0;
    let totalNekaz = 0;

    for (const course of courses) {
        // Validation for the 0-100 scale
        if (typeof course.grade !== 'number' || course.grade < 0 || course.grade > 100) {
            console.warn(`Invalid grade detected: ${course.grade}. Must be 0-100.`);
            continue;
        }
        if (typeof course.nekaz !== 'number' || course.nekaz <= 0) {
            console.warn(`Invalid Nekaz detected: ${course.nekaz}. Must be > 0.`);
            continue;
        }

        totalPoints += (course.grade * course.nekaz);
        totalNekaz += course.nekaz;
    }

    if (totalNekaz === 0) return 0;

    const gpa = totalPoints / totalNekaz;
    // Round to 2 decimals
    return Math.round(gpa * 100) / 100;
}

/**
 * Assesses the risk factor of taking 'Moed B' based on Israeli rules (Latest grade counts).
 * 
 * @param {number} moedAGrade The grade achieved in Moed A (0-100)
 * @param {number} historicalAverage The student's current overall GPA or average in similar courses
 * @returns {string} Risk Assessment Label ("Awaiting Grade", "Critical Risk", "High Risk", "Moderate Risk", "Low Risk", "Safe to Upgrade")
 */
export function assessMoedBRisk(moedAGrade, historicalAverage) {
    if (typeof moedAGrade !== 'number' || moedAGrade === 0) return "Awaiting Grade";

    // Fails (under 56 in Israel) are always "Must Take" since you have nothing to lose
    if (moedAGrade < 56) {
        return "Must Take";
    }

    // High Moed A score indicates extreme risk of dropping
    if (moedAGrade >= 90) {
        return "Critical Risk";
    }

    // If grade is well above the student's average, there is high risk in jeopardizing it
    if (moedAGrade > historicalAverage + 10) {
        return "High Risk";
    }

    // If grade is around their average
    if (Math.abs(moedAGrade - historicalAverage) <= 10 && moedAGrade >= 75) {
        return "Moderate Risk";
    }

    // If grade is passing but significantly below their average
    if (moedAGrade < historicalAverage - 5) {
        return "Low Risk";
    }

    return "Moderate Risk";
}

/**
 * Basic Critical Path identifier to surface exams with high weight that are coming up soon.
 * 
 * @param {Array<{id: string, name: string, nekaz: number, daysUntil: number}>} upcomingExams 
 * @returns {Array<{id: string, name: string, priorityScore: number}>} Sorted by highest priority focus.
 */
export function calculateCriticalPath(upcomingExams) {
    if (!upcomingExams || upcomingExams.length === 0) return [];

    return upcomingExams.map(exam => {
        // Prevent division by zero if exam is today
        const safeDays = Math.max(0.5, exam.daysUntil);
        
        // Simple heuristic: higher Nekaz and fewer days = higher priority
        const priorityScore = (exam.nekaz * 10) / safeDays;
        
        return {
            id: exam.id,
            name: exam.name,
            nekaz: exam.nekaz,
            daysUntil: exam.daysUntil,
            priorityScore: Math.round(priorityScore * 100) / 100
        };
    }).sort((a, b) => b.priorityScore - a.priorityScore); // Descending priority
}
