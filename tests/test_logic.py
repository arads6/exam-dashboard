import json

exams = [
    {
        "id": "1",
        "title": "Math 1",
        "date": "2026-04-15",
        "decisionState": "Taking"
    },
    {
        "id": "2",
        "title": "Math 1",
        "date": "2026-04-15",
        "decisionState": "Skipping"
    }
]

conflictsMap = { "1": [], "2": [] }

for i in range(len(exams)):
    for j in range(i + 1, len(exams)):
        e1 = exams[i]
        e2 = exams[j]
        # Same exact date collision check as Javascript line 687
        if e1['date'] == e2['date']:
            if e2['id'] not in conflictsMap[e1['id']]:
                conflictsMap[e1['id']].append(e2['id'])
            if e1['id'] not in conflictsMap[e2['id']]:
                conflictsMap[e2['id']].append(e1['id'])

print("Conflicts Map:", conflictsMap)

# Simulate Rendering logic
for exam in exams:
    if exam['decisionState'] == "Taking":
        conflictingIds = conflictsMap[exam['id']]
        if conflictingIds and len(conflictingIds) > 0:
            print(f"Exam {exam['id']} has conflicts. Checking delayed exams...")
            # Simulate delayed exams filter
            delayedExams = [e for e in exams if e['id'] in conflictingIds and e['decisionState'] == 'Skipping']
            print(f"Found {len(delayedExams)} delayed exams (Skipping) for base exam {exam['id']}")
            if len(delayedExams) > 0:
                print("SUCCESS: Rendering <div class='exam-stack'>")
            else:
                print("FAILED: No delayed exams found to stack.")
        else:
            print(f"FAILED: Exam {exam['id']} has no conflicts in map!")
