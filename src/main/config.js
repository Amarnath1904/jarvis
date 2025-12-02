const { app } = require('electron');

/**
 * Application configuration
 */
module.exports = {
  window: {
    width: 800,
    height: 600,
    minWidth: 800,
    minHeight: 600,
    transparent: true,
    frame: false,
    backgroundColor: '#00000000' // Transparent background
  },
  webPreferences: {
    nodeIntegration: false,
    contextIsolation: true,
    enableRemoteModule: false
  },
  isDevelopment: process.argv.includes('--dev') || (app && !app.isPackaged)
};

