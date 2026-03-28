def calculate_gpa(courses):
    if not courses:
        return 0

    total_points = 0
    total_nekaz = 0

    for course in courses:
        grade = course.get('grade')
        nekaz = course.get('nekaz')

        if not isinstance(grade, (int, float)) or grade < 0 or grade > 100:
            print(f"Invalid grade detected: {grade}. Must be 0-100.")
            continue
        if not isinstance(nekaz, (int, float)) or nekaz <= 0:
            print(f"Invalid Nekaz detected: {nekaz}. Must be > 0.")
            continue

        total_points += (grade * nekaz)
        total_nekaz += nekaz

    if total_nekaz == 0:
        return 0

    gpa = total_points / total_nekaz
    return round(gpa, 2)


def assess_moed_b_risk(moed_a_grade, historical_average):
    if not isinstance(moed_a_grade, (int, float)) or moed_a_grade == 0:
        return "Awaiting Grade"

    if moed_a_grade < 60:
        return "Safe to Upgrade"

    if moed_a_grade >= 90:
        return "Critical Risk"

    if moed_a_grade > historical_average + 10:
        return "High Risk"

    if abs(moed_a_grade - historical_average) <= 10 and moed_a_grade >= 75:
        return "Moderate Risk"

    if moed_a_grade < historical_average - 5:
        return "Low Risk"

    return "Moderate Risk"


def calculate_critical_path(upcoming_exams):
    if not upcoming_exams:
        return []

    prioritized = []
    for exam in upcoming_exams:
        safe_days = max(0.5, exam.get('daysUntil', 1))
        priority_score = (exam.get('nekaz') * 10) / safe_days
        
        prioritized.append({
            'name': exam.get('name'),
            'nekaz': exam.get('nekaz'),
            'daysUntil': exam.get('daysUntil'),
            'priorityScore': round(priority_score, 2)
        })

    return sorted(prioritized, key=lambda x: x['priorityScore'], reverse=True)


print('--- GPA Calculation Test ---')
courses = [
    {'name': 'Data Structures', 'grade': 85, 'nekaz': 4.5},
    {'name': 'Linear Algebra', 'grade': 92, 'nekaz': 5},
    {'name': 'Physics I', 'grade': 78, 'nekaz': 3}
]
print(f"GPA of sample courses: {calculate_gpa(courses)} (Expected ~86.12)")

print('\n--- Moed B Risk Test (Latest Grade Counts) ---')
print(f"Moed A: 94, Historical Avg: 85 -> {assess_moed_b_risk(94, 85)} (Expected: Critical Risk)")
print(f"Moed A: 55, Historical Avg: 85 -> {assess_moed_b_risk(55, 85)} (Expected: Safe to Upgrade)")
print(f"Moed A: 89, Historical Avg: 78 -> {assess_moed_b_risk(89, 78)} (Expected: High Risk)")
print(f"Moed A: 78, Historical Avg: 80 -> {assess_moed_b_risk(78, 80)} (Expected: Moderate Risk)")
print(f"Moed A: 72, Historical Avg: 82 -> {assess_moed_b_risk(72, 82)} (Expected: Low Risk)")

print('\n--- Critical Path Test ---')
exams = [
    {'id': '1', 'name': 'Ethics', 'nekaz': 2, 'daysUntil': 5},
    {'id': '2', 'name': 'Calculus', 'nekaz': 5, 'daysUntil': 3},
    {'id': '3', 'name': 'Algorithms', 'nekaz': 4.5, 'daysUntil': 1}
]
priority = calculate_critical_path(exams)
print('Priority Order:')
for p in priority:
    print(f"{p['name']} (Nekaz: {p['nekaz']}, Days left: {p['daysUntil']}) -> Score: {p['priorityScore']}")
