# Exam Study Dashboard - Roadmap

## Project Management Rules
1. **Mandatory Pre-Flight Check**: Every code update must be preceded by an internal logic simulation.
2. **Verification Report**: Every output must include a 'Test Report' showing what was checked (e.g., Moed assignment, sync, edge cases).
3. **The 'Golden Rule'**: Never mark a task as 'Verified' in the roadmap yourself. Only the user can provide the 'Verified' status after following the provided manual test plan.
4. **Edge Case Testing**: proactive testing for 'illegal' states (like adding a 4th Moed) is required as part of the internal check.

## Backlog (Ideas)

- **Priority Management**: Make the 'Med Priority' stars interactive so I can toggle between High, Med, and Low. (Currently hidden from UI)
- **Export/Backup**: Add a button to download/upload the exam data as a file.
- **Gemini Gems Integration**: Link specific Gems to courses and fetch study topics. *Enrichment:* A dedicated 'Study Buddy' link for each exam card, connecting the specific Gem to the course's Master PDF.
- **Strategic Study Planner**: Logic-based suggestions on when to start studying for each exam based on difficulty and gaps between tests. *Enrichment:* A priority-based scheduling algorithm using the 'Critical Path' method (considering Nekaz, Moed B Risk, and remaining time).
- **Visual Calendar View**: Display all exams on a monthly/weekly calendar.
- **Multi-language support**: Add support for multiple languages in the UI.
- **Post-Exam Handling**: Decide and implement what happens to a test after its date has passed (e.g., archive, delete, specific status).
- **Complex Edge Cases**: Investigate and handle various edge cases, such as conflicts between more than 2 subjects, needing a check once in a while.
- **Editable Smart Import Preview**: Allow editing of parsed exams directly in the preview list before confirming the import.
- **Contextual Smart Import (formerly Free-Text Parsing)**: Enhance the Smart Import to accurately extract test information even when it's embedded within paragraphs of conversational or unstructured free text. *Enrichment:* Enhancing the raw text parser to understand messy, non-structured exam lists and extract course titles and dates with high accuracy.
- **Sidebar to Master List**: Transform Sidebar into a full Master List with filters (Moed A/B/C, Eligibility status, and Search).
- **Manual Eligibility Override**: Allow users to manually mark an exam as skipped with/without eligibility for a special date, regardless of conflicts.
- **Reserve Duty (מילואים) Eligibility**: Add an option to check a box indicating enough days as Reserve (מילואים). This allows choosing two of three tests in each course regardless of the conflict. (using Moed C more freely)
- **Syllabus AI Harvester**: An automated tool to scan syllabus PDFs and extract Nekaz, grade weights, and exam topics directly into the system.
  - *V2 Requirements (Logged):* Move fetch to `background.js` (bypass CORS), add `bgu4u.bgu.ac.il` host permissions, and implement MIME-type sniffing for dynamic links.
- **The PDF Source Merger**: A module to consolidate all course presentations, summaries, and readings into a single 'Master PDF' for each course to reduce cognitive load.
- **UI Focus Slider**: A flexible dashboard filter to toggle between 'Today', 'This Week', and 'Custom Date Ranges'.
- **Full Intelligent Bidirectional Sync**: High-fidelity sync between Student OS and Google Calendar. Allow users to choose conflict resolution policies (Master Dashboard vs. External Changes) and sync data back from Google to the app.
- **Moodle Integration for Task Tracking**: A centralized dashboard that pulls and displays all assignments from all courses in Moodle. Includes checkboxes for each task to track ongoing progress against deadlines. *Goal:* Provide a high-level overview of the academic workload and prevent missed deadlines.

- **[BUG] Atomic 'Missing Credits' Refresh**: Fix sequential saves in the Action Required box to prevent DOM wipes. (Deferred to Phase 11/12).

## In Progress (Current Focus)

- **Phase 11: Syllabus AI Harvester**: Automated scanning of syllabus PDFs to extract Nekaz, grade weights, and exam topics.

## Verified (Tested by me)

- **Phase 10: Smart Library & Engine**: Professional Course Selection, GPA Audit Engine, and Resilient Portal Scraper.
- **Stacked Cards UI & Undo Logic**: Base overlapping and 'Taking/Skipping' state transitions.
- **Classic Deck UI**: Redesign the stacked cards visual to a fully opaque physical deck, implement a 'Lift' modal interaction.

- **Smart Import**: Allow pasting raw text lists of exam dates for automatic entry.
- **Core Sync & Logic**: Fixing the checklist synchronization and the auto-Moed assignment logic.
