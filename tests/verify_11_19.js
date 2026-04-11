
import { CourseMatcher } from '../src/utils/course_matcher.js';

function test(s1, s2) {
    const score = CourseMatcher.calculateSimilarity(s1, s2);
    console.log(`Test: [${s1}] vs [${s2}] -> Score: ${Math.round(score * 100)}%`);
}

console.log("--- Phase 11.19 Zero Word Overlap Test ---");
test("מימון הפירמה 2", "הסתברות 1 לסטטיסטיקאים"); // Should be 0%
test("מימון הפירמה 2", "מימון הפירמה 1"); // Should be > 0% (but have digit penalty)
test("Mathematics 1", "Math 1"); // Should be > 0% (share '1' and possibly more if normalized)
test("Intro to Physics", "Advanced Physics"); // Should share 'Physics'
