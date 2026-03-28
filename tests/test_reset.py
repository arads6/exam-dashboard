import re

exams = [
    { "id": "1", "title": "Probability 1", "date": "2025-06-01", "time": "10:00", "moed": "A", "decisionState": "Taking", "checklist": [] },
    { "id": "2", "title": "Probability1", "date": "2025-06-01", "time": "10:00", "moed": "A", "decisionState": "Skipping", "checklist": [] }
]

def get_core_subject_name(title):
    if not title: return ''
    clean = re.sub(r'(?i)(?:-?\s*(?:מועד|moed)\s*[אבגa-c])', '', title)
    # Remove spaces and lower case exactly as in JS implementation
    return re.sub(r'\s+', '', clean).strip().lower()

print("--- Test 1: getCoreSubjectName Space Insensitivity ---")
print("Probability 1 ->", get_core_subject_name("Probability 1"))
print("Probability1 ->", get_core_subject_name("Probability1"))
print("Match?", get_core_subject_name("Probability 1") == get_core_subject_name("Probability1"))


def reset_conflict(base_id, conflicting_ids_str, exams_array):
    print(f"\n--- Running resetConflict for ID {base_id} ---")
    conflict_ids = conflicting_ids_str.split(',') if conflicting_ids_str else []
    resolving_exam_ids = [base_id] + conflict_ids
    resolving_exam_ids = [i for i in resolving_exam_ids if i]

    for exam_id in resolving_exam_ids:
        exam = next((e for e in exams_array if e['id'] == exam_id), None)
        if exam:
            print(f"Reverting {exam['title']} from '{exam['decisionState']}' to 'Pending'")
            exam['decisionState'] = 'Pending'

print("\n--- Test 2: Undo Logic from Taking/Skipping State ---")
print("Initial State:")
for e in exams:
    print(f"- {e['title']}: {e['decisionState']}")

reset_conflict('1', '2', exams)

print("\nFinal State:")
for e in exams:
    print(f"- {e['title']}: {e['decisionState']}")
