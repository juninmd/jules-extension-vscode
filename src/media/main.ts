// Jules VS Code Extension - Webview Script

// Declare vscode API
declare function acquireVsCodeApi(): {
  postMessage(message: any): void;
  getState(): any;
  setState(state: any): void;
};

(function () {
  'use strict';

  // VS Code API
  const vscode = acquireVsCodeApi();

  // State
interface Task {
  name: string;
  prompt: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  createdAt: string;
  updatedAt: string;
  result?: string;
  error?: string;
  pullRequestUrl?: string;
}

interface State {
  hasApiKey: boolean;
  tasks: Task[];
  sources: any[];
  codeContext: string | null;
  codeLanguage: string;
  isCreatingTask: boolean;
}

  const state: State = {
    hasApiKey: false,
    tasks: [],
    sources: [],
    codeContext: null,
    codeLanguage: '',
    isCreatingTask: false,
  };

  // Elements - Screens
  const setupScreen = document.getElementById('setup-screen') as HTMLElement;
  const mainScreen = document.getElementById('main-screen') as HTMLElement;

  // Elements - Setup
  const btnConfigureKey = document.getElementById('btn-configure-key');
  const linkPortal = document.getElementById('link-portal');

  // Elements - Main
  const tasksArea = document.getElementById('tasks-area') as HTMLElement;
  const welcomeMsg = document.getElementById('welcome-msg');
  const messageInput = document.getElementById('message-input') as HTMLTextAreaElement;
  const btnSend = document.getElementById('btn-send') as HTMLButtonElement;
  const btnClear = document.getElementById('btn-clear');
  const btnRefresh = document.getElementById('btn-refresh');
  const btnSettings = document.getElementById('btn-settings');
  const codeContextBanner = document.getElementById('code-context-banner');
  const codeContextLabel = document.getElementById('code-context-label');
  const btnClearContext = document.getElementById('btn-clear-context');
  const repoSelect = document.getElementById('repo-select') as HTMLSelectElement;

  // ---- Init ----
  function init() {
    bindEvents();
    // Show loading state until we know API key status
    setupScreen.classList.add('hidden');
    mainScreen.classList.add('hidden');

    // Notify extension that webview is ready to receive messages
    vscode.postMessage({ type: 'ready' });
  }

  // ---- Event Bindings ----
  function bindEvents() {
    // Setup screen
    btnConfigureKey?.addEventListener('click', () => {
      vscode.postMessage({ type: 'configureApiKey' });
    });

    linkPortal?.addEventListener('click', (e: Event) => {
      e.preventDefault();
      vscode.postMessage({ type: 'openTaskUrl', url: 'https://jules.google' });
    });

    // Send button
    btnSend?.addEventListener('click', sendMessage);

    // Keyboard shortcut: Ctrl+Enter to send
    messageInput?.addEventListener('keydown', (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        sendMessage();
      }
    });

    // Auto-resize textarea
    messageInput?.addEventListener('input', () => {
      autoResize(messageInput);
      updateSendButton();
    });

    // Toolbar buttons
    btnClear?.addEventListener('click', () => {
      clearTasks();
    });

    btnRefresh?.addEventListener('click', () => {
      vscode.postMessage({ type: 'refreshTasks' });
    });

    btnSettings?.addEventListener('click', () => {
      vscode.postMessage({ type: 'configureApiKey' });
    });

    // Code context
    btnClearContext?.addEventListener('click', () => {
      clearCodeContext();
    });
  }

  // ---- Send Message ----
  function sendMessage() {
    const text = messageInput?.value.trim();
    const repository = repoSelect?.value;
    
    if (!text || state.isCreatingTask) return;
    if (!repository) {
        addErrorCard('Please select a repository first.');
        return;
    }

    vscode.postMessage({
      type: 'sendMessage',
      text,
      repository,
      codeContext: state.codeContext || undefined,
    });

    // Add a pending task card immediately in the UI
    addPendingTaskCard(text);

    if (messageInput) {
      messageInput.value = '';
      messageInput.style.height = '';
    }
    updateSendButton();
    clearCodeContext();
  }

  // ---- Task Cards ----
  function addPendingTaskCard(description: string) {
    hideWelcome();
    state.isCreatingTask = true;
    updateSendButton();

    const card = createTaskCard({
      name: 'creating-' + Date.now(),
      prompt: description,
      status: 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }, true);

    tasksArea.appendChild(card);
    tasksArea.scrollTop = tasksArea.scrollHeight;
  }

  function createTaskCard(task: any, isCreating = false) {
    const card = document.createElement('div');
    card.className = 'task-card';
    card.dataset.taskId = task.name;

    const statusClass = `status-${task.status}`;
    const statusLabel = getStatusLabel(task.status);
    const statusDot = task.status === 'running' ? '<span class="spinner"></span>' : getStatusEmoji(task.status);

    const timeStr = task.createdAt ? formatTime(task.createdAt) : '';

    card.innerHTML = `
      <div class="task-card-header">
        <div class="task-title">${escapeHtml(task.prompt || 'Task')}</div>
        <div class="task-card-actions">
          ${(task.status === 'pending' || task.status === 'running') && !isCreating
            ? `<button class="icon-btn btn-cancel-task" title="Cancel Task" data-task-id="${escapeHtml(task.name)}">
                <svg viewBox="0 0 16 16" fill="currentColor" width="12" height="12"><path d="M8 1a7 7 0 100 14A7 7 0 008 1zm3.354 4.646l-6 6-.708-.708 6-6 .708.708zm-6 0l.708-.708 6 6-.708.708-6-6z"/></svg>
               </button>`
            : ''
          }
        </div>
      </div>
      <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
        <span class="task-status ${statusClass}">${statusDot} ${statusLabel}</span>
        ${timeStr ? `<span class="task-time">${timeStr}</span>` : ''}
        ${isCreating ? '<span class="spinner"></span>' : ''}
      </div>
      ${task.result ? `<div class="task-result">${escapeHtml(task.result)}</div>` : ''}
      ${task.error ? `<div class="task-error">⚠️ ${escapeHtml(task.error)}</div>` : ''}
      ${task.pullRequestUrl ? `
        <button class="task-pr-link" data-url="${escapeHtml(task.pullRequestUrl)}">
          <svg viewBox="0 0 16 16" fill="currentColor" width="13" height="13"><path d="M7.177 3.073L9.573.677A.25.25 0 0110 .854v4.792a.25.25 0 01-.427.177L7.177 3.427a.25.25 0 010-.354zm-2.354 7.854l-2.396-2.396a.25.25 0 010-.354l2.396-2.396A.25.25 0 015 6v4.792a.25.25 0 01-.427.177z"/><path fill-rule="evenodd" d="M3.75 2.5a.75.75 0 100 1.5.75.75 0 000-1.5zm-2.25.75a2.25 2.25 0 113 2.122v5.256a2.251 2.251 0 11-1.5 0V5.372A2.25 2.25 0 011.5 3.25zM11 2.5h-1V4h1a1 1 0 011 1v5.628a2.251 2.251 0 101.5 0V5A2.5 2.5 0 0011 2.5zm1 10.25a.75.75 0 111.5 0 .75.75 0 01-1.5 0z"/></svg>
          View Pull Request
        </button>
      ` : ''}
    `;

    // Bind cancel button
    const cancelBtn = card.querySelector('.btn-cancel-task');
    cancelBtn?.addEventListener('click', () => {
      vscode.postMessage({ type: 'cancelTask', taskId: task.name });
    });

    // Bind PR link
    const prLink = card.querySelector('.task-pr-link');
    prLink?.addEventListener('click', () => {
      vscode.postMessage({ type: 'openTaskUrl', url: task.pullRequestUrl });
    });

    return card;
  }

  function updateTaskCard(task: any) {
    const existing = tasksArea.querySelector(`[data-task-id="${CSS.escape(task.name)}"]`);

    if (existing) {
      const newCard = createTaskCard(task);
      existing.replaceWith(newCard);
    } else {
      // Remove any "creating" placeholder
      const creating = tasksArea.querySelector('[data-task-id^="creating-"]');
      if (creating) {
        creating.remove();
      }
      const card = createTaskCard(task);
      tasksArea.appendChild(card);
      hideWelcome();
    }

    state.isCreatingTask = false;
    updateSendButton();
    tasksArea.scrollTop = tasksArea.scrollHeight;
  }

  function addTasksList(tasks: any[]) {
    clearTasks(false);
    if (tasks.length === 0) {
      showWelcome();
      return;
    }
    tasks.forEach(task => {
      const card = createTaskCard(task);
      tasksArea.appendChild(card);
    });
    hideWelcome();
    tasksArea.scrollTop = tasksArea.scrollHeight;
  }

  function updateSourcesList(sources: any[]) {
      state.sources = sources;
      if (!repoSelect) return;
      
      repoSelect.innerHTML = '';
      
      if (sources.length === 0) {
          const option = document.createElement('option');
          option.value = '';
          option.textContent = 'No repositories found';
          repoSelect.appendChild(option);
          return;
      }

      // Add a default select option
      const defaultOption = document.createElement('option');
      defaultOption.value = '';
      defaultOption.textContent = 'Select a repository...';
      repoSelect.appendChild(defaultOption);

      sources.forEach(source => {
          const option = document.createElement('option');
          option.value = source.name;
          option.textContent = source.displayName || source.name.split('/').pop();
          repoSelect.appendChild(option);
      });
  }

  function addErrorCard(message: string) {
    const card = document.createElement('div');
    card.className = 'error-toast';
    card.innerHTML = `<span class="error-icon">⚠️</span><span>${escapeHtml(message)}</span>`;
    tasksArea.appendChild(card);
    tasksArea.scrollTop = tasksArea.scrollHeight;
    state.isCreatingTask = false;
    updateSendButton();
    // Auto-remove after 10s
    setTimeout(() => card.remove(), 10000);
  }

  // ---- UI Helpers ----
  function showScreen(screen: HTMLElement) {
    setupScreen.classList.add('hidden');
    mainScreen.classList.add('hidden');
    screen.classList.remove('hidden');
  }

  function hideWelcome() {
    welcomeMsg?.classList.add('hidden');
  }

  function showWelcome() {
    welcomeMsg?.classList.remove('hidden');
  }

  function clearTasks(showWelcomeAfter = true) {
    // Remove all task cards and error cards, keep welcome msg
    const cards = tasksArea.querySelectorAll('.task-card, .error-toast');
    cards.forEach(c => c.remove());
    state.tasks = [];
    state.isCreatingTask = false;
    updateSendButton();
    if (showWelcomeAfter) {
      showWelcome();
    }
  }

  function updateSendButton() {
    if (!btnSend || !messageInput) return;
    const hasText = messageInput.value.trim().length > 0;
    btnSend.disabled = !hasText || state.isCreatingTask;
  }

  function autoResize(textarea: HTMLTextAreaElement) {
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 150) + 'px';
  }

  function setCodeContext(code: string, language: string) {
    state.codeContext = code;
    state.codeLanguage = language;
    const lineCount = code.split('\n').length;
    const langLabel = language ? ` (${language})` : '';
    if (codeContextLabel) {
      codeContextLabel.textContent = `📎 ${lineCount} line${lineCount !== 1 ? 's' : ''} of code attached${langLabel}`;
    }
    codeContextBanner?.classList.remove('hidden');
  }

  function clearCodeContext() {
    state.codeContext = null;
    state.codeLanguage = '';
    codeContextBanner?.classList.add('hidden');
    if (codeContextLabel) {
      codeContextLabel.textContent = '📎 Code selected';
    }
  }

  // ---- Formatting ----
  function getStatusLabel(status: string) {
    const labels: { [key: string]: string } = {
      pending: 'Pending',
      running: 'Running',
      completed: 'Completed',
      failed: 'Failed',
      cancelled: 'Cancelled',
    };
    return labels[status] || status;
  }

  function getStatusEmoji(status: string) {
    const emojis: { [key: string]: string } = {
      pending: '⏳',
      running: '',
      completed: '✅',
      failed: '❌',
      cancelled: '🚫',
    };
    return emojis[status] || '';
  }

  function formatTime(isoString: string) {
    try {
      const date = new Date(isoString);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      if (diffMins < 1) return 'just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) return `${diffHours}h ago`;
      return date.toLocaleDateString();
    } catch {
      return '';
    }
  }

  function escapeHtml(str: string | null | undefined) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // ---- Message Handler ----
  window.addEventListener('message', (event: MessageEvent) => {
    const message = event.data;

    switch (message.type) {
      case 'apiKeyStatus':
        state.hasApiKey = message.hasKey;
        if (message.hasKey) {
          showScreen(mainScreen);
        } else {
          showScreen(setupScreen);
        }
        break;

      case 'taskCreating':
        state.isCreatingTask = true;
        updateSendButton();
        break;

      case 'taskCreated':
        updateTaskCard(message.task);
        break;

      case 'taskUpdated':
        updateTaskCard(message.task);
        break;

      case 'tasksList':
        addTasksList(message.tasks);
        break;

      case 'sourcesList':
        updateSourcesList(message.sources);
        break;

      case 'error':
        addErrorCard(message.message);
        break;

      case 'clearChat':
        clearTasks();
        break;

      case 'selectedCode':
        showScreen(mainScreen);
        setCodeContext(message.code, message.language);
        messageInput?.focus();
        break;
    }
  });

  // ---- Start ----
  init();
})();
