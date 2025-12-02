/**
 * Main application logic for renderer process
 */
import { showAlert } from './utils.js';

/**
 * Initialize the application
 */
function init() {
    // Setup event listeners
    setupEventListeners();
}

/**
 * Setup event listeners
 */
function setupEventListeners() {
    // Make showAlert available globally for onclick handlers
    window.showAlert = () => showAlert();
    
    // You can add more event listeners here
    document.addEventListener('DOMContentLoaded', () => {
        console.log('JARVIS application loaded');
    });
}

// Initialize app when script loads
init();

