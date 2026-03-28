import * as assert from 'node:assert/strict';
import * as vscode from 'vscode';
import * as sinon from 'sinon';
import { JulesApiClient } from '../julesApiClient';

suite('JulesApiClient Core Test Suite', () => {
  let context: vscode.ExtensionContext;
  let client: JulesApiClient;
  let fetchStub: sinon.SinonStub;
  let secretGetStub: sinon.SinonStub;

  setup(() => {
    secretGetStub = sinon.stub().resolves('stored_token');
    context = {
      secrets: {
        get: secretGetStub,
      }
    } as unknown as vscode.ExtensionContext;

    fetchStub = sinon.stub(globalThis, 'fetch');
    client = new JulesApiClient(context);
  });

  teardown(() => {
    sinon.restore();
  });

  test('should load config and retrieve API key on init', async () => {
    await client.waitForInit();
    assert.strictEqual(client.hasApiKey(), true);
  });

  test('should ignore errors during init from secret storage', async () => {
    secretGetStub.rejects(new Error('Secret store failed'));
    const failingClient = new JulesApiClient(context);
    await failingClient.waitForInit();
    assert.strictEqual(failingClient.hasApiKey(), false);
  });

  test('setApiKey should update the key', () => {
    client.setApiKey('new_token');
    assert.strictEqual(client.hasApiKey(), true);
  });

  test('hasApiKey should return false if empty string', () => {
    client.setApiKey('   ');
    assert.strictEqual(client.hasApiKey(), false);
  });

  test('createTask should send a POST request with correct payload', async () => {
    client.setApiKey('test_token');
    const mockResponse = {
      ok: true,
      json: sinon.stub().resolves({ id: 'task1', title: 'Test Task' })
    };
    fetchStub.resolves(mockResponse);

    const result = await client.createTask({
      title: 'Test Task',
      description: 'A test task'
    });

    assert.strictEqual(result.id, 'task1');
    assert.ok(fetchStub.calledOnce);
    const [url, options] = fetchStub.firstCall.args;
    assert.ok(url.includes('/tasks'));
    assert.strictEqual(options.method, 'POST');
    assert.strictEqual(options.headers['Authorization'], 'Bearer test_token');
    assert.ok(options.body.includes('Test Task'));
  });

  test('getTask should send a GET request for specific task', async () => {
    client.setApiKey('test_token');
    const mockResponse = {
      ok: true,
      json: sinon.stub().resolves({ id: 'task1', title: 'Test Task' })
    };
    fetchStub.resolves(mockResponse);

    const result = await client.getTask('task1');

    assert.strictEqual(result.id, 'task1');
    assert.ok(fetchStub.calledOnce);
    const [url, options] = fetchStub.firstCall.args;
    assert.ok(url.includes('/tasks/task1'));
    assert.strictEqual(options.method, 'GET');
  });

  test('listTasks should handle pagination', async () => {
    client.setApiKey('test_token');
    const mockResponse = {
      ok: true,
      json: sinon.stub().resolves({ tasks: [] })
    };
    fetchStub.resolves(mockResponse);

    await client.listTasks('token123');

    assert.ok(fetchStub.calledOnce);
    const [url] = fetchStub.firstCall.args;
    assert.ok(url.includes('?pageToken=token123'));
  });

  test('cancelTask should send POST cancel request', async () => {
    client.setApiKey('test_token');
    const mockResponse = {
      ok: true,
      json: sinon.stub().resolves({})
    };
    fetchStub.resolves(mockResponse);

    await client.cancelTask('task1');

    assert.ok(fetchStub.calledOnce);
    const [url, options] = fetchStub.firstCall.args;
    assert.ok(url.includes('/tasks/task1:cancel'));
    assert.strictEqual(options.method, 'POST');
  });

  test('deleteTask should send DELETE request', async () => {
    client.setApiKey('test_token');
    const mockResponse = {
      ok: true,
      json: sinon.stub().resolves({})
    };
    fetchStub.resolves(mockResponse);

    await client.deleteTask('task1');

    assert.ok(fetchStub.calledOnce);
    const [url, options] = fetchStub.firstCall.args;
    assert.ok(url.includes('/tasks/task1'));
    assert.strictEqual(options.method, 'DELETE');
  });
});