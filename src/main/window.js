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
      webPreferences: {
        ...config.webPreferences,
        preload: path.join(__dirname, '../preload/preload.js')
      },
      show: false, // Don't show until ready
      titleBarStyle: 'default'
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

