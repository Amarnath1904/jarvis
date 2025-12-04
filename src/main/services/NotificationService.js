const DailyPlan = require('../models/DailyPlan');
const database = require('../database');
const windowManager = require('../window');

/**
 * Notification Service
 * Monitors events and displays notifications at scheduled times
 */
class NotificationService {
    constructor() {
        this.checkInterval = null;
        this.scheduledNotifications = new Map(); // Track scheduled timeouts
        this.sentNotifications = new Set(); // Track sent notifications to prevent duplicates
        this.isRunning = false;
    }

    /**
     * Start the notification service
     */
    start() {
        if (this.isRunning) {
            console.log('[NotificationService] Already running');
            return;
        }

        console.log('[NotificationService] Starting notification monitoring');
        this.isRunning = true;

        // Check events immediately
        this.checkAndScheduleNotifications();

        // Check events every 30 seconds for more responsive notifications
        this.checkInterval = setInterval(() => {
            this.checkAndScheduleNotifications();
        }, 30000); // 30 seconds
    }

    /**
     * Stop the notification service
     */
    stop() {
        if (!this.isRunning) {
            return;
        }

        console.log('[NotificationService] Stopping notification monitoring');
        this.isRunning = false;

        // Clear interval
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
            this.checkInterval = null;
        }

        // Clear all scheduled notifications
        this.scheduledNotifications.forEach((timeoutId) => {
            clearTimeout(timeoutId);
        });
        this.scheduledNotifications.clear();
    }

    /**
     * Check events and schedule notifications
     * @param {boolean} resetFirst - If true, reset all notifications before scheduling
     */
    async checkAndScheduleNotifications(resetFirst = false) {
        try {
            const db = database.getDb();
            if (!db) {
                console.warn('[NotificationService] Database not connected');
                return;
            }

            if (resetFirst) {
                this.resetNotifications();
            }

            const dailyPlan = new DailyPlan(db);
            const today = this.getTodayDateString();
            const events = await dailyPlan.getEventsForDate(today);

            console.log(`[NotificationService] Found ${events ? events.length : 0} events for ${today}`);

            if (!events || events.length === 0) {
                // If no events, clear all notifications
                if (resetFirst) {
                    this.resetNotifications();
                }
                return;
            }

            const now = new Date();
            const currentTime = now.getTime();

            // Process each event
            for (const event of events) {
                console.log(`[NotificationService] Processing event: ${event.title || 'Untitled'}, start: ${event.start || event.startTime || 'N/A'}, date: ${event.date || 'N/A'}`);
                this.scheduleEventNotifications(event, currentTime);
            }
        } catch (error) {
            console.error('[NotificationService] Error checking events:', error);
        }
    }

  /**
   * Schedule notifications for a single event
   * @param {Object} event - Event object with start, date, title, etc.
   * @param {number} currentTime - Current timestamp in milliseconds
   */
  scheduleEventNotifications(event, currentTime) {
    // Support both 'start' and 'startTime' field names for compatibility
    const startTime = event.start || event.startTime;
    if (!startTime || !event.date) {
      console.log(`[NotificationService] Event missing start time or date:`, { start: event.start, startTime: event.startTime, date: event.date });
      return;
    }

    const eventDateTime = this.parseEventDateTime(event.date, startTime);
    if (!eventDateTime) {
      console.log(`[NotificationService] Failed to parse event date/time:`, { date: event.date, start: startTime });
      return;
    }

    const eventTime = eventDateTime.getTime();
    const timeUntilEvent = eventTime - currentTime;
    const minutesUntilEvent = Math.floor(timeUntilEvent / (60 * 1000));

    console.log(`[NotificationService] Event "${event.title || 'Untitled'}" at ${startTime}, ${minutesUntilEvent} minutes from now`);

    // Skip if event is in the past
    if (eventTime < currentTime) {
      console.log(`[NotificationService] Event "${event.title || 'Untitled'}" is in the past, skipping`);
      return;
    }

    // Calculate notification times
    const notificationTimes = [
      { time: eventTime - (30 * 60 * 1000), type: '30min', label: '30 minutes' },
      { time: eventTime - (15 * 60 * 1000), type: '15min', label: '15 minutes' },
      { time: eventTime, type: 'now', label: 'Event starting now' }
    ];

    // Schedule each notification
    notificationTimes.forEach(({ time, type, label }) => {
      const timeUntilNotification = time - currentTime;
      const minutesUntilNotification = Math.floor(timeUntilNotification / (60 * 1000));

      // If notification time is in the past or very close (less than 5 seconds), show immediately
      if (timeUntilNotification < 5000) {
        if (timeUntilNotification < 0) {
          console.log(`[NotificationService] Notification ${type} for "${event.title || 'Untitled'}" is in the past, skipping`);
          return;
        } else {
          // Show immediately if very close
          console.log(`[NotificationService] Notification ${type} for "${event.title || 'Untitled'}" is very close, showing immediately`);
          const notificationKey = `${event._id || event.id}_${type}`;
          if (!this.sentNotifications.has(notificationKey)) {
            this.showNotification(event, type, label);
            this.sentNotifications.add(notificationKey);
          }
          return;
        }
      }

      // Create unique key for this notification
      const notificationKey = `${event._id || event.id}_${type}`;

      // Skip if already scheduled or sent
      if (this.scheduledNotifications.has(notificationKey) || this.sentNotifications.has(notificationKey)) {
        console.log(`[NotificationService] Notification ${type} for "${event.title || 'Untitled'}" already scheduled/sent`);
        return;
      }

      // Calculate delay in milliseconds
      const delay = timeUntilNotification;

      console.log(`[NotificationService] Scheduling ${type} notification for "${event.title || 'Untitled'}" in ${minutesUntilNotification} minutes`);

      // Schedule notification
      const timeoutId = setTimeout(() => {
        this.showNotification(event, type, label);
        this.scheduledNotifications.delete(notificationKey);
        this.sentNotifications.add(notificationKey);
      }, delay);

      this.scheduledNotifications.set(notificationKey, timeoutId);
    });
  }

  /**
   * Show a notification window
   * @param {Object} event - Event object
   * @param {string} type - Notification type (30min, 15min, now)
   * @param {string} label - Human-readable label
   */
  showNotification(event, type, label) {
    try {
      console.log(`[NotificationService] Showing notification: ${event.title} - ${label}`);
      // Support both 'start' and 'startTime' field names for compatibility
      const startTime = event.start || event.startTime || '';
      windowManager.createNotificationWindow({
        eventId: event._id || event.id,
        title: event.title || 'Event',
        description: event.description || '',
        startTime: startTime,
        endTime: event.end || '',
        date: event.date || '',
        notificationType: type,
        notificationLabel: label
      });
    } catch (error) {
      console.error('[NotificationService] Error showing notification:', error);
    }
  }

    /**
     * Parse event date and time into a Date object
     * @param {string} dateString - Date in YYYY-MM-DD format
     * @param {string} timeString - Time in HH:MM format
     * @returns {Date|null}
     */
    parseEventDateTime(dateString, timeString) {
        try {
            if (!dateString || !timeString) {
                console.error('[NotificationService] Missing date or time string');
                return null;
            }

            const [year, month, day] = dateString.split('-').map(Number);
            const [hours, minutes] = timeString.split(':').map(Number);

            if (isNaN(year) || isNaN(month) || isNaN(day) || isNaN(hours) || isNaN(minutes)) {
                console.error('[NotificationService] Invalid date/time values:', { dateString, timeString, year, month, day, hours, minutes });
                return null;
            }

            // Create date in local timezone
            const date = new Date(year, month - 1, day, hours, minutes, 0, 0);
            
            // Validate the date was created correctly
            if (isNaN(date.getTime())) {
                console.error('[NotificationService] Invalid date created:', date);
                return null;
            }

            return date;
        } catch (error) {
            console.error('[NotificationService] Error parsing event date/time:', error);
            return null;
        }
    }

    /**
     * Get today's date string in YYYY-MM-DD format
     * @returns {string}
     */
    getTodayDateString() {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    /**
     * Clear sent notifications (useful for testing or reset)
     */
    clearSentNotifications() {
        this.sentNotifications.clear();
    }

    /**
     * Cancel all scheduled notifications for a specific event
     * @param {string} eventId - Event ID to cancel notifications for
     */
    cancelEventNotifications(eventId) {
        const eventIdStr = String(eventId);
        const keysToCancel = [];
        
        // Find all notification keys for this event
        this.scheduledNotifications.forEach((timeoutId, key) => {
            if (key.startsWith(`${eventIdStr}_`)) {
                keysToCancel.push(key);
            }
        });

        // Cancel the timeouts
        keysToCancel.forEach(key => {
            const timeoutId = this.scheduledNotifications.get(key);
            if (timeoutId) {
                clearTimeout(timeoutId);
                this.scheduledNotifications.delete(key);
                console.log(`[NotificationService] Cancelled notification: ${key}`);
            }
        });

        // Also remove from sent notifications
        keysToCancel.forEach(key => {
            this.sentNotifications.delete(key);
        });
    }

    /**
     * Cancel all scheduled notifications and clear sent notifications
     * Useful when schedule is completely refreshed
     */
    resetNotifications() {
        console.log('[NotificationService] Resetting all notifications');
        
        // Cancel all scheduled notifications
        this.scheduledNotifications.forEach((timeoutId) => {
            clearTimeout(timeoutId);
        });
        this.scheduledNotifications.clear();
        
        // Clear sent notifications
        this.sentNotifications.clear();
        
        console.log('[NotificationService] All notifications reset');
    }

    /**
     * Force immediate re-check and reschedule of notifications
     * Useful when events are updated
     */
    async refreshNotifications() {
        console.log('[NotificationService] Refreshing notifications after schedule update');
        
        // Reset all notifications and reschedule
        await this.checkAndScheduleNotifications(true);
    }
}

module.exports = NotificationService;

