/**
 * Notification Window Logic
 * Handles displaying event notification data
 */

// DOM Elements
const eventTitleEl = document.getElementById('event-title');
const notificationLabelEl = document.getElementById('notification-label');
const notificationBadgeEl = document.getElementById('notification-badge');
const eventTimeEl = document.getElementById('event-time');
const eventDescriptionEl = document.getElementById('event-description');
const descriptionContainerEl = document.getElementById('description-container');
const closeBtn = document.getElementById('close-btn');

/**
 * Initialize notification window
 */
function init() {
    console.log('[Notification] Initializing notification window');
    console.log('[Notification] electronAPI available:', !!window.electronAPI);
    console.log('[Notification] onNotificationData available:', !!(window.electronAPI && window.electronAPI.onNotificationData));

    // Listen for event data from main process
    if (window.electronAPI && window.electronAPI.onNotificationData) {
        console.log('[Notification] Setting up notification data listener');
        window.electronAPI.onNotificationData((eventData) => {
            console.log('[Notification] Received event data:', eventData);
            displayNotification(eventData);
        });
    } else {
        console.error('[Notification] electronAPI.onNotificationData not available');
        // Fallback: try to get data from window object if sent before listener was set up
        if (window.__notificationData) {
            console.log('[Notification] Using fallback data from window object');
            displayNotification(window.__notificationData);
        }
    }

    // Setup close button
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            closeNotification();
        });
    }

    // Also allow ESC key to close
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeNotification();
        }
    });
}

/**
 * Display notification with event data
 * @param {Object} eventData - Event data from main process
 */
function displayNotification(eventData) {
    console.log('[Notification] Displaying notification with data:', eventData);
    
    if (!eventData) {
        console.error('[Notification] No event data provided');
        return;
    }

    // Set event title
    if (eventData.title && eventTitleEl) {
        eventTitleEl.textContent = eventData.title;
        console.log('[Notification] Set title:', eventData.title);
    } else {
        console.warn('[Notification] No title or title element not found');
    }

    // Set notification label
    if (eventData.notificationLabel && notificationLabelEl) {
        notificationLabelEl.textContent = eventData.notificationLabel;
        console.log('[Notification] Set label:', eventData.notificationLabel);
    }

    // Set notification badge based on type
    if (eventData.notificationType && notificationBadgeEl) {
        const badge = notificationBadgeEl;
        badge.textContent = getBadgeText(eventData.notificationType);
        
        // Remove existing classes
        badge.classList.remove('warning', 'danger');
        
        // Add appropriate class based on type
        if (eventData.notificationType === 'now') {
            badge.classList.add('danger');
        } else if (eventData.notificationType === '15min') {
            badge.classList.add('warning');
        }
        console.log('[Notification] Set badge:', eventData.notificationType);
    }

    // Set event time
    if (eventData.startTime && eventTimeEl) {
        const timeDisplay = formatTime(eventData.startTime);
        if (eventData.endTime) {
            eventTimeEl.textContent = `${timeDisplay} - ${formatTime(eventData.endTime)}`;
        } else {
            eventTimeEl.textContent = timeDisplay;
        }
        console.log('[Notification] Set time:', eventData.startTime, '->', timeDisplay);
    } else {
        console.warn('[Notification] No startTime or time element not found. startTime:', eventData.startTime);
    }

    // Set description if available
    if (eventData.description && eventData.description.trim() && eventDescriptionEl && descriptionContainerEl) {
        eventDescriptionEl.textContent = eventData.description;
        descriptionContainerEl.style.display = 'flex';
        console.log('[Notification] Set description:', eventData.description);
    } else {
        if (descriptionContainerEl) {
            descriptionContainerEl.style.display = 'none';
        }
    }
}

/**
 * Get badge text based on notification type
 * @param {string} type - Notification type (30min, 15min, now)
 * @returns {string}
 */
function getBadgeText(type) {
    switch (type) {
        case '30min':
            return '30 Minutes Before';
        case '15min':
            return '15 Minutes Before';
        case 'now':
            return 'Event Starting Now';
        default:
            return 'Event Reminder';
    }
}

/**
 * Format time string (HH:MM) to readable format
 * @param {string} timeString - Time in HH:MM format
 * @returns {string}
 */
function formatTime(timeString) {
    try {
        const [hours, minutes] = timeString.split(':');
        const hour = parseInt(hours, 10);
        const min = minutes || '00';
        
        // Convert to 12-hour format
        const period = hour >= 12 ? 'PM' : 'AM';
        const displayHour = hour > 12 ? hour - 12 : (hour === 0 ? 12 : hour);
        
        return `${displayHour}:${min} ${period}`;
    } catch (error) {
        return timeString;
    }
}

/**
 * Close the notification window
 */
function closeNotification() {
    if (window.electronAPI && window.electronAPI.closeNotification) {
        window.electronAPI.closeNotification();
    }
}

// Make displayNotification globally accessible
window.displayNotification = displayNotification;

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        init();
        // Check for fallback data after init
        setTimeout(() => {
            if (window.__notificationData) {
                console.log('[Notification] Found fallback data, displaying');
                displayNotification(window.__notificationData);
            }
        }, 200);
    });
} else {
    init();
    // Check for fallback data after init
    setTimeout(() => {
        if (window.__notificationData) {
            console.log('[Notification] Found fallback data, displaying');
            displayNotification(window.__notificationData);
        }
    }, 200);
}

