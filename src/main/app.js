const { app } = require('electron');
const windowManager = require('./window');
const IPCHandlers = require('./ipc');
const keyboardShortcuts = require('./shortcuts');
const database = require('./database');

/**
 * Application lifecycle management
 */
class AppLifecycle {
  constructor() {
    this.initializeHotReload();
    this.setupIPC();
    this.setupEventHandlers();
    this.setupKeyboardShortcuts();
    this.setupDatabaseCleanup();
  }

  /**
   * Setup IPC handlers
   */
  setupIPC() {
    new IPCHandlers();
  }

  /**
   * Initialize hot reload in development
   */
  initializeHotReload() {
    if (process.argv.includes('--dev')) {
      try {
        require('electron-reloader')(module, {
          debug: true,
          watchRenderer: true,
          ignore: ['node_modules']
        });
      } catch (err) {
        console.log('Error loading electron-reloader:', err);
      }
    }
  }

  /**
   * Setup application event handlers
   */
  setupEventHandlers() {
    // This method will be called when Electron has finished initialization
    app.whenReady().then(() => {
      this.onReady();
    });

    // Quit when all windows are closed, except on macOS
    app.on('window-all-closed', () => {
      this.onWindowAllClosed();
    });

    // On macOS, re-create a window when the dock icon is clicked
    app.on('activate', () => {
      this.onActivate();
    });
  }

  /**
   * Handle app ready event
   */
  onReady() {
    windowManager.createMainWindow();
  }

  /**
   * Setup keyboard shortcuts
   */
  setupKeyboardShortcuts() {
    app.whenReady().then(() => {
      keyboardShortcuts.register();
    });

    // Unregister shortcuts when app quits
    app.on('will-quit', () => {
      keyboardShortcuts.unregister();
    });
  }

  /**
   * Handle window all closed event
   */
  onWindowAllClosed() {
    // On macOS, keep app running even when all windows are closed
    if (process.platform !== 'darwin') {
      app.quit();
    }
  }

  /**
   * Setup database cleanup on app quit
   */
  setupDatabaseCleanup() {
    app.on('before-quit', async () => {
      await database.disconnect();
    });
  }

  /**
   * Handle app activate event (macOS)
   */
  onActivate() {
    // Re-create a window when the dock icon is clicked and no windows are open
    if (windowManager.getAllWindows().length === 0) {
      windowManager.createMainWindow();
    }
  }
}

module.exports = AppLifecycle;

