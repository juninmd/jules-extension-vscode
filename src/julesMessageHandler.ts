import * as vscode from 'vscode';
import { JulesApiClient } from './julesApiClient.js';
import { WebviewTask, WebviewSource, WebviewMessage } from './webviewTypes.js';
import { JulesChatViewProvider } from './julesProvider.js';
import {
  normalizeTask,
  normalizeSource,
  handleSendMessage,
  handleCancelTask,
  handleDeleteTask
} from './julesMessageHandlers.js';

export class JulesMessageHandler {
  private sourcesCache: { data: WebviewSource[], timestamp: number } | null = null;
  private readonly CACHE_TTL = 5 * 60 * 1000;

  constructor(private readonly apiClient: JulesApiClient, private readonly provider: JulesChatViewProvider) {}

  public async handleMessage(message: WebviewMessage): Promise<void> {
    switch (message.type) {
      case 'ready':
        await this.apiClient.waitForInit();
        this.provider.notifyApiKeyChanged(this.apiClient.hasApiKey());
        if (this.apiClient.hasApiKey()) {
          void Promise.all([this.handleRefreshTasks(true), this.handleRefreshSources()]);
        }
        break;
      case 'configureApiKey':
        await vscode.commands.executeCommand('jules.configureApiKey');
        break;
      case 'sendMessage':
        await handleSendMessage(this.provider, this.apiClient, message.text, message.repository, message.codeContext);
        break;
      case 'clearChat':
        this.provider.clearChat();
        break;
      case 'cancelTask':
        await handleCancelTask(this.provider, this.apiClient, message.taskId);
        break;
      case 'deleteTask':
        await handleDeleteTask(this.provider, this.apiClient, message.taskId);
        break;
      case 'refreshTasks':
        await this.handleRefreshTasks(false);
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

  private async handleRefreshTasks(firstPageOnly: boolean = false): Promise<void> {
    if (!this.apiClient.hasApiKey()) return;
    try {
      let allTasks: WebviewTask[] = [];
      let pageToken: string | undefined;
      do {
        const response = await this.apiClient.listTasks(pageToken, 20);
        if (response.sessions) allTasks = allTasks.concat(response.sessions.map(normalizeTask));
        pageToken = response.nextPageToken;
        if (firstPageOnly) break;
      } while (pageToken);

      this.provider.postMessage({ type: 'tasksList', tasks: allTasks });

      for (const task of allTasks) {
        const isActive = task.status === 'pending' || task.status === 'running';
        if (isActive && !this.provider.taskManager.isPolling(task.name)) {
          this.provider.taskManager.startPolling(task.name);
        }
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      this.provider.postMessage({ type: 'error', message: `Failed to load tasks: ${msg}` });
      this.provider.postMessage({ type: 'tasksList', tasks: [] });
    }
  }

  private async handleRefreshSources(): Promise<void> {
    if (!this.apiClient.hasApiKey()) return;
    if (this.sourcesCache && (Date.now() - this.sourcesCache.timestamp < this.CACHE_TTL)) {
      this.provider.postMessage({ type: 'sourcesList', sources: this.sourcesCache.data });
      return;
    }

    try {
      let allSources: WebviewSource[] = [];
      let pageToken: string | undefined;
      do {
        const response = await this.apiClient.listSources(pageToken);
        if (Array.isArray(response.sources)) allSources = allSources.concat(response.sources.map(normalizeSource));
        pageToken = response.nextPageToken;
      } while (pageToken);

      this.sourcesCache = { data: allSources, timestamp: Date.now() };
      this.provider.postMessage({ type: 'sourcesList', sources: allSources });
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      this.provider.postMessage({ type: 'error', message: `Failed to load repositories: ${msg}` });
      this.provider.postMessage({ type: 'sourcesList', sources: [] });
    }
  }

  private async handleGetTask(taskId: string): Promise<void> {
    try {
      const task = await this.apiClient.getTask(taskId);
      const normalized = normalizeTask(task);
      this.provider.postMessage({ type: 'taskUpdated', task: normalized });
      const isDone = normalized.status === 'completed' || normalized.status === 'failed' || normalized.status === 'cancelled';
      if (isDone) {
        this.provider.taskManager.stopPolling(task.name);
        this.provider.taskManager.updateStatusBar();
      }
    } catch { }
  }

  private async handleApprovePlan(taskId: string): Promise<void> {
    try {
      const task = await this.apiClient.approvePlan(taskId);
      this.provider.postMessage({ type: 'taskUpdated', task: normalizeTask(task) });
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      this.provider.postMessage({ type: 'error', message: `Failed to approve plan: ${msg}` });
    }
  }

  private async handleSendMessageToSession(taskId: string, text: string): Promise<void> {
    try {
      const task = await this.apiClient.sendMessageToSession(taskId, text);
      this.provider.postMessage({ type: 'taskUpdated', task: normalizeTask(task) });
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      this.provider.postMessage({ type: 'error', message: `Failed to send message: ${msg}` });
    }
  }

  private async handleGetActivities(taskId: string): Promise<void> {
    try {
      let activities: unknown[] = [];
      let pageToken: string | undefined;
      do {
        const response = await this.apiClient.listActivities(taskId, pageToken);
        if (response.activities) activities = activities.concat(response.activities);
        pageToken = response.nextPageToken;
      } while (pageToken);
      this.provider.postMessage({ type: 'activitiesList', taskId, activities });
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      this.provider.postMessage({ type: 'error', message: `Failed to load activities: ${msg}` });
    }
  }
}
