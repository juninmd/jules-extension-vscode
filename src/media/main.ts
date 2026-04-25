// Jules AI Extension — Webview Script

declare function acquireVsCodeApi(): {
  postMessage(message: unknown): void;
  getState(): unknown;
  setState(state: unknown): void;
};

(function () {
  'use strict';

  const vscode = acquireVsCodeApi();
  const MAX_CHARS = 2000;

  interface Task {
    name: string;
    id?: string;
    title?: string;
    prompt: string;
    status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled' | 'pendingApproval';
    createdAt?: string;
    pullRequestUrl?: string;
  }

  type TabType = 'all' | 'active' | 'done';

  const state = {
    hasApiKey: false,
    allTasks: [] as Task[],
    sources: [] as Array<{ name: string; displayName: string }>,
    codeContext: null as string | null,
    codeLanguage: '',
    isCreatingTask: false,
    currentTab: 'all' as TabType,
    isLoading: false,
  };

  // ── DOM refs ─────────────────────────────────────────────
  const setupScreen    = document.getElementById('setup-screen')!;
  const mainScreen     = document.getElementById('main-screen')!;
  const btnConfigKey   = document.getElementById('btn-configure-key')!;
  const linkPortal     = document.getElementById('link-portal')!;
  const btnRefresh     = document.getElementById('btn-refresh')!;
  const btnSettings    = document.getElementById('btn-settings')!;
  const repoSearch     = document.getElementById('repo-search') as HTMLInputElement;
  const repoSelect     = document.getElementById('repo-select') as HTMLSelectElement;
  const tabBtns        = document.querySelectorAll<HTMLButtonElement>('.tab-btn');
  const tasksArea      = document.getElementById('tasks-area')!;
  const skeletonLoader = document.getElementById('skeleton-loader')!;
  const codeBanner     = document.getElementById('code-context-banner')!;
  const codeBannerText = document.getElementById('code-banner-text')!;
  const btnClearCtx    = document.getElementById('btn-clear-context')!;
  const textarea       = document.getElementById('message-input') as HTMLTextAreaElement;
  const btnSend        = document.getElementById('btn-send') as HTMLButtonElement;
  const charCountEl    = document.getElementById('char-count')!;

  // ── Init ─────────────────────────────────────────────────
  function init() {
    bindEvents();
    vscode.postMessage({ type: 'ready' });
  }

  // ── Events ───────────────────────────────────────────────
  function bindEvents() {
    btnConfigKey.addEventListener('click', () => vscode.postMessage({ type: 'configureApiKey' }));

    linkPortal.addEventListener('click', (e: Event) => {
      e.preventDefault();
      vscode.postMessage({ type: 'openTaskUrl', url: 'https://jules.google.com' });
    });

    btnRefresh.addEventListener('click', () => {
      btnRefresh.classList.add('spinning');
      refreshTasks();
      setTimeout(() => btnRefresh.classList.remove('spinning'), 1600);
    });

    btnSettings.addEventListener('click', () => vscode.postMessage({ type: 'configureApiKey' }));

    tabBtns.forEach(btn => {
      btn.addEventListener('click', () => setTab(btn.dataset.tab as TabType));
    });

    repoSearch.addEventListener('input', () => filterSources());
    repoSelect.addEventListener('change', () => refreshTasks());

    btnClearCtx.addEventListener('click', () => clearCodeContext());

    textarea.addEventListener('input', () => {
      autoResize(textarea);
      updateSendBtn();
      updateCharCount();
    });

    textarea.addEventListener('keydown', (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        sendMessage();
      }
    });

    btnSend.addEventListener('click', sendMessage);
  }

  // ── Tabs ─────────────────────────────────────────────────
  function setTab(tab: TabType) {
    state.currentTab = tab;
    tabBtns.forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
    renderTasks();
  }

  function getFiltered(): Task[] {
    switch (state.currentTab) {
      case 'active':
        return state.allTasks.filter(t => t.status === 'pending' || t.status === 'running' || t.status === 'pendingApproval');
      case 'done':
        return state.allTasks.filter(t => t.status === 'completed' || t.status === 'failed' || t.status === 'cancelled');
      default:
        return state.allTasks;
    }
  }

  function updateTabCounts() {
    const active = state.allTasks.filter(t => t.status === 'pending' || t.status === 'running' || t.status === 'pendingApproval').length;
    const done   = state.allTasks.filter(t => t.status === 'completed' || t.status === 'failed' || t.status === 'cancelled').length;

    (document.querySelector('[data-tab="all"] .tab-count') as HTMLElement).textContent  = String(state.allTasks.length);
    (document.querySelector('[data-tab="active"] .tab-count') as HTMLElement).textContent = String(active);
    (document.querySelector('[data-tab="done"] .tab-count') as HTMLElement).textContent   = String(done);
  }

  // ── Send ─────────────────────────────────────────────────
  function sendMessage() {
    const text = textarea.value.trim();
    const repo = repoSelect.value;

    if (!text || state.isCreatingTask) return;
    if (!repo) { showError('Please select a repository first.'); return; }
    if (text.length > MAX_CHARS) { showError(`Message too long (max ${MAX_CHARS} chars).`); return; }

    vscode.postMessage({ type: 'sendMessage', text, repository: repo, codeContext: state.codeContext ?? undefined });

    const tempId = 'creating-' + Date.now();
    const tempTask: Task = {
      name: tempId,
      prompt: text,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };

    state.allTasks.unshift(tempTask);
    state.isCreatingTask = true;

    textarea.value = '';
    textarea.style.height = '';
    updateSendBtn();
    updateCharCount();
    clearCodeContext();

    if (state.currentTab === 'done') setTab('all');
    else renderTasks();

    updateTabCounts();
  }

  function refreshTasks() {
    vscode.postMessage({ type: 'refreshTasks' });
  }

  // ── Render ───────────────────────────────────────────────
  function renderTasks() {
    if (!state.isLoading) skeletonLoader.classList.add('hidden');

    tasksArea.querySelectorAll('.task-card, .empty-state, .error-toast').forEach(el => el.remove());

    const filtered = getFiltered();
    if (filtered.length === 0) {
      tasksArea.appendChild(buildEmptyState());
      return;
    }

    const frag = document.createDocumentFragment();
    filtered.forEach(t => frag.appendChild(buildCard(t)));
    tasksArea.appendChild(frag);
  }

  function buildEmptyState(): HTMLElement {
    const d = document.createElement('div');
    d.className = 'empty-state';

    const cfg: Record<TabType, { icon: string; title: string; desc: string }> = {
      all:    { icon: '🤖', title: 'No tasks yet',       desc: 'Describe a coding task and Jules will write code, fix bugs, and open pull requests.' },
      active: { icon: '✨', title: 'No active tasks',    desc: 'All tasks have finished. Send a new task to get Jules working.' },
      done:   { icon: '📋', title: 'No completed tasks', desc: 'Completed and failed tasks will appear here.' },
    };

    const c = cfg[state.currentTab];
    d.innerHTML = `
      <div class="empty-icon">${c.icon}</div>
      <div class="empty-title">${c.title}</div>
      <div class="empty-desc">${c.desc}</div>
    `;
    return d;
  }

  const STATUS_LABELS: Record<string, string> = {
    pending:        'Pending',
    running:        'Running',
    pendingApproval:'Needs Approval',
    completed:      'Completed',
    failed:         'Failed',
    cancelled:      'Cancelled',
  };

  function buildCard(task: Task): HTMLElement {
    const card = document.createElement('div');
    card.className = `task-card status-${task.status} entering`;
    card.dataset.taskId = task.name;

    const isActive          = task.status === 'pending' || task.status === 'running';
    const isPendingApproval = task.status === 'pendingApproval';
    const isCreating        = task.name.startsWith('creating-');
    const isDone            = task.status === 'completed' || task.status === 'failed' || task.status === 'cancelled';
    const hasDetails        = !!(task.pullRequestUrl || isDone || isPendingApproval);
    const timeStr           = task.createdAt ? formatTime(task.createdAt) : '';
    const statusLabel       = STATUS_LABELS[task.status] ?? task.status;
    const displayTitle      = task.title || task.prompt;

    requestAnimationFrame(() => requestAnimationFrame(() => card.classList.remove('entering')));

    card.innerHTML = `
      <div class="task-main">
        <div class="task-top">
          <span class="task-badge">
            <span class="status-dot"></span>
            ${task.status === 'running' ? '<span class="spinner"></span>' : ''}
            ${escHtml(statusLabel)}
          </span>
          <span class="task-time">${escHtml(timeStr)}</span>
          <div class="task-top-actions">
            ${(isActive || isPendingApproval) && !isCreating
              ? `<button class="icon-btn btn-cancel" title="Cancel" data-id="${escHtml(task.name)}">
                  <svg viewBox="0 0 16 16" fill="currentColor" width="11" height="11"><path d="M8 1a7 7 0 100 14A7 7 0 008 1zm3.5 9.793L10.793 11.5 8 8.707 5.207 11.5 4.5 10.793 7.293 8 4.5 5.207l.707-.707L8 7.293l2.793-2.793.707.707L8.707 8z"/></svg>
                </button>`
              : ''}
            ${hasDetails
              ? `<svg class="expand-icon" viewBox="0 0 16 16" fill="currentColor" width="12" height="12"><path d="M4 6l4 4 4-4"/></svg>`
              : ''}
          </div>
        </div>
        <div class="task-prompt">${escHtml(displayTitle)}</div>
        ${task.status === 'running'
          ? `<div class="task-progress">
              <div class="progress-track"><div class="progress-fill"></div></div>
              <span class="progress-lbl">Working…</span>
            </div>`
          : ''}
        ${isPendingApproval
          ? `<div class="task-approval-hint">Jules has generated a plan and is waiting for your approval.</div>`
          : ''}
      </div>
      ${hasDetails ? `
      <div class="task-details">
        <div class="task-action-row">
          ${isPendingApproval && !isCreating
            ? `<button class="btn-approve" data-id="${escHtml(task.name)}">
                <svg viewBox="0 0 16 16" fill="currentColor" width="12" height="12"><path d="M13.854 3.646a.5.5 0 010 .708l-7 7a.5.5 0 01-.708 0l-3.5-3.5a.5.5 0 11.708-.708L6.5 10.293l6.646-6.647a.5.5 0 01.708 0z"/></svg>
                Approve Plan
              </button>`
            : ''}
          ${task.pullRequestUrl
            ? `<button class="btn-pr" data-url="${escHtml(task.pullRequestUrl)}">
                <svg viewBox="0 0 16 16" fill="currentColor" width="12" height="12"><path fill-rule="evenodd" d="M7.177 3.073L9.573.677A.25.25 0 0110 .854v4.792a.25.25 0 01-.427.177L7.177 3.427a.25.25 0 010-.354zM3.75 2.5a.75.75 0 100 1.5.75.75 0 000-1.5zm-2.25.75a2.25 2.25 0 113 2.122v5.256a2.251 2.251 0 11-1.5 0V5.372A2.25 2.25 0 011.5 3.25zM11 2.5h-1V4h1a1 1 0 011 1v5.628a2.251 2.251 0 101.5 0V5A2.5 2.5 0 0011 2.5zm1 10.25a.75.75 0 111.5 0 .75.75 0 01-1.5 0z"/></svg>
                View Pull Request
              </button>`
            : ''}
          ${isDone && !isCreating
            ? `<button class="btn-del" data-id="${escHtml(task.name)}">
                <svg viewBox="0 0 16 16" fill="currentColor" width="11" height="11"><path d="M10 3h3v1h-1v9l-1 1H4l-1-1V4H2V3h3V2a1 1 0 011-1h3a1 1 0 011 1v1zm-6 9h8V4H4v8zm4-8a.5.5 0 01.5.5v6a.5.5 0 01-1 0v-6A.5.5 0 018 4z"/></svg>
                Remove
              </button>`
            : ''}
        </div>
      </div>` : ''}
    `;

    // Click-to-expand
    const taskMain = card.querySelector('.task-main')!;
    taskMain.addEventListener('click', (e: Event) => {
      if ((e.target as HTMLElement).closest('.btn-cancel')) return;
      if (hasDetails) card.classList.toggle('expanded');
    });

    // Cancel
    card.querySelector('.btn-cancel')?.addEventListener('click', (e: Event) => {
      e.stopPropagation();
      vscode.postMessage({ type: 'cancelTask', taskId: task.name });
    });

    // Approve plan
    card.querySelector('.btn-approve')?.addEventListener('click', (e: Event) => {
      e.stopPropagation();
      vscode.postMessage({ type: 'approvePlan', taskId: task.name });
      // Optimistic update
      task.status = 'running';
      card.className = `task-card status-running`;
      renderTasks();
    });

    // PR link
    card.querySelector('.btn-pr')?.addEventListener('click', () => {
      vscode.postMessage({ type: 'openTaskUrl', url: task.pullRequestUrl! });
    });

    // Delete
    card.querySelector('.btn-del')?.addEventListener('click', () => {
      vscode.postMessage({ type: 'deleteTask', taskId: task.name });
      state.allTasks = state.allTasks.filter(t => t.name !== task.name);
      updateTabCounts();
      renderTasks();
    });

    return card;
  }

  // ── Task state helpers ────────────────────────────────────
  function upsertTask(task: Task) {
    const idx = state.allTasks.findIndex(t => t.name === task.name);
    if (idx >= 0) {
      state.allTasks[idx] = { ...state.allTasks[idx], ...task };
    } else {
      const cIdx = state.allTasks.findIndex(t => t.name.startsWith('creating-'));
      if (cIdx >= 0) state.allTasks[cIdx] = task;
      else state.allTasks.unshift(task);
    }
    state.isCreatingTask = false;
    updateSendBtn();
  }

  function setTasksList(tasks: Task[]) {
    state.allTasks = tasks;
    state.isCreatingTask = false;
    state.isLoading = false;
    skeletonLoader.classList.add('hidden');
    updateSendBtn();
    updateTabCounts();
    renderTasks();
  }

  // ── Sources ──────────────────────────────────────────────
  function setSources(sources: Array<{ name: string; displayName: string }>) {
    state.sources = Array.isArray(sources) ? sources : [];
    filterSources();
  }

  function filterSources() {
    const q = repoSearch.value.toLowerCase();
    const filtered = state.sources.filter(s =>
      !q ||
      s.name?.toLowerCase().includes(q) ||
      s.displayName?.toLowerCase().includes(q)
    );

    repoSelect.innerHTML = '';

    if (filtered.length === 0) {
      const opt = document.createElement('option');
      opt.value = '';
      opt.textContent = state.sources.length === 0 ? 'No repositories found' : 'No matches';
      repoSelect.appendChild(opt);
      return;
    }

    const def = document.createElement('option');
    def.value = '';
    def.textContent = 'Select a repository…';
    repoSelect.appendChild(def);

    filtered.forEach(src => {
      const opt = document.createElement('option');
      opt.value = src.name;
      opt.textContent = src.displayName || src.name;
      repoSelect.appendChild(opt);
    });

    if (filtered.length === 1 && q) {
      repoSelect.selectedIndex = 1;
      refreshTasks();
    }
  }

  // ── Code context ─────────────────────────────────────────
  function setCodeContext(code: string, language: string) {
    state.codeContext = code;
    state.codeLanguage = language;
    const lines = code.split('\n').length;
    const lang  = language ? ` · ${language}` : '';
    codeBannerText.textContent = `${lines} line${lines !== 1 ? 's' : ''} attached${lang}`;
    codeBanner.classList.remove('hidden');
    textarea.focus();
  }

  function clearCodeContext() {
    state.codeContext  = null;
    state.codeLanguage = '';
    codeBanner.classList.add('hidden');
  }

  // ── UI helpers ───────────────────────────────────────────
  function showScreen(el: HTMLElement) {
    setupScreen.classList.add('hidden');
    mainScreen.classList.add('hidden');
    el.classList.remove('hidden');
  }

  function showError(msg: string) {
    const d = document.createElement('div');
    d.className = 'error-toast';
    d.innerHTML = `<span>⚠</span><span>${escHtml(msg)}</span>`;
    tasksArea.appendChild(d);
    tasksArea.scrollTop = tasksArea.scrollHeight;
    state.isCreatingTask = false;
    updateSendBtn();
    setTimeout(() => d.remove(), 8000);
  }

  function updateSendBtn() {
    const hasText = textarea.value.trim().length > 0;
    const over    = textarea.value.length > MAX_CHARS;
    btnSend.disabled = !hasText || state.isCreatingTask || over;
  }

  function updateCharCount() {
    const len = textarea.value.length;
    charCountEl.textContent = `${len} / ${MAX_CHARS}`;
    charCountEl.className = 'char-count';
    if (len > MAX_CHARS * 0.9) charCountEl.classList.add('warn');
    if (len > MAX_CHARS)       charCountEl.classList.add('over');
  }

  function autoResize(el: HTMLTextAreaElement) {
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 138) + 'px';
  }

  // ── Formatting ───────────────────────────────────────────
  function formatTime(iso: string): string {
    try {
      const diff  = Date.now() - new Date(iso).getTime();
      const mins  = Math.floor(diff / 60000);
      if (mins < 1)  return 'just now';
      if (mins < 60) return `${mins}m ago`;
      const hrs = Math.floor(mins / 60);
      if (hrs < 24)  return `${hrs}h ago`;
      const days = Math.floor(hrs / 24);
      if (days < 7)  return `${days}d ago`;
      return new Date(iso).toLocaleDateString();
    } catch { return ''; }
  }

  function escHtml(s: string | null | undefined): string {
    if (!s) return '';
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // ── Message handler ──────────────────────────────────────
  window.addEventListener('message', (event: MessageEvent) => {
    const msg = event.data;

    switch (msg.type) {
      case 'apiKeyStatus':
        state.hasApiKey = msg.hasKey;
        showScreen(msg.hasKey ? mainScreen : setupScreen);
        if (msg.hasKey && state.allTasks.length === 0) {
          state.isLoading = true;
          skeletonLoader.classList.remove('hidden');
        }
        break;

      case 'taskCreating':
        state.isCreatingTask = true;
        updateSendBtn();
        break;

      case 'taskCreated':
      case 'taskUpdated':
        upsertTask(msg.task as Task);
        updateTabCounts();
        renderTasks();
        break;

      case 'tasksList':
        setTasksList((msg.tasks ?? []) as Task[]);
        break;

      case 'sourcesList':
        setSources(msg.sources ?? []);
        break;

      case 'taskDeleted':
        state.allTasks = state.allTasks.filter((t: Task) => t.name !== msg.taskId);
        updateTabCounts();
        renderTasks();
        break;

      case 'error':
        showError(msg.message);
        break;

      case 'clearChat':
        state.allTasks = [];
        state.isCreatingTask = false;
        updateSendBtn();
        updateTabCounts();
        renderTasks();
        break;

      case 'selectedCode':
        showScreen(mainScreen);
        setCodeContext(msg.code, msg.language);
        break;
    }
  });

  init();
})();
