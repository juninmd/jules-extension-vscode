import * as vscode from 'vscode';
import { JulesApiClient, JulesTask } from './julesApiClient.js';
import { WebviewTask } from './webviewTypes.js';
import { JulesChatViewProvider } from './julesProvider.js';

export class JulesTaskManager {
  private pollingTimers: Map<string, NodeJS.Timeout> = new Map();
  private approvalNotified: Set<string> = new Set();

  constructor(
    private readonly apiClient: JulesApiClient,
    private readonly provider: JulesChatViewProvider
  ) {}

  public isPolling(taskId: string): boolean {
    return this.pollingTimers.has(taskId);
  }

  public updateStatusBar(): void {
    if (!this.provider.statusBarItem) return;
    const count = this.pollingTimers.size;
    if (count > 0) {
      this.provider.statusBarItem.text = `$(sync~spin) Jules: ${count}`;
      this.provider.statusBarItem.tooltip = `Jules AI — ${count} task${count > 1 ? 's' : ''} running`;
    } else {
      this.provider.statusBarItem.text = `$(sparkle) Jules`;
      this.provider.statusBarItem.tooltip = 'Jules AI — Click to open';
    }
  }

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

  public startPolling(taskId: string): void {
    this.stopPolling(taskId);

    const timer = setInterval(async () => {
      try {
        const task = await this.apiClient.getTask(taskId);
        const normalized = this.normalizeTask(task);
        this.provider.postMessage({ type: 'taskUpdated', task: normalized });

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
          if (!this.approvalNotified.has(task.name)) {
            this.approvalNotified.add(task.name);
            this.promptPlanApproval(task.name, normalized.prompt);
          }
        } else {
          this.approvalNotified.delete(task.name);
        }
      } catch {
        // Silently ignore polling errors
      }
    }, 5000);

    this.pollingTimers.set(taskId, timer);
    this.updateStatusBar();
  }

  private promptPlanApproval(taskName: string, prompt: string): void {
    void vscode.window.showInformationMessage(
      `Jules is waiting for plan approval: "${prompt.substring(0, 40)}…"`,
      'Approve'
    ).then(async action => {
      if (action !== 'Approve') return;
      try {
        const approvedTask = await this.apiClient.approvePlan(taskName);
        this.provider.postMessage({ type: 'taskUpdated', task: this.normalizeTask(approvedTask) });
      } catch (error) {
        void vscode.window.showErrorMessage(`Jules: failed to approve plan (${String(error)})`);
      }
    });
  }

  public stopPolling(taskId: string): void {
    const timer = this.pollingTimers.get(taskId);
    if (timer) {
      clearInterval(timer);
      this.pollingTimers.delete(taskId);
    }
    this.approvalNotified.delete(taskId);
  }
}
