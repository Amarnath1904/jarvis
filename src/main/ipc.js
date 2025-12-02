const { ipcMain } = require('electron');
const windowManager = require('./window');
const chatService = require('./chat');

/**
 * IPC handlers for window controls
 */
class IPCHandlers {
  constructor() {
    this.setupHandlers();
  }

  setupHandlers() {
    // Window minimize
    ipcMain.handle('window-minimize', () => {
      const mainWindow = windowManager.getWindow('main');
      if (mainWindow) {
        mainWindow.minimize();
      }
    });

    // Window maximize/restore
    ipcMain.handle('window-maximize', () => {
      const mainWindow = windowManager.getWindow('main');
      if (mainWindow) {
        if (mainWindow.isMaximized()) {
          mainWindow.unmaximize();
        } else {
          mainWindow.maximize();
        }
      }
    });

    // Window close
    ipcMain.handle('window-close', () => {
      const mainWindow = windowManager.getWindow('main');
      if (mainWindow) {
        mainWindow.close();
      }
    });

    // Chat handlers
    ipcMain.handle('chat-send', async (event, message, sessionId = 'default') => {
      try {
        const response = await chatService.sendMessage(message, sessionId);
        return { success: true, response };
      } catch (error) {
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle('chat-history', async (event, sessionId = 'default') => {
      try {
        const history = await chatService.getHistory(sessionId);
        return history;
      } catch (error) {
        console.error('Error getting chat history:', error);
        return [];
      }
    });

    ipcMain.handle('chat-clear', async (event, sessionId = 'default') => {
      try {
        await chatService.clearHistory(sessionId);
        return { success: true };
      } catch (error) {
        return { success: false, error: error.message };
      }
    });

    // Get all chat sessions
    ipcMain.handle('chat-sessions', async () => {
      try {
        const sessions = await chatService.getAllSessions();
        return sessions;
      } catch (error) {
        console.error('Error getting sessions:', error);
        return [];
      }
    });

    // Create new chat session
    ipcMain.handle('chat-new', async () => {
      try {
        const sessionId = await chatService.createNewSession();
        return { success: true, sessionId };
      } catch (error) {
        return { success: false, error: error.message };
      }
    });

    // Delete chat session
    ipcMain.handle('chat-delete', async (event, sessionId) => {
      try {
        await chatService.deleteSession(sessionId);
        return { success: true };
      } catch (error) {
        return { success: false, error: error.message };
      }
    });

    // Set current session
    ipcMain.handle('chat-set-session', (event, sessionId) => {
      chatService.setCurrentSession(sessionId);
      return { success: true };
    });
  }
}

module.exports = IPCHandlers;

