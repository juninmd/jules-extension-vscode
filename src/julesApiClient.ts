import * as vscode from 'vscode';
import {
  JulesSource,
  ListSourcesResponse,
  JulesTask,
  ListTasksResponse,
  ListActivitiesResponse,
  CreateTaskRequest
} from './julesApiTypes.js';

export * from './julesApiTypes.js'; // Re-export for dependents

export class JulesApiClient {
  private apiKey: string = '';
  private baseUrl: string = 'https://jules.googleapis.com/v1alpha';
  private keyLoaded: Promise<void>;

  constructor(private readonly context: vscode.ExtensionContext) {
    this.keyLoaded = this.loadConfig();
  }

  private async loadConfig(): Promise<void> {
    const config = vscode.workspace.getConfiguration('jules');
    this.baseUrl = config.get<string>('apiBaseUrl') ?? 'https://jules.googleapis.com/v1alpha';

    try {
      const key = await this.context.secrets.get('jules.apiKey');
      if (key) {
        this.apiKey = key;
      }
    } catch {
      // Ignore errors during initialization
    }
  }

  public async waitForInit(): Promise<void> {
    await this.keyLoaded;
  }

  public setApiKey(key: string): void {
    this.apiKey = key;
  }

  public hasApiKey(): boolean {
    return this.apiKey.trim().length > 0;
  }

  private getHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': this.apiKey,
    };
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const url = `${this.baseUrl}${path}`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 60000);

    const options: RequestInit = {
      method,
      headers: this.getHeaders(),
      signal: controller.signal,
    };

    if (body !== undefined) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options).finally(() => clearTimeout(timer));

    if (!response.ok) {
      let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
      try {
        const errorBody = await response.json() as { error?: { message?: string } };
        if (errorBody?.error?.message) {
          errorMessage = errorBody.error.message;
        }
      } catch {
        // Use default error message
      }

      if (response.status === 401) {
        throw new Error('Invalid API key. Please configure a valid Jules API key.');
      }
      if (response.status === 403) {
        throw new Error('Access denied. Check your Jules API key permissions.');
      }
      if (response.status === 429) {
        throw new Error('Rate limit exceeded. Please wait before making more requests.');
      }

      throw new Error(errorMessage);
    }

    if (response.status === 204) {
      return undefined as T;
    }

    return response.json() as Promise<T>;
  }

  public async listSources(pageToken?: string): Promise<ListSourcesResponse> {
    const query = pageToken ? `?pageToken=${encodeURIComponent(pageToken)}` : '';
    return this.request<ListSourcesResponse>('GET', `/sources${query}`);
  }

  public async createTask(request: CreateTaskRequest): Promise<JulesTask> {
    return this.request<JulesTask>('POST', '/sessions', request);
  }

  public async listTasks(pageToken?: string, pageSize?: number): Promise<ListTasksResponse> {
    const params = new URLSearchParams();
    if (pageToken) params.append('pageToken', pageToken);
    if (pageSize) params.append('pageSize', String(pageSize));
    const query = params.toString() ? `?${params.toString()}` : '';
    return this.request<ListTasksResponse>('GET', `/sessions${query}`);
  }

  public async getTask(sessionId: string): Promise<JulesTask> {
    const path = sessionId.startsWith('sessions/') ? `/${sessionId}` : `/sessions/${sessionId}`;
    return this.request<JulesTask>('GET', path);
  }

  public async approvePlan(sessionId: string): Promise<JulesTask> {
    const path = sessionId.startsWith('sessions/') ? `/${sessionId}:approvePlan` : `/sessions/${sessionId}:approvePlan`;
    return this.request<JulesTask>('POST', path);
  }

  public async listActivities(sessionId: string, pageToken?: string): Promise<ListActivitiesResponse> {
    const idPart = sessionId.startsWith('sessions/') ? sessionId : `sessions/${sessionId}`;
    const query = pageToken ? `?pageToken=${encodeURIComponent(pageToken)}` : '';
    return this.request<ListActivitiesResponse>('GET', `/${idPart}/activities${query}`);
  }

  public async sendMessageToSession(sessionId: string, prompt: string): Promise<JulesTask> {
    const path = sessionId.startsWith('sessions/') ? `/${sessionId}:sendMessage` : `/sessions/${sessionId}:sendMessage`;
    return this.request<JulesTask>('POST', path, { prompt });
  }

  public async cancelTask(sessionId: string): Promise<void> {
    const path = sessionId.startsWith('sessions/') ? `/${sessionId}:cancel` : `/sessions/${sessionId}:cancel`;
    await this.request<unknown>('POST', path);
  }

  public async deleteTask(sessionId: string): Promise<void> {
    const path = sessionId.startsWith('sessions/') ? `/${sessionId}` : `/sessions/${sessionId}`;
    await this.request<unknown>('DELETE', path);
  }
}
