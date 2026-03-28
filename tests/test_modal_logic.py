class StorageMock:
    def __init__(self):
        self.db = {
            "1": {"id": "1", "decisionState": "Taking"},
            "2": {"id": "2", "decisionState": "Skipping"},
            "3": {"id": "3", "decisionState": "Skipping"}
        }
    def updateExam(self, exam):
        self.db[exam['id']] = exam

class AppLogicMock:
    def __init__(self):
        self.storage = StorageMock()
        self.exams = list(self.storage.db.values())

    def get_exams(self):
        self.exams = list(self.storage.db.values())
        return self.exams

    def switchConflict(self, baseId, conflictIds):
        resolvingExamIds = [baseId] + conflictIds
        print(f"Switching state for IDs: {resolvingExamIds}")
        for eid in resolvingExamIds:
            exam = next((e for e in self.exams if e['id'] == eid), None)
            if exam and exam['decisionState'] in ['Taking', 'Skipping']:
                exam['decisionState'] = 'Skipping' if exam['decisionState'] == 'Taking' else 'Taking'
                self.storage.updateExam(exam)
        self.get_exams()

    def resetConflict(self, baseId, conflictIds):
        resolvingExamIds = [baseId] + conflictIds
        print(f"Resetting state for IDs: {resolvingExamIds}")
        for eid in resolvingExamIds:
            exam = next((e for e in self.exams if e['id'] == eid), None)
            if exam:
                exam['decisionState'] = 'Pending'
                self.storage.updateExam(exam)
        self.get_exams()


app = AppLogicMock()
print("Initial:", app.get_exams())

print("\n--- Testing Switch ---")
app.switchConflict("1", ["2", "3"])
print("After Switch:", app.get_exams())

print("\n--- Testing Reset ---")
app.resetConflict("1", ["2", "3"])
print("After Reset:", app.get_exams())
