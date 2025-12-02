const { globalShortcut, Menu } = require('electron');
const windowManager = require('./window');

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

    if (registeredCount > 0) {
      console.log(`Registered ${registeredCount}/${shortcuts.length} keyboard shortcuts`);
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

