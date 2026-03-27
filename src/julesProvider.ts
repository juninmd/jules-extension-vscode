import * as vscode from 'vscode';
import * as path from 'path';
import { JulesApiClient } from './julesApiClient';
import { getHtmlContent } from './julesWebviewHtml';
import { JulesMessageHandler, WebviewMessage } from './julesMessageHandler';

export class JulesChatViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'jules.chatView';

  private webviewView?: vscode.WebviewView;
  private pollingTimers: Map<string, NodeJS.Timeout> = new Map();
  private messageHandler: JulesMessageHandler;

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly apiClient: JulesApiClient
  ) {
    this.messageHandler = new JulesMessageHandler(
      apiClient,
      () => this.webviewView,
      (taskId) => this.startPolling(taskId),
      (taskId) => this.stopPolling(taskId)
    );
  }

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

    webviewView.webview.html = getHtmlContent(webviewView.webview, this.context);

    webviewView.webview.onDidReceiveMessage(
      (message: WebviewMessage) => this.messageHandler.handleMessage(message),
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
      } catch (error) {
        console.debug('Polling error ignored:', error);
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
}
