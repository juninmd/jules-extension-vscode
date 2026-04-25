import * as vscode from 'vscode';
import * as path from 'path';
import { JulesApiClient, JulesSource, JulesTask } from './julesApiClient.js';
import { WebviewTask, WebviewSource, WebviewMessage } from './webviewTypes.js';
import { getHtmlContent } from './webviewHtml.js';
import { JulesMessageHandler } from './julesMessageHandler.js';
import { JulesTaskManager } from './julesTaskManager.js';

export class JulesChatViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'jules.chatView';

  private webviewView?: vscode.WebviewView;
  private messageHandler: JulesMessageHandler;
  public taskManager: JulesTaskManager;

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly apiClient: JulesApiClient,
    public readonly statusBarItem?: vscode.StatusBarItem
  ) {
    this.taskManager = new JulesTaskManager(this.apiClient, this);
    this.messageHandler = new JulesMessageHandler(this.apiClient, this);
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

    webviewView.webview.onDidReceiveMessage(
      (message: WebviewMessage) => this.messageHandler.handleMessage(message),
      undefined,
      this.context.subscriptions
    );

    webviewView.webview.html = getHtmlContent(webviewView.webview, this.context.extensionPath);
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

  public postMessage(message: any): void {
    this.webviewView?.webview.postMessage(message);
  }
}
