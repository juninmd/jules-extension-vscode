import * as vscode from 'vscode';

export interface JulesTask {
  id: string;
  title: string;
  description: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  createdAt: string;
  updatedAt: string;
  result?: string;
  error?: string;
  pullRequestUrl?: string;
}

export interface CreateTaskRequest {
  title: string;
  description: string;
  repository?: string;
  branch?: string;
  language?: string;
  codeContext?: string;
}

export interface ListTasksResponse {
  tasks: JulesTask[];
  nextPageToken?: string;
}

export class JulesApiClient {
  private apiKey: string = '';
  private baseUrl: string = 'https://jules.googleapis.com/v1';
  private keyLoaded: Promise<void>;

  constructor(private readonly context: vscode.ExtensionContext) {
    this.keyLoaded = this.loadConfig();
  }

  private async loadConfig(): Promise<void> {
    const config = vscode.workspace.getConfiguration('jules');
    this.baseUrl = config.get<string>('apiBaseUrl') ?? 'https://jules.googleapis.com/v1';

    try {
      const key = await this.context.secrets.get('jules.apiKey');
      if (key) {
        this.apiKey = key;
      }
    } catch {
      // Ignore errors during initialization
    }
  }

  /** Wait until the API key has been loaded from secret storage. */
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
      'Authorization': `Bearer ${this.apiKey}`,
      'X-Jules-Client': 'vscode-extension/0.1.0'
    };
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;

    const options: RequestInit = {
      method,
      headers: this.getHeaders(),
    };

    if (body !== undefined) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options); // NOSONAR

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

    return response.json() as Promise<T>;
  }

  public async createTask(request: CreateTaskRequest): Promise<JulesTask> {
    return this.request<JulesTask>('POST', '/tasks', request);
  }

  public async getTask(taskId: string): Promise<JulesTask> {
    return this.request<JulesTask>('GET', `/tasks/${taskId}`);
  }

  public async listTasks(pageToken?: string): Promise<ListTasksResponse> {
    const queryParams = pageToken ? `?pageToken=${encodeURIComponent(pageToken)}` : '';
    return this.request<ListTasksResponse>('GET', `/tasks${queryParams}`);
  }

  public async cancelTask(taskId: string): Promise<void> {
    await this.request<unknown>('POST', `/tasks/${taskId}:cancel`);
  }

  public async deleteTask(taskId: string): Promise<void> {
    await this.request<unknown>('DELETE', `/tasks/${taskId}`);
  }
}
