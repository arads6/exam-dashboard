import { calculateGPA, assessMoedBRisk, calculateCriticalPath } from './src/analytics/predictor.js';

console.log('--- GPA Calculation Test ---');
const courses = [
    { name: 'Data Structures', grade: 85, nekaz: 4.5 },
    { name: 'Linear Algebra', grade: 92, nekaz: 5 },
    { name: 'Physics I', grade: 78, nekaz: 3 }
];
// Expected manual math: ((85*4.5) + (92*5) + (78*3)) / 12.5 
// (382.5 + 460 + 234) = 1076.5 / 12.5 = 86.12
console.log(`GPA of sample courses: ${calculateGPA(courses)} (Expected ~86.12)`);

console.log('\n--- Moed B Risk Test (Latest Grade Counts) ---');
console.log(`Moed A: 94, Historical Avg: 85 -> ${assessMoedBRisk(94, 85)} (Expected: Critical Risk)`);
console.log(`Moed A: 55, Historical Avg: 85 -> ${assessMoedBRisk(55, 85)} (Expected: Safe to Upgrade)`);
console.log(`Moed A: 89, Historical Avg: 78 -> ${assessMoedBRisk(89, 78)} (Expected: High Risk)`);
console.log(`Moed A: 78, Historical Avg: 80 -> ${assessMoedBRisk(78, 80)} (Expected: Moderate Risk)`);
console.log(`Moed A: 72, Historical Avg: 82 -> ${assessMoedBRisk(72, 82)} (Expected: Low Risk)`);

console.log('\n--- Critical Path Test ---');
const exams = [
    { id: '1', name: 'Ethics', nekaz: 2, daysUntil: 5 }, // 2*10 / 5 = 4
    { id: '2', name: 'Calculus', nekaz: 5, daysUntil: 3 }, // 5*10 / 3 = 16.67
    { id: '3', name: 'Algorithms', nekaz: 4.5, daysUntil: 1 } // 4.5*10 / 1 = 45 
];
const priority = calculateCriticalPath(exams);
console.log('Priority Order:');
priority.forEach(p => console.log(`${p.name} (Nekaz: ${p.nekaz}, Days left: ${p.daysUntil}) -> Score: ${p.priorityScore}`));
