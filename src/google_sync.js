import { storage } from './storage.js';

class GoogleSync {
    constructor() {
        this.CLIENT_ID = '786200937248-b3kh385h3pgh6sjq95ej7kgjl0qpj3pv.apps.googleusercontent.com';
        this.SCOPES = 'https://www.googleapis.com/auth/calendar';
        this.CALENDAR_NAME = 'Student OS - Test';
        
        this.tokenClient = null;
        this.gapiInited = false;
        this.gisInited = false;
        this.accessToken = null;
        
        this.syncModal = document.getElementById('sync-modal');
        this.closeSyncModalBtn = document.getElementById('close-sync-modal-btn');
        this.syncReviewList = document.getElementById('sync-review-list');
        this.startSyncBtn = document.getElementById('start-sync-btn');
        this.headerSyncBtn = document.getElementById('header-sync-btn');
        
        // Initialize everything
        this.init();
    }

    async init() {
        this.bindEvents();
        await this.loadScripts();
    }

    bindEvents() {
        if (this.headerSyncBtn) {
            this.headerSyncBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.openSyncFlow();
            });
        }
        if (this.closeSyncModalBtn) {
            this.closeSyncModalBtn.addEventListener('click', () => this.closeModal());
        }
        if (this.startSyncBtn) {
            this.startSyncBtn.addEventListener('click', () => this.executeSync());
        }
        
        // Close on outside click
        window.addEventListener('click', (e) => {
            if (e.target === this.syncModal) this.closeModal();
        });
    }

    loadScripts() {
        // GAPI is loaded in index.html, we just need to wait and init
        const checkScripts = setInterval(() => {
            if (window.gapi && window.google) {
                clearInterval(checkScripts);
                this.initializeGapi();
                this.initializeGis();
            }
        }, 100);
    }

    initializeGapi() {
        gapi.load('client', async () => {
            await gapi.client.init({
                // Discovery doc for Calendar API
                discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest'],
            });
            this.gapiInited = true;
        });
    }

    initializeGis() {
        this.tokenClient = google.accounts.oauth2.initTokenClient({
            client_id: this.CLIENT_ID,
            scope: this.SCOPES,
            callback: (resp) => {
                if (resp.error) {
                    console.error('GIS Error:', resp);
                    return;
                }
                console.log('GIS Token received, authorizing GAPI client...');
                this.accessToken = resp.access_token;
                gapi.client.setToken(resp); // CRITICAL: Connect GIS token to GAPI client
                this.processSyncModal();
            },
        });
        this.gisInited = true;
    }

    async openSyncFlow() {
        if (!this.gapiInited || !this.gisInited) {
            alert('Google API is still loading. Please try again in a few seconds.');
            return;
        }

        // Check for existing token in session or just request a new one for fresh sync
        this.tokenClient.requestAccessToken({ prompt: 'consent' });
    }

    closeModal() {
        if (this.syncModal) {
            this.syncModal.classList.add('closing');
            setTimeout(() => {
                this.syncModal.classList.remove('active', 'closing');
            }, 200);
        }
    }

    async processSyncModal() {
        this.syncReviewList.innerHTML = '<p style="padding: 20px; text-align: center; color: var(--text-secondary);">Analyzing calendar states...</p>';
        this.syncModal.classList.add('active');

        try {
            const calendarId = await this.getOrCreateCalendar();
            const events = await this.listGoogleEvents(calendarId);
            const exams = await storage.getExams();
            
            this.renderSyncReview(exams, events);
        } catch (err) {
            console.error('Error processing sync modal:', err);
            this.syncReviewList.innerHTML = `<p style="padding: 20px; text-align: center; color: var(--danger-color);">Error connecting to Google: ${err.message}</p>`;
        }
    }

    async getOrCreateCalendar() {
        const resp = await gapi.client.calendar.calendarList.list();
        const calendars = resp.result.items || [];
        const existing = calendars.find(c => c.summary === this.CALENDAR_NAME);
        
        if (existing) {
            return existing.id;
        }

        // Create new calendar
        const newCal = await gapi.client.calendar.calendars.insert({
            resource: { summary: this.CALENDAR_NAME }
        });
        return newCal.result.id;
    }

    async listGoogleEvents(calendarId) {
        const resp = await gapi.client.calendar.events.list({
            calendarId: calendarId,
            timeMin: (new Date()).toISOString(),
            showDeleted: false,
            singleEvents: true,
            orderBy: 'startTime',
        });
        return resp.result.items || [];
    }

    renderSyncReview(exams, googleEvents) {
        this.syncReviewList.innerHTML = '';
        
        if (exams.length === 0) {
            this.syncReviewList.innerHTML = '<p style="padding: 20px; text-align: center; color: var(--text-secondary);">No exams found to sync.</p>';
            return;
        }

        exams.forEach(exam => {
            const gEvent = googleEvents.find(e => e.id === exam.googleEventId);
            let status = 'NEW';
            let conflictWarning = false;
            
            if (gEvent) {
                // Check for updates
                const isTitleSame = gEvent.summary === exam.title;
                const isDateSame = this.isDateSame(gEvent, exam);
                
                status = (isTitleSame && isDateSame) ? 'SYNCED' : 'UPDATED';
                
                // Conflict Check: If Google event updated time is more recent than our last sync record
                if (exam.lastSyncGoogleUpdated && gEvent.updated > exam.lastSyncGoogleUpdated) {
                    conflictWarning = true;
                }
            }

            const statusBadge = this.getStatusBadge(status);
            const warningIcon = conflictWarning ? `<i class='bx bx-error' style="color: #ff9800; cursor: help;" title="External change detected in Google Calendar. Syncing will overwrite it."></i>` : '';

            this.syncReviewList.innerHTML += `
                <div class="sync-item" style="display: flex; align-items: center; gap: 12px; padding: 12px; border-bottom: 1px solid var(--border-color);">
                    <input type="checkbox" checked data-examid="${exam.id}" style="width: 18px; height: 18px; accent-color: var(--primary-color);">
                    <div style="flex: 1;">
                        <div style="font-weight: 500; font-size: 0.95rem;">${exam.title} ${warningIcon}</div>
                        <div style="font-size: 0.8rem; color: var(--text-secondary);">${exam.date} ${exam.time ? '| ' + exam.time : ''}</div>
                    </div>
                    ${statusBadge}
                </div>
            `;
        });
    }

    isDateSame(gEvent, exam) {
        // GEvent date can be all-day (start.date) or timed (start.dateTime)
        const gDate = gEvent.start.date || gEvent.start.dateTime.split('T')[0];
        const gTime = gEvent.start.dateTime ? gEvent.start.dateTime.split('T')[1].substring(0, 5) : null;
        
        const dateMatch = gDate === exam.date;
        const timeMatch = exam.time ? (gTime === exam.time) : true; // If local has no time, we don't care (it's all-day)
        
        return dateMatch && timeMatch;
    }

    getStatusBadge(status) {
        let color = '';
        switch(status) {
            case 'NEW': color = '#4facfe'; break;
            case 'UPDATED': color = '#ff9800'; break;
            case 'SYNCED': color = '#03dac6'; break;
        }
        return `<span style="font-size: 0.7rem; font-weight: 700; padding: 2px 8px; border-radius: 4px; border: 1px solid ${color}; color: ${color};">${status}</span>`;
    }

    async executeSync() {
        const selectedExams = Array.from(this.syncReviewList.querySelectorAll('input:checked')).map(cb => cb.dataset.examid);
        if (selectedExams.length === 0) {
            alert('Please select at least one exam to sync.');
            return;
        }

        this.startSyncBtn.disabled = true;
        this.startSyncBtn.textContent = 'Syncing...';

        try {
            const calendarId = await this.getOrCreateCalendar();
            const examsData = await storage.getExams();
            
            for (const examId of selectedExams) {
                const exam = examsData.find(e => e.id === examId);
                if (!exam) continue;

                const eventResource = this.prepareEventResource(exam);
                
                let resp;
                if (exam.googleEventId) {
                    try {
                        resp = await gapi.client.calendar.events.update({
                            calendarId: calendarId,
                            eventId: exam.googleEventId,
                            resource: eventResource
                        });
                    } catch (e) {
                        // If update fails (e.g. event deleted on Google), try inserting
                        resp = await gapi.client.calendar.events.insert({
                            calendarId: calendarId,
                            resource: eventResource
                        });
                    }
                } else {
                    resp = await gapi.client.calendar.events.insert({
                        calendarId: calendarId,
                        resource: eventResource
                    });
                }

                // Update local storage with Google refs
                exam.googleEventId = resp.result.id;
                exam.lastSyncGoogleUpdated = resp.result.updated;
                exam.lastSyncLocalAt = new Date().toISOString();
                await storage.updateExam(exam);
            }

            alert(`Successfully synced ${selectedExams.length} events to 'Student OS - Test' calendar.`);
            this.closeModal();
            // Trigger refresh in main App if needed (optional)
            if (window.app) await window.app.loadExams();
        } catch (err) {
            console.error('Sync execution failed:', err);
            alert(`Sync failed: ${err.message}`);
        } finally {
            this.startSyncBtn.disabled = false;
            this.startSyncBtn.textContent = 'Start Syncing';
        }
    }

    prepareEventResource(exam) {
        // Default to All-Day unless time is explicitly set
        const resource = {
            summary: exam.title,
            description: `Student OS Exam Dashboard. Moed: ${exam.moed || 'N/A'}.`,
            id: exam.googleEventId || undefined // Only provide if updating, but gapi client handles update vs insert differently
        };

        if (exam.time) {
            // Timed event (1 hour duration as default)
            const startDateTime = `${exam.date}T${exam.time}:00`;
            const endDate = new Date(new Date(startDateTime).getTime() + 60 * 60 * 1000);
            resource.start = { dateTime: startDateTime, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone };
            resource.end = { dateTime: endDate.toISOString(), timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone };
        } else {
            // All-day event
            resource.start = { date: exam.date };
            // End date for all-day is exclusive, so it must be the NEXT day
            const nextDay = new Date(new Date(exam.date).getTime() + 24 * 60 * 60 * 1000);
            resource.end = { date: nextDay.toISOString().split('T')[0] };
        }

        return resource;
    }
}

// Initializing as a singleton accessible from window if needed
document.addEventListener('DOMContentLoaded', () => {
    window.googleSync = new GoogleSync();
});
