const { contextBridge, ipcRenderer } = require('electron');

/**
 * Preload script - Exposes safe APIs to the renderer process
 */
contextBridge.exposeInMainWorld('electronAPI', {
  // System information
  platform: process.platform,
  versions: process.versions,

  // Window controls
  windowMinimize: () => ipcRenderer.invoke('window-minimize'),
  windowMaximize: () => ipcRenderer.invoke('window-maximize'),
  windowClose: () => ipcRenderer.invoke('window-close'),

  // Chat API
  chatSend: (message, sessionId) => ipcRenderer.invoke('chat-send', message, sessionId),
  chatHistory: (sessionId) => ipcRenderer.invoke('chat-history', sessionId),
  chatClear: (sessionId) => ipcRenderer.invoke('chat-clear', sessionId),
  chatSessions: () => ipcRenderer.invoke('chat-sessions'),
  chatNew: () => ipcRenderer.invoke('chat-new'),
  chatDelete: (sessionId) => ipcRenderer.invoke('chat-delete', sessionId),
  chatSetSession: (sessionId) => ipcRenderer.invoke('chat-set-session', sessionId),

  // Events
  onChatProgress: (callback) => ipcRenderer.on('chat-progress', (event, data) => callback(data)),

  // Planning API
  saveDailyPlan: (events) => ipcRenderer.invoke('save-daily-plan', events),
  planningDone: () => ipcRenderer.send('planning-done'),
  analyzeSchedule: (text, history) => ipcRenderer.invoke('chat-analyze-schedule', text, history),
  getDailyPlan: () => ipcRenderer.invoke('get-daily-plan'),
});

