/**
 * Quality Control Script: Storage & Sync Validation
 * This script verifies that the Storage class (storage.js) follows the 
 * single-source-of-truth requirement and handles data lifecycle correctly.
 */

const fs = require('fs');
const path = require('path');

// Mocking Browser Environment
global.localStorage = {
    _data: {},
    getItem(key) { return this._data[key] || null; },
    setItem(key, val) { this._data[key] = String(val); },
    removeItem(key) { delete this._data[key]; },
    clear() { this._data = {}; }
};
global.window = {
    dispatchEvent: () => {}
};
global.Event = class {};

// Load Storage Class (Extracting logic from the file since it's an ES Module)
const storagePath = path.join(__dirname, '../src/storage.js');
let storageContent = fs.readFileSync(storagePath, 'utf8');

// Injecting into a testable class (CJS for node runner)
// Special hack to test the logic without complex ESM setup
const ExamStorageLogic = eval(`
    (function() {
        ${storageContent.replace(/export class ExamStorage/, 'class ExamStorage').replace(/export const storage = new ExamStorage\(\);/, 'ExamStorage')}
        return ExamStorage;
    })()
`);

async function runTests() {
    console.log("--- Starting Storage QC Validation ---");
    const storage = new ExamStorageLogic();
    const PRIMARY_KEY = 'student_os_data';
    const V2_KEY = 'exam_dashboard_v2';

    // Test 1: Key Consistency
    console.log("Test 1: Primary Key Check...");
    if (storage.PRIMARY_KEY !== PRIMARY_KEY) throw new Error(`Wrong Primary Key: ${storage.PRIMARY_KEY}`);
    console.log("PASS: Correct storage key used.");

    // Test 2: Migration from V2
    console.log("Test 2: Migration Check...");
    localStorage.setItem(V2_KEY, JSON.stringify({ courses: [{id: 'c1', title: 'Test'}], exams: [] }));
    await storage._getStore(); // Triggers migration
    if (!localStorage.getItem(PRIMARY_KEY)) throw new Error("Migration failed to create new key");
    console.log("PASS: Migration successful.");

    // Test 3: Save Course (Should NOT delete immediately)
    console.log("Test 3: Save Course Persistence...");
    const newCourse = { id: 'c2', title: 'New Course', nekaz: 3 };
    await storage.saveCourse(newCourse);
    let store = await storage._getStore();
    if (!store.courses.find(c => c.id === 'c2')) throw new Error("Course deleted immediately after save!");
    console.log("PASS: Course persisted without exams.");

    // Test 4: Ghost Cleanup on Delete
    console.log("Test 4: Ghost Cleanup Check...");
    // Add an exam for c2
    const exam = { id: 'e1', courseId: 'c2', title: 'Exam 1' };
    await storage.saveExam(exam);
    // Delete the exam
    await storage.deleteExam('e1');
    store = await storage._getStore();
    // Course c2 has NEKAZ 3, so it should persist even without exams
    if (!store.courses.find(c => c.id === 'c2')) throw new Error("Course with nekaz was deleted incorrectly!");
    
    // Add a course without nekaz
    await storage.saveCourse({ id: 'ghost', title: 'Ghost', nekaz: null });
    await storage.saveExam({ id: 'e2', courseId: 'ghost', title: 'Ghost Exam' });
    // Delete the exam - THIS should trigger ghost cleanup
    await storage.deleteExam('e2');
    store = await storage._getStore();
    if (store.courses.find(c => c.id === 'ghost')) throw new Error("Ghost course (no exams, no nekaz) was NOT cleaned up!");
    console.log("PASS: Ghost cleanup logic verified.");

    console.log("\n--- ALL STORAGE QC TESTS PASSED ---");
}

runTests().catch(err => {
    console.error("\n--- QC FAILED ---");
    console.error(err);
    process.exit(1);
});
