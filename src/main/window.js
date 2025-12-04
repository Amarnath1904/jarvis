const { BrowserWindow, screen } = require('electron');
const path = require('path');
const config = require('./config');

/**
 * Window management module
 */
class WindowManager {
  constructor() {
    this.windows = new Map();
  }

  /**
   * Create the main application window
   * @returns {BrowserWindow} The created window
   */
  createMainWindow() {
    const mainWindow = new BrowserWindow({
      width: config.window.width,
      height: config.window.height,
      minWidth: config.window.minWidth,
      minHeight: config.window.minHeight,
      transparent: config.window.transparent,
      frame: config.window.frame,
      backgroundColor: config.window.backgroundColor,
      title: 'JARVIS',
      webPreferences: {
        ...config.webPreferences,
        preload: path.join(__dirname, '../preload/preload.js')
      },
      show: false, // Don't show until ready
      titleBarStyle: 'default',
      alwaysOnTop: true, // Keep window always on top
      skipTaskbar: true // Hide from taskbar (will use Tray)
    });

    // Load the index.html file
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));

    // Show window when ready to prevent visual flash
    mainWindow.once('ready-to-show', () => {
      // Center window horizontally at the top
      const primaryDisplay = screen.getPrimaryDisplay();
      const { width: screenWidth } = primaryDisplay.workAreaSize;
      const x = Math.floor((screenWidth - config.window.width) / 2);
      const y = 0; // Top of the screen

      mainWindow.setPosition(x, y);
      mainWindow.show();
    });

    // Handle window closed
    mainWindow.on('closed', () => {
      this.windows.delete('main');
    });

    this.windows.set('main', mainWindow);
    return mainWindow;
  }

  /**
   * Create the planning window
   * @returns {BrowserWindow} The created window
   */
  createPlanningWindow() {
    const planningWindow = new BrowserWindow({
      width: config.window.width,
      height: config.window.height,
      fullscreen: true, // Fullscreen for focus
      alwaysOnTop: true, // Always on top
      frame: false,
      kiosk: true, // Kiosk mode to prevent other interactions
      webPreferences: {
        ...config.webPreferences,
        preload: path.join(__dirname, '../preload/preload.js')
      },
      show: false
    });

    planningWindow.loadFile(path.join(__dirname, '../renderer/planning.html'));

    planningWindow.once('ready-to-show', () => {
      planningWindow.show();
      planningWindow.focus();
    });

    planningWindow.on('closed', () => {
      this.windows.delete('planning');
    });

    this.windows.set('planning', planningWindow);
    return planningWindow;
  }

  /**
   * Create a notification window
   * @param {Object} eventData - Event data to display
   * @returns {BrowserWindow} The created notification window
   */
  createNotificationWindow(eventData) {
    // Generate unique window ID
    const windowId = `notification_${eventData.eventId}_${Date.now()}`;

    const notificationWindow = new BrowserWindow({
      fullscreen: true,
      alwaysOnTop: true,
      frame: false,
      kiosk: true, // Kiosk mode prevents changing window
      webPreferences: {
        ...config.webPreferences,
        preload: path.join(__dirname, '../preload/preload.js')
      },
      show: false
    });

    // Load notification HTML
    notificationWindow.loadFile(path.join(__dirname, '../renderer/notification.html'));

    // Send event data to renderer when page is fully loaded
    notificationWindow.webContents.once('did-finish-load', () => {
      console.log('[WindowManager] Notification page loaded, sending data:', eventData);
      
      // Store data in window object as fallback (in case IPC event is missed)
      notificationWindow.webContents.executeJavaScript(`
        window.__notificationData = ${JSON.stringify(eventData)};
      `).catch(err => console.error('[WindowManager] Error setting window data:', err));

      // Longer delay to ensure JavaScript listeners are set up and DOM is ready
      setTimeout(() => {
        console.log('[WindowManager] Sending notification-data event');
        notificationWindow.webContents.send('notification-data', eventData);
        
        // Also try to trigger display directly via executeJavaScript as backup
        setTimeout(() => {
          notificationWindow.webContents.executeJavaScript(`
            if (window.__notificationData) {
              console.log('[Notification] Triggering display from window data');
              if (typeof displayNotification === 'function') {
                displayNotification(window.__notificationData);
              } else if (window.electronAPI && window.electronAPI.onNotificationData) {
                // If function not available yet, trigger via the listener
                window.electronAPI.onNotificationData(window.__notificationData);
              }
            }
          `).catch(err => console.error('[WindowManager] Error triggering display:', err));
        }, 100);
      }, 500);
    });

    // Show window when ready
    notificationWindow.once('ready-to-show', () => {
      notificationWindow.show();
      notificationWindow.focus();
    });

    // Handle window closed
    notificationWindow.on('closed', () => {
      this.windows.delete(windowId);
    });

    this.windows.set(windowId, notificationWindow);
    return notificationWindow;
  }

  /**
   * Get a window by name
   * @param {string} name - Window identifier
   * @returns {BrowserWindow|null}
   */
  getWindow(name) {
    return this.windows.get(name) || null;
  }

  /**
   * Get all windows
   * @returns {Array<BrowserWindow>}
   */
  getAllWindows() {
    return Array.from(this.windows.values());
  }
}

module.exports = new WindowManager();

