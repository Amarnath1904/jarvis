/**
 * UI module for Chat functionality
 * Handles DOM manipulation and rendering
 */
export class ChatUI {
    constructor() {
        this.elements = {
            input: document.getElementById('chat-input'),
            sendBtn: document.getElementById('chat-send-btn'),
            newChatBtn: document.getElementById('chat-new-btn'),
            newChatBtnHeader: document.getElementById('chat-new-btn-header'),
            sidebarToggle: document.getElementById('sidebar-toggle-btn'),
            sidebarClose: document.getElementById('sidebar-close-btn'),
            chatMessages: document.getElementById('chat-messages'),
            sessionsList: document.getElementById('chat-sessions-list'),
            sidebar: document.getElementById('chat-sidebar')
        };

        // Helper for event delegation
        this.callbacks = {};
    }

    setCallbacks(callbacks) {
        this.callbacks = callbacks;
        this.setupEventListeners();
    }

    setupEventListeners() {
        const { input, sendBtn, newChatBtn, newChatBtnHeader, sidebarToggle, sidebarClose } = this.elements;

        if (input) {
            input.addEventListener('keypress', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    if (this.callbacks.onSend) this.callbacks.onSend();
                }
            });
        }

        if (sendBtn) {
            sendBtn.addEventListener('click', () => {
                if (this.callbacks.onSend) this.callbacks.onSend();
            });
        }

        if (newChatBtn) {
            newChatBtn.addEventListener('click', () => {
                if (this.callbacks.onNewChat) this.callbacks.onNewChat();
            });
        }

        if (newChatBtnHeader) {
            newChatBtnHeader.addEventListener('click', () => {
                if (this.callbacks.onNewChat) this.callbacks.onNewChat();
            });
        }

        if (sidebarToggle) {
            sidebarToggle.addEventListener('click', () => this.toggleSidebar());
        }

        if (sidebarClose) {
            sidebarClose.addEventListener('click', () => this.toggleSidebar());
        }
    }

    getInputValue() {
        return this.elements.input ? this.elements.input.value.trim() : '';
    }

    clearInput() {
        if (this.elements.input) {
            this.elements.input.value = '';
        }
    }

    updateSendButton(isLoading) {
        if (this.elements.sendBtn) {
            this.elements.sendBtn.disabled = isLoading;
            this.elements.sendBtn.textContent = isLoading ? 'Sending...' : 'Send';
        }
    }

    toggleSidebar(forceState = null) {
        if (!this.elements.sidebar) return;

        const isHidden = this.elements.sidebar.classList.contains('hidden');
        const shouldOpen = forceState !== null ? forceState : isHidden;

        if (shouldOpen) {
            this.elements.sidebar.classList.remove('hidden');
        } else {
            this.elements.sidebar.classList.add('hidden');
        }
    }

    renderChat(messages) {
        if (!this.elements.chatMessages) return;

        if (messages.length === 0) {
            this.elements.chatMessages.innerHTML = `
        <div class="flex items-center justify-center h-full futuristic-empty-state text-white/50">
          <div class="text-center">
            <p class="text-xl mb-2">Start a conversation with JARVIS</p>
            <p class="text-sm">Type a message below to begin</p>
          </div>
        </div>
      `;
        } else {
            this.elements.chatMessages.innerHTML = messages.map(msg => this.renderMessage(msg)).join('');
        }
        this.scrollToBottom();
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
        <div class="message-bubble ${isUser ? 'user' : 'assistant'} max-w-[80%] ${isUser ? 'bg-gray-700/80' : 'bg-white/20'} backdrop-blur-sm rounded-lg px-4 py-2 ${isUser ? 'rounded-br-none' : 'rounded-bl-none'}">
          <div class="message-content text-white ${!isUser ? 'chat-markdown' : ''}">
            ${content}
          </div>
        </div>
      </div>
    `;
    }

    renderSessions(sessions, currentSessionId) {
        if (!this.elements.sessionsList) return;

        if (sessions.length === 0) {
            this.elements.sessionsList.innerHTML = '<p class="text-white/50 text-sm">No chats yet</p>';
        } else {
            this.elements.sessionsList.innerHTML = sessions.map(session =>
                this.renderSessionItem(session, currentSessionId)
            ).join('');

            // Add event listeners to session items
            // We need to do this after rendering because the elements are new
            this.attachSessionListeners();
        }
    }

    renderSessionItem(session, currentSessionId) {
        const isActive = session.id === currentSessionId;
        return `
      <div 
        class="futuristic-session-item ${isActive ? 'active' : ''} p-3 mb-2 ${isActive ? 'bg-gray-700/30 border-l-2 border-gray-500' : 'bg-white/10'} rounded cursor-pointer hover:bg-white/20 transition-colors group relative"
        data-session-id="${session.id}"
      >
        <div class="flex items-center justify-between">
          <div class="flex-1 min-w-0">
            <div class="text-sm font-medium text-white truncate">${this.escapeHtml(session.title)}</div>
            <div class="text-xs text-white/50 mt-1">${this.formatDate(session.updatedAt)}</div>
          </div>
          <button 
            class="delete-session-btn ml-2 opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300 transition-opacity"
            data-session-id="${session.id}"
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

    attachSessionListeners() {
        // Session click listeners
        const sessionItems = this.elements.sessionsList.querySelectorAll('.futuristic-session-item');
        sessionItems.forEach(item => {
            item.addEventListener('click', () => {
                const sessionId = item.dataset.sessionId;
                if (this.callbacks.onSwitchSession) this.callbacks.onSwitchSession(sessionId);
            });
        });

        // Delete button listeners
        const deleteBtns = this.elements.sessionsList.querySelectorAll('.delete-session-btn');
        deleteBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const sessionId = btn.dataset.sessionId;
                if (this.callbacks.onDeleteSession) this.callbacks.onDeleteSession(sessionId);
            });
        });
    }

    scrollToBottom() {
        if (this.elements.chatMessages) {
            this.elements.chatMessages.scrollTop = this.elements.chatMessages.scrollHeight;
        }
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    showLoading() {
        if (!this.elements.chatMessages) return;

        // Remove existing loading indicator if any
        this.hideLoading();

        const loadingHtml = `
            <div id="loading-indicator" class="flex flex-col items-start mb-4">
                <div class="thinking-bubble mb-1">
                    <div class="thinking-dot"></div>
                    <div class="thinking-dot"></div>
                    <div class="thinking-dot"></div>
                </div>
                <div id="loading-text" class="text-xs text-white/50 ml-1 hidden"></div>
            </div>
        `;

        this.elements.chatMessages.insertAdjacentHTML('beforeend', loadingHtml);
        this.scrollToBottom();
    }

    updateLoadingText(text) {
        const loadingText = document.getElementById('loading-text');
        if (loadingText) {
            loadingText.textContent = text;
            loadingText.classList.remove('hidden');
            this.scrollToBottom();
        }
    }

    hideLoading() {
        const loadingIndicator = document.getElementById('loading-indicator');
        if (loadingIndicator) {
            loadingIndicator.remove();
        }
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
}
