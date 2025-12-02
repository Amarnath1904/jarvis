/**
 * Chat functionality with multiple sessions
 * Main entry point that coordinates API and UI
 */
import { ChatAPI } from './chat-api.js';
import { ChatUI } from './chat-ui.js';

class ChatManager {
  constructor() {
    this.api = new ChatAPI();
    this.ui = new ChatUI();

    this.currentSessionId = null;
    this.messages = [];
    this.sessions = [];
    this.isLoading = false;
    this.sidebarOpen = false;

    this.init();
  }

  async init() {
    // Setup UI callbacks
    this.ui.setCallbacks({
      onSend: () => this.handleSend(),
      onNewChat: () => this.handleNewChat(),
      onSwitchSession: (id) => this.handleSwitchSession(id),
      onDeleteSession: (id) => this.handleDeleteSession(id)
    });

    await this.loadSessions();
    await this.createOrLoadSession();

    // Ensure sidebar is closed on initial load
    this.ui.toggleSidebar(false);

    // Listen for progress updates
    if (window.electronAPI && window.electronAPI.onChatProgress) {
      window.electronAPI.onChatProgress((data) => {
        if (data.type === 'tool_start' && data.message) {
          this.ui.updateLoadingText(data.message);
        }
      });
    }
  }

  async loadSessions() {
    try {
      this.sessions = await this.api.getSessions();
      this.ui.renderSessions(this.sessions, this.currentSessionId);
    } catch (error) {
      console.error('Error loading sessions:', error);
    }
  }

  async createOrLoadSession() {
    if (this.sessions.length === 0) {
      await this.handleNewChat();
    } else {
      // Load the most recent session
      const mostRecent = this.sessions[0];
      await this.handleSwitchSession(mostRecent.id);
    }
  }

  async handleNewChat() {
    try {
      const result = await this.api.createNewChat();
      if (result.success) {
        this.currentSessionId = result.sessionId;
        this.messages = [];
        this.ui.renderChat(this.messages);
        await this.loadSessions();
      }
    } catch (error) {
      console.error('Error creating new chat:', error);
    }
  }

  async handleSwitchSession(sessionId) {
    await this.api.setSession(sessionId);

    this.currentSessionId = sessionId;
    await this.loadHistory();
    this.ui.renderChat(this.messages);

    // Re-render sessions to update active state
    this.ui.renderSessions(this.sessions, this.currentSessionId);
  }

  async loadHistory() {
    if (this.currentSessionId) {
      try {
        this.messages = await this.api.getHistory(this.currentSessionId);
      } catch (error) {
        console.error('Error loading chat history:', error);
      }
    }
  }

  async handleSend() {
    const message = this.ui.getInputValue();
    if (!message || this.isLoading || !this.currentSessionId) return;

    this.ui.clearInput();

    // Add user message to UI immediately
    this.addMessage('user', message);
    this.isLoading = true;
    this.ui.updateSendButton(true);
    this.ui.showLoading();

    try {
      const result = await this.api.sendMessage(message, this.currentSessionId);

      if (result.success) {
        this.addMessage('assistant', result.response);
        // Reload sessions to update titles
        await this.loadSessions();
      } else {
        this.addMessage('assistant', `Error: ${result.error}`);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      this.addMessage('assistant', `Error: ${error.message}`);
    } finally {
      this.isLoading = false;
      this.ui.updateSendButton(false);
      this.ui.hideLoading();
    }
  }

  async handleDeleteSession(sessionId) {
    if (confirm('Are you sure you want to delete this chat?')) {
      await this.api.deleteSession(sessionId);
      await this.loadSessions();

      // If deleted session was current, switch to another or create new
      if (sessionId === this.currentSessionId) {
        if (this.sessions.length > 0) {
          await this.handleSwitchSession(this.sessions[0].id);
        } else {
          await this.handleNewChat();
        }
      }
    }
  }

  addMessage(role, content) {
    this.messages.push({
      role,
      content,
      timestamp: new Date().toISOString()
    });
    this.ui.renderChat(this.messages);
  }
}

// Initialize chat manager
let chatManager;
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    chatManager = new ChatManager();
    window.chatManager = chatManager;
  });
} else {
  chatManager = new ChatManager();
  window.chatManager = chatManager;
}
