// internal_simulation.js
const fs = require('fs');

// Mock data
let exams = [
    { id: '1', title: 'Physics', date: '2025-06-01', time: '10:00', moed: '', checklist: [] },
    { id: '2', title: 'Physics', date: '2025-07-01', time: '10:00', moed: '', checklist: [] },
    { id: '3', title: 'Physics - Moed A', date: '2025-06-01', time: '10:00', moed: 'A', checklist: [] }
];

function getCoreSubjectName(title) {
    if (!title) return '';
    // Safely strip out moed indicators (e.g. " - Moed A", "מועד א")
    return title.replace(/(?:-?\s*(?:מועד|moed)\s*[אבגa-c])/gi, '').trim().toLowerCase();
}

console.log("--- Test 1: getCoreSubjectName ---");
console.log("Physics ->", getCoreSubjectName("Physics"));
console.log("Physics - Moed A ->", getCoreSubjectName("Physics - Moed A"));
console.log("Physics מועד ב ->", getCoreSubjectName("Physics מועד ב"));

console.log("\n--- Test 2: AutoAssignMoeds ---");
function autoAssignMoeds(examsArray) {
    const groupedBySubject = {};
    examsArray.forEach(exam => {
        const coreName = getCoreSubjectName(exam.title);
        if (!groupedBySubject[coreName]) groupedBySubject[coreName] = [];
        groupedBySubject[coreName].push(exam);
    });

    const moedLabels = ['A', 'B', 'C'];
    for (const [coreName, group] of Object.entries(groupedBySubject)) {
        if (group.length > 1) {
            group.sort((a, b) => new Date(`${a.date}T${a.time}`) - new Date(`${b.date}T${b.time}`));
            group.forEach((exam, index) => {
                const assignedMoed = moedLabels[index] || 'C';
                if (!exam.moed || exam.moed !== assignedMoed) {
                    console.log(`[AutoMoed] Assigning Moed ${assignedMoed} to exam: ${exam.title}`);
                    exam.moed = assignedMoed;
                }
            });
        }
    }
}
autoAssignMoeds(exams);
console.log("Exams after AutoAssignMoeds:", exams.map(e => ({ title: e.title, moed: e.moed })));

console.log("\n--- Test 3: syncChecklists ---");
function syncChecklists(baseExamId, newChecklist, examsArray) {
    const baseExam = examsArray.find(e => e.id === baseExamId);
    if (!baseExam) return;

    const cleanTitle = getCoreSubjectName(baseExam.title);

    let syncedCount = 0;
    for (const exam of examsArray) {
        if (exam.id === baseExamId) continue;

        const otherCleanTitle = getCoreSubjectName(exam.title);
        if (cleanTitle === otherCleanTitle) {
            // Deep copy to prevent reference mutation bugs
            exam.checklist = JSON.parse(JSON.stringify(newChecklist));
            syncedCount++;
        }
    }
    console.log(`[Sync] Synced checklist from ID ${baseExamId} to ${syncedCount} other exams.`);
}

const mockChecklist = [{ id: 'i1', text: 'Read Chapter 1', completed: true }];
syncChecklists('1', mockChecklist, exams);
console.log("Exams after Sync:", exams.map(e => ({ id: e.id, checklist: e.checklist })));
