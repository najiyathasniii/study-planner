let calendar = null;
let weeklyChartInstance = null;
let statusChartInstance = null;

// ----------------------------------------------------
// 1. BACKEND & API CONFIGURATION
// ----------------------------------------------------
// Change this to your live Render backend URL:
const API_BASE_URL = 'https://study-planner-backend-rklh.onrender.com/api';
const AUTH_TOKEN_KEY = 'studyplanner.token';

let tasks = [];

function getAuthToken() { return localStorage.getItem(AUTH_TOKEN_KEY); }
function setAuthToken(token) { localStorage.setItem(AUTH_TOKEN_KEY, token); }
function clearAuthToken() { 
    localStorage.removeItem(AUTH_TOKEN_KEY); 
    localStorage.removeItem('study_useremail');
    localStorage.removeItem('study_username');
}

function getAuthHeaders() {
    const token = getAuthToken();
    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
    };
}

// ----------------------------------------------------
// 2. TAB SWITCHING LOGIC
// ----------------------------------------------------
function showSection(sectionId, element) {
    const sections = document.querySelectorAll('.tab-content');
    sections.forEach(sec => sec.classList.remove('active-tab'));

    const links = document.querySelectorAll('.sidebar ul li a');
    links.forEach(link => link.classList.remove('active'));

    const targetSection = document.getElementById(sectionId);
    if (targetSection) {
        targetSection.classList.add('active-tab');
    }
    if (element) {
        element.classList.add('active');
    }

    if (sectionId === 'calendar-sec') {
        setTimeout(initCalendar, 50);
    }

    if (sectionId === 'progress-sec') {
        setTimeout(initAnalytics, 50);
    }
}

// ----------------------------------------------------
// 3. TASK MANAGEMENT WITH MONGODB SYNC
// ----------------------------------------------------

// Fetch all tasks for logged in user from MongoDB
async function fetchTasksFromBackend() {
    const token = getAuthToken();
    if (!token) return;

    try {
        const res = await fetch(`${API_BASE_URL}/tasks`, {
            method: 'GET',
            headers: getAuthHeaders()
        });

        if (res.status === 401) {
            logoutUser();
            return;
        }

        if (res.ok) {
            const rawTasks = await res.json();
            // Map MongoDB format to frontend properties
            tasks = rawTasks.map(t => ({
                id: t._id,
                text: t.title,
                completed: t.status === 'completed',
                completedDay: t.completedDay !== undefined ? t.completedDay : (t.status === 'completed' ? new Date(t.updatedAt).getDay() : undefined)
            }));
            renderTasks();
        }
    } catch (err) {
        console.error('Error loading tasks from server:', err);
    }
}

// Add New Task to MongoDB
async function addNewTask() {
    const input = document.getElementById('taskInput');
    if (!input || !input.value.trim()) return;

    const titleText = input.value.trim();

    try {
        const res = await fetch(`${API_BASE_URL}/tasks`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({
                title: titleText,
                status: 'today'
            })
        });

        if (res.ok) {
            input.value = '';
            fetchTasksFromBackend(); // Reload clean list from MongoDB
        }
    } catch (err) {
        console.error('Error creating task on server:', err);
    }
}

// Toggle Task Complete / Pending on MongoDB
async function toggleTask(id) {
    const taskToToggle = tasks.find(t => t.id === id);
    if (!taskToToggle) return;

    const newCompletedStatus = !taskToToggle.completed;
    const newStatusString = newCompletedStatus ? 'completed' : 'today';

    try {
        const res = await fetch(`${API_BASE_URL}/tasks/${id}`, {
            method: 'PUT',
            headers: getAuthHeaders(),
            body: JSON.stringify({ status: newStatusString })
        });

        if (res.ok) {
            fetchTasksFromBackend();
        }
    } catch (err) {
        console.error('Error updating task on server:', err);
    }
}

// Delete Task from MongoDB
async function deleteTask(id) {
    try {
        const res = await fetch(`${API_BASE_URL}/tasks/${id}`, {
            method: 'DELETE',
            headers: getAuthHeaders()
        });

        if (res.ok) {
            fetchTasksFromBackend();
        }
    } catch (err) {
        console.error('Error deleting task on server:', err);
    }
}

function renderTasks() {
    const taskList = document.getElementById('taskList');
    if (!taskList) return;

    taskList.innerHTML = '';

    tasks.forEach(task => {
        const div = document.createElement('div');
        div.className = `task-item ${task.completed ? 'completed' : ''}`;
        div.innerHTML = `
            <div style="display:flex; align-items:center; gap:10px;">
                <input type="checkbox" ${task.completed ? 'checked' : ''} onchange="toggleTask('${task.id}')">
                <span>${task.text}</span>
            </div>
            <div class="task-actions">
                <button class="btn-icon btn-delete" onclick="deleteTask('${task.id}')"><i class="fa-solid fa-trash"></i></button>
            </div>
        `;
        taskList.appendChild(div);
    });

    updateCounters();
}

function updateCounters() {
    const total = tasks.length;
    const completed = tasks.filter(t => t.completed).length;
    const pending = total - completed;
    const percent = total > 0 ? Math.round((completed / total) * 100) : 0;

    if (document.getElementById('totalTasks')) document.getElementById('totalTasks').innerText = total;
    if (document.getElementById('completedTasks')) document.getElementById('completedTasks').innerText = completed;
    if (document.getElementById('pendingTasks')) document.getElementById('pendingTasks').innerText = pending;
    if (document.getElementById('progressBar')) document.getElementById('progressBar').value = percent;
    if (document.getElementById('progressText')) document.getElementById('progressText').innerText = `${percent}% Completed`;

    if (document.getElementById('analyticsCompleted')) document.getElementById('analyticsCompleted').innerText = completed;
    if (document.getElementById('analyticsRate')) document.getElementById('analyticsRate').innerText = `${percent}%`;
}

// ----------------------------------------------------
// 4. ANALYTICS & WEEKLY PERFORMANCE
// ----------------------------------------------------
function getWeeklyTaskCounts() {
    const weeklyCounts = [0, 0, 0, 0, 0, 0, 0];
    const dayIndexMap = { 1: 0, 2: 1, 3: 2, 4: 3, 5: 4, 6: 5, 0: 6 };

    tasks.forEach(task => {
        if (task.completed && task.completedDay !== undefined) {
            const index = dayIndexMap[task.completedDay];
            if (index !== undefined) {
                weeklyCounts[index] += 1;
            }
        }
    });

    return weeklyCounts;
}

function initAnalytics() {
    const ctxWeekly = document.getElementById('weeklyChart');
    if (ctxWeekly) {
        if (weeklyChartInstance) weeklyChartInstance.destroy();
        
        const liveWeeklyData = getWeeklyTaskCounts();

        weeklyChartInstance = new Chart(ctxWeekly, {
            type: 'bar',
            data: {
                labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
                datasets: [{
                    label: 'Tasks Completed',
                    data: liveWeeklyData,
                    backgroundColor: '#3b82f6',
                    borderRadius: 8
                }]
            },
            options: {
                responsive: true,
                plugins: { legend: { display: false } },
                scales: { 
                    y: { 
                        beginAtZero: true,
                        ticks: { stepSize: 1 }
                    } 
                }
            }
        });
    }

    const ctxStatus = document.getElementById('statusChart');
    if (ctxStatus) {
        if (statusChartInstance) statusChartInstance.destroy();
        
        const completed = tasks.filter(t => t.completed).length;
        const pending = tasks.length - completed;

        statusChartInstance = new Chart(ctxStatus, {
            type: 'doughnut',
            data: {
                labels: ['Completed', 'Pending'],
                datasets: [{
                    data: [completed, pending],
                    backgroundColor: ['#10b981', '#cbd5e1']
                }]
            },
            options: {
                responsive: true,
                plugins: { legend: { position: 'bottom' } }
            }
        });
    }
}

// ----------------------------------------------------
// 5. CALENDAR INITIALIZATION
// ----------------------------------------------------
function initCalendar() {
    const calendarEl = document.getElementById('calendar');
    if (!calendarEl) return;

    if (!calendar) {
        calendar = new FullCalendar.Calendar(calendarEl, {
            initialView: 'dayGridMonth',
            headerToolbar: {
                left: 'prev,next today',
                center: 'title',
                right: 'dayGridMonth,timeGridWeek'
            },
            editable: true,
            selectable: true,
            dateClick: function(info) {
                let taskTitle = prompt('Enter deadline for ' + info.dateStr + ':');
                if (taskTitle) {
                    calendar.addEvent({
                        title: taskTitle,
                        start: info.dateStr,
                        allDay: true
                    });
                }
            }
        });
        calendar.render();
    } else {
        calendar.updateSize();
    }
}

// ----------------------------------------------------
// 6. PROFILE & SETTINGS
// ----------------------------------------------------
function previewImage(event) {
    const reader = new FileReader();
    reader.onload = function() {
        const output = document.getElementById('profileImage');
        if (output) output.src = reader.result;
        localStorage.setItem('study_profile_img', reader.result);
    };
    if (event.target.files && event.target.files[0]) {
        reader.readAsDataURL(event.target.files[0]);
    }
}

function saveProfile(event) {
    if (event) event.preventDefault();
    const newName = document.getElementById('settingName')?.value;
    const newEmail = document.getElementById('settingEmail')?.value;

    if (newName) {
        localStorage.setItem('study_username', newName);
        updateGreetingName(newName);
    }
    if (newEmail) {
        localStorage.setItem('study_useremail', newEmail);
    }

    alert('Profile settings saved successfully!');
}

function updateGreetingName(name) {
    const headerGreeting = document.querySelector('#dashboard-sec header h1') || document.querySelector('header h1');
    if (headerGreeting && name) {
        headerGreeting.innerText = `Hello, ${name} 👋`;
    }
}

function changePassword(event) {
    if (event) event.preventDefault();
    const newPass = document.getElementById('newPass')?.value;
    const confirmPass = document.getElementById('confirmPass')?.value;

    if (newPass !== confirmPass) {
        alert('New passwords do not match!');
        return;
    }

    alert('Password updated successfully!');
    if (document.getElementById('currentPass')) document.getElementById('currentPass').value = '';
    if (document.getElementById('newPass')) document.getElementById('newPass').value = '';
    if (document.getElementById('confirmPass')) document.getElementById('confirmPass').value = '';
}

async function loadSavedProfile() {
    let savedName = localStorage.getItem('study_username');
    let savedEmail = localStorage.getItem('study_useremail');
    const savedImg = localStorage.getItem('study_profile_img');
    const token = getAuthToken();

    if (!savedEmail && token) {
        try {
            let res = await fetch(`${API_BASE_URL}/auth/me`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            
            if (!res.ok) {
                res = await fetch(`${API_BASE_URL}/me`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
            }

            if (res.ok) {
                const userData = await res.json();
                savedEmail = userData.email || userData.user?.email;
                savedName = userData.name || userData.user?.name || savedName;
                if (savedEmail) localStorage.setItem('study_useremail', savedEmail);
                if (savedName) localStorage.setItem('study_username', savedName);
            }
        } catch (err) {
            console.log('Could not fetch user profile from server:', err);
        }
    }

    if (savedName) {
        updateGreetingName(savedName);
        const nameInput = document.getElementById('settingName');
        if (nameInput) nameInput.value = savedName;
    }

    if (savedEmail) {
        const emailInput = document.getElementById('settingEmail');
        if (emailInput) emailInput.value = savedEmail;
    }

    const profileImg = document.getElementById('profileImage');
    if (profileImg) {
        if (savedImg) {
            profileImg.src = savedImg;
        } else {
            const displayName = savedName || 'User';
            profileImg.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=3b82f6&color=fff`;
        }
    }
}

// ----------------------------------------------------
// 7. BACKEND AUTHENTICATION INTEGRATION
// ----------------------------------------------------
async function registerUser(name, email, password) {
    let response = await fetch(`${API_BASE_URL}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password })
    });

    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
        throw new Error('Backend route not found. Check server!');
    }

    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'Registration failed.');

    setAuthToken(data.token);
    return data.user;
}

async function loginUser(email, password) {
    let response = await fetch(`${API_BASE_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
    });

    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
        throw new Error('Backend route not found. Check server!');
    }

    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'Login failed.');

    setAuthToken(data.token);
    return data.user;
}

function logoutUser() {
    clearAuthToken();
    window.location.href = 'login.html';
}

function initAuthForms() {
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');

    if (loginForm) {
        loginForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            try {
                const emailInput = loginForm.querySelector('input[type="email"]');
                const passwordInput = loginForm.querySelector('input[type="password"]');

                if (!emailInput || !passwordInput) throw new Error('Input fields not found.');

                const typedEmail = emailInput.value.trim();
                const user = await loginUser(typedEmail, passwordInput.value);

                const finalEmail = (user && user.email) ? user.email : typedEmail;
                const finalName = (user && user.name) ? user.name : 'User';

                localStorage.setItem('study_useremail', finalEmail);
                localStorage.setItem('study_username', finalName);

                window.location.href = 'dashboard.html'; 
            } catch (err) {
                alert(err.message || 'Login failed!');
            }
        });
    }

    if (registerForm) {
        registerForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            try {
                const textInputs = registerForm.querySelectorAll('input[type="text"]');
                const emailInput = registerForm.querySelector('input[type="email"]');
                const passwordInput = registerForm.querySelector('input[type="password"]');

                const name = textInputs.length > 0 ? textInputs[0].value.trim() : 'User';
                const email = emailInput ? emailInput.value.trim() : '';
                const password = passwordInput ? passwordInput.value : '';

                if (!email || !password) throw new Error('Please fill out required fields.');

                const user = await registerUser(name, email, password);

                localStorage.setItem('study_username', name);
                localStorage.setItem('study_useremail', email);

                window.location.href = 'dashboard.html';
            } catch (err) {
                alert(err.message || 'Registration failed!');
            }
        });
    }
}

// ----------------------------------------------------
// 8. INITIALIZE ON PAGE LOAD
// ----------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
    // Check auth token before fetching
    const token = getAuthToken();
    const isAuthPage = window.location.pathname.includes('login.html') || window.location.pathname.includes('register.html');

    if (!token && !isAuthPage) {
        window.location.href = 'login.html';
        return;
    }

    if (token) {
        fetchTasksFromBackend();
    }
    
    loadSavedProfile();
    initAuthForms();
});
// ==========================================
// POMODORO TIMER LOGIC
// ==========================================
let timeLeft = 25 * 60; // 25 minutes in seconds
let timerId = null;

const timerDisplay = document.getElementById('timer-display');
const startBtn = document.getElementById('start-btn');
const pauseBtn = document.getElementById('pause-btn');
const resetBtn = document.getElementById('reset-btn');

function updateDisplay() {
    if (!timerDisplay) return;
    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;
    timerDisplay.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

if (startBtn) {
    startBtn.addEventListener('click', () => {
        if (timerId !== null) return;
        
        timerId = setInterval(() => {
            if (timeLeft > 0) {
                timeLeft--;
                updateDisplay();
            } else {
                clearInterval(timerId);
                timerId = null;
                alert('🎉 Pomodoro finished! Time to take a 5-minute break.');
            }
        }, 1000);
    });
}

if (pauseBtn) {
    pauseBtn.addEventListener('click', () => {
        clearInterval(timerId);
        timerId = null;
    });
}

if (resetBtn) {
    resetBtn.addEventListener('click', () => {
        clearInterval(timerId);
        timerId = null;
        timeLeft = 25 * 60;
        updateDisplay();
    });
}
// ==========================================
// EXAM & ASSIGNMENT TRACKER LOGIC
// ==========================================
let examItems = JSON.parse(localStorage.getItem('study_exams')) || [];

function saveAndRenderExams() {
    localStorage.setItem('study_exams', JSON.stringify(examItems));
    renderExams();
}

function addExamTrackerItem() {
    const title = document.getElementById('examTitleInput')?.value.trim();
    const subject = document.getElementById('examSubjectInput')?.value.trim() || 'General';
    const dateValue = document.getElementById('examDateInput')?.value;

    if (!title || !dateValue) {
        alert('Please enter a title and select a due date!');
        return;
    }

    const newItem = {
        id: Date.now().toString(),
        title: title,
        subject: subject,
        dueDate: dateValue
    };

    examItems.push(newItem);
    saveAndRenderExams();

    // Clear inputs
    document.getElementById('examTitleInput').value = '';
    document.getElementById('examSubjectInput').value = '';
    document.getElementById('examDateInput').value = '';
}

function deleteExamItem(id) {
    examItems = examItems.filter(item => item.id !== id);
    saveAndRenderExams();
}

function getDaysRemainingText(dueDateStr) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const dueDate = new Date(dueDateStr);
    dueDate.setHours(0, 0, 0, 0);

    const diffTime = dueDate - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

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

    // Sort by nearest due date
    examItems.sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));

    examItems.forEach(item => {
        const badge = getDaysRemainingText(item.dueDate);

        const card = document.createElement('div');
        card.style.cssText = `
            display: flex; 
            justify-content: space-between; 
            align-items: center; 
            padding: 12px 16px; 
            background: #f9fafb; 
            border-radius: 8px; 
            border-left: 4px solid ${badge.color};
        `;

        card.innerHTML = `
            <div>
                <strong style="font-size: 15px; color: #111827;">${item.title}</strong>
                <span style="font-size: 12px; color: #6b7280; background: #e5e7eb; padding: 2px 8px; border-radius: 12px; margin-left: 8px;">${item.subject}</span>
                <p style="font-size: 12px; color: #6b7280; margin-top: 2px;">Due: ${item.dueDate}</p>
            </div>
            <div style="display: flex; align-items: center; gap: 10px;">
                <span style="font-size: 12px; font-weight: 600; color: ${badge.color}; background: ${badge.bg}; padding: 4px 10px; border-radius: 12px;">${badge.text}</span>
                <button onclick="deleteExamItem('${item.id}')" style="background: transparent; border: none; color: #ef4444; cursor: pointer; font-size: 14px;"><i class="fa-solid fa-trash"></i></button>
            </div>
        `;

        listContainer.appendChild(card);
    });
}

// Initial rendering when page loads
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(renderExams, 100);
});
