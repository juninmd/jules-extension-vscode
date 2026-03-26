import * as assert from 'assert';
import * as sinon from 'sinon';
import { JulesApiClient } from '../julesApiClient';
import * as vscode from 'vscode';

suite('JulesApiClient Test Suite', () => {
    let apiClient: JulesApiClient;
    let extensionContextMock: any;

    setup(() => {
        extensionContextMock = {
            secrets: {
                get: sinon.stub().resolves('fake-api-key'),
                store: sinon.stub().resolves(),
                delete: sinon.stub().resolves()
            }
        };
        apiClient = new JulesApiClient(extensionContextMock as vscode.ExtensionContext);
    });

    teardown(() => {
        sinon.restore();
    });

    test('hasApiKey returns false initially before init finishes', () => {
        const client = new JulesApiClient(extensionContextMock as vscode.ExtensionContext);
        assert.strictEqual(client.hasApiKey(), false);
    });

    test('waitForInit initializes API key from secrets', async () => {
        await apiClient.waitForInit();
        assert.strictEqual(apiClient.hasApiKey(), true);
    });

    test('setApiKey stores key and updates state', async () => {
        apiClient.setApiKey('new-key');
        assert.strictEqual(apiClient.hasApiKey(), true);
    });

    test('request throws if no api key (well, actually here it throws 404 because fetch stub is missing but we check that)', async () => {
        const fetchStub = sinon.stub(globalThis, 'fetch').resolves({
            ok: false,
            status: 401,
            json: async () => ({})
        } as unknown as Response);

        const client = new JulesApiClient(extensionContextMock as vscode.ExtensionContext);
        // Do not wait for init so api key is not set
        try {
            await client.listTasks();
            assert.fail('Should have thrown');
        } catch (err: any) {
            assert.strictEqual(err.message, 'Invalid API key. Please configure a valid Jules API key.');
        }

        fetchStub.restore();
    });

    test('listTasks uses correct URL and method', async () => {
        const fetchStub = sinon.stub(globalThis, 'fetch').resolves({
            ok: true,
            json: async () => ({ tasks: [] })
        } as unknown as Response);

        await apiClient.waitForInit();
        const res = await apiClient.listTasks();
        assert.deepStrictEqual(res, { tasks: [] });

        const fetchCallUrl = fetchStub.getCall(0).args[0];
        assert.ok((fetchCallUrl as string).endsWith('/tasks'));

        fetchStub.restore();
    });

    test('createTask sends proper body', async () => {
        const fetchStub = sinon.stub(globalThis, 'fetch').resolves({
            ok: true,
            json: async () => ({ id: '123' })
        } as unknown as Response);

        await apiClient.waitForInit();
        const res = await apiClient.createTask({
            title: 'test title',
            description: 'test desc'
        });

        assert.deepStrictEqual(res, { id: '123' });

        const callArgs = fetchStub.getCall(0).args[1];
        assert.strictEqual(callArgs?.method, 'POST');
        assert.strictEqual(JSON.parse(callArgs?.body as string).title, 'test title');

        fetchStub.restore();
    });

    test('getTask retrieves task', async () => {
        const fetchStub = sinon.stub(globalThis, 'fetch').resolves({
            ok: true,
            json: async () => ({ id: '123', status: 'completed' })
        } as unknown as Response);

        await apiClient.waitForInit();
        const res = await apiClient.getTask('123');

        assert.deepStrictEqual(res, { id: '123', status: 'completed' });

        fetchStub.restore();
    });

    test('cancelTask sends post to cancel endpoint', async () => {
        const fetchStub = sinon.stub(globalThis, 'fetch').resolves({
            ok: true,
            json: async () => ({})
        } as unknown as Response);

        await apiClient.waitForInit();
        await apiClient.cancelTask('123');

        const callUrl = fetchStub.getCall(0).args[0] as string;
        assert.ok(callUrl.endsWith('/tasks/123:cancel'));

        fetchStub.restore();
    });

    test('request throws custom error message from API if available', async () => {
        const fetchStub = sinon.stub(globalThis, 'fetch').resolves({
            ok: false,
            status: 400,
            statusText: 'Bad Request',
            json: async () => ({ error: { message: 'Custom API Error' } })
        } as unknown as Response);

        const client = new JulesApiClient(extensionContextMock as vscode.ExtensionContext);
        client.setApiKey('test'); // Bypass local auth check implicitly tested through setting it

        try {
            await client.listTasks();
            assert.fail('Should have thrown');
        } catch (err: any) {
            assert.strictEqual(err.message, 'Custom API Error');
        }

        fetchStub.restore();
    });

    test('request handles 403 Forbidden', async () => {
        const fetchStub = sinon.stub(globalThis, 'fetch').resolves({
            ok: false,
            status: 403,
            statusText: 'Forbidden',
            json: async () => ({})
        } as unknown as Response);

        const client = new JulesApiClient(extensionContextMock as vscode.ExtensionContext);
        client.setApiKey('test');

        try {
            await client.listTasks();
            assert.fail('Should have thrown');
        } catch (err: any) {
            assert.strictEqual(err.message, 'Access denied. Check your Jules API key permissions.');
        }

        fetchStub.restore();
    });

    test('request handles 429 Too Many Requests', async () => {
        const fetchStub = sinon.stub(globalThis, 'fetch').resolves({
            ok: false,
            status: 429,
            statusText: 'Too Many Requests',
            json: async () => ({})
        } as unknown as Response);

        const client = new JulesApiClient(extensionContextMock as vscode.ExtensionContext);
        client.setApiKey('test');

        try {
            await client.listTasks();
            assert.fail('Should have thrown');
        } catch (err: any) {
            assert.strictEqual(err.message, 'Rate limit exceeded. Please wait before making more requests.');
        }

        fetchStub.restore();
    });

    test('request handles arbitrary error gracefully', async () => {
        const fetchStub = sinon.stub(globalThis, 'fetch').resolves({
            ok: false,
            status: 500,
            statusText: 'Internal Server Error',
            json: (async () => { throw new Error("Not JSON"); }) as any
        } as unknown as Response);

        const client = new JulesApiClient(extensionContextMock as vscode.ExtensionContext);
        client.setApiKey('test');

        try {
            await client.listTasks();
            assert.fail('Should have thrown');
        } catch (err: any) {
            assert.strictEqual(err.message, 'HTTP 500: Internal Server Error');
        }

        fetchStub.restore();
    });

    test('listTasks uses pageToken if provided', async () => {
        const fetchStub = sinon.stub(globalThis, 'fetch').resolves({
            ok: true,
            json: async () => ({ tasks: [] })
        } as unknown as Response);

        await apiClient.waitForInit();
        await apiClient.listTasks('token123');

        const fetchCallUrl = fetchStub.getCall(0).args[0] as string;
        assert.ok(fetchCallUrl.includes('pageToken=token123'));

        fetchStub.restore();
    });

    test('deleteTask sends delete method', async () => {
        const fetchStub = sinon.stub(globalThis, 'fetch').resolves({
            ok: true,
            json: async () => ({})
        } as unknown as Response);

        await apiClient.waitForInit();
        await apiClient.deleteTask('123');

        const callUrl = fetchStub.getCall(0).args[0] as string;
        const callArgs = fetchStub.getCall(0).args[1];

        assert.ok(callUrl.endsWith('/tasks/123'));
        assert.strictEqual(callArgs?.method, 'DELETE');

        fetchStub.restore();
    });

    test('loadConfig catches error retrieving secret', async () => {
        const errorContext = {
            secrets: {
                get: sinon.stub().rejects(new Error('Secret retrieval failed')),
                store: sinon.stub(),
                delete: sinon.stub()
            }
        };

        const client = new JulesApiClient(errorContext as any);
        await client.waitForInit();
        assert.strictEqual(client.hasApiKey(), false);
    });
});
