import * as vscode from 'vscode';
import * as path from 'path';
import * as crypto from 'node:crypto';
import { JulesApiClient } from './julesApiClient';

type WebviewMessage =
  | { type: 'sendMessage'; text: string; codeContext?: string }
  | { type: 'configureApiKey' }
  | { type: 'clearChat' }
  | { type: 'cancelTask'; taskId: string }
  | { type: 'refreshTasks' }
  | { type: 'openTaskUrl'; url: string }
  | { type: 'getTask'; taskId: string };

export class JulesChatViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'jules.chatView';

  private webviewView?: vscode.WebviewView;
  private pollingTimers: Map<string, NodeJS.Timeout> = new Map();

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly apiClient: JulesApiClient
  ) {}

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    _resolverContext: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): void {
    this.webviewView = webviewView;

    webviewView.webview.options = {
      enableScripts: true, // NOSONAR
      localResourceRoots: [
        vscode.Uri.file(path.join(this.context.extensionPath, 'out', 'media'))
      ]
    };

    webviewView.webview.html = this.getHtmlContent(webviewView.webview); // NOSONAR

    webviewView.webview.onDidReceiveMessage(
      (message: WebviewMessage) => this.handleMessage(message),
      undefined,
      this.context.subscriptions
    );

    // Check if API key is configured and notify the webview
    void this.apiClient.waitForInit().then(() => {
      this.notifyApiKeyChanged(this.apiClient.hasApiKey());
    });
  }

  public notifyApiKeyChanged(hasKey: boolean): void {
    this.webviewView?.webview.postMessage({
      type: 'apiKeyStatus',
      hasKey
    });
  }

  public sendSelectedCode(code: string, language: string): void {
    this.webviewView?.webview.postMessage({
      type: 'selectedCode',
      code,
      language
    });
  }

  public clearChat(): void {
    this.webviewView?.webview.postMessage({ type: 'clearChat' });
  }

  private async handleMessage(message: WebviewMessage): Promise<void> {
    switch (message.type) {
      case 'configureApiKey':
        await vscode.commands.executeCommand('jules.configureApiKey');
        break;

      case 'sendMessage':
        await this.handleSendMessage(message.text, message.codeContext);
        break;

      case 'clearChat':
        this.webviewView?.webview.postMessage({ type: 'clearChat' });
        break;

      case 'cancelTask':
        await this.handleCancelTask(message.taskId);
        break;

      case 'refreshTasks':
        await this.handleRefreshTasks();
        break;

      case 'openTaskUrl':
        await vscode.env.openExternal(vscode.Uri.parse(message.url)); // NOSONAR
        break;

      case 'getTask':
        await this.handleGetTask(message.taskId);
        break;
    }
  }

  private async handleSendMessage(text: string, codeContext?: string): Promise<void> {
    if (!this.apiClient.hasApiKey()) {
      this.webviewView?.webview.postMessage({
        type: 'error',
        message: 'Please configure your Jules API key first.'
      });
      return;
    }

    this.webviewView?.webview.postMessage({ type: 'taskCreating' });

    try {
      const task = await this.apiClient.createTask({
        title: text.substring(0, 100),
        description: text,
        codeContext: codeContext
      });

      this.webviewView?.webview.postMessage({
        type: 'taskCreated',
        task
      });

      // Start polling for task status
      this.startPolling(task.id);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error occurred';
      this.webviewView?.webview.postMessage({
        type: 'error',
        message: `Failed to create task: ${message}`
      });
    }
  }

  private async handleCancelTask(taskId: string): Promise<void> {
    try {
      this.stopPolling(taskId);
      await this.apiClient.cancelTask(taskId);
      this.webviewView?.webview.postMessage({
        type: 'taskUpdated',
        task: { id: taskId, status: 'cancelled' }
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error occurred';
      this.webviewView?.webview.postMessage({
        type: 'error',
        message: `Failed to cancel task: ${message}`
      });
    }
  }

  private async handleRefreshTasks(): Promise<void> {
    if (!this.apiClient.hasApiKey()) {
      return;
    }
    try {
      const response = await this.apiClient.listTasks();
      this.webviewView?.webview.postMessage({
        type: 'tasksList',
        tasks: response.tasks
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error occurred';
      this.webviewView?.webview.postMessage({
        type: 'error',
        message: `Failed to fetch tasks: ${message}`
      });
    }
  }

  private async handleGetTask(taskId: string): Promise<void> {
    try {
      const task = await this.apiClient.getTask(taskId);
      this.webviewView?.webview.postMessage({
        type: 'taskUpdated',
        task
      });
      if (task.status === 'completed' || task.status === 'failed' || task.status === 'cancelled') {
        this.stopPolling(taskId);
      }
    } catch (error) {
      // Silently ignore polling errors
    }
  }

  private startPolling(taskId: string): void {
    this.stopPolling(taskId);
    const timer = setInterval(async () => {
      try {
        const task = await this.apiClient.getTask(taskId);
        this.webviewView?.webview.postMessage({
          type: 'taskUpdated',
          task
        });
        if (task.status === 'completed' || task.status === 'failed' || task.status === 'cancelled') {
          this.stopPolling(taskId);
          if (task.status === 'completed') {
            const actions: string[] = [];
            if (task.pullRequestUrl) {
              actions.push('Open PR');
            }
            void vscode.window.showInformationMessage(
              `✅ Jules task "${task.title}" completed!`,
              ...actions
            ).then((action) => {
              if (action === 'Open PR' && task.pullRequestUrl) {
                void vscode.env.openExternal(vscode.Uri.parse(task.pullRequestUrl));
              }
            });
          }
        }
      } catch {
        // Silently ignore polling errors
      }
    }, 5000);

    this.pollingTimers.set(taskId, timer);
  }

  private stopPolling(taskId: string): void {
    const timer = this.pollingTimers.get(taskId);
    if (timer) {
      clearInterval(timer);
      this.pollingTimers.delete(taskId);
    }
  }

  private getMediaUri(webview: vscode.Webview, filename: string): vscode.Uri {
    const mediaPath = path.join(this.context.extensionPath, 'out', 'media', filename);
    return webview.asWebviewUri(vscode.Uri.file(mediaPath));
  }

  private getHtmlContent(webview: vscode.Webview): string {
    const nonce = getNonce();
    const styleUri = this.getMediaUri(webview, 'style.css');
    const scriptUri = this.getMediaUri(webview, 'main.js');

    return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; script-src 'nonce-${nonce}'; img-src ${webview.cspSource} https: data:;">
  <link rel="stylesheet" href="${styleUri}">
  <title>Jules AI</title>
</head>
<body>
  <!-- Setup Screen -->
  <div id="setup-screen" class="screen hidden">
    <div class="setup-container">
      <div class="setup-logo">
        <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="24" cy="24" r="22" fill="url(#grad1)" />
          <text x="24" y="30" text-anchor="middle" font-size="20" font-family="monospace" fill="white" font-weight="bold">J</text>
          <defs>
            <linearGradient id="grad1" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stop-color="#4285F4"/>
              <stop offset="100%" stop-color="#0F9D58"/>
            </linearGradient>
          </defs>
        </svg>
      </div>
      <h1 class="setup-title">Jules AI Agent</h1>
      <p class="setup-subtitle">Your AI coding assistant from Google, right inside VS Code.</p>
      <div class="setup-steps">
        <div class="setup-step">
          <span class="step-number">1</span>
          <span class="step-text">Get your API key from <a href="#" class="link" id="link-portal">jules.google</a></span>
        </div>
        <div class="setup-step">
          <span class="step-number">2</span>
          <span class="step-text">Click the button below to configure it</span>
        </div>
        <div class="setup-step">
          <span class="step-number">3</span>
          <span class="step-text">Start automating your coding tasks!</span>
        </div>
      </div>
      <button id="btn-configure-key" class="btn btn-primary btn-large">
        <svg viewBox="0 0 16 16" fill="currentColor" width="16" height="16"><path d="M8 1a7 7 0 100 14A7 7 0 008 1zm0 1.5a5.5 5.5 0 110 11 5.5 5.5 0 010-11zM7 5h2v4H7zm0 5h2v2H7z"/></svg>
        Configure API Key
      </button>
    </div>
  </div>

  <!-- Main Chat Screen -->
  <div id="main-screen" class="screen hidden">
    <!-- Header -->
    <div class="header">
      <div class="header-title">
        <svg class="header-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="12" cy="12" r="11" fill="url(#hgrad)"/>
          <text x="12" y="16" text-anchor="middle" font-size="11" font-family="monospace" fill="white" font-weight="bold">J</text>
          <defs>
            <linearGradient id="hgrad" x1="0" y1="0" x2="24" y2="24" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stop-color="#4285F4"/>
              <stop offset="100%" stop-color="#0F9D58"/>
            </linearGradient>
          </defs>
        </svg>
        <span>Jules AI</span>
      </div>
      <div class="header-actions">
        <button class="icon-btn" id="btn-refresh" title="Refresh Tasks">
          <svg viewBox="0 0 16 16" fill="currentColor" width="14" height="14"><path d="M13.451 5.609l-.808-.588C11.584 3.601 9.895 2.75 8 2.75c-2.757 0-5.116 1.814-5.855 4.385l-.014.054a5.15 5.15 0 00-.132 1.138c0 2.85 2.297 5.162 5.125 5.162 1.481 0 2.806-.594 3.776-1.553l.813.836A6.389 6.389 0 018.124 14.5C4.68 14.5 1.876 11.71 1.876 8.278c0-.49.058-.964.167-1.418C2.81 3.88 5.238 1.5 8.25 1.5c2.125 0 3.998 1.047 5.16 2.649l.806-.588v3.152l-0.765-1.104z"/></svg>
        </button>
        <button class="icon-btn" id="btn-clear" title="Clear Chat">
          <svg viewBox="0 0 16 16" fill="currentColor" width="14" height="14"><path d="M10 3h3v1h-1v9l-1 1H4l-1-1V4H2V3h3V2a1 1 0 011-1h3a1 1 0 011 1v1zm-6 9h8V4H4v8zm4-8a.5.5 0 01.5.5v6a.5.5 0 01-1 0v-6A.5.5 0 018 4z"/></svg>
        </button>
        <button class="icon-btn" id="btn-settings" title="Configure API Key">
          <svg viewBox="0 0 16 16" fill="currentColor" width="14" height="14"><path d="M9.1 4.4L8.6 2H7.4l-.5 2.4-.7.3-2-1.3-.9.8 1.3 2-.2.7-2.4.5v1.2l2.4.5.3.8-1.3 2 .8.8 2-1.3.8.3.4 2.3h1.2l.5-2.4.8-.3 2 1.3.8-.8-1.3-2 .3-.8 2.3-.4V7.4l-2.4-.5-.3-.8 1.3-2-.8-.8-2 1.3-.7-.2zM8 10a2 2 0 110-4 2 2 0 010 4z"/></svg>
        </button>
      </div>
    </div>

    <!-- Tasks Area -->
    <div id="tasks-area" class="tasks-area">
      <!-- Welcome message -->
      <div id="welcome-msg" class="welcome-message">
        <div class="welcome-icon">🤖</div>
        <p>Hi! I'm Jules, your AI coding agent.</p>
        <p class="welcome-subtitle">Describe a coding task and I'll handle it for you — writing code, fixing bugs, creating PRs, and more.</p>
      </div>
    </div>

    <!-- Code Context Banner -->
    <div id="code-context-banner" class="code-context-banner hidden">
      <span id="code-context-label">📎 Code selected</span>
      <button id="btn-clear-context" class="clear-context-btn">✕</button>
    </div>

    <!-- Input Area -->
    <div class="input-area">
      <div class="input-wrapper">
        <textarea
          id="message-input"
          class="message-input"
          placeholder="Describe a coding task for Jules... (e.g., 'Fix the null pointer exception in UserService.java')"
          rows="3"
        ></textarea>
        <button id="btn-send" class="btn-send" title="Send (Ctrl+Enter)">
          <svg viewBox="0 0 16 16" fill="currentColor" width="16" height="16"><path d="M1.5 1.5l13 6.5-13 6.5V9.5l9-2.5-9-2.5V1.5z"/></svg>
        </button>
      </div>
      <div class="input-hint">Press <kbd>Ctrl</kbd>+<kbd>Enter</kbd> to send</div>
    </div>
  </div>

  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
  }
}

function getNonce(): string {
  return crypto.randomBytes(16).toString('hex'); // NOSONAR
}
