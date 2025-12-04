const { app, Tray, Menu, nativeImage } = require('electron');
const path = require('path');
const windowManager = require('./window');
const IPCHandlers = require('./ipc');
const keyboardShortcuts = require('./shortcuts');
const database = require('./database');

const AppState = require('./models/AppState');
const NotificationService = require('./services/NotificationService');

/**
 * Application lifecycle management
 */
class AppLifecycle {
  constructor() {
    this.appState = null;
    this.isPlanningDone = false; // Initialize flag
    this.notificationService = new NotificationService();
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
    new IPCHandlers(this);
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
  async onReady() {
    // Connect to DB first
    const dbConnected = await database.connect();
    if (dbConnected) {
      this.appState = new AppState(database.getDb());
      await this.checkMorningMode();
      
      // Start notification service after database is connected
      // Add a small delay to ensure database is fully ready
      setTimeout(() => {
        console.log('[App] Starting notification service...');
        this.notificationService.start();
      }, 1000);
    } else {
      // Fallback if DB fails
      windowManager.createMainWindow();
      console.warn('[App] Database connection failed, notification service not started');
    }

    this.setupTray();
  }

  /**
   * Check if it's a new day and start planning mode if needed
   */
  async checkMorningMode() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const today = `${year}-${month}-${day}`;
    const state = await this.appState.getState();

    if (state.lastLaunchDate !== today) {
      // New day, reset state
      await this.appState.resetDailyState(today);
      this.startPlanningMode();
    } else if (!state.isPlanningDone) {
      // Same day, but planning not done yet
      this.startPlanningMode();
    } else {
      // Planning done, open normally
      windowManager.createMainWindow();
    }
  }

  /**
   * Start Planning Mode
   */
  startPlanningMode() {
    this.isPlanningDone = false; // Reset flag
    // Create window with special flags
    const planningWindow = windowManager.createPlanningWindow();

    // Prevent closing
    planningWindow.on('close', (e) => {
      console.log(`[App] Planning window close attempt. Quitting: ${this.isQuitting}, PlanningDone: ${this.isPlanningDone}`);
      // Allow closing if explicitly quitting via Tray or if planning is done
      if (!this.isQuitting && !this.isPlanningDone) {
        console.log('[App] Preventing planning window close');
        e.preventDefault();
      }
    });
  }

  /**
   * Setup System Tray
   */
  setupTray() {
    // Attempt to load icon from assets, fallback to empty if not found (user should provide icon)
    // Assuming an 'assets' folder at project root or src/assets
    const iconPath = path.join(__dirname, '../../assets/icon.png');
    const icon = nativeImage.createFromPath(iconPath);

    this.tray = new Tray(icon);
    this.tray.setToolTip('JARVIS');

    const contextMenu = Menu.buildFromTemplate([
      {
        label: 'Show/Hide',
        click: () => {
          const mainWindow = windowManager.getWindow('main');
          if (mainWindow) {
            if (mainWindow.isVisible()) {
              mainWindow.hide();
            } else {
              mainWindow.show();
              mainWindow.focus();
            }
          } else {
            windowManager.createMainWindow();
          }
        }
      },
      { type: 'separator' },
      {
        label: 'Quit',
        click: () => {
          this.isQuitting = true;
          app.quit();
        }
      }
    ]);

    this.tray.setContextMenu(contextMenu);

    this.tray.on('click', () => {
      const mainWindow = windowManager.getWindow('main');
      if (mainWindow) {
        if (mainWindow.isVisible()) {
          mainWindow.hide();
        } else {
          mainWindow.show();
          mainWindow.focus();
        }
      } else {
        windowManager.createMainWindow();
      }
    });
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
    // Do not quit when all windows are closed, keep running in background
    // Unless explicitly quitting via Tray
    if (this.isQuitting) {
      app.quit();
    }
  }

  /**
   * Setup database cleanup on app quit
   */
  setupDatabaseCleanup() {
    app.on('before-quit', async () => {
      // Stop notification service
      if (this.notificationService) {
        this.notificationService.stop();
      }
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

