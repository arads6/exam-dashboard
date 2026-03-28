import re
from datetime import datetime

print("--- Test 1: Smart Parser Exact Logic ---")
test_lines = [
    "Add Exam:     Probability 1         01/01/2026",
    "Add Exam:Probability 1 01/01/2026",
    "important Add Exam: Probability    1 Moed A 01/01/2026",
]

for line in test_lines:
    date_match = re.search(r'\d{1,2}[-/.]\d{1,2}(?:[-/.]\d{2,4})?', line)
    if date_match:
        date_str = date_match.group(0)
        name_str = line.replace(date_str, '')
        name_str = re.sub(r'(?i)Add\s*Exam:', '', name_str)
        name_str = re.sub(r'(?i)מועד\s*[אבגa-c]|moed\s*[a-c]|מיוחד|special', '', name_str)
        name_str = re.sub(r'^[-\s|:.,()]+', '', name_str)
        name_str = re.sub(r'[-\s|:.,()]+$', '', name_str)
        name_str = name_str.strip()
        # Force single space
        name_str = re.sub(r'\s+', ' ', name_str)
        
        print(f"Original: '{line}' -> Name: '{name_str}', Date: '{date_str}'")

print("\n--- Test 2: Date Standardization ---")
raw_dates = ["15/04", "15.04", "15/04/2026"]
current_year = 2026

for d in raw_dates:
    parts = re.split(r'[-/.]', d)
    day = int(parts[0])
    month = int(parts[1])
    year = current_year
    if len(parts) == 3 and len(parts[2]) > 0:
        year = int("20" + parts[2]) if len(parts[2]) == 2 else int(parts[2])
    print(f"Parsed {d} -> {year}-{month:02d}-{day:02d}")
