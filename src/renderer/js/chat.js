/**
 * Chat functionality with multiple sessions
 * Using marked.js from window (loaded in HTML)
 */

class ChatManager {
  constructor() {
    this.currentSessionId = null;
    this.messages = [];
    this.sessions = [];
    this.isLoading = false;
    this.sidebarOpen = false; // Start with sidebar closed
    this.init();
  }

  async init() {
    await this.loadSessions();
    this.setupEventListeners();
    await this.createOrLoadSession();
    // Ensure sidebar is closed on initial load
    this.updateSidebarState();
  }

  updateSidebarState() {
    const sidebar = document.getElementById('chat-sidebar');
    if (sidebar) {
      if (this.sidebarOpen) {
        sidebar.classList.remove('hidden');
      } else {
        sidebar.classList.add('hidden');
      }
    }
  }

  setupEventListeners() {
    const input = document.getElementById('chat-input');
    const sendBtn = document.getElementById('chat-send-btn');
    const newChatBtn = document.getElementById('chat-new-btn');
    const sidebarToggle = document.getElementById('sidebar-toggle-btn');
    const sidebarClose = document.getElementById('sidebar-close-btn');

    if (input) {
      input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          this.sendMessage();
        }
      });
    }

    if (sendBtn) {
      sendBtn.addEventListener('click', () => this.sendMessage());
    }

    if (newChatBtn) {
      newChatBtn.addEventListener('click', () => this.createNewChat());
    }

    if (sidebarToggle) {
      sidebarToggle.addEventListener('click', () => this.toggleSidebar());
    }

    if (sidebarClose) {
      sidebarClose.addEventListener('click', () => this.toggleSidebar());
    }
  }

  async loadSessions() {
    if (window.electronAPI && window.electronAPI.chatSessions) {
      try {
        this.sessions = await window.electronAPI.chatSessions() || [];
        this.renderSessions();
      } catch (error) {
        console.error('Error loading sessions:', error);
      }
    }
  }

  async createOrLoadSession() {
    if (this.sessions.length === 0) {
      await this.createNewChat();
    } else {
      // Load the most recent session
      const mostRecent = this.sessions[0];
      await this.switchSession(mostRecent.id);
    }
  }

  async createNewChat() {
    if (window.electronAPI && window.electronAPI.chatNew) {
      try {
        const result = await window.electronAPI.chatNew();
        if (result.success) {
          this.currentSessionId = result.sessionId;
          this.messages = [];
          this.renderChat();
          await this.loadSessions();
        }
      } catch (error) {
        console.error('Error creating new chat:', error);
      }
    }
  }

  async switchSession(sessionId) {
    if (window.electronAPI && window.electronAPI.chatSetSession) {
      await window.electronAPI.chatSetSession(sessionId);
    }
    
    this.currentSessionId = sessionId;
    await this.loadHistory();
    this.renderChat();
  }

  async loadHistory() {
    if (window.electronAPI && window.electronAPI.chatHistory && this.currentSessionId) {
      try {
        this.messages = await window.electronAPI.chatHistory(this.currentSessionId) || [];
      } catch (error) {
        console.error('Error loading chat history:', error);
      }
    }
  }

  async sendMessage() {
    const input = document.getElementById('chat-input');
    if (!input || !input.value.trim() || this.isLoading || !this.currentSessionId) return;

    const message = input.value.trim();
    input.value = '';

    // Add user message to UI immediately
    this.addMessage('user', message);
    this.isLoading = true;
    this.updateSendButton();

    try {
      if (window.electronAPI && window.electronAPI.chatSend) {
        const result = await window.electronAPI.chatSend(message, this.currentSessionId);
        
        if (result.success) {
          this.addMessage('assistant', result.response);
          // Reload sessions to update titles
          await this.loadSessions();
        } else {
          this.addMessage('assistant', `Error: ${result.error}`);
        }
      } else {
        this.addMessage('assistant', 'Chat API not available');
      }
    } catch (error) {
      console.error('Error sending message:', error);
      this.addMessage('assistant', `Error: ${error.message}`);
    } finally {
      this.isLoading = false;
      this.updateSendButton();
    }
  }

  async deleteSession(sessionId, event) {
    event.stopPropagation();
    if (confirm('Are you sure you want to delete this chat?')) {
      if (window.electronAPI && window.electronAPI.chatDelete) {
        await window.electronAPI.chatDelete(sessionId);
        await this.loadSessions();
        
        // If deleted session was current, switch to another or create new
        if (sessionId === this.currentSessionId) {
          if (this.sessions.length > 0) {
            await this.switchSession(this.sessions[0].id);
          } else {
            await this.createNewChat();
          }
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
    this.renderChat();
    this.scrollToBottom();
  }

  toggleSidebar() {
    this.sidebarOpen = !this.sidebarOpen;
    this.updateSidebarState();
  }

  renderChat() {
    const chatMessages = document.getElementById('chat-messages');
    
    if (chatMessages) {
      if (this.messages.length === 0) {
        chatMessages.innerHTML = `
          <div class="flex items-center justify-center h-full futuristic-empty-state text-white/50">
            <div class="text-center">
              <p class="text-xl mb-2">Start a conversation with JARVIS</p>
              <p class="text-sm">Type a message below to begin</p>
            </div>
          </div>
        `;
      } else {
        chatMessages.innerHTML = this.messages.map(msg => this.renderMessage(msg)).join('');
      }
    }
  }

  renderSessions() {
    const sessionsList = document.getElementById('chat-sessions-list');
    
    if (sessionsList) {
      if (this.sessions.length === 0) {
        sessionsList.innerHTML = '<p class="text-white/50 text-sm">No chats yet</p>';
      } else {
        sessionsList.innerHTML = this.sessions.map(session => 
          this.renderSessionItem(session)
        ).join('');
      }
    }
  }

  renderSessionItem(session) {
    const isActive = session.id === this.currentSessionId;
    return `
      <div 
        class="futuristic-session-item ${isActive ? 'active' : ''} p-3 mb-2 ${isActive ? 'bg-blue-500/30 border-l-2 border-blue-400' : 'bg-white/10'} rounded cursor-pointer hover:bg-white/20 transition-colors group relative"
        onclick="chatManager.switchSession('${session.id}')"
      >
        <div class="flex items-center justify-between">
          <div class="flex-1 min-w-0">
            <div class="text-sm font-medium text-white truncate">${this.escapeHtml(session.title)}</div>
            <div class="text-xs text-white/50 mt-1">${this.formatDate(session.updatedAt)}</div>
          </div>
          <button 
            onclick="event.stopPropagation(); chatManager.deleteSession('${session.id}', event)"
            class="ml-2 opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300 transition-opacity"
            style="-webkit-app-region: no-drag;"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
            </svg>
          </button>
        </div>
      </div>
    `;
  }

  renderMessage(msg) {
    const isUser = msg.role === 'user';
    let content;
    
    if (isUser) {
      content = this.escapeHtml(msg.content);
    } else {
      // Use marked if available, otherwise escape HTML
      if (window.marked && typeof window.marked.parse === 'function') {
        content = window.marked.parse(msg.content);
      } else {
        content = this.escapeHtml(msg.content).replace(/\n/g, '<br>');
      }
    }
    
    return `
      <div class="flex ${isUser ? 'justify-end' : 'justify-start'} mb-4">
        <div class="message-bubble ${isUser ? 'user' : 'assistant'} max-w-[80%] ${isUser ? 'bg-blue-500/80' : 'bg-white/20'} backdrop-blur-sm rounded-lg px-4 py-2 ${isUser ? 'rounded-br-none' : 'rounded-bl-none'}">
          <div class="message-content text-white ${!isUser ? 'chat-markdown' : ''}">
            ${content}
          </div>
        </div>
      </div>
    `;
  }

  formatDate(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  }

  scrollToBottom() {
    const chatMessages = document.getElementById('chat-messages');
    if (chatMessages) {
      chatMessages.scrollTop = chatMessages.scrollHeight;
    }
  }

  updateSendButton() {
    const sendBtn = document.getElementById('chat-send-btn');
    if (sendBtn) {
      sendBtn.disabled = this.isLoading;
      sendBtn.textContent = this.isLoading ? 'Sending...' : 'Send';
    }
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
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
