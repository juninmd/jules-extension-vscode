import * as vscode from 'vscode';

export interface JulesSource {
  name: string;
  displayName: string;
}

export interface ListSourcesResponse {
  sources: JulesSource[];
  nextPageToken?: string;
}

export interface JulesTask {
  name: string;
  prompt: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  createdAt: string;
  updatedAt: string;
  result?: string;
  error?: string;
  pullRequestUrl?: string;
}

export interface CreateTaskRequest {
  prompt: string;
  sourceContext: {
    source: string;
  };
  branch?: string;
  language?: string;
  codeContext?: string;
}

export interface ListTasksResponse {
  sessions: JulesTask[];
  nextPageToken?: string;
}

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
      'X-Goog-Api-Key': this.apiKey,
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

    const response = await fetch(url, options);

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
    return this.request<JulesTask>('POST', '/sessions', request);
  }

  public async getTask(taskId: string): Promise<JulesTask> {
    const path = taskId.startsWith('sessions/') ? `/${taskId}` : `/sessions/${taskId}`;
    return this.request<JulesTask>('GET', path);
  }

  public async listTasks(pageToken?: string, filter?: string): Promise<ListTasksResponse> {
    const params = new URLSearchParams();
    if (pageToken) params.append('pageToken', pageToken);
    if (filter) params.append('filter', filter);
    
    const query = params.toString() ? `?${params.toString()}` : '';
    return this.request<ListTasksResponse>('GET', `/sessions${query}`);
  }

  public async listSources(pageToken?: string): Promise<ListSourcesResponse> {
    const queryParams = pageToken ? `?pageToken=${encodeURIComponent(pageToken)}` : '';
    return this.request<ListSourcesResponse>('GET', `/sources${queryParams}`);
  }

  public async cancelTask(taskId: string): Promise<void> {
    const path = taskId.startsWith('sessions/') ? `/${taskId}:cancel` : `/sessions/${taskId}:cancel`;
    await this.request<unknown>('POST', path);
  }

  public async deleteTask(taskId: string): Promise<void> {
    const path = taskId.startsWith('sessions/') ? `/${taskId}` : `/sessions/${taskId}`;
    await this.request<unknown>('DELETE', path);
  }
}
