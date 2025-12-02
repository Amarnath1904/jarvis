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

