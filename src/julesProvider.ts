import * as vscode from 'vscode';
import * as path from 'path';
import { JulesApiClient, JulesSource, JulesTask } from './julesApiClient.js';

/** Shape sent to the webview — stable regardless of API changes */
interface WebviewTask {
  name: string;
  id?: string;
  title?: string;
  prompt: string;
  status: string;
  createdAt?: string;
  pullRequestUrl?: string;
}

interface WebviewSource {
  name: string;
  displayName: string;
}

type WebviewMessage =
  | { type: 'ready' }
  | { type: 'sendMessage'; text: string; repository: string; codeContext?: string }
  | { type: 'configureApiKey' }
  | { type: 'clearChat' }
  | { type: 'cancelTask'; taskId: string }
  | { type: 'deleteTask'; taskId: string }
  | { type: 'refreshTasks' }
  | { type: 'openTaskUrl'; url: string }
  | { type: 'getTask'; taskId: string }
  | { type: 'approvePlan'; taskId: string }
  | { type: 'sendMessageToSession'; taskId: string; text: string }
  | { type: 'getActivities'; taskId: string };

export class JulesChatViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'jules.chatView';

  private webviewView?: vscode.WebviewView;
  private pollingTimers: Map<string, NodeJS.Timeout> = new Map();

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly apiClient: JulesApiClient,
    private readonly statusBarItem?: vscode.StatusBarItem
  ) {}

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    _resolverContext: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): void {
    this.webviewView = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.file(path.join(this.context.extensionPath, 'out', 'media'))
      ]
    };

    webviewView.webview.onDidReceiveMessage(
      (message: WebviewMessage) => this.handleMessage(message),
      undefined,
      this.context.subscriptions
    );

    webviewView.webview.html = this.getHtmlContent(webviewView.webview);
  }

  public notifyApiKeyChanged(hasKey: boolean): void {
    this.webviewView?.webview.postMessage({ type: 'apiKeyStatus', hasKey });
  }

  public sendSelectedCode(code: string, language: string): void {
    this.webviewView?.webview.postMessage({ type: 'selectedCode', code, language });
  }

  public clearChat(): void {
    this.webviewView?.webview.postMessage({ type: 'clearChat' });
  }

  // ── Normalization helpers ─────────────────────────────────

  private normalizeTask(task: JulesTask): WebviewTask {
    const pullRequestUrl = task.outputs?.find(o => o.pullRequest?.url)?.pullRequest?.url;
    return {
      name: task.name,
      id: task.id,
      title: task.title,
      prompt: task.prompt,
      status: task.status ?? 'running',
      createdAt: task.createdAt,
      pullRequestUrl,
    };
  }

  private normalizeSource(source: JulesSource): WebviewSource {
    let displayName: string;
    if (source.githubRepo) {
      displayName = `${source.githubRepo.owner}/${source.githubRepo.repo}`;
    } else {
      displayName = source.name.split('/').pop() ?? source.name;
    }
    return { name: source.name, displayName };
  }

  // ── Status bar ───────────────────────────────────────────

  private updateStatusBar(): void {
    if (!this.statusBarItem) return;
    const count = this.pollingTimers.size;
    if (count > 0) {
      this.statusBarItem.text = `$(sync~spin) Jules: ${count}`;
      this.statusBarItem.tooltip = `Jules AI — ${count} task${count > 1 ? 's' : ''} running`;
    } else {
      this.statusBarItem.text = `$(sparkle) Jules`;
      this.statusBarItem.tooltip = 'Jules AI — Click to open';
    }
  }

  // ── Message dispatcher ───────────────────────────────────

  private async handleMessage(message: WebviewMessage): Promise<void> {
    switch (message.type) {
      case 'ready':
        await this.apiClient.waitForInit();
        this.notifyApiKeyChanged(this.apiClient.hasApiKey());
        if (this.apiClient.hasApiKey()) {
          void this.handleRefreshTasks();
          void this.handleRefreshSources();
        }
        break;

      case 'configureApiKey':
        await vscode.commands.executeCommand('jules.configureApiKey');
        break;

      case 'sendMessage':
        await this.handleSendMessage(message.text, message.repository, message.codeContext);
        break;

      case 'clearChat':
        this.webviewView?.webview.postMessage({ type: 'clearChat' });
        break;

      case 'cancelTask':
        await this.handleCancelTask(message.taskId);
        break;

      case 'deleteTask':
        await this.handleDeleteTask(message.taskId);
        break;

      case 'refreshTasks':
        await this.handleRefreshTasks();
        break;

      case 'openTaskUrl':
        await vscode.env.openExternal(vscode.Uri.parse(message.url));
        break;

      case 'getTask':
        await this.handleGetTask(message.taskId);
        break;

      case 'approvePlan':
        await this.handleApprovePlan(message.taskId);
        break;

      case 'sendMessageToSession':
        await this.handleSendMessageToSession(message.taskId, message.text);
        break;

      case 'getActivities':
        await this.handleGetActivities(message.taskId);
        break;
    }
  }

  // ── Handlers ─────────────────────────────────────────────

  private async handleSendMessage(text: string, repository: string, codeContext?: string): Promise<void> {
    if (!this.apiClient.hasApiKey()) {
      this.webviewView?.webview.postMessage({
        type: 'error',
        message: 'Please configure your Jules API key first.'
      });
      return;
    }

    if (!repository) {
      this.webviewView?.webview.postMessage({
        type: 'error',
        message: 'Please select a repository first.'
      });
      return;
    }

    this.webviewView?.webview.postMessage({ type: 'taskCreating' });

    try {
      const request = {
        prompt: codeContext ? `${text}\n\n\`\`\`\n${codeContext}\n\`\`\`` : text,
        sourceContext: { source: repository },
        automationMode: 'AUTO_CREATE_PR' as const,
      };

      const task = await this.apiClient.createTask(request);
      const normalized = this.normalizeTask(task);

      this.webviewView?.webview.postMessage({ type: 'taskCreated', task: normalized });
      this.startPolling(task.name);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error occurred';
      this.webviewView?.webview.postMessage({ type: 'error', message: `Failed to create task: ${msg}` });
    }
  }

  private async handleCancelTask(taskId: string): Promise<void> {
    try {
      this.stopPolling(taskId);
      await this.apiClient.cancelTask(taskId);
      this.webviewView?.webview.postMessage({
        type: 'taskUpdated',
        task: { name: taskId, status: 'cancelled' }
      });
      this.updateStatusBar();
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error occurred';
      this.webviewView?.webview.postMessage({ type: 'error', message: `Failed to cancel task: ${msg}` });
    }
  }

  private async handleDeleteTask(taskId: string): Promise<void> {
    try {
      this.stopPolling(taskId);
      await this.apiClient.deleteTask(taskId);
      this.webviewView?.webview.postMessage({ type: 'taskDeleted', taskId });
      this.updateStatusBar();
    } catch {
      // Optimistic delete already happened in the UI
    }
  }

  private async handleRefreshTasks(): Promise<void> {
    if (!this.apiClient.hasApiKey()) return;
    try {
      let allTasks: WebviewTask[] = [];
      let pageToken: string | undefined;

      do {
        const response = await this.apiClient.listTasks(pageToken);
        if (response.sessions) {
          allTasks = allTasks.concat(response.sessions.map(t => this.normalizeTask(t)));
        }
        pageToken = response.nextPageToken;
      } while (pageToken);

      this.webviewView?.webview.postMessage({ type: 'tasksList', tasks: allTasks });

      for (const task of allTasks) {
        const isActive = task.status === 'pending' || task.status === 'running';
        if (isActive && !this.pollingTimers.has(task.name)) {
          this.startPolling(task.name);
        }
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      this.webviewView?.webview.postMessage({ type: 'error', message: `Failed to load tasks: ${msg}` });
      this.webviewView?.webview.postMessage({ type: 'tasksList', tasks: [] });
    }
  }

  private async handleRefreshSources(): Promise<void> {
    if (!this.apiClient.hasApiKey()) return;
    try {
      let allSources: WebviewSource[] = [];
      let pageToken: string | undefined;

      do {
        const response = await this.apiClient.listSources(pageToken);
        if (Array.isArray(response.sources)) {
          allSources = allSources.concat(response.sources.map(s => this.normalizeSource(s)));
        }
        pageToken = response.nextPageToken;
      } while (pageToken);

      this.webviewView?.webview.postMessage({ type: 'sourcesList', sources: allSources });
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      this.webviewView?.webview.postMessage({ type: 'error', message: `Failed to load repositories: ${msg}` });
      this.webviewView?.webview.postMessage({ type: 'sourcesList', sources: [] });
    }
  }

  private async handleGetTask(taskId: string): Promise<void> {
    try {
      const task = await this.apiClient.getTask(taskId);
      const normalized = this.normalizeTask(task);
      this.webviewView?.webview.postMessage({ type: 'taskUpdated', task: normalized });

      const isDone = normalized.status === 'completed' || normalized.status === 'failed' || normalized.status === 'cancelled';
      if (isDone) {
        this.stopPolling(task.name);
        this.updateStatusBar();
      }
    } catch {
      // Silently ignore
    }
  }

  private async handleApprovePlan(taskId: string): Promise<void> {
    try {
      const task = await this.apiClient.approvePlan(taskId);
      const normalized = this.normalizeTask(task);
      this.webviewView?.webview.postMessage({ type: 'taskUpdated', task: normalized });
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error occurred';
      this.webviewView?.webview.postMessage({ type: 'error', message: `Failed to approve plan: ${msg}` });
    }
  }

  private async handleSendMessageToSession(taskId: string, text: string): Promise<void> {
    try {
      const task = await this.apiClient.sendMessageToSession(taskId, text);
      const normalized = this.normalizeTask(task);
      this.webviewView?.webview.postMessage({ type: 'taskUpdated', task: normalized });
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error occurred';
      this.webviewView?.webview.postMessage({ type: 'error', message: `Failed to send message: ${msg}` });
    }
  }

  private async handleGetActivities(taskId: string): Promise<void> {
    try {
      let allActivities: unknown[] = [];
      let pageToken: string | undefined;
      do {
        const response = await this.apiClient.listActivities(taskId, pageToken);
        if (response.activities) allActivities = allActivities.concat(response.activities);
        pageToken = response.nextPageToken;
      } while (pageToken);
      this.webviewView?.webview.postMessage({ type: 'activitiesList', taskId, activities: allActivities });
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error occurred';
      this.webviewView?.webview.postMessage({ type: 'error', message: `Failed to load activities: ${msg}` });
    }
  }

  // ── Polling ───────────────────────────────────────────────

  private startPolling(taskId: string): void {
    this.stopPolling(taskId);

    const timer = setInterval(async () => {
      try {
        const task = await this.apiClient.getTask(taskId);
        const normalized = this.normalizeTask(task);
        this.webviewView?.webview.postMessage({ type: 'taskUpdated', task: normalized });

        if (normalized.status === 'completed' || normalized.status === 'failed' || normalized.status === 'cancelled') {
          this.stopPolling(task.name);
          this.updateStatusBar();

          if (normalized.status === 'completed') {
            const actions: string[] = normalized.pullRequestUrl ? ['Open PR'] : [];
            const action = await vscode.window.showInformationMessage(
              `Jules finished: "${normalized.prompt.substring(0, 50)}…"`,
              ...actions
            );
            if (action === 'Open PR' && normalized.pullRequestUrl) {
              await vscode.env.openExternal(vscode.Uri.parse(normalized.pullRequestUrl));
            }
          }
        } else if (normalized.status === 'pendingApproval') {
          vscode.window.showInformationMessage(
            `Jules is waiting for plan approval: "${normalized.prompt.substring(0, 40)}…"`,
            'Approve'
          ).then(action => {
            if (action === 'Approve') {
              void this.handleApprovePlan(task.name);
            }
          });
        }
      } catch {
        // Silently ignore polling errors
      }
    }, 5000);

    this.pollingTimers.set(taskId, timer);
    this.updateStatusBar();
  }

  private stopPolling(taskId: string): void {
    const timer = this.pollingTimers.get(taskId);
    if (timer) {
      clearInterval(timer);
      this.pollingTimers.delete(taskId);
    }
  }

  // ── HTML ─────────────────────────────────────────────────

  private getMediaUri(webview: vscode.Webview, filename: string): vscode.Uri {
    return webview.asWebviewUri(
      vscode.Uri.file(path.join(this.context.extensionPath, 'out', 'media', filename))
    );
  }

  private getHtmlContent(webview: vscode.Webview): string {
    const nonce = getNonce();
    const styleUri = this.getMediaUri(webview, 'style.css');
    const scriptUri = this.getMediaUri(webview, 'main.js');

    return /* html */`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; script-src ${webview.cspSource} 'nonce-${nonce}'; img-src ${webview.cspSource} https: data:; connect-src ${webview.cspSource};">
  <link rel="stylesheet" href="${styleUri}">
  <title>Jules AI</title>
</head>
<body>

<!-- ═══ SETUP SCREEN ═══ -->
<div id="setup-screen" class="screen">
  <div class="setup-content">
    <div class="setup-logo">
      <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="32" cy="32" r="30" fill="url(#sg)"/>
        <text x="32" y="42" text-anchor="middle" font-size="28" font-family="monospace" fill="white" font-weight="800">J</text>
        <defs>
          <linearGradient id="sg" x1="2" y1="2" x2="62" y2="62" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stop-color="#4285F4"/>
            <stop offset="100%" stop-color="#34A853"/>
          </linearGradient>
        </defs>
      </svg>
    </div>
    <h1 class="setup-title">Jules AI Agent</h1>
    <p class="setup-subtitle">Google's AI coding agent — write code, fix bugs, and open PRs automatically.</p>
    <ol class="setup-steps">
      <li class="setup-step">
        <span class="step-num">1</span>
        <span class="step-desc">Get your API key at <a href="#" id="link-portal">jules.google.com</a></span>
      </li>
      <li class="setup-step">
        <span class="step-num">2</span>
        <span class="step-desc">Click the button below to configure it securely</span>
      </li>
      <li class="setup-step">
        <span class="step-num">3</span>
        <span class="step-desc">Select a repository and start automating!</span>
      </li>
    </ol>
    <button id="btn-configure-key" class="btn btn-primary lg">
      <svg viewBox="0 0 16 16" fill="currentColor" width="14" height="14"><path d="M11.5 1a4.5 4.5 0 011.563 8.71l.407.406a.5.5 0 010 .707l-.5.5a.5.5 0 01-.707 0l-.375-.376-.375.376a.5.5 0 01-.707 0l-.5-.5a.5.5 0 010-.707l.406-.407A4.5 4.5 0 1111.5 1zm0 1.5a3 3 0 100 6 3 3 0 000-6zm0 1.5a1.5 1.5 0 110 3 1.5 1.5 0 010-3z"/></svg>
      Configure API Key
    </button>
  </div>
</div>

<!-- ═══ MAIN SCREEN ═══ -->
<div id="main-screen" class="screen hidden">

  <!-- Header -->
  <header class="header">
    <div class="header-brand">
      <svg class="brand-logo" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="12" cy="12" r="11" fill="url(#hg)"/>
        <text x="12" y="16.5" text-anchor="middle" font-size="11" font-family="monospace" fill="white" font-weight="800">J</text>
        <defs>
          <linearGradient id="hg" x1="1" y1="1" x2="23" y2="23" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stop-color="#4285F4"/>
            <stop offset="100%" stop-color="#34A853"/>
          </linearGradient>
        </defs>
      </svg>
      <span class="brand-name">Jules</span>
      <span class="brand-badge">AI</span>
    </div>
    <div class="header-actions">
      <button class="icon-btn" id="btn-refresh" title="Refresh tasks">
        <svg viewBox="0 0 16 16" fill="currentColor" width="14" height="14"><path d="M13.451 5.609l-.808-.588C11.584 3.601 9.895 2.75 8 2.75c-2.757 0-5.116 1.814-5.855 4.385l-.014.054a5.15 5.15 0 00-.132 1.138C2.0 11.177 4.797 14 8.25 14c1.491 0 2.836-.594 3.806-1.553l.813.836A6.389 6.389 0 018.25 15.5C4.248 15.5 1 12.266 1 8.25c0-.49.058-.964.167-1.418C1.93 3.98 4.793 1.5 8.25 1.5c2.207 0 4.17 1.043 5.422 2.658l.779-.566v3.017z"/></svg>
      </button>
      <button class="icon-btn" id="btn-settings" title="Configure API Key">
        <svg viewBox="0 0 16 16" fill="currentColor" width="14" height="14"><path d="M9.1 4.4L8.6 2H7.4l-.5 2.4-.7.3-2-1.3-.9.8 1.3 2-.2.7-2.4.5v1.2l2.4.5.3.8-1.3 2 .8.8 2-1.3.8.3.4 2.3h1.2l.5-2.4.8-.3 2 1.3.8-.8-1.3-2 .3-.8 2.3-.4V7.4l-2.4-.5-.3-.8 1.3-2-.8-.8-2 1.3-.7-.2zM8 10a2 2 0 110-4 2 2 0 010 4z"/></svg>
      </button>
    </div>
  </header>

  <!-- Repo Zone -->
  <div class="repo-zone">
    <span class="repo-label">Repository</span>
    <div class="repo-search-wrap">
      <svg viewBox="0 0 16 16" fill="currentColor" width="12" height="12"><path d="M11.742 10.344a6.5 6.5 0 10-1.397 1.398h-.001c.03.04.062.078.098.115l3.85 3.85a1 1 0 001.415-1.414l-3.85-3.85a1.007 1.007 0 00-.115-.1zM12 6.5a5.5 5.5 0 11-11 0 5.5 5.5 0 0111 0z"/></svg>
      <input type="text" id="repo-search" class="repo-search" placeholder="Filter repositories…" autocomplete="off">
    </div>
    <div class="repo-select-wrap">
      <select id="repo-select" class="repo-select">
        <option value="">Loading repositories…</option>
      </select>
      <svg class="repo-caret" viewBox="0 0 16 16" fill="currentColor" width="10" height="10"><path d="M4 6l4 4 4-4"/></svg>
    </div>
  </div>

  <!-- Filter Tabs -->
  <div class="filter-tabs" role="tablist">
    <button class="tab-btn active" role="tab" data-tab="all">All <span class="tab-count">0</span></button>
    <button class="tab-btn" role="tab" data-tab="active">Active <span class="tab-count">0</span></button>
    <button class="tab-btn" role="tab" data-tab="done">Done <span class="tab-count">0</span></button>
  </div>

  <!-- Tasks Area -->
  <div id="tasks-area" class="tasks-area">
    <div id="skeleton-loader" class="skeleton-wrap hidden">
      <div class="task-skeleton">
        <div class="skel w40 h8"></div>
        <div class="skel w80"></div>
        <div class="skel w60"></div>
      </div>
      <div class="task-skeleton">
        <div class="skel w40 h8"></div>
        <div class="skel w80"></div>
      </div>
      <div class="task-skeleton">
        <div class="skel w40 h8"></div>
        <div class="skel w80"></div>
        <div class="skel w60"></div>
      </div>
    </div>
  </div>

  <!-- Code Context Banner -->
  <div id="code-context-banner" class="code-banner hidden">
    <svg viewBox="0 0 16 16" fill="currentColor" width="13" height="13" style="flex-shrink:0;opacity:0.7"><path d="M4.5 9a3.5 3.5 0 100 7h7a3.5 3.5 0 100-7h-7zm7 6h-7a2.5 2.5 0 010-5h7a2.5 2.5 0 010 5z"/><path d="M4.5 3a3.5 3.5 0 100 7h7a3.5 3.5 0 100-7h-7zm7 6h-7a2.5 2.5 0 010-5h7a2.5 2.5 0 010 5z"/></svg>
    <span id="code-banner-text" class="code-banner-text">Code attached</span>
    <button id="btn-clear-context" class="code-banner-clear" title="Remove code context">✕</button>
  </div>

  <!-- Input Zone -->
  <div class="input-zone">
    <div class="input-wrap">
      <textarea
        id="message-input"
        class="message-textarea"
        placeholder="Describe a task for Jules… (e.g. 'Fix the null pointer exception in UserService')"
        rows="3"
      ></textarea>
      <button id="btn-send" class="btn-send" title="Send (Ctrl+Enter)" disabled>
        <svg viewBox="0 0 16 16" fill="currentColor" width="14" height="14"><path d="M1.5 1.5l13 6.5-13 6.5V9.5l9-2.5-9-2.5V1.5z"/></svg>
      </button>
    </div>
    <div class="input-footer">
      <span id="char-count" class="char-count">0 / 2000</span>
      <span class="input-hint"><kbd>Ctrl</kbd>+<kbd>Enter</kbd> to send</span>
    </div>
  </div>

</div>

<script type="module" nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
  }
}

function getNonce(): string {
  let text = '';
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) text += chars.charAt(Math.floor(Math.random() * chars.length));
  return text;
}
