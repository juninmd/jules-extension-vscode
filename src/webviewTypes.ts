export interface WebviewTask {
  name: string;
  id?: string;
  title?: string;
  prompt: string;
  status: string;
  createdAt?: string;
  pullRequestUrl?: string;
}

export interface WebviewSource {
  name: string;
  displayName: string;
}

export type WebviewMessage =
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
