import * as vscode from 'vscode';
import { JulesApiClient, JulesSource, JulesTask } from './julesApiClient.js';
import { WebviewTask, WebviewSource, WebviewMessage } from './webviewTypes.js';
import { JulesChatViewProvider } from './julesProvider.js';

export function normalizeTask(task: JulesTask): WebviewTask {
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

export function normalizeSource(source: JulesSource): WebviewSource {
  let displayName: string;
  if (source.githubRepo) {
    displayName = `${source.githubRepo.owner}/${source.githubRepo.repo}`;
  } else {
    displayName = source.name.split('/').pop() ?? source.name;
  }
  return { name: source.name, displayName };
}

export async function handleSendMessage(
  provider: JulesChatViewProvider,
  apiClient: JulesApiClient,
  text: string,
  repository: string,
  codeContext?: string
): Promise<void> {
  if (!apiClient.hasApiKey()) {
    provider.postMessage({ type: 'error', message: 'Please configure your Jules API key first.' });
    return;
  }
  if (!repository) {
    provider.postMessage({ type: 'error', message: 'Please select a repository first.' });
    return;
  }

  provider.postMessage({ type: 'taskCreating' });

  try {
    const request = {
      prompt: codeContext ? `${text}\n\n\`\`\`\n${codeContext}\n\`\`\`` : text,
      sourceContext: { source: repository },
      automationMode: 'AUTO_CREATE_PR' as const,
    };
    const task = await apiClient.createTask(request);
    provider.postMessage({ type: 'taskCreated', task: normalizeTask(task) });
    provider.taskManager.startPolling(task.name);
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error occurred';
    provider.postMessage({ type: 'error', message: `Failed to create task: ${msg}` });
  }
}

export async function handleCancelTask(provider: JulesChatViewProvider, apiClient: JulesApiClient, taskId: string): Promise<void> {
  try {
    provider.taskManager.stopPolling(taskId);
    await apiClient.cancelTask(taskId);
    provider.postMessage({ type: 'taskUpdated', task: { name: taskId, status: 'cancelled' } });
    provider.taskManager.updateStatusBar();
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error occurred';
    provider.postMessage({ type: 'error', message: `Failed to cancel task: ${msg}` });
  }
}

export async function handleDeleteTask(provider: JulesChatViewProvider, apiClient: JulesApiClient, taskId: string): Promise<void> {
  try {
    provider.taskManager.stopPolling(taskId);
    await apiClient.deleteTask(taskId);
    provider.postMessage({ type: 'taskDeleted', taskId });
    provider.taskManager.updateStatusBar();
  } catch {
    // Optimistic delete already happened in the UI
  }
}
