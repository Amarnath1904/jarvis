const path = require('path');
const fs = require('fs');

// Try to get app, but handle case where it might not be available yet
let app = null;
try {
  app = require('electron').app;
} catch (e) {
  // app not available yet, will use fallback
}

/**
 * Get the path to .env file in user data directory
 * This is the standard location for Electron apps - persistent and user-specific
 * Windows: C:\Users\Username\AppData\Roaming\JARVIS\.env
 */
function getUserDataEnvPath() {
  if (!app) {
    // Fallback for when app is not available yet
    return null;
  }
  
  const userDataPath = app.getPath('userData');
  return path.join(userDataPath, '.env');
}

/**
 * Get the path to .env file in project root (for development)
 */
function getProjectEnvPath() {
  return path.join(__dirname, '../../../.env');
}

/**
 * Initialize .env file in user data directory if it doesn't exist
 * Copies from project root if available, otherwise creates a template
 */
function initializeUserDataEnv() {
  if (!app) {
    return false;
  }
  
  const userDataPath = app.getPath('userData');
  const userDataEnvPath = path.join(userDataPath, '.env');
  const projectEnvPath = getProjectEnvPath();
  
  // Create userData directory if it doesn't exist
  if (!fs.existsSync(userDataPath)) {
    fs.mkdirSync(userDataPath, { recursive: true });
  }
  
  // If .env already exists in userData, don't overwrite it
  if (fs.existsSync(userDataEnvPath)) {
    return true;
  }
  
  // Try to copy from project root (development)
  if (fs.existsSync(projectEnvPath)) {
    try {
      fs.copyFileSync(projectEnvPath, userDataEnvPath);
      console.log(`[EnvLoader] Copied .env from project root to user data: ${userDataEnvPath}`);
      return true;
    } catch (error) {
      console.warn(`[EnvLoader] Failed to copy .env from project: ${error.message}`);
    }
  }
  
  // Create a template .env file if it doesn't exist
  const template = `# JARVIS Configuration
# Add your API keys and configuration here

# Google Gemini API Key (required)
# Get your key from: https://makersuite.google.com/app/apikey
GEMINI_API_KEY=

# MongoDB Connection URL (optional)
# If not provided, app will use in-memory storage
MONGODB_URL=

# Google Search API (optional)
# For web search functionality
GOOGLE_SEARCH_API_KEY=
GOOGLE_SEARCH_CX=
`;
  
  try {
    fs.writeFileSync(userDataEnvPath, template, 'utf8');
    console.log(`[EnvLoader] Created template .env file at: ${userDataEnvPath}`);
    console.log(`[EnvLoader] Please edit this file and add your GEMINI_API_KEY`);
    return true;
  } catch (error) {
    console.error(`[EnvLoader] Failed to create .env template: ${error.message}`);
    return false;
  }
}

/**
 * Load .env file with correct path resolution
 * Priority:
 * 1. User data directory (production & persistent)
 * 2. Project root (development fallback)
 */
function loadEnv() {
  // Initialize user data .env if needed
  initializeUserDataEnv();
  
  // Try user data directory first (standard Electron location)
  const userDataEnvPath = getUserDataEnvPath();
  if (userDataEnvPath && fs.existsSync(userDataEnvPath)) {
    console.log(`[EnvLoader] Loading .env from user data: ${userDataEnvPath}`);
    require('dotenv').config({ path: userDataEnvPath });
    return true;
  }
  
  // Fallback: try project root (for development)
  const projectEnvPath = getProjectEnvPath();
  if (fs.existsSync(projectEnvPath)) {
    console.log(`[EnvLoader] Loading .env from project root: ${projectEnvPath}`);
    require('dotenv').config({ path: projectEnvPath });
    return true;
  }
  
  // Last resort: try current working directory
  const cwdPath = path.join(process.cwd(), '.env');
  if (fs.existsSync(cwdPath)) {
    console.log(`[EnvLoader] Loading .env from current directory: ${cwdPath}`);
    require('dotenv').config({ path: cwdPath });
    return true;
  }
  
  console.warn(`[EnvLoader] .env file not found. Checked:`);
  if (userDataEnvPath) {
    console.warn(`  - User data: ${userDataEnvPath}`);
  }
  console.warn(`  - Project root: ${projectEnvPath}`);
  console.warn(`  - Current dir: ${cwdPath}`);
  console.warn(`[EnvLoader] A template .env file should have been created. Please add your GEMINI_API_KEY.`);
  return false;
}

module.exports = {
  getUserDataEnvPath,
  getProjectEnvPath,
  loadEnv,
  initializeUserDataEnv
};
