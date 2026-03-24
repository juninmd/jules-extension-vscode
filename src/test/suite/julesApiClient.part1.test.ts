import * as assert from 'assert';
import * as vscode from 'vscode';
import * as sinon from 'sinon';
import { JulesApiClient } from '../../julesApiClient';

suite('JulesApiClient Test Suite - Part 1', () => {
  let apiClient: JulesApiClient;
  let mockContext: any;
  let mockSecrets: any;
  let mockConfiguration: any;

  setup(() => {
    mockSecrets = {
      get: sinon.stub().resolves('test-api-key')
    };

    mockContext = {
      secrets: mockSecrets
    };

    mockConfiguration = {
      get: sinon.stub().returns('https://test-api.jules.com/v1')
    };

    sinon.stub(vscode.workspace, 'getConfiguration').returns(mockConfiguration);

    apiClient = new JulesApiClient(mockContext);
  });

  teardown(() => {
    sinon.restore();
  });

  test('constructor loads config and secret', async () => {
    await apiClient.waitForInit();

    assert.ok(mockConfiguration.get.calledWith('apiBaseUrl'));
    assert.ok(mockSecrets.get.calledWith('jules.apiKey'));
    assert.strictEqual(apiClient.hasApiKey(), true);
  });

  test('setApiKey updates api key', () => {
    apiClient.setApiKey('new-api-key');
    assert.strictEqual(apiClient.hasApiKey(), true);
  });

  test('createTask sends request', async () => {
    await apiClient.waitForInit();

    const fetchStub = sinon.stub(global, 'fetch').resolves({
      ok: true,
      json: sinon.stub().resolves({ id: 'task-1', status: 'pending' })
    } as any);

    const task = await apiClient.createTask({
      title: 'Test',
      description: 'Test task',
      codeContext: 'function test() {}'
    });

    assert.ok(fetchStub.calledOnce);
    assert.strictEqual(task.id, 'task-1');
  });

  test('getTask retrieves task', async () => {
    await apiClient.waitForInit();

    const fetchStub = sinon.stub(global, 'fetch').resolves({
      ok: true,
      json: sinon.stub().resolves({ id: 'task-1', status: 'completed' })
    } as any);

    const task = await apiClient.getTask('task-1');

    assert.ok(fetchStub.calledOnce);
    assert.strictEqual(task.status, 'completed');
  });

  test('listTasks lists all tasks', async () => {
    await apiClient.waitForInit();

    const fetchStub = sinon.stub(global, 'fetch').resolves({
      ok: true,
      json: sinon.stub().resolves({ tasks: [{ id: 'task-1', status: 'pending' }] })
    } as any);

    const response = await apiClient.listTasks();

    assert.ok(fetchStub.calledOnce);
    assert.strictEqual(response.tasks.length, 1);
  });

  test('listTasks with pageToken', async () => {
    await apiClient.waitForInit();

    const fetchStub = sinon.stub(global, 'fetch').resolves({
      ok: true,
      json: sinon.stub().resolves({ tasks: [{ id: 'task-1', status: 'pending' }] })
    } as any);

    const response = await apiClient.listTasks('token');

    assert.ok(fetchStub.calledOnce);
    const url = fetchStub.getCall(0).args[0] as string;
    assert.ok(url.includes('pageToken=token'));
  });
});
