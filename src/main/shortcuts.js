const { globalShortcut, Menu, dialog } = require('electron');
const windowManager = require('./window');
const database = require('./database');
const AppState = require('./models/AppState');

/**
 * Keyboard shortcuts management
 */
class KeyboardShortcuts {
  constructor() {
    this.stepSize = 50; // Pixels to move per keypress
  }

  /**
   * Register global shortcuts
   */
  register() {
    // Try Windows/Super key first, fallback to Ctrl+Shift if it fails
    const modifier = process.platform === 'darwin' ? 'Command' : 'Super';

    // First, try to register Windows/Super + Arrow keys
    const shortcuts = [
      { key: `${modifier}+Left`, direction: 'left', alt: 'CommandOrControl+Shift+Left' },
      { key: `${modifier}+Right`, direction: 'right', alt: 'CommandOrControl+Shift+Right' },
      { key: `${modifier}+Up`, direction: 'up', alt: 'CommandOrControl+Shift+Up' },
      { key: `${modifier}+Down`, direction: 'down', alt: 'CommandOrControl+Shift+Down' }
    ];

    let registeredCount = 0;

    shortcuts.forEach(({ key, direction, alt }) => {
      // Try primary shortcut first
      let ret = globalShortcut.register(key, () => {
        this.moveWindow(direction);
      });

      // If primary fails, try alternative
      if (!ret && alt) {
        ret = globalShortcut.register(alt, () => {
          this.moveWindow(direction);
        });
        if (ret) {
          console.log(`Registered alternative shortcut: ${alt} for ${direction}`);
        }
      }

      if (ret) {
        registeredCount++;
      } else {
        console.error(`Failed to register shortcut: ${key} or ${alt}`);
      }
    });

    // Also register window-specific accelerators via menu
    this.registerMenuAccelerators();

    // Register global toggle shortcut
    const toggleShortcut = 'CommandOrControl+Shift+J';
    const ret = globalShortcut.register(toggleShortcut, () => {
      this.toggleWindow();
    });

    if (ret) {
      console.log(`Registered global toggle shortcut: ${toggleShortcut}`);
      registeredCount++;
    } else {
      console.error(`Failed to register global toggle shortcut: ${toggleShortcut}`);
    }

    // Register snooze shortcut (Ctrl+Shift+C)
    const snoozeShortcut = 'CommandOrControl+Shift+C';
    const snoozeRet = globalShortcut.register(snoozeShortcut, () => {
      this.snoozeWindow();
    });

    if (snoozeRet) {
      console.log(`Registered snooze shortcut: ${snoozeShortcut}`);
      registeredCount++;
    } else {
      console.error(`Failed to register snooze shortcut: ${snoozeShortcut}`);
    }

    if (registeredCount > 0) {
      console.log(`Registered ${registeredCount} keyboard shortcuts`);
    }
  }

  /**
   * Snooze the planning window
   */
  async snoozeWindow() {
    const planningWindow = windowManager.getWindow('planning');

    // Only allow snooze if planning window is active
    if (!planningWindow || !planningWindow.isVisible()) {
      return;
    }

    const appState = new AppState(database.getDb());
    const state = await appState.getState();

    if (state.snoozeCount < 3) {
      // Increment snooze count
      const newCount = await appState.incrementSnooze();
      console.log(`Snoozing window. Count: ${newCount}/3`);

      // Hide window
      planningWindow.hide();

      // Show again after 30 minutes (30 * 60 * 1000 ms)
      // For testing, we might want to use a shorter duration, but user asked for 30 min exactly
      setTimeout(() => {
        planningWindow.show();
        planningWindow.focus();
      }, 30 * 60 * 1000);

    } else {
      // No more snoozes
      dialog.showErrorBox('Snooze Limit Reached', 'You have used all 3 snoozes for today. You must complete your planning now.');
    }
  }

  /**
   * Toggle main window visibility
   */
  toggleWindow() {
    const mainWindow = windowManager.getWindow('main');
    if (!mainWindow) {
      // If window doesn't exist (e.g. closed), recreate it
      windowManager.createMainWindow();
      return;
    }

    if (mainWindow.isVisible()) {
      mainWindow.hide();
    } else {
      mainWindow.show();
      mainWindow.focus();
    }
  }

  /**
   * Register menu accelerators (works when window is focused)
   */
  registerMenuAccelerators() {
    const template = [
      {
        label: 'Window',
        submenu: [
          {
            label: 'Move Left',
            accelerator: process.platform === 'darwin' ? 'Command+Left' : 'Super+Left',
            click: () => this.moveWindow('left')
          },
          {
            label: 'Move Right',
            accelerator: process.platform === 'darwin' ? 'Command+Right' : 'Super+Right',
            click: () => this.moveWindow('right')
          },
          {
            label: 'Move Up',
            accelerator: process.platform === 'darwin' ? 'Command+Up' : 'Super+Up',
            click: () => this.moveWindow('up')
          },
          {
            label: 'Move Down',
            accelerator: process.platform === 'darwin' ? 'Command+Down' : 'Super+Down',
            click: () => this.moveWindow('down')
          }
        ]
      }
    ];

    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
  }

  /**
   * Move window in specified direction
   * @param {string} direction - 'left', 'right', 'up', or 'down'
   */
  moveWindow(direction) {
    const mainWindow = windowManager.getWindow('main');
    if (!mainWindow) return;

    const [x, y] = mainWindow.getPosition();
    const [width, height] = mainWindow.getSize();

    let newX = x;
    let newY = y;

    switch (direction) {
      case 'left':
        newX = Math.max(0, x - this.stepSize);
        break;
      case 'right':
        newX = x + this.stepSize;
        break;
      case 'up':
        newY = Math.max(0, y - this.stepSize);
        break;
      case 'down':
        newY = y + this.stepSize;
        break;
    }

    mainWindow.setPosition(newX, newY);
  }

  /**
   * Unregister all shortcuts
   */
  unregister() {
    globalShortcut.unregisterAll();
  }
}

module.exports = new KeyboardShortcuts();

