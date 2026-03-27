import * as vscode from 'vscode';
import { JulesApiClient } from './julesApiClient';

export type WebviewMessage =
  | { type: 'sendMessage'; text: string; codeContext?: string }
  | { type: 'configureApiKey' }
  | { type: 'clearChat' }
  | { type: 'cancelTask'; taskId: string }
  | { type: 'refreshTasks' }
  | { type: 'openTaskUrl'; url: string }
  | { type: 'getTask'; taskId: string };

export class JulesMessageHandler {
  constructor(
    private readonly apiClient: JulesApiClient,
    private readonly getWebviewView: () => vscode.WebviewView | undefined,
    private readonly startPolling: (taskId: string) => void,
    private readonly stopPolling: (taskId: string) => void
  ) {}

  public async handleMessage(message: WebviewMessage): Promise<void> {
    switch (message.type) {
      case 'configureApiKey':
        await vscode.commands.executeCommand('jules.configureApiKey');
        break;
      case 'sendMessage':
        await this.handleSendMessage(message.text, message.codeContext);
        break;
      case 'clearChat':
        this.getWebviewView()?.webview.postMessage({ type: 'clearChat' });
        break;
      case 'cancelTask':
        await this.handleCancelTask(message.taskId);
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
    }
  }

  private async handleSendMessage(text: string, codeContext?: string): Promise<void> {
    if (!this.apiClient.hasApiKey()) {
      this.getWebviewView()?.webview.postMessage({
        type: 'error',
        message: 'Please configure your Jules API key first.'
      });
      return;
    }

    this.getWebviewView()?.webview.postMessage({ type: 'taskCreating' });

    try {
      const task = await this.apiClient.createTask({
        title: text.substring(0, 100),
        description: text,
        codeContext: codeContext
      });

      this.getWebviewView()?.webview.postMessage({
        type: 'taskCreated',
        task
      });

      this.startPolling(task.id);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error occurred';
      this.getWebviewView()?.webview.postMessage({
        type: 'error',
        message: `Failed to create task: ${message}`
      });
    }
  }

  private async handleCancelTask(taskId: string): Promise<void> {
    try {
      this.stopPolling(taskId);
      await this.apiClient.cancelTask(taskId);
      this.getWebviewView()?.webview.postMessage({
        type: 'taskUpdated',
        task: { id: taskId, status: 'cancelled' }
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error occurred';
      this.getWebviewView()?.webview.postMessage({
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
      this.getWebviewView()?.webview.postMessage({
        type: 'tasksList',
        tasks: response.tasks
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error occurred';
      this.getWebviewView()?.webview.postMessage({
        type: 'error',
        message: `Failed to fetch tasks: ${message}`
      });
    }
  }

  private async handleGetTask(taskId: string): Promise<void> {
    try {
      const task = await this.apiClient.getTask(taskId);
      this.getWebviewView()?.webview.postMessage({
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
}
