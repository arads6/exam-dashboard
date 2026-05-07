// Abstract Storage API
// Upgraded to handle dual-schema (Courses and Exams) with auto-migration from legacy V1
import { CourseMatcher } from './utils/course_matcher.js';
import { GradeEngine } from './analytics/grade_engine.js';

class ExamStorage {
    constructor() {
        this.PRIMARY_KEY = 'student_os_data';
    }

    async _getStore() {
        const data = localStorage.getItem(this.PRIMARY_KEY);
        let store = data ? JSON.parse(data) : { courses: [], exams: [] };
        
        // Stage 6.10: Self-Healing Storage (Sanitize buckets)
        if (this._sanitize(store)) {
            await this._saveStore(store);
        }
        
        return store;
    }

    _sanitize(store) {
        let changed = false;
        if (!store.courses) { store.courses = []; changed = true; }
        if (!store.exams) { store.exams = []; changed = true; }

        // 1. Move "Course-like" objects from exams to courses
        // A course-like object has gradeComponents OR topics but is stuck in the exams bucket
        const coursesInExams = store.exams.filter(e => 
            (e.gradeComponents && e.gradeComponents.length > 0) || 
            (e.topics && e.topics.length > 0)
        );

        if (coursesInExams.length > 0) {
            console.log(`[Storage Sanitizer] Found ${coursesInExams.length} courses in exams bucket. Migrating...`);
            coursesInExams.forEach(c => {
                const exists = store.courses.some(existing => this.isFuzzyMatch(existing.title, c.title));
                
                if (!exists) {
                    store.courses.push({
                        ...c,
                        id: c.id.startsWith('course_') ? c.id : 'course_' + Date.now() + Math.random().toString(36).substring(7)
                    });
                }
            });
            // Rigidly purge these from exams bucket
            store.exams = store.exams.filter(e => !(
                (e.gradeComponents && e.gradeComponents.length > 0) || 
                (e.topics && e.topics.length > 0)
            ));
            changed = true;
        }

        // 2. Retroactive Deduplication within Courses Bucket
        const uniqueCourses = [];
        let dupesFound = false;

        store.courses.forEach(c => {
            const primary = uniqueCourses.find(u => this.isFuzzyMatch(u.title, c.title));
            if (primary) {
                dupesFound = true;
                console.log(`🧹 [Storage Sanitizer] Retroactively merging duplicate course: ${c.title} -> ${primary.title}`);
                
                if (!primary.nekaz && c.nekaz) primary.nekaz = c.nekaz;
                if (!primary.moodleName && c.moodleName) primary.moodleName = c.moodleName;
                if (c.topics && c.topics.length > 0 && (!primary.topics || primary.topics.length === 0)) {
                    primary.topics = c.topics;
                }
                if (c.checklist && c.checklist.length > 0 && (!primary.checklist || primary.checklist.length === 0)) {
                    primary.checklist = c.checklist;
                }

                if (c.gradeComponents && c.gradeComponents.length > 0) {
                    if (!primary.gradeComponents) primary.gradeComponents = [];
                    c.gradeComponents.forEach(comp => {
                        const exists = primary.gradeComponents.find(pc => pc.name === comp.name);
                        if (!exists) {
                            primary.gradeComponents.push(comp);
                        } else if (comp.score !== null && (exists.score === null || exists.score === undefined)) {
                            exists.score = comp.score;
                        }
                    });
                    const totalW = primary.gradeComponents.reduce((sum, current) => sum + (current.weight || 0), 0);
                    primary.isConfigured = (totalW === 100);
                }
            } else {
                uniqueCourses.push(c);
            }
        });

        // 3. Phase 11: Global Passing Threshold Migration (60 -> 56)
        store.courses.forEach(c => {
            if (!c.minPassGrade || c.minPassGrade === 60) {
                c.minPassGrade = 56;
                changed = true;
            }
            
            // ETL Transformation Backfill
            if (c.term && typeof c.term === 'string') {
                c.term = GradeEngine.normalizeTermData(c.term);
                changed = true;
            }
        });

        if (dupesFound) {
            store.courses = uniqueCourses;
            changed = true;
        }

        return changed;
    }

    async _saveStore(store, silent = false) {
        localStorage.setItem(this.PRIMARY_KEY, JSON.stringify(store));
        if (!silent) {
            window.dispatchEvent(new Event('storage_updated'));
        }
    }

    getCoreSubjectName(title) {
        if (!title) return 'Untitled Course';
        let clean = title.replace(/(?:[-\s|:.,()]*\s*(?:מועד|moed)\s*[אבגa-c\d])/gi, '');
        clean = clean.replace(/^[-\s|:.,()]+/, '').replace(/[-\s|:.,()]+$/, '');
        return clean.trim();
    }

    normalizeCourseName(name) {
        if (!name) return '';
        return name.toLowerCase().replace(/[\s\-_]+/g, '');
    }

    // --- Fuzzy Matching & Duplicate Resolution ---
    extractNumbers(str) {
        const match = str.match(/\d+/g);
        return match ? match.join('') : '';
    }

    normalizeHebrew(str) {
        if (!str) return '';
        let clean = str.toLowerCase().replace(/[\s\-_,.\\'()]+/g, '');
        return clean.replace(/[אהוי]/g, '');
    }

    levenshteinDistance(a, b) {
        if (a.length === 0) return b.length;
        if (b.length === 0) return a.length;

        const matrix = [];
        for (let i = 0; i <= b.length; i++) {
            matrix[i] = [i];
        }
        for (let j = 0; j <= a.length; j++) {
            matrix[0][j] = j;
        }
        for (let i = 1; i <= b.length; i++) {
            for (let j = 1; j <= a.length; j++) {
                if (b.charAt(i - 1) === a.charAt(j - 1)) {
                    matrix[i][j] = matrix[i - 1][j - 1];
                } else {
                    matrix[i][j] = Math.min(
                        matrix[i - 1][j - 1] + 1,
                        Math.min(matrix[i][j - 1] + 1,
                        matrix[i - 1][j] + 1)
                    );
                }
            }
        }
        return matrix[b.length][a.length];
    }

    isFuzzyMatch(str1, str2) {
        if (!str1 || !str2) return false;
        
        // Prevent aggressive merging of semantically conflicting courses (e.g., Micro vs Macro)
        if (CourseMatcher.hasConflict(str1, str2)) return false;
        
        const s1 = str1.toLowerCase().trim();
        const s2 = str2.toLowerCase().trim();
        
        if (s1 === s2) return true;

        // Strict Number Guardrail: Base courses CANNOT swallow sequentially numbered courses
        const nums1 = this.extractNumbers(s1);
        const nums2 = this.extractNumbers(s2);
        
        if (nums1 !== nums2) {
            return false;
        }

        const norm1 = this.normalizeHebrew(s1);
        const norm2 = this.normalizeHebrew(s2);
        if (norm1 === norm2 && norm1.length > 0) return true;

        const distance = this.levenshteinDistance(norm1, norm2);
        
        // Phase 11.5: Ultra-strict Levenshtein. 
        // Since we already stripped spaces, punctuation, and vowels, strings are densely packed.
        // A distance of 2+ on a 9-char string means multiple fundamentally different consonants.
        // Threshold: 0 for < 6 chars, 1 for 6-11 chars, max 2.
        const maxDist = Math.floor(Math.min(norm1.length, norm2.length) / 6);
        
        if (distance <= maxDist) return true;

        return false;
    }

    // --- Courses API --- //

    async getCourses() {
        const store = await this._getStore();
        return store.courses || [];
    }

    async saveCourse(course) {
        const store = await this._getStore();
        if (!course.id) course.id = 'course_' + Date.now().toString() + Math.random().toString(36).substring(2);
        
        // Phase 2 & 9: Initialize Grade & GPA Engine Infrastructure
        if (!course.gradeComponents) course.gradeComponents = [];
        if (course.isConfigured === undefined) course.isConfigured = false;
        if (course.gradingPolicy === undefined) course.gradingPolicy = 'last_counts';
        if (course.isBinary === undefined) course.isBinary = false;
        
        // ETL Transformation
        if (course.term && typeof course.term === 'string') {
            course.term = GradeEngine.normalizeTermData(course.term);
        }
        
        store.courses.push(course);
        await this._saveStore(store);
        return course;
    }

    async updateCourse(updatedCourse) {
        const store = await this._getStore();
        const index = store.courses.findIndex(c => c.id === updatedCourse.id);
        if (index !== -1) {
            // Ensure fields exist on update
            if (!updatedCourse.gradeComponents) updatedCourse.gradeComponents = [];
            if (updatedCourse.isConfigured === undefined) updatedCourse.isConfigured = false;
            if (updatedCourse.gradingPolicy === undefined) updatedCourse.gradingPolicy = 'last_counts';
            if (updatedCourse.isBinary === undefined) updatedCourse.isBinary = false;
            
            // ETL Transformation
            if (updatedCourse.term && typeof updatedCourse.term === 'string') {
                updatedCourse.term = GradeEngine.normalizeTermData(updatedCourse.term);
            }
            
            store.courses[index] = updatedCourse;
            await this._saveStore(store);
        }
        return updatedCourse;
    }

    async deleteCourse(id) {
        const store = await this._getStore();
        store.courses = store.courses.filter(c => c.id !== id);
        await this._saveStore(store);
        return true;
    }

    async clearAllCourses() {
        const store = await this._getStore();
        store.courses = [];
        await this._saveStore(store);
        return true;
    }

    // calculateFinalGrade logic moved to Phase 9 GradeEngine

    // --- Exams API --- //

    async getExams() {
        const store = await this._getStore();
        return store.exams || [];
    }

    async saveExam(exam) {
        const store = await this._getStore();
        if (!exam.id) exam.id = 'exam_' + Date.now().toString() + Math.random().toString(36).substring(2);
        store.exams.push(exam);
        
        // Chronological sort
        store.exams.sort((a, b) => new Date(`${a.date}T${a.time}`) - new Date(`${b.date}T${b.time}`));
        
        await this._saveStore(store);
        return exam;
    }

    async updateExam(updatedExam, silent = false) {
        const store = await this._getStore();
        const index = store.exams.findIndex(e => e.id === updatedExam.id);
        if (index !== -1) {
            store.exams[index] = updatedExam;
            await this._saveStore(store, silent);
        }
        return updatedExam;
    }

    async deleteExam(id) {
        const store = await this._getStore();
        store.exams = store.exams.filter(e => e.id !== id);
        await this._saveStore(store); 
        return true;
    }
}

export const storage = new ExamStorage();
