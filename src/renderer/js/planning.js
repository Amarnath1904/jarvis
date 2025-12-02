// DOM Elements
const currentDateEl = document.getElementById('current-date');
const currentTimeEl = document.getElementById('current-time');
const timeSlotsEl = document.getElementById('time-slots');
const finishBtn = document.getElementById('finish-btn');
const addEventBtn = document.getElementById('add-event-btn');
const chatInput = document.getElementById('chat-input');
const chatMessages = document.getElementById('chat-messages');

// Modal Elements
const modal = document.getElementById('event-modal');
const saveEventBtn = document.getElementById('save-event-btn');
const cancelEventBtn = document.getElementById('cancel-event-btn');
const eventTitleInput = document.getElementById('event-title');
const eventStartInput = document.getElementById('event-start');
const eventEndInput = document.getElementById('event-end');
const eventDescInput = document.getElementById('event-desc');
const colorOptions = document.querySelectorAll('.color-option');

// Context Menu Elements
const contextMenu = document.getElementById('context-menu');
const ctxModifyBtn = document.getElementById('ctx-modify');
const ctxDeleteBtn = document.getElementById('ctx-delete');

// State
let events = [];
let selectedColor = 'blue';
let selectedEventId = null; // For context menu actions
let chatHistory = []; // Chat history for context

// Initialize
function init() {
    // Set Date and Time
    updateDateTime();
    setInterval(updateDateTime, 1000);

    // Generate Time Slots
    renderTimeSlots();

    // Load existing events (mock for now, or fetch from DB via IPC)
    loadEvents();

    // Global click to close context menu
    document.addEventListener('click', () => {
        contextMenu.classList.remove('active');
    });
}

function updateDateTime() {
    const now = new Date();

    // Date
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    currentDateEl.textContent = now.toLocaleDateString('en-US', options);

    // Time
    if (currentTimeEl) {
        currentTimeEl.textContent = now.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
        });
    }
}

// Render Time Slots (00:00 - 23:00)
function renderTimeSlots() {
    timeSlotsEl.innerHTML = '';
    for (let i = 0; i < 24; i++) {
        const hour = i.toString().padStart(2, '0');
        const timeLabel = `${hour}:00`;

        const slot = document.createElement('div');
        slot.className = 'time-slot';
        slot.dataset.hour = i;

        slot.innerHTML = `
            <div class="time-label">${timeLabel}</div>
            <div class="event-area" onclick="openModal(null, ${i})"></div>
        `;

        timeSlotsEl.appendChild(slot);
    }
}

// Modal Logic
function openModal(eventToEdit = null, startHour = null) {
    // Reset form
    eventTitleInput.value = '';
    eventDescInput.value = '';
    selectedEventId = null; // Reset unless editing

    if (eventToEdit) {
        // Edit Mode
        selectedEventId = eventToEdit.id;
        eventTitleInput.value = eventToEdit.title;
        eventStartInput.value = eventToEdit.start;
        eventEndInput.value = eventToEdit.end;
        eventDescInput.value = eventToEdit.description || '';
        selectColor(eventToEdit.color);
        saveEventBtn.textContent = 'Update Event';
    } else {
        // Create Mode
        saveEventBtn.textContent = 'Save Event';
        if (startHour !== null) {
            const startStr = startHour.toString().padStart(2, '0') + ':00';
            const endStr = (startHour + 1).toString().padStart(2, '0') + ':00';
            eventStartInput.value = startStr;
            eventEndInput.value = endStr;
        } else {
            eventStartInput.value = '09:00';
            eventEndInput.value = '10:00';
        }
        selectColor('blue');
    }

    modal.classList.add('active');
    eventTitleInput.focus();
}

function closeModal() {
    modal.classList.remove('active');
}

// Color Selection
colorOptions.forEach(option => {
    option.addEventListener('click', () => {
        selectColor(option.dataset.color);
    });
});

function selectColor(color) {
    selectedColor = color;
    colorOptions.forEach(opt => {
        if (opt.dataset.color === color) {
            opt.classList.add('selected');
        } else {
            opt.classList.remove('selected');
        }
    });
}

// Save Event
saveEventBtn.addEventListener('click', () => {
    const title = eventTitleInput.value.trim();
    const start = eventStartInput.value;
    const end = eventEndInput.value;
    const desc = eventDescInput.value.trim();

    if (!title || !start || !end) {
        alert('Please fill in Title, Start Time, and End Time.');
        return;
    }

    const startHour = parseInt(start.split(':')[0]);

    if (selectedEventId) {
        // Update existing event
        const index = events.findIndex(e => e.id === selectedEventId);
        if (index !== -1) {
            events[index] = {
                ...events[index],
                title,
                start,
                end,
                description: desc,
                color: selectedColor,
                hour: startHour
            };
        }
    } else {
        // Create new event
        const event = {
            id: Date.now(),
            title,
            start,
            end,
            description: desc,
            color: selectedColor,
            hour: startHour
        };
        events.push(event);
    }

    renderEvents();
    closeModal();
});

cancelEventBtn.addEventListener('click', closeModal);
addEventBtn.addEventListener('click', () => openModal());

// Render Events on the Calendar
function renderEvents() {
    // Clear existing events
    document.querySelectorAll('.event-item').forEach(el => el.remove());

    events.forEach(event => {
        const slot = document.querySelector(`.time-slot[data-hour="${event.hour}"] .event-area`);
        if (slot) {
            const eventEl = document.createElement('div');
            eventEl.className = `event-item ${event.color}`;
            eventEl.textContent = `${event.start} - ${event.title}`;
            eventEl.title = event.description || event.title;

            // Left click to edit (optional, or just view details)
            eventEl.onclick = (e) => {
                e.stopPropagation();
                // openModal(event); // Uncomment to allow left-click edit
            };

            // Right click context menu
            eventEl.oncontextmenu = (e) => {
                e.preventDefault();
                e.stopPropagation();
                showContextMenu(e.clientX, e.clientY, event.id);
            };

            slot.appendChild(eventEl);
        }
    });
}

// Context Menu Logic
function showContextMenu(x, y, eventId) {
    selectedEventId = eventId;
    contextMenu.style.left = `${x}px`;
    contextMenu.style.top = `${y}px`;
    contextMenu.classList.add('active');
}

ctxModifyBtn.addEventListener('click', () => {
    const event = events.find(e => e.id === selectedEventId);
    if (event) {
        openModal(event);
    }
    contextMenu.classList.remove('active');
});

ctxDeleteBtn.addEventListener('click', () => {
    if (confirm('Are you sure you want to delete this event?')) {
        events = events.filter(e => e.id !== selectedEventId);
        renderEvents();
    }
    contextMenu.classList.remove('active');
});

// Load Events (Mock)
function loadEvents() {
    // In a real implementation, we would fetch from DB here
    // events = await window.electronAPI.getDailyPlan();
    renderEvents();
}

// Finish Planning
finishBtn.addEventListener('click', async () => {
    if (events.length === 0) {
        if (!confirm('You have no events scheduled. Are you sure you want to finish?')) {
            return;
        }
    }

    try {
        // Save events to DB via IPC
        await window.electronAPI.saveDailyPlan(events);

        // Notify main process that planning is done
        window.electronAPI.planningDone();
    } catch (error) {
        console.error('Error saving plan:', error);
        alert('Failed to save plan. Please try again.');
    }
});

// Chat Input
chatInput.addEventListener('keypress', async (e) => {
    if (e.key === 'Enter' && chatInput.value.trim()) {
        const text = chatInput.value.trim();
        addMessage(text, 'user');
        chatInput.value = '';
        chatInput.disabled = true; // Disable input while processing

        // Add to history
        chatHistory.push({ role: 'user', content: text });

        try {
            // Call LLM to analyze with history
            const result = await window.electronAPI.analyzeSchedule(text, chatHistory);

            if (result && result.message) {
                addMessage(result.message, 'system');
                chatHistory.push({ role: 'assistant', content: result.message });
            }

            if (result && result.events && Array.isArray(result.events)) {
                // Add all events
                result.events.forEach(evt => {
                    const newEvent = {
                        id: Date.now() + Math.random(), // Ensure unique ID
                        title: evt.title,
                        start: evt.start,
                        end: evt.end,
                        description: evt.description || '',
                        color: evt.color || 'blue',
                        hour: parseInt(evt.start.split(':')[0])
                    };
                    events.push(newEvent);
                });

                renderEvents();
            }
        } catch (error) {
            console.error('Error processing chat:', error);
            addMessage("Sorry, something went wrong processing your request.", 'system');
        } finally {
            chatInput.disabled = false;
            chatInput.focus();
        }
    }
});

function addMessage(text, type) {
    const msg = document.createElement('div');
    msg.className = `message ${type}`;
    msg.textContent = text;
    chatMessages.appendChild(msg);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Start
init();
