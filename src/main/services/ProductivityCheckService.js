const windowManager = require('../window');
const database = require('../database');

/**
 * Productivity Check Service
 * Opens productivity check windows every 20 minutes
 */
class ProductivityCheckService {
    constructor() {
        this.checkInterval = null;
        this.isRunning = false;
        this.lastCheckTime = null;
    }

    /**
     * Start the productivity check service
     */
    start() {
        if (this.isRunning) {
            console.log('[ProductivityCheckService] Already running');
            return;
        }

        console.log('[ProductivityCheckService] Starting productivity checks (every 20 minutes)');
        this.isRunning = true;

        // Schedule first check in 20 minutes
        const firstCheckTimeout = setTimeout(() => {
            this.showProductivityCheck();
            this.scheduleNextCheck();
            
            // Start the interval AFTER the first check completes
            this.checkInterval = setInterval(() => {
                this.showProductivityCheck();
                this.scheduleNextCheck();
            }, 20 * 60 * 1000); // 20 minutes
        }, 20 * 60 * 1000); // 20 minutes
        
        // Store timeout ID so we can clear it if needed
        this.firstCheckTimeout = firstCheckTimeout;
    }

    /**
     * Stop the productivity check service
     */
    stop() {
        if (!this.isRunning) {
            return;
        }

        console.log('[ProductivityCheckService] Stopping productivity checks');
        this.isRunning = false;

        // Clear first check timeout if it exists
        if (this.firstCheckTimeout) {
            clearTimeout(this.firstCheckTimeout);
            this.firstCheckTimeout = null;
        }

        // Clear interval if it exists
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
            this.checkInterval = null;
        }
    }

    /**
     * Schedule the next productivity check
     */
    scheduleNextCheck() {
        const now = new Date();
        const nextCheck = new Date(now.getTime() + (20 * 60 * 1000)); // 20 minutes from now
        this.lastCheckTime = nextCheck;
        console.log(`[ProductivityCheckService] Next check scheduled for: ${nextCheck.toLocaleTimeString()}`);
    }

    /**
     * Show productivity check window
     */
    showProductivityCheck() {
        try {
            console.log('[ProductivityCheckService] Showing productivity check window');
            windowManager.createProductivityCheckWindow();
        } catch (error) {
            console.error('[ProductivityCheckService] Error showing productivity check:', error);
        }
    }
}

module.exports = ProductivityCheckService;

