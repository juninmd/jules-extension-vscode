import * as assert from 'assert';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import { JulesApiClient } from '../julesApiClient';

suite('JulesApiClient Test Suite 1', () => {
  let client: JulesApiClient;
  let context: vscode.ExtensionContext;
  let getConfigurationStub: sinon.SinonStub;
  let fetchStub: sinon.SinonStub;

  setup(() => {
    getConfigurationStub = sinon.stub(vscode.workspace, 'getConfiguration').returns({
      get: (key: string) => key === 'apiBaseUrl' ? 'https://jules.googleapis.com/v1' : undefined,
      has: () => true, inspect: () => undefined, update: () => Promise.resolve()
    } as any);

    context = { secrets: { get: sinon.stub().resolves('test-token') } } as any;
    client = new JulesApiClient(context);
    fetchStub = sinon.stub(globalThis, 'fetch');
  });

  teardown(() => sinon.restore());

  test('constructor loads config and API token', async () => {
    await client.waitForInit();
    assert.strictEqual(client.hasApiKey(), true);
  });

  test('setApiKey updates the token', async () => {
    await client.waitForInit();
    client.setApiKey('new-token');
    assert.strictEqual(client.hasApiKey(), true);
  });

  test('createTask sends POST request', async () => {
    await client.waitForInit();
    fetchStub.resolves({ ok: true, json: async () => ({ id: '1', title: 'T' }) });
    const task = await client.createTask({ title: 'T', description: 'D' });
    assert.strictEqual(task.id, '1');
    const [url, opts] = fetchStub.firstCall.args;
    assert.strictEqual(url, 'https://jules.googleapis.com/v1/tasks');
    assert.strictEqual(opts.method, 'POST');
    assert.strictEqual(JSON.parse(opts.body).title, 'T');
  });

  test('getTask sends GET request', async () => {
    await client.waitForInit();
    fetchStub.resolves({ ok: true, json: async () => ({ id: '1', status: 'C' }) });
    const task = await client.getTask('1');
    assert.strictEqual(task.id, '1');
    const [url, opts] = fetchStub.firstCall.args;
    assert.strictEqual(url, 'https://jules.googleapis.com/v1/tasks/1');
    assert.strictEqual(opts.method, 'GET');
  });

  test('listTasks sends GET request without pageToken', async () => {
    await client.waitForInit();
    fetchStub.resolves({ ok: true, json: async () => ({ tasks: [{ id: '1' }] }) });
    const res = await client.listTasks();
    assert.strictEqual(res.tasks.length, 1);
    const [url] = fetchStub.firstCall.args;
    assert.strictEqual(url, 'https://jules.googleapis.com/v1/tasks');
  });

  test('listTasks sends GET request with pageToken', async () => {
    await client.waitForInit();
    fetchStub.resolves({ ok: true, json: async () => ({ tasks: [{ id: '2' }] }) });
    const res = await client.listTasks('tok');
    assert.strictEqual(res.tasks[0].id, '2');
    const [url] = fetchStub.firstCall.args;
    assert.strictEqual(url, 'https://jules.googleapis.com/v1/tasks?pageToken=tok');
  });

  test('cancelTask sends POST request', async () => {
    await client.waitForInit();
    fetchStub.resolves({ ok: true, json: async () => ({}) });
    await client.cancelTask('1');
    const [url, opts] = fetchStub.firstCall.args;
    assert.strictEqual(url, 'https://jules.googleapis.com/v1/tasks/1:cancel');
    assert.strictEqual(opts.method, 'POST');
  });

  test('deleteTask sends DELETE request', async () => {
    await client.waitForInit();
    fetchStub.resolves({ ok: true, json: async () => ({}) });
    await client.deleteTask('1');
    const [url, opts] = fetchStub.firstCall.args;
    assert.strictEqual(url, 'https://jules.googleapis.com/v1/tasks/1');
    assert.strictEqual(opts.method, 'DELETE');
  });

  test('request throws Invalid API key on 401', async () => {
    await client.waitForInit();
    fetchStub.resolves({ ok: false, status: 401, json: async () => ({}) });
    await assert.rejects(() => client.getTask('1'), /Invalid API key/);
  });

  test('request throws Access denied on 403', async () => {
    await client.waitForInit();
    fetchStub.resolves({ ok: false, status: 403, json: async () => ({}) });
    await assert.rejects(() => client.getTask('1'), /Access denied/);
  });

  test('request throws Rate limit exceeded on 429', async () => {
    await client.waitForInit();
    fetchStub.resolves({ ok: false, status: 429, json: async () => ({}) });
    await assert.rejects(() => client.getTask('1'), /Rate limit exceeded/);
  });

  test('request extracts error message from JSON body', async () => {
    await client.waitForInit();
    fetchStub.resolves({ ok: false, status: 400, json: async () => ({ error: { message: 'Cst' } }) });
    await assert.rejects(() => client.getTask('1'), /Cst/);
  });

  test('request falls back to statusText if no error message', async () => {
    await client.waitForInit();
    fetchStub.resolves({ ok: false, status: 500, statusText: 'ISE', json: async () => ({}) });
    await assert.rejects(() => client.getTask('1'), /HTTP 500: ISE/);
  });

  test('request falls back to statusText if JSON fails', async () => {
    await client.waitForInit();
    fetchStub.resolves({ ok: false, status: 500, statusText: 'ISE', json: async () => { throw new Error('E'); } });
    await assert.rejects(() => client.getTask('1'), /HTTP 500: ISE/);
  });

  test('loadConfig ignores secret retrieval error', async () => {
    const errorContext = { secrets: { get: sinon.stub().rejects(new Error('E')) } } as any;
    const errorClient = new JulesApiClient(errorContext);
    await errorClient.waitForInit();
    assert.strictEqual(errorClient.hasApiKey(), false);
  });
});
