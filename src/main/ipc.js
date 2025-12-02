const { ipcMain } = require('electron');
const windowManager = require('./window');
const chatService = require('./services/ChatService');
const planningService = require('./services/PlanningService');
const database = require('./database');
const AppState = require('./models/AppState');
const DailyPlan = require('./models/DailyPlan');

/**
 * IPC handlers for window controls
 */
class IPCHandlers {
  constructor(appLifecycle) {
    this.appLifecycle = appLifecycle;
    this.setupHandlers();
    this.setupPlanningHandlers();
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
        const mainWindow = windowManager.getWindow('main');
        const onProgress = (data) => {
          if (mainWindow) {
            mainWindow.webContents.send('chat-progress', data);
          }
        };

        const response = await chatService.sendMessage(message, sessionId, onProgress);
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

  /**
   * Setup Planning IPC handlers
   */
  setupPlanningHandlers() {
    // Handle planning completion
    ipcMain.on('planning-done', async () => {
      console.log('[IPC] planning-done received');
      const appState = new AppState(database.getDb());
      await appState.updateState({ isPlanningDone: true });
      console.log('[IPC] App state updated: isPlanningDone = true');

      // Update AppLifecycle flag to allow closing
      if (this.appLifecycle) {
        this.appLifecycle.isPlanningDone = true;
        console.log('[IPC] AppLifecycle flag updated');
      } else {
        console.warn('[IPC] AppLifecycle instance missing in IPCHandlers');
      }

      const planningWindow = windowManager.getWindow('planning');
      if (planningWindow) {
        console.log('[IPC] Closing planning window');
        planningWindow.close();
      } else {
        console.warn('[IPC] Planning window not found');
      }

      // Open main window if not already open
      if (!windowManager.getWindow('main')) {
        console.log('[IPC] Creating main window');
        windowManager.createMainWindow();
      }
    });

    // Save daily plan
    ipcMain.handle('save-daily-plan', async (event, events) => {
      const dailyPlan = new DailyPlan(database.getDb());

      // Get local date in YYYY-MM-DD format
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      const today = `${year}-${month}-${day}`;

      // Delete existing events for today
      const existingEvents = await dailyPlan.getEventsForDate(today);
      for (const evt of existingEvents) {
        await dailyPlan.deleteEvent(evt._id);
      }

      // Save new events
      for (const evt of events) {
        await dailyPlan.createEvent({
          ...evt,
          date: today
        });
      }
      return true;
    });

    // Analyze schedule from chat
    ipcMain.handle('chat-analyze-schedule', async (event, text, history = []) => {
      try {
        // Fetch current events for context
        const dailyPlan = new DailyPlan(database.getDb());

        // Get local date in YYYY-MM-DD format
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const today = `${year}-${month}-${day}`;

        const currentEvents = await dailyPlan.getEventsForDate(today);

        return await planningService.analyzeSchedule(text, history, currentEvents);
      } catch (error) {
        console.error('Error analyzing schedule:', error);
        return { events: [], message: "Error processing request." };
      }
    });
  }
}

module.exports = IPCHandlers;

