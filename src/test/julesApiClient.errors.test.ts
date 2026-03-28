import * as assert from 'node:assert/strict';
import * as vscode from 'vscode';
import * as sinon from 'sinon';
import { JulesApiClient } from '../julesApiClient';

suite('JulesApiClient Errors Test Suite', () => {
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

  test('API request should throw error on failure', async () => {
    client.setApiKey('test_token');
    const mockResponse = {
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      json: sinon.stub().resolves({})
    };
    fetchStub.resolves(mockResponse);

    await assert.rejects(
      client.getTask('task1'),
      /Invalid API key/
    );
  });

  test('API request should handle 403 error', async () => {
    client.setApiKey('test_token');
    const mockResponse = {
      ok: false,
      status: 403,
      statusText: 'Forbidden',
      json: sinon.stub().resolves({})
    };
    fetchStub.resolves(mockResponse);

    await assert.rejects(
      client.getTask('task1'),
      /Access denied/
    );
  });

  test('API request should handle 429 error', async () => {
    client.setApiKey('test_token');
    const mockResponse = {
      ok: false,
      status: 429,
      statusText: 'Too Many Requests',
      json: sinon.stub().resolves({})
    };
    fetchStub.resolves(mockResponse);

    await assert.rejects(
      client.getTask('task1'),
      /Rate limit exceeded/
    );
  });

  test('API request should handle structured JSON errors', async () => {
    client.setApiKey('test_token');
    const mockResponse = {
      ok: false,
      status: 400,
      statusText: 'Bad Request',
      json: sinon.stub().resolves({ error: { message: 'Custom API error message' } })
    };
    fetchStub.resolves(mockResponse);

    await assert.rejects(
      client.getTask('task1'),
      /Custom API error message/
    );
  });

  test('API request should fallback to default error message if JSON parsing fails', async () => {
    client.setApiKey('test_token');
    const mockResponse = {
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      json: sinon.stub().rejects(new Error('Failed to parse json'))
    };
    fetchStub.resolves(mockResponse);

    await assert.rejects(
      client.getTask('task1'),
      /HTTP 500: Internal Server Error/
    );
  });
});