import * as assert from 'assert';
import * as vscode from 'vscode';
import * as sinon from 'sinon';
import { JulesApiClient } from '../../julesApiClient';

suite('JulesApiClient Test Suite - Part 2', () => {
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

  test('cancelTask sends request', async () => {
    await apiClient.waitForInit();

    const fetchStub = sinon.stub(global, 'fetch').resolves({
      ok: true,
      json: sinon.stub().resolves({})
    } as any);

    await apiClient.cancelTask('task-1');

    assert.ok(fetchStub.calledOnce);
    const url = fetchStub.getCall(0).args[0] as string;
    assert.ok(url.endsWith('/tasks/task-1:cancel'));
  });

  test('deleteTask sends request', async () => {
    await apiClient.waitForInit();

    const fetchStub = sinon.stub(global, 'fetch').resolves({
      ok: true,
      json: sinon.stub().resolves({})
    } as any);

    await apiClient.deleteTask('task-1');

    assert.ok(fetchStub.calledOnce);
    const options = fetchStub.getCall(0).args[1] as any;
    assert.strictEqual(options.method, 'DELETE');
  });

  test('request handles HTTP errors (401)', async () => {
    await apiClient.waitForInit();

    sinon.stub(global, 'fetch').resolves({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      json: sinon.stub().resolves({})
    } as any);

    await assert.rejects(
      () => apiClient.getTask('task-1'),
      /Invalid API key/
    );
  });

  test('request handles HTTP errors (403)', async () => {
    await apiClient.waitForInit();

    sinon.stub(global, 'fetch').resolves({
      ok: false,
      status: 403,
      statusText: 'Forbidden',
      json: sinon.stub().resolves({})
    } as any);

    await assert.rejects(
      () => apiClient.getTask('task-1'),
      /Access denied/
    );
  });

  test('request handles HTTP errors (429)', async () => {
    await apiClient.waitForInit();

    sinon.stub(global, 'fetch').resolves({
      ok: false,
      status: 429,
      statusText: 'Too Many Requests',
      json: sinon.stub().resolves({})
    } as any);

    await assert.rejects(
      () => apiClient.getTask('task-1'),
      /Rate limit exceeded/
    );
  });

  test('request handles API errors with message', async () => {
    await apiClient.waitForInit();

    sinon.stub(global, 'fetch').resolves({
      ok: false,
      status: 400,
      statusText: 'Bad Request',
      json: sinon.stub().resolves({ error: { message: 'Custom error message' } })
    } as any);

    await assert.rejects(
      () => apiClient.getTask('task-1'),
      /Custom error message/
    );
  });

  test('request handles unknown errors', async () => {
    await apiClient.waitForInit();

    sinon.stub(global, 'fetch').resolves({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      json: sinon.stub().rejects(new Error('Parse error'))
    } as any);

    await assert.rejects(
      () => apiClient.getTask('task-1'),
      /HTTP 500: Internal Server Error/
    );
  });
});
