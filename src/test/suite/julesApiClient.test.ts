import * as assert from 'assert';
import * as vscode from 'vscode';
import * as sinon from 'sinon';
import { JulesApiClient, CreateTaskRequest, JulesTask, ListTasksResponse } from '../../julesApiClient';

suite('JulesApiClient Test Suite', () => {
    let context: vscode.ExtensionContext;
    let apiClient: JulesApiClient;
    let fetchStub: sinon.SinonStub;

    setup(() => {
        context = {
            secrets: {
                get: sinon.stub().resolves('test-key'),
                store: sinon.stub().resolves(),
                onDidChange: sinon.stub(),
                delete: sinon.stub().resolves()
            }
        } as unknown as vscode.ExtensionContext;

        sinon.stub(vscode.workspace, 'getConfiguration').returns({
            get: sinon.stub().returns('https://api.test'),
            has: sinon.stub(),
            inspect: sinon.stub(),
            update: sinon.stub()
        } as unknown as vscode.WorkspaceConfiguration);

        fetchStub = sinon.stub(globalThis, 'fetch');
        apiClient = new JulesApiClient(context);
    });

    teardown(() => {
        sinon.restore();
    });

    test('waitForInit and hasApiKey', async () => {
        await apiClient.waitForInit();
        assert.ok(apiClient.hasApiKey());
    });

    test('setApiKey updates the key', () => {
        apiClient.setApiKey('new-key');
        assert.ok(apiClient.hasApiKey());
    });

    test('createTask makes correct API call', async () => {
        await apiClient.waitForInit();

        const mockTask: JulesTask = {
            id: 'task-1',
            title: 'Test Task',
            description: 'Test Description',
            status: 'pending',
            createdAt: '2023-01-01T00:00:00Z',
            updatedAt: '2023-01-01T00:00:00Z'
        };

        const response = new Response(JSON.stringify(mockTask), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
        fetchStub.resolves(response);

        const request: CreateTaskRequest = {
            title: 'Test Task',
            description: 'Test Description'
        };

        const task = await apiClient.createTask(request);

        assert.strictEqual(task.id, 'task-1');
        assert.strictEqual(task.title, 'Test Task');
        assert.ok(fetchStub.calledOnce);

        const [url, options] = fetchStub.getCall(0).args;
        assert.strictEqual(url, 'https://api.test/tasks');
        assert.strictEqual(options.method, 'POST');
        assert.strictEqual(JSON.parse(options.body).title, 'Test Task');
    });

    test('getTask handles 404', async () => {
        await apiClient.waitForInit();

        const response = new Response(JSON.stringify({ error: { message: 'Not Found' } }), {
            status: 404,
            headers: { 'Content-Type': 'application/json' },
            statusText: 'Not Found'
        });
        fetchStub.resolves(response);

        try {
            await apiClient.getTask('task-1');
            assert.fail('Should have thrown');
        } catch (e: unknown) {
            assert.ok(e instanceof Error);
            assert.strictEqual(e.message, 'Not Found');
        }
    });

    test('getTask handles 401 Unauthorized', async () => {
        await apiClient.waitForInit();

        const response = new Response(JSON.stringify({ error: { message: 'Unauthorized' } }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
            statusText: 'Unauthorized'
        });
        fetchStub.resolves(response);

        try {
            await apiClient.getTask('task-1');
            assert.fail('Should have thrown');
        } catch (e: unknown) {
            assert.ok(e instanceof Error);
            assert.strictEqual(e.message, 'Invalid API key. Please configure a valid Jules API key.');
        }
    });

    test('listTasks pagination works', async () => {
        await apiClient.waitForInit();

        const mockResponse: ListTasksResponse = {
            tasks: [
                {
                    id: 'task-1',
                    title: 'Test Task',
                    description: 'Test Description',
                    status: 'pending',
                    createdAt: '2023-01-01T00:00:00Z',
                    updatedAt: '2023-01-01T00:00:00Z'
                }
            ],
            nextPageToken: 'page-2'
        };

        const response = new Response(JSON.stringify(mockResponse), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
        fetchStub.resolves(response);

        const res = await apiClient.listTasks('page-1');

        assert.strictEqual(res.tasks.length, 1);
        assert.strictEqual(res.nextPageToken, 'page-2');

        const [url] = fetchStub.getCall(0).args;
        assert.strictEqual(url, 'https://api.test/tasks?pageToken=page-1');
    });

    test('cancelTask makes correct call', async () => {
        await apiClient.waitForInit();

        const response = new Response("{}", {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
        fetchStub.resolves(response);

        await apiClient.cancelTask('task-1');

        const [url, options] = fetchStub.getCall(0).args;
        assert.strictEqual(url, 'https://api.test/tasks/task-1:cancel');
        assert.strictEqual(options.method, 'POST');
    });

    test('deleteTask makes correct call', async () => {
        await apiClient.waitForInit();

        const response = new Response("{}", {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
        fetchStub.resolves(response);

        await apiClient.deleteTask('task-1');

        const [url, options] = fetchStub.getCall(0).args;
        assert.strictEqual(url, 'https://api.test/tasks/task-1');
        assert.strictEqual(options.method, 'DELETE');
    });
});