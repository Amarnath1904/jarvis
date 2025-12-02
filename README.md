# JARVIS - Electron Application

A modern Electron application with AI chat capabilities powered by Gemini.

## Getting Started

### Prerequisites

- Node.js (v14 or higher)
- npm (comes with Node.js)
- Gemini API Key from Google AI Studio

### Installation

1. Install dependencies:
```bash
npm install
```

2. Create a `.env` file in the root directory:
```bash
GEMINI_API_KEY=your_gemini_api_key_here
```

You can get your API key from [Google AI Studio](https://makersuite.google.com/app/apikey).

### Running the Application

To run the application in development mode:
```bash
npm start
```

To run with DevTools open:
```bash
npm run dev
```

**Note:** 
- Hot reload is enabled by default. When you modify any file (HTML, JS, CSS), the application will automatically reload.
- CSS is built automatically before starting. To watch for CSS changes during development, run `npm run watch:css` in a separate terminal.

## Project Structure

The project follows a modular architecture for better maintainability and scalability:

```
JARVIS/
├── src/
│   ├── main/              # Main process (Node.js)
│   │   ├── main.js        # Application entry point
│   │   ├── app.js         # Application lifecycle management
│   │   ├── window.js      # Window management
│   │   ├── config.js      # Application configuration
│   │   ├── chat.js        # Chat service with LangChain
│   │   ├── ipc.js         # IPC handlers
│   │   └── shortcuts.js   # Keyboard shortcuts
│   ├── preload/           # Preload scripts
│   │   └── preload.js     # Secure context bridge
│   └── renderer/          # Renderer process (Browser)
│       ├── index.html     # Main HTML file
│       ├── css/
│       │   ├── input.css  # Tailwind CSS source file
│       │   └── styles.css # Compiled CSS (generated)
│       └── js/
│           ├── app.js     # Main renderer logic
│           ├── utils.js  # Utility functions
│           └── chat.js    # Chat UI and functionality
├── package.json           # Project configuration
├── tailwind.config.js     # Tailwind CSS configuration
├── postcss.config.js      # PostCSS configuration
├── .env                   # Environment variables (create this)
└── README.md              # This file
```

### Module Descriptions

- **src/main/main.js** - Entry point that initializes the application
- **src/main/app.js** - Handles application lifecycle (ready, activate, window-all-closed)
- **src/main/window.js** - Manages window creation and lifecycle
- **src/main/config.js** - Centralized configuration settings
- **src/main/chat.js** - Chat service with LangChain and Gemini integration
- **src/main/ipc.js** - IPC handlers for window controls and chat
- **src/main/shortcuts.js** - Keyboard shortcuts for window positioning
- **src/preload/preload.js** - Exposes safe APIs to renderer process
- **src/renderer/** - All UI-related files (HTML, CSS, JS)

## Features

- **Modular Architecture** - Clean separation of concerns with organized folder structure
- **Tailwind CSS** - Utility-first CSS framework for rapid UI development
- **AI Chat Interface** - Powered by Google Gemini with conversation memory
- **Chat History** - Sidebar with chat history and quick navigation
- **Markdown Support** - AI responses rendered with markdown formatting
- **Transparent Window** - Frameless transparent window with custom controls
- **Secure Context Isolation** - Best practices for Electron security
- **Cross-platform Support** - Works on Windows, macOS, and Linux
- **Hot Reload** - Automatically reloads when you make changes to files
- **ES Modules** - Modern JavaScript with ES6+ module syntax
- **Keyboard Shortcuts** - Ctrl+Shift+Arrow keys to move window

## CSS Development

This project uses Tailwind CSS. The CSS is compiled from `src/renderer/css/input.css` to `src/renderer/css/styles.css`.

- **Build CSS once**: `npm run build:css`
- **Watch CSS changes**: `npm run watch:css` (run in a separate terminal during development)

## Chat Features

- **Conversation Memory** - Maintains context across messages using LangChain's BufferMemory
- **Markdown Rendering** - AI responses support markdown formatting
- **Chat History** - View and navigate previous conversations
- **Session Management** - Supports multiple chat sessions

## Building for Production

To build the application for production, you can use tools like:
- [electron-builder](https://www.electron.build/)
- [electron-forge](https://www.electronforge.io/)

## License

MIT
