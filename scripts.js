// ==========================================
// CONFIGURATION & GLOBAL VARIABLES
// ==========================================
const API_BASE_URL = 'https://study-planner-backend-rklh.onrender.com';
let tasks = [];
let examItems = [];
let studyNotes = [];
let currentSelectedFile = null;

let weeklyChart = null;
let statusChart = null;
let calendar = null;

// Helper function to fetch token safely
function getAuthToken() {
    return localStorage.getItem('token');
}

// ==========================================
// TAB NAVIGATION LOGIC
// ==========================================
function showSection(sectionId, element) {
    const tabs = document.querySelectorAll('.tab-content');
    tabs.forEach(tab => tab.classList.remove('active-tab'));

    const navLinks = document.querySelectorAll('.nav-link');
    navLinks.forEach(link => link.classList.remove('active'));

    const activeTab = document.getElementById(sectionId);
    if (activeTab) {
        activeTab.classList.add('active-tab');
    }

    if (element) {
        element.classList.add('active');
    }

    if (sectionId === 'calendar-sec' && calendar) {
        setTimeout(() => calendar.render(), 100);
    }

    if (sectionId === 'progress-sec') {
        setTimeout(updateCharts, 100);
    }
}

// ==========================================
// TASK MANAGEMENT (BACKEND API)
// ==========================================
async function fetchTasksFromBackend() {
    const token = getAuthToken();
    try {
        const response = await fetch(`${API_BASE_URL}/api/tasks`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.ok) {
            tasks = await response.json();
            updateDashboard();
            renderTaskList(tasks);
            updateCalendarEvents();
            updateCharts();
        }
    } catch (error) {
        console.error('Error fetching tasks:', error);
    }
}

async function addNewTask() {
    const input = document.getElementById('taskInput');
    const title = input ? input.value.trim() : '';
    if (!title) return;

    const token = getAuthToken();
    try {
        const response = await fetch(`${API_BASE_URL}/api/tasks`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ title, completed: false, date: new Date().toISOString().split('T')[0] })
        });

        if (response.ok) {
            input.value = '';
            fetchTasksFromBackend();
        }
    } catch (error) {
        console.error('Error adding task:', error);
    }
}

async function toggleTask(id, currentStatus) {
    const token = getAuthToken();
    try {
        const payload = { 
            completed: !currentStatus,
            completedAt: !currentStatus ? new Date().toISOString() : null
        };

        const response = await fetch(`${API_BASE_URL}/api/tasks/${id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(payload)
        });
        if (response.ok) fetchTasksFromBackend();
    } catch (error) {
        console.error('Error updating task:', error);
    }
}

async function deleteTask(id) {
    const token = getAuthToken();
    try {
        const response = await fetch(`${API_BASE_URL}/api/tasks/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.ok) fetchTasksFromBackend();
    } catch (error) {
        console.error('Error deleting task:', error);
    }
}

// ==========================================
// EXAMS & ASSIGNMENTS TRACKER (BACKEND API)
// ==========================================
async function fetchExamsFromBackend() {
    const token = getAuthToken();
    try {
        const response = await fetch(`${API_BASE_URL}/api/exams`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.ok) {
            examItems = await response.json();
            renderExams();
        }
    } catch (error) {
        console.error('Error fetching exams:', error);
    }
}

async function addExamTrackerItem() {
    const title = document.getElementById('examTitleInput')?.value.trim();
    const subject = document.getElementById('examSubjectInput')?.value.trim() || 'General';
    const dateValue = document.getElementById('examDateInput')?.value;

    if (!title || !dateValue) {
        alert('Please enter a title and select a due date!');
        return;
    }

    const token = getAuthToken();
    try {
        const response = await fetch(`${API_BASE_URL}/api/exams`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ title, subject, dueDate: dateValue })
        });

        if (response.ok) {
            document.getElementById('examTitleInput').value = '';
            document.getElementById('examSubjectInput').value = '';
            document.getElementById('examDateInput').value = '';
            fetchExamsFromBackend();
        }
    } catch (error) {
        console.error('Error adding exam:', error);
    }
}

async function deleteExamItem(id) {
    const token = getAuthToken();
    try {
        const response = await fetch(`${API_BASE_URL}/api/exams/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.ok) fetchExamsFromBackend();
    } catch (error) {
        console.error('Error deleting exam:', error);
    }
}

// ==========================================
// PDF & NOTES HUB (BACKEND API)
// ==========================================
async function fetchNotesFromBackend() {
    const token = getAuthToken();
    try {
        const response = await fetch(`${API_BASE_URL}/api/notes`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.ok) {
            studyNotes = await response.json();
            renderNotes();
        }
    } catch (error) {
        console.error('Error fetching notes:', error);
    }
}

function handleFileSelect(event) {
    const file = event.target.files[0];
    if (file) {
        currentSelectedFile = file;
        const nameDisplay = document.getElementById('selectedFileName');
        if (nameDisplay) nameDisplay.textContent = `📎 Selected: ${file.name} (${(file.size / (1024 * 1024)).toFixed(2)} MB)`;
    }
}

async function addPdfNote() {
    const title = document.getElementById('noteTitle')?.value.trim();
    const subject = document.getElementById('noteSubject')?.value.trim() || 'General';

    if (!title || !currentSelectedFile) {
        alert('Please enter a title AND select a file to upload!');
        return;
    }

    const reader = new FileReader();
    reader.onload = async function (e) {
        const token = getAuthToken();
        const payload = {
            title: title,
            subject: subject,
            fileName: currentSelectedFile.name,
            fileType: currentSelectedFile.type,
            fileData: e.target.result,
            date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        };

        try {
            const response = await fetch(`${API_BASE_URL}/api/notes`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(payload)
            });

            if (response.ok) {
                document.getElementById('noteTitle').value = '';
                document.getElementById('noteSubject').value = '';
                document.getElementById('noteFileInput').value = '';
                document.getElementById('selectedFileName').textContent = '';
                currentSelectedFile = null;
                fetchNotesFromBackend();
            }
        } catch (error) {
            console.error('Error uploading note:', error);
        }
    };

    reader.readAsDataURL(currentSelectedFile);
}

async function deleteNote(id) {
    const token = getAuthToken();
    try {
        const response = await fetch(`${API_BASE_URL}/api/notes/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.ok) fetchNotesFromBackend();
    } catch (error) {
        console.error('Error deleting note:', error);
    }
}

// ==========================================
// RENDER HELPERS & DOM BUILDERS
// ==========================================
function updateDashboard() {
    const total = tasks.length;
    const completed = tasks.filter(t => t.completed).length;
    const pending = total - completed;
    const percentage = total === 0 ? 0 : Math.round((completed / total) * 100);

    if (document.getElementById('totalTasks')) document.getElementById('totalTasks').textContent = total;
    if (document.getElementById('completedTasks')) document.getElementById('completedTasks').textContent = completed;
    if (document.getElementById('pendingTasks')) document.getElementById('pendingTasks').textContent = pending;

    const progressBar = document.getElementById('progressBar');
    const progressText = document.getElementById('progressText');
    if (progressBar) progressBar.value = percentage;
    if (progressText) progressText.textContent = `${percentage}% Completed`;

    if (document.getElementById('analyticsRate')) document.getElementById('analyticsRate').textContent = `${percentage}%`;
    if (document.getElementById('analyticsCompleted')) document.getElementById('analyticsCompleted').textContent = completed;
    if (document.getElementById('analyticsPending')) document.getElementById('analyticsPending').textContent = pending;
}

function renderTaskList(taskList) {
    const container = document.getElementById('taskList');
    if (!container) return;

    container.innerHTML = '';
    if (taskList.length === 0) {
        container.innerHTML = '<p style="color: #666; margin-top: 15px;">No tasks found.</p>';
        return;
    }

    taskList.forEach(task => {
        const item = document.createElement('div');
        item.className = `task-item ${task.completed ? 'completed' : ''}`;
        item.style.cssText = `
            display: flex; justify-content: space-between; align-items: center;
            padding: 12px; background: white; margin-top: 10px; border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.05);
        `;
        item.innerHTML = `
            <div style="display: flex; align-items: center; gap: 10px;">
                <input type="checkbox" ${task.completed ? 'checked' : ''} onchange="toggleTask('${task._id}', ${task.completed})">
                <span style="${task.completed ? 'text-decoration: line-through; color: #888;' : ''}">${task.title}</span>
            </div>
            <button onclick="deleteTask('${task._id}')" style="background: none; border: none; color: #ef4444; cursor: pointer;">
                <i class="fa-solid fa-trash"></i>
            </button>
        `;
        container.appendChild(item);
    });
}

function getDaysRemainingText(dueDateStr) {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const dueDate = new Date(dueDateStr); dueDate.setHours(0, 0, 0, 0);
    const diffDays = Math.ceil((dueDate - today) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return { text: 'Overdue', color: '#dc2626', bg: '#fee2e2' };
    if (diffDays === 0) return { text: 'Due Today!', color: '#dc2626', bg: '#fee2e2' };
    if (diffDays === 1) return { text: 'Tomorrow!', color: '#d97706', bg: '#fef3c7' };
    return { text: `${diffDays} days left`, color: '#2563eb', bg: '#dbeafe' };
}

function renderExams() {
    const listContainer = document.getElementById('examTrackerList');
    if (!listContainer) return;

    listContainer.innerHTML = '';
    if (examItems.length === 0) {
        listContainer.innerHTML = `<p style="color: #888; font-size: 14px; text-align: center;">No upcoming exams or assignments added yet! 🎉</p>`;
        return;
    }

    examItems.sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));

    examItems.forEach(item => {
        const badge = getDaysRemainingText(item.dueDate);
        const card = document.createElement('div');
        card.style.cssText = `
            display: flex; justify-content: space-between; align-items: center; 
            padding: 12px 16px; background: #f9fafb; border-radius: 8px; border-left: 4px solid ${badge.color};
        `;
        card.innerHTML = `
            <div>
                <strong style="font-size: 15px; color: #111827;">${item.title}</strong>
                <span style="font-size: 12px; color: #6b7280; background: #e5e7eb; padding: 2px 8px; border-radius: 12px; margin-left: 8px;">${item.subject}</span>
                <p style="font-size: 12px; color: #6b7280; margin-top: 2px;">Due: ${item.dueDate}</p>
            </div>
            <div style="display: flex; align-items: center; gap: 10px;">
                <span style="font-size: 12px; font-weight: 600; color: ${badge.color}; background: ${badge.bg}; padding: 4px 10px; border-radius: 12px;">${badge.text}</span>
                <button onclick="deleteExamItem('${item._id}')" style="background: transparent; border: none; color: #ef4444; cursor: pointer;"><i class="fa-solid fa-trash"></i></button>
            </div>
        `;
        listContainer.appendChild(card);
    });
}

function renderNotes() {
    const notesGrid = document.getElementById('notesGrid');
    if (!notesGrid) return;

    notesGrid.innerHTML = '';
    if (studyNotes.length === 0) {
        notesGrid.innerHTML = `<p style="grid-column: 1/-1; color: #888; text-align: center;">No PDFs or study materials uploaded yet! 📄</p>`;
        return;
    }

    studyNotes.forEach(note => {
        const card = document.createElement('div');
        card.style.cssText = `
            background: #ffffff; border-radius: 10px; padding: 16px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.06); border-left: 5px solid #2563eb;
            display: flex; flex-direction: column; justify-content: space-between;
        `;
        card.innerHTML = `
            <div>
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                    <span style="font-size: 11px; background: #dbeafe; color: #1e40af; font-weight: 600; padding: 2px 8px; border-radius: 12px;">${note.subject}</span>
                    <span style="font-size: 11px; color: #9ca3af;">${note.date}</span>
                </div>
                <h4 style="font-size: 16px; color: #111827; margin-bottom: 6px;">${note.title}</h4>
                <p style="font-size: 12px; color: #6b7280; display: flex; align-items: center; gap: 5px;">
                    <i class="fa-solid fa-file-pdf" style="color: #ef4444; font-size: 16px;"></i> ${note.fileName}
                </p>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 15px;">
                <a href="${note.fileData}" download="${note.fileName}" style="background: #2563eb; color: white; padding: 6px 12px; border-radius: 6px; text-decoration: none; font-size: 12px; font-weight: 600;">
                    <i class="fa-solid fa-download"></i> Download / View
                </a>
                <button onclick="deleteNote('${note._id}')" style="background: none; border: none; color: #ef4444; cursor: pointer; font-size: 13px;">
                    <i class="fa-solid fa-trash"></i>
                </button>
            </div>
        `;
        notesGrid.appendChild(card);
    });
}

// ==========================================
// CALENDAR & CHARTS INITIALIZATION
// ==========================================
function initCalendar() {
    const calendarEl = document.getElementById('calendar');
    if (!calendarEl) return;

    calendar = new FullCalendar.Calendar(calendarEl, {
        initialView: 'dayGridMonth',
        headerToolbar: {
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,timeGridWeek'
        },
        events: []
    });
    calendar.render();
}

function updateCalendarEvents() {
    if (!calendar) return;
    calendar.removeAllEvents();
    tasks.forEach(task => {
        calendar.addEvent({
            title: task.title,
            start: task.date || new Date().toISOString().split('T')[0],
            color: task.completed ? '#10b981' : '#2563eb'
        });
    });
}

// Calculates completion counts per day of week (Mon-Sun)
function getWeeklyTaskCounts() {
    const counts = [0, 0, 0, 0, 0, 0, 0]; // Mon, Tue, Wed, Thu, Fri, Sat, Sun

    tasks.forEach(task => {
        if (task.completed) {
            const completedDate = task.completedAt ? new Date(task.completedAt) : new Date();
            let dayIndex = completedDate.getDay(); // 0 = Sun, 1 = Mon, ..., 6 = Sat

            // Map Sun (0) to index 6, Mon (1) to index 0, etc.
            const chartIndex = dayIndex === 0 ? 6 : dayIndex - 1;
            counts[chartIndex]++;
        }
    });

    return counts;
}

function initCharts() {
    const weeklyCtx = document.getElementById('weeklyChart')?.getContext('2d');
    const statusCtx = document.getElementById('statusChart')?.getContext('2d');

    if (weeklyChart) weeklyChart.destroy();
    if (statusChart) statusChart.destroy();

    if (weeklyCtx) {
        weeklyChart = new Chart(weeklyCtx, {
            type: 'bar',
            data: {
                labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
                datasets: [{ 
                    label: 'Tasks Completed', 
                    data: getWeeklyTaskCounts(), 
                    backgroundColor: '#2563eb',
                    borderRadius: 4
                }]
            },
            options: { 
                responsive: true, 
                maintainAspectRatio: false,
                scales: {
                    y: { beginAtZero: true, ticks: { stepSize: 1 } }
                }
            }
        });
    }

    if (statusCtx) {
        const completed = tasks.filter(t => t.completed).length;
        const pending = tasks.length - completed;

        statusChart = new Chart(statusCtx, {
            type: 'doughnut',
            data: {
                labels: ['Completed', 'Pending'],
                datasets: [{ data: [completed, pending], backgroundColor: ['#10b981', '#f59e0b'] }]
            },
            options: { responsive: true, maintainAspectRatio: false }
        });
    }
}

function updateCharts() {
    if (weeklyChart) {
        weeklyChart.data.datasets[0].data = getWeeklyTaskCounts();
        weeklyChart.update();
    }
    if (statusChart) {
        const completed = tasks.filter(t => t.completed).length;
        const pending = tasks.length - completed;
        statusChart.data.datasets[0].data = [completed, pending];
        statusChart.update();
    }
}

// ==========================================
// USER PROFILE & AUTH HELPERS
// ==========================================
function loadSavedProfile() {
    const userName = localStorage.getItem('userName') || 'User';
    const userEmail = localStorage.getItem('userEmail') || '';

    const headerTitle = document.querySelector('header h1');
    if (headerTitle && headerTitle.textContent.includes('Hello')) {
        headerTitle.innerHTML = `Hello, ${userName} 👋`;
    }

    const nameInput = document.getElementById('settingName');
    const emailInput = document.getElementById('settingEmail');
    if (nameInput) nameInput.value = userName;
    if (emailInput) emailInput.value = userEmail;

    const savedAvatar = localStorage.getItem('userAvatar');
    if (savedAvatar) {
        const img = document.getElementById('profileImage');
        if (img) img.src = savedAvatar;
    }
}

function logoutUser() {
    localStorage.removeItem('token');
    window.location.href = 'login.html';
}

function initAuthForms() {
    const searchInput = document.getElementById('searchTask');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase();
            const filtered = tasks.filter(t => t.title.toLowerCase().includes(query));
            renderTaskList(filtered);
        });
    }
}

// ==========================================
// INITIALIZE ON PAGE LOAD
// ==========================================
document.addEventListener('DOMContentLoaded', () => {

    const token = getAuthToken();
    const path = window.location.pathname;

    // 1. Identify current page
    const isLoginPage = path.includes('login.html');
    const isRegisterPage = path.includes('register.html');
    const isDashboard = path.includes('dashboard.html');

    // 2. Protected Route Guard
    if (isDashboard && !token) {
        window.location.href = 'login.html';
        return;
    }

    // 3. Logged-in Guard
    if (token && (isLoginPage || isRegisterPage)) {
        window.location.href = 'dashboard.html';
        return;
    }

    // 4. Initialize Dashboard Components
    if (isDashboard && token) {
        if (typeof fetchTasksFromBackend === 'function') fetchTasksFromBackend();
        if (typeof fetchExamsFromBackend === 'function') fetchExamsFromBackend(); 
        if (typeof fetchNotesFromBackend === 'function') fetchNotesFromBackend(); 

        if (typeof loadSavedProfile === 'function') loadSavedProfile();
        if (typeof initCalendar === 'function') initCalendar();
        
        const chartCanvas = document.getElementById('weeklyChart');
        if (chartCanvas && typeof initCharts === 'function') {
            initCharts();
        }
    }

    if ((isLoginPage || isRegisterPage) && typeof initAuthForms === 'function') {
        initAuthForms();
    }
});
