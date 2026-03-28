# test.py
import re
from datetime import datetime
import json

exams = [
    { "id": "1", "title": "Physics", "date": "2025-06-01", "time": "10:00", "moed": "", "checklist": [] },
    { "id": "2", "title": "Physics", "date": "2025-07-01", "time": "10:00", "moed": "", "checklist": [] },
    { "id": "3", "title": "Physics - Moed A", "date": "2025-06-01", "time": "10:00", "moed": "A", "checklist": [] } 
]

def get_core_subject_name(title):
    if not title: return ''
    # Match JS regex: /(?:-?\s*(?:מועד|moed)\s*[אבגa-c])/gi
    clean = re.sub(r'(?i)(?:-?\s*(?:מועד|moed)\s*[אבגa-c])', '', title)
    return clean.strip().lower()

print("--- Test 1: getCoreSubjectName ---")
print("Physics ->", get_core_subject_name("Physics"))
print("Physics - Moed A ->", get_core_subject_name("Physics - Moed A"))
print("Physics מועד ב ->", get_core_subject_name("Physics מועד ב"))

print("\n--- Test 2: AutoAssignMoeds ---")
def auto_assign_moeds(exams_array):
    grouped = {}
    for e in exams_array:
        core = get_core_subject_name(e['title'])
        if core not in grouped: grouped[core] = []
        grouped[core].append(e)
        
    moed_labels = ['A', 'B', 'C']
    for core, group in grouped.items():
        if len(group) > 1:
            group.sort(key=lambda x: datetime.strptime(f"{x['date']} {x['time']}", "%Y-%m-%d %H:%M"))
            for i, e in enumerate(group):
                assigned = moed_labels[i] if i < 3 else 'C'
                if e['moed'] != assigned:
                    print(f"[AutoMoed] Assigning Moed {assigned} to exam: {e['title']}")
                    e['moed'] = assigned

auto_assign_moeds(exams)
print("Exams after AutoAssignMoeds:", [{"title": e["title"], "moed": e["moed"]} for e in exams])

print("\n--- Test 3: syncChecklists ---")
def sync_checklists(base_id, new_checklist, exams_array):
    base_exam = next((e for e in exams_array if e['id'] == base_id), None)
    if not base_exam: return
    
    clean_title = get_core_subject_name(base_exam['title'])
    synced = 0
    for e in exams_array:
        if e['id'] == base_id: continue
        other_clean = get_core_subject_name(e['title'])
        if clean_title == other_clean:
            e['checklist'] = new_checklist.copy()
            synced += 1
            
    print(f"[Sync] Synced checklist from ID {base_id} to {synced} other exams.")

sync_checklists('1', [{"id": "i1", "text": "Read Chapter 1", "completed": True}], exams)
print("Exams after Sync:", [{"id": e["id"], "checklist": e["checklist"]} for e in exams])
