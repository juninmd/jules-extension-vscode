import * as assert from 'assert';
import * as vscode from 'vscode';
import * as sinon from 'sinon';
import { JulesApiClient, CreateTaskRequest } from '../../julesApiClient';

suite('JulesApiClient Test Suite', () => {
  let apiClient: JulesApiClient;
  let contextMock: any;
  let fetchStub: sinon.SinonStub;

  setup(() => {
    contextMock = {
      secrets: {
        get: sinon.stub().resolves('fake-api-key'),
      }
    };

    // Set up fetch stub in global scope
    fetchStub = sinon.stub(globalThis, 'fetch');

    apiClient = new JulesApiClient(contextMock as any);
  });

  teardown(() => {
    sinon.restore();
  });

  test('should load config and initialize correctly', async () => {
    await apiClient.waitForInit();
    assert.strictEqual(apiClient.hasApiKey(), true);
  });

  test('should set API key manually', () => {
    apiClient.setApiKey('new-key');
    assert.strictEqual(apiClient.hasApiKey(), true);
  });

  test('createTask should call API and return task', async () => {
    const mockTask = { id: '123', title: 'Test Task', status: 'pending' };
    fetchStub.resolves({
      ok: true,
      json: sinon.stub().resolves(mockTask)
    } as unknown as Response);

    await apiClient.waitForInit();

    const request: CreateTaskRequest = { title: 'Test Task', description: 'Desc' };
    const task = await apiClient.createTask(request);

    assert.deepStrictEqual(task, mockTask);
    assert.ok(fetchStub.calledOnce);
  });

  test('getTask should fetch task correctly', async () => {
    const mockTask = { id: '123', title: 'Test Task', status: 'running' };
    fetchStub.resolves({
      ok: true,
      json: sinon.stub().resolves(mockTask)
    } as unknown as Response);

    await apiClient.waitForInit();
    const task = await apiClient.getTask('123');

    assert.deepStrictEqual(task, mockTask);
  });

  test('listTasks should fetch tasks list', async () => {
    const mockResponse = { tasks: [{ id: '123' }] };
    fetchStub.resolves({
      ok: true,
      json: sinon.stub().resolves(mockResponse)
    } as unknown as Response);

    await apiClient.waitForInit();
    const response = await apiClient.listTasks();

    assert.deepStrictEqual(response, mockResponse);
  });

  test('should throw meaningful error on 401', async () => {
    fetchStub.resolves({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      json: sinon.stub().resolves({})
    } as unknown as Response);

    await apiClient.waitForInit();

    try {
      await apiClient.getTask('123');
      assert.fail('Should have thrown an error');
    } catch (error: any) {
      assert.strictEqual(error.message, 'Invalid API key. Please configure a valid Jules API key.');
    }
  });

  test('cancelTask should send correct request', async () => {
    fetchStub.resolves({
      ok: true,
      json: sinon.stub().resolves({})
    } as unknown as Response);

    await apiClient.waitForInit();
    await apiClient.cancelTask('123');
    assert.ok(fetchStub.calledOnce);
    assert.strictEqual(fetchStub.getCall(0).args[0], 'https://jules.googleapis.com/v1/tasks/123:cancel');
  });

  test('deleteTask should send correct request', async () => {
    fetchStub.resolves({
      ok: true,
      json: sinon.stub().resolves({})
    } as unknown as Response);

    await apiClient.waitForInit();
    await apiClient.deleteTask('123');
    assert.ok(fetchStub.calledOnce);
    assert.strictEqual(fetchStub.getCall(0).args[0], 'https://jules.googleapis.com/v1/tasks/123');
    assert.strictEqual(fetchStub.getCall(0).args[1].method, 'DELETE');
  });
});
