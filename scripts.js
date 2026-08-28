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
        setTimeout(() => {
            calendar.updateSize();
            calendar.render();
        }, 100);
    }

    if (sectionId === 'progress-sec') {
        setTimeout(updateCharts, 100);
    }
}

// ==========================================
// TASK MANAGEMENT & FILTER STATE
// ==========================================
let currentTaskFilter = 'all';

function filterTaskView(filterType, element) {
    currentTaskFilter = filterType;
    
    const pills = document.querySelectorAll('.filter-pill');
    pills.forEach(p => p.classList.remove('active'));
    if (element) element.classList.add('active');

    applyTaskFilters();
}

function handleTaskSearch(query) {
    applyTaskFilters(query.toLowerCase().trim());
}

function applyTaskFilters(searchQuery = '') {
    let filtered = [...tasks];

    if (currentTaskFilter === 'pending') filtered = filtered.filter(t => !t.completed);
    if (currentTaskFilter === 'completed') filtered = filtered.filter(t => t.completed);

    const query = searchQuery || document.getElementById('searchTask')?.value.toLowerCase().trim();
    if (query) {
        filtered = filtered.filter(t => t.title.toLowerCase().includes(query));
    }

    renderTaskList(filtered);
}

// ==========================================
// TASK MANAGEMENT (BACKEND API)
// ==========================================
async function fetchTasksFromBackend() {
    const token = getAuthToken();
    if (!token) return;

    try {
        const response = await fetch(`${API_BASE_URL}/api/tasks`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.ok) {
            tasks = await response.json();
            updateDashboard();
            applyTaskFilters();
            if (typeof updateCalendarEvents === 'function') updateCalendarEvents();
            if (typeof updateCharts === 'function') updateCharts();
        }
    } catch (error) {
        console.error('Error fetching tasks:', error);
    }
}

async function addNewTask() {
    const input = document.getElementById('taskInput');
    const title = input ? input.value.trim() : '';
    
    const dateInput = document.getElementById('taskDate')?.value;
    const timeInput = document.getElementById('taskTime')?.value || '10:00';

    if (!title) return;

    const selectedDate = dateInput || new Date().toISOString().split('T')[0];
    const fullDateTimeStr = `${selectedDate}T${timeInput}:00`;

    const token = getAuthToken();
    try {
        const response = await fetch(`${API_BASE_URL}/api/tasks`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ 
                title, 
                completed: false, 
                date: fullDateTimeStr 
            })
        });

        if (response.ok) {
            input.value = '';
            if (input) input.blur(); // Dismiss mobile keyboard
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

function updateDashboard() {
    const total = tasks.length;
    const completed = tasks.filter(t => t.completed).length;
    const pending = total - completed;
    const percentage = total === 0 ? 0 : Math.round((completed / total) * 100);

    if (document.getElementById('totalTasks')) document.getElementById('totalTasks').textContent = total;
    if (document.getElementById('completedTasks')) document.getElementById('completedTasks').textContent = completed;
    if (document.getElementById('pendingTasks')) document.getElementById('pendingTasks').textContent = pending;

    if (document.getElementById('sideTotal')) document.getElementById('sideTotal').textContent = total;
    if (document.getElementById('sideCompleted')) document.getElementById('sideCompleted').textContent = completed;
    if (document.getElementById('sidePending')) document.getElementById('sidePending').textContent = pending;

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
    if (!taskList || taskList.length === 0) {
        container.innerHTML = '<p style="color: #666; margin-top: 15px;">No tasks found.</p>';
        return;
    }

    taskList.forEach(task => {
        const item = document.createElement('div');
        item.className = `task-card-item ${task.completed ? 'completed' : ''}`;
        
        item.innerHTML = `
            <div style="display: flex; align-items: center; gap: 12px;">
                <input type="checkbox" ${task.completed ? 'checked' : ''} onchange="toggleTask('${task._id}', ${task.completed})" style="width: 18px; height: 18px; accent-color: #2563eb; cursor: pointer;">
                <span style="${task.completed ? 'text-decoration: line-through; color: #94a3b8;' : 'color: #0f172a; font-weight: 500;'}">${task.title}</span>
            </div>
            <button onclick="deleteTask('${task._id}')" style="background: #fee2e2; border: none; color: #ef4444; width: 32px; height: 32px; border-radius: 8px; cursor: pointer; display: flex; align-items: center; justify-content: center;">
                <i class="fa-solid fa-trash" style="font-size: 12px;"></i>
            </button>
        `;
        container.appendChild(item);
    });
}

// ==========================================
// EXAMS & ASSIGNMENTS (BACKEND API)
// ==========================================
async function fetchExamsFromBackend() {
    const token = getAuthToken();
    if (!token) return;

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

async function addNewExam() {
    const titleInput = document.getElementById('examTitle');
    const subjectInput = document.getElementById('examSubject');
    const dateInput = document.getElementById('examDate');

    const title = titleInput ? titleInput.value.trim() : '';
    const subject = subjectInput ? subjectInput.value.trim() : 'General';
    let rawDate = dateInput ? dateInput.value : '';

    if (!title || !rawDate) {
        alert('Please fill in both the Title and the Due Date!');
        return;
    }

    const parsedDate = new Date(rawDate);
    if (isNaN(parsedDate.getTime())) {
        alert('Please enter a valid date!');
        return;
    }
    const dueDate = parsedDate.toISOString().split('T')[0];

    const token = getAuthToken();
    try {
        const response = await fetch(`${API_BASE_URL}/api/exams`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ title, subject, dueDate })
        });

        if (response.ok) {
            if (titleInput) titleInput.value = '';
            if (subjectInput) subjectInput.value = '';
            if (dateInput) dateInput.value = '';
            fetchExamsFromBackend();
        } else {
            const errData = await response.json();
            alert(errData.error || errData.message || 'Failed to add exam item.');
        }
    } catch (error) {
        console.error('Error adding exam:', error);
        alert('Unable to connect to server.');
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
    if (!token) return;

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
        alert('Please enter a title AND select a PDF file to upload!');
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
                if (document.getElementById('noteTitle')) document.getElementById('noteTitle').value = '';
                if (document.getElementById('noteSubject')) document.getElementById('noteSubject').value = '';
                if (document.getElementById('noteFileInput')) document.getElementById('noteFileInput').value = '';
                if (document.getElementById('selectedFileName')) document.getElementById('selectedFileName').textContent = '';
                currentSelectedFile = null;
                fetchNotesFromBackend();
            } else {
                const errData = await response.json();
                alert(errData.error || 'Failed to upload PDF. File size may be too large.');
            }
        } catch (error) {
            console.error('Error uploading note:', error);
            alert('Server error occurred during PDF upload.');
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
// RENDER HELPERS
// ==========================================
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
            padding: 12px 16px; background: #f9fafb; border-radius: 8px; border-left: 4px solid ${badge.color}; margin-bottom: 8px;
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
        initialView: 'timeGridWeek',
        headerToolbar: {
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,timeGridWeek'
        },
        editable: true,                 
        droppable: true,                
        selectable: true,               
        selectLongPressDelay: 200,      
        selectMirror: true,
        allDayMaintainDuration: false,  
        defaultTimedEventDuration: '01:00:00',

        // 1. Handles creating NEW tasks by clicking/dragging on empty slots
        select: async function(info) {
            const title = prompt('Enter task name:');
            if (!title || !title.trim()) return;

            const token = getAuthToken();
            try {
                const response = await fetch(`${API_BASE_URL}/api/tasks`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({ 
                        title: title.trim(), 
                        completed: false, 
                        date: info.startStr 
                    })
                });

                if (response.ok) {
                    fetchTasksFromBackend();
                }
            } catch (error) {
                console.error('Error adding task from calendar:', error);
            }
        },

        // 2. Handles RENAME or DELETE choice when a task is clicked
// Handles RENAMING a task when clicked on the calendar
        eventClick: async function(info) {
            const currentTitle = info.event.title;
            const newTitle = prompt('Rename task:', currentTitle);

            // If user enters nothing, cancels, or keeps the same name, do nothing
            if (!newTitle || !newTitle.trim() || newTitle.trim() === currentTitle) return;

            const token = getAuthToken();
            try {
                const response = await fetch(`${API_BASE_URL}/api/tasks/${info.event.id}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({ title: newTitle.trim() })
                });

                if (response.ok) {
                    fetchTasksFromBackend();
                }
            } catch (error) {
                console.error('Error renaming task:', error);
            }
        },

        // 3. Handles saving the time when you DRAG an existing task
        eventDrop: async function(info) {
            const token = getAuthToken();
            try {
                const payload = { 
                    date: info.event.startStr 
                };

                const response = await fetch(`${API_BASE_URL}/api/tasks/${info.event.id}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify(payload)
                });

                if (!response.ok) {
                    info.revert();
                    console.error('Backend failed to save the new time.');
                }
            } catch (error) {
                console.error('Error saving dragged task:', error);
                info.revert();
            }
        },

        events: []
    });
    calendar.render();
}

function updateCalendarEvents() {
    if (!calendar) return;
    calendar.removeAllEvents();
    tasks.forEach(task => {
        const hasTime = task.date && task.date.includes('T');

        calendar.addEvent({
            id: task._id,
            title: task.title,
            start: task.date || new Date().toISOString(),
            allDay: !hasTime, 
            color: task.completed ? '#10b981' : '#2563eb'
        });
    });
}

function getWeeklyTaskCounts() {
    const counts = [0, 0, 0, 0, 0, 0, 0];
    tasks.forEach(task => {
        if (task.completed) {
            const completedDate = task.completedAt ? new Date(task.completedAt) : new Date();
            let dayIndex = completedDate.getDay();
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
// USER PROFILE & SETTINGS LOGIC (CROSS-DEVICE SYNC)
// ==========================================
async function loadSavedProfile() {
    const token = getAuthToken();
    let userName = localStorage.getItem('userName') || 'Student';
    let userEmail = localStorage.getItem('userEmail') || '';
    let savedAvatar = localStorage.getItem('userAvatar');

    // Fetch fresh profile info from server to keep phone and laptop synchronized
    if (token) {
        try {
            const response = await fetch(`${API_BASE_URL}/api/user/profile`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (response.ok) {
                const data = await response.json();
                if (data.name) {
                    userName = data.name;
                    localStorage.setItem('userName', data.name);
                }
                if (data.email) {
                    userEmail = data.email;
                    localStorage.setItem('userEmail', data.email);
                }
                if (data.avatar) {
                    savedAvatar = data.avatar;
                    localStorage.setItem('userAvatar', data.avatar);
                }
            }
        } catch (e) {
            console.warn('Could not fetch remote profile:', e);
        }
    }

    const headerTitle = document.querySelector('header h1');
    if (headerTitle && headerTitle.textContent.includes('Hello')) {
        headerTitle.innerHTML = `Hello, ${userName} 👋`;
    }

    const nameInput = document.getElementById('settingName');
    const emailInput = document.getElementById('settingEmail');
    if (nameInput) nameInput.value = userName;
    if (emailInput) emailInput.value = userEmail;

    if (savedAvatar) {
        const img = document.getElementById('profileImage');
        if (img) img.src = savedAvatar;
    }
}

function handleAvatarUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function (e) {
        const img = new Image();
        img.onload = async function () {
            // Compress image for fast mobile uploading and network transfer
            const canvas = document.createElement('canvas');
            const MAX_WIDTH = 250;
            const scaleFactor = MAX_WIDTH / img.width;
            
            canvas.width = MAX_WIDTH;
            canvas.height = img.height * scaleFactor;

            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

            const compressedBase64 = canvas.toDataURL('image/jpeg', 0.7);

            // 1. Update DOM & LocalStorage
            const profileImg = document.getElementById('profileImage');
            if (profileImg) profileImg.src = compressedBase64;
            localStorage.setItem('userAvatar', compressedBase64);

            // 2. Sync avatar to backend so it displays across all devices
            const token = getAuthToken();
            try {
                const response = await fetch(`${API_BASE_URL}/api/user/profile`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({ avatar: compressedBase64 })
                });

                if (response.ok) {
                    alert('Profile picture updated across all devices!');
                } else {
                    alert('Profile picture saved locally.');
                }
            } catch (err) {
                console.error('Error uploading avatar:', err);
            }
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

async function saveProfile() {
    const nameInput = document.getElementById('settingName');
    const name = nameInput ? nameInput.value.trim() : '';

    if (!name) {
        alert('Name cannot be empty!');
        return;
    }

    localStorage.setItem('userName', name);

    const token = getAuthToken();
    try {
        const response = await fetch(`${API_BASE_URL}/api/user/profile`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ name })
        });

        if (response.ok) {
            alert('Profile details saved!');
            loadSavedProfile();
        }
    } catch (err) {
        console.warn('Backend update failed; saved locally.');
    }
}

async function changePassword() {
    const currentPassword = document.getElementById('currentPassword')?.value.trim();
    const newPassword = document.getElementById('newPassword')?.value.trim();
    const confirmPassword = document.getElementById('confirmPassword')?.value.trim();

    if (!currentPassword || !newPassword || !confirmPassword) {
        alert('Please fill out all password fields!');
        return;
    }

    if (newPassword.length < 6) {
        alert('New password must be at least 6 characters long.');
        return;
    }

    if (newPassword !== confirmPassword) {
        alert('New passwords do not match!');
        return;
    }

    const token = getAuthToken();
    try {
        const response = await fetch(`${API_BASE_URL}/api/change-password`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ currentPassword, newPassword })
        });

        const data = await response.json();

        if (response.ok) {
            alert(data.message || 'Password changed successfully!');
            document.getElementById('currentPassword').value = '';
            document.getElementById('newPassword').value = '';
            document.getElementById('confirmPassword').value = '';
        } else {
            alert(data.error || data.message || 'Failed to change password.');
        }
    } catch (error) {
        console.error('Password change error:', error);
        alert('Unable to connect to the server.');
    }
}

function logoutUser() {
    localStorage.clear();
    window.location.href = 'login.html';
}

function initAuthForms() {
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('loginEmail')?.value.trim().toLowerCase();
            const password = document.getElementById('loginPassword')?.value.trim();

            if (!email || !password) {
                alert('Please enter both email and password.');
                return;
            }

            try {
                const response = await fetch(`${API_BASE_URL}/api/login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password })
                });

                const data = await response.json();

                if (response.ok) {
                    localStorage.setItem('token', data.token);
                    if (data.user?.name) localStorage.setItem('userName', data.user.name);
                    if (data.user?.email) localStorage.setItem('userEmail', data.user.email);
                    window.location.href = 'dashboard.html';
                } else {
                    alert(data.error || data.message || 'Invalid email or password');
                }
            } catch (error) {
                console.error('Login Error:', error);
                alert('Unable to connect to server. Please try again.');
            }
        });
    }

    const registerForm = document.getElementById('registerForm');
    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const name = document.getElementById('registerName')?.value.trim();
            const email = document.getElementById('registerEmail')?.value.trim().toLowerCase();
            const password = document.getElementById('registerPassword')?.value.trim();

            if (!name || !email || !password) {
                alert('Please fill in all fields!');
                return;
            }

            try {
                const response = await fetch(`${API_BASE_URL}/api/register`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name, email, password })
                });

                const data = await response.json();

                if (response.ok) {
                    alert('Registration successful! Please log in.');
                    window.location.href = 'login.html';
                } else {
                    alert(data.error || data.message || 'Registration failed.');
                }
            } catch (error) {
                console.error('Registration Error:', error);
                alert('Unable to connect to server. Please try again.');
            }
        });
    }
}

// ==========================================
// INITIALIZATION ON DOM LOAD
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    const isDashboard = !!document.getElementById('calendar-sec'); 
    const token = getAuthToken();

    if (isDashboard && !token) {
        window.location.href = 'login.html';
        return;
    }

    if (isDashboard) {
        loadSavedProfile();
        fetchTasksFromBackend();
        fetchExamsFromBackend();
        fetchNotesFromBackend();
        
        initCalendar();
        initCharts();
        
        const todayStr = new Date().toISOString().split('T')[0];
        const taskDateInput = document.getElementById('taskDate');
        const examDateInput = document.getElementById('examDate');
        if (taskDateInput) taskDateInput.min = todayStr;
        if (examDateInput) examDateInput.min = todayStr;
    } else {
        initAuthForms();
    }
});
// ==========================================
// POMODORO TIMER CODE
// ==========================================
let timerInterval = null;
let currentDurationInSeconds = 25 * 60; // Default: 25 minutes
let timeLeft = 25 * 60;
let isTimerRunning = false;

// 1. Update display clock (MM:SS)
function updatePomoDisplay() {
    const display = document.getElementById('pomoTimerDisplay');
    if (!display) return;

    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;
    display.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

// 2. Mode Switcher (25m, 5m, 15m)
function setTimerMode(minutes, element) {
    pausePomodoro();
    
    // Toggle active class on buttons
    if (element) {
        document.querySelectorAll('.timer-mode-btn').forEach(btn => btn.classList.remove('active'));
        element.classList.add('active');
    }

    currentDurationInSeconds = minutes * 60;
    timeLeft = currentDurationInSeconds;
    updatePomoDisplay();
}

// 3. Start Timer
function startPomodoro() {
    if (isTimerRunning) return;
    isTimerRunning = true;

    timerInterval = setInterval(() => {
        if (timeLeft > 0) {
            timeLeft--;
            updatePomoDisplay();
        } else {
            clearInterval(timerInterval);
            isTimerRunning = false;
            alert("⏰ Pomodoro session completed! Take a break.");
        }
    }, 1000);
}

// 4. Pause Timer
function pausePomodoro() {
    clearInterval(timerInterval);
    timerInterval = null;
    isTimerRunning = false;
}

// 5. Reset Timer
function resetPomodoro() {
    pausePomodoro();
    timeLeft = currentDurationInSeconds;
    updatePomoDisplay();
}

// Load timer display on page start
document.addEventListener('DOMContentLoaded', () => {
    updatePomoDisplay();
});
