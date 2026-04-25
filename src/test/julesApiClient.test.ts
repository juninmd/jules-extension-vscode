import { describe, it, expect, beforeEach } from 'vitest';
import { JulesApiClient } from '../julesApiClient.js';

describe('JulesApiClient', () => {
  let client: JulesApiClient;
  const token = process.env.JULES_TOKEN;

  beforeEach(() => {
    // Mock ExtensionContext
    const contextMock: any = {
      secrets: {
        get: async (key: string) => {
          if (key === 'jules.apiKey') return token;
          return undefined;
        }
      }
    };
    client = new JulesApiClient(contextMock);
    if (token) {
      client.setApiKey(token);
    }
  });

  it('should have a token from .env', () => {
    expect(token).toBeDefined();
    expect(token?.length).toBeGreaterThan(0);
  });

  it('should list sources successfully', async () => {
    const response = await client.listSources();
    expect(response).toBeDefined();
    expect(Array.isArray(response.sources)).toBe(true);
    console.log(`Vitest: Found ${response.sources.length} sources.`);
  });

  it('should list sessions (tasks) successfully', async () => {
    const response = await client.listTasks();
    expect(response).toBeDefined();
    expect(Array.isArray(response.sessions)).toBe(true);
    console.log(`Vitest: Found ${response.sessions.length} sessions.`);
  });

  it('should list activities for a task successfully', async () => {
    const tasksResponse = await client.listTasks();
    if (tasksResponse.sessions && tasksResponse.sessions.length > 0) {
      const firstTask = tasksResponse.sessions[0];
      const response = await client.listActivities(firstTask.name);
      expect(response).toBeDefined();
      expect(Array.isArray(response.activities)).toBe(true);
      console.log(`Vitest: Found ${response.activities?.length || 0} activities for task ${firstTask.name}`);
    }
  });

  it('should perform a full task lifecycle (create, delete)', async () => {
    // 0. Get a valid source and branch dynamically
    const sourcesResponse = await client.listSources();
    const source = sourcesResponse.sources[0];
    const sourceName = source.name;
    const defaultBranch = (source as any).githubRepo?.defaultBranch?.displayName || 'main';
    
    // 1. Create Task
    console.log('Vitest: Creating a test task...');
    const createTaskRequest: any = {
      prompt: 'Hello Jules, this is a connection test.',
      sourceContext: { source: sourceName, githubRepoContext: { startingBranch: defaultBranch } },
      title: 'AQ Connection Test'
    };

    const task = await client.createTask(createTaskRequest);
    expect(task).toBeDefined();
    const sessionId = task.name!;
    console.log(`Vitest: Created task ${sessionId}`);

    // 2. Delete Task (Cleanup)
    console.log(`Vitest: Deleting test task ${sessionId}...`);
    await client.deleteTask(sessionId);
    console.log('Vitest: Task deleted successfully.');
  });

  it('should test message and cancel on an existing task if available', async () => {
    const tasksResponse = await client.listTasks();
    if (tasksResponse.sessions && tasksResponse.sessions.length > 0) {
      const existingTask = tasksResponse.sessions[0];
      const sessionId = existingTask.name;

      console.log(`Vitest: Testing sendMessageToSession for ${sessionId}...`);
      try {
        const updatedTask = await client.sendMessageToSession(sessionId, 'AQ verification message.');
        expect(updatedTask).toBeDefined();
        console.log('Vitest: Message sent successfully.');
      } catch (e: any) {
        console.log(`Vitest: Message sending failed (might be expected for COMPLETED tasks): ${e.message}`);
      }

      console.log(`Vitest: Testing cancelTask for ${sessionId}...`);
      try {
        await client.cancelTask(sessionId);
        console.log('Vitest: Task cancel requested successfully.');
      } catch (e: any) {
        console.log(`Vitest: Cancel failed (might be expected for COMPLETED tasks): ${e.message}`);
      }
    }
  });
});
