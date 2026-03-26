import * as assert from 'assert';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import { JulesChatViewProvider } from '../julesProvider';
import { JulesApiClient } from '../julesApiClient';

suite('JulesChatViewProvider Test Suite', () => {
    let provider: JulesChatViewProvider;
    let apiClientMock: any;
    let contextMock: any;
    let webviewViewMock: any;
    let postMessageStub: sinon.SinonStub;

    setup(() => {
        apiClientMock = {
            hasApiKey: sinon.stub().returns(true),
            waitForInit: sinon.stub().resolves(),
            createTask: sinon.stub().resolves({ id: 'task-1', title: 'Test Task', status: 'pending' }),
            getTask: sinon.stub().resolves({ id: 'task-1', status: 'completed' }),
            listTasks: sinon.stub().resolves({ tasks: [] }),
            cancelTask: sinon.stub().resolves()
        };

        contextMock = {
            extensionPath: '/fake/path',
            subscriptions: []
        };

        provider = new JulesChatViewProvider(contextMock as vscode.ExtensionContext, apiClientMock as JulesApiClient);

        postMessageStub = sinon.stub();
        webviewViewMock = {
            webview: {
                postMessage: postMessageStub,
                options: {},
                html: '',
                onDidReceiveMessage: sinon.stub(),
                asWebviewUri: sinon.stub().returns(vscode.Uri.parse('fake://uri'))
            }
        };

        provider.resolveWebviewView(webviewViewMock as any, {} as any, {} as any);
    });

    teardown(() => {
        sinon.restore();
    });

    test('resolveWebviewView sets up webview', () => {
        assert.strictEqual(webviewViewMock.webview.options.hasOwnProperty('enableScripts'), true);
        assert.ok(webviewViewMock.webview.html.includes('Jules AI'));
        assert.ok(webviewViewMock.webview.onDidReceiveMessage.called);
    });

    test('sendSelectedCode posts message', () => {
        provider.sendSelectedCode('console.log("hi")', 'javascript');

        assert.ok(postMessageStub.calledWith({
            type: 'selectedCode',
            code: 'console.log("hi")',
            language: 'javascript'
        }));
    });

    test('clearChat posts message', () => {
        provider.clearChat();

        assert.ok(postMessageStub.calledWith({
            type: 'clearChat'
        }));
    });

    test('handleMessage sendMessage with no API key', async () => {
        apiClientMock.hasApiKey.returns(false);
        const handleMessage = webviewViewMock.webview.onDidReceiveMessage.getCall(0).args[0];

        await handleMessage({ type: 'sendMessage', text: 'hello' });

        assert.ok(postMessageStub.calledWith({
            type: 'error',
            message: 'Please configure your Jules API key first.'
        }));
    });

    test('handleMessage sendMessage creates task', async () => {
        const handleMessage = webviewViewMock.webview.onDidReceiveMessage.getCall(0).args[0];

        await handleMessage({ type: 'sendMessage', text: 'hello' });

        assert.ok(postMessageStub.calledWith({ type: 'taskCreating' }));
        assert.ok(apiClientMock.createTask.calledWith({
            title: 'hello',
            description: 'hello',
            codeContext: undefined
        }));
        assert.ok(postMessageStub.calledWith({
            type: 'taskCreated',
            task: { id: 'task-1', title: 'Test Task', status: 'pending' }
        }));
    });

    test('handleMessage cancelTask', async () => {
        const handleMessage = webviewViewMock.webview.onDidReceiveMessage.getCall(0).args[0];

        await handleMessage({ type: 'cancelTask', taskId: 'task-1' });

        assert.ok(apiClientMock.cancelTask.calledWith('task-1'));
        assert.ok(postMessageStub.calledWith({
            type: 'taskUpdated',
            task: { id: 'task-1', status: 'cancelled' }
        }));
    });

    test('handleMessage refreshTasks', async () => {
        const handleMessage = webviewViewMock.webview.onDidReceiveMessage.getCall(0).args[0];

        await handleMessage({ type: 'refreshTasks' });

        assert.ok(apiClientMock.listTasks.called);
        assert.ok(postMessageStub.calledWith({
            type: 'tasksList',
            tasks: []
        }));
    });

    test('handleMessage getTask', async () => {
        const handleMessage = webviewViewMock.webview.onDidReceiveMessage.getCall(0).args[0];

        await handleMessage({ type: 'getTask', taskId: 'task-1' });

        assert.ok(apiClientMock.getTask.calledWith('task-1'));
        assert.ok(postMessageStub.calledWith({
            type: 'taskUpdated',
            task: { id: 'task-1', status: 'completed' }
        }));
    });

    test('handleMessage configureApiKey executes command', async () => {
        const executeCommandStub = sinon.stub(vscode.commands, 'executeCommand').resolves();
        const handleMessage = webviewViewMock.webview.onDidReceiveMessage.getCall(0).args[0];

        await handleMessage({ type: 'configureApiKey' });

        assert.ok(executeCommandStub.calledWith('jules.configureApiKey'));
    });

    test('handleMessage clearChat from webview', async () => {
        const handleMessage = webviewViewMock.webview.onDidReceiveMessage.getCall(0).args[0];

        await handleMessage({ type: 'clearChat' });

        assert.ok(postMessageStub.calledWith({ type: 'clearChat' }));
    });

    test('handleMessage openTaskUrl', async () => {
        const openExternalStub = sinon.stub(vscode.env, 'openExternal').resolves();
        const handleMessage = webviewViewMock.webview.onDidReceiveMessage.getCall(0).args[0];

        await handleMessage({ type: 'openTaskUrl', url: 'https://example.com' });

        assert.ok(openExternalStub.called);
    });

    test('handleMessage sendMessage handles error during creation', async () => {
        apiClientMock.createTask.rejects(new Error('Network error'));
        const handleMessage = webviewViewMock.webview.onDidReceiveMessage.getCall(0).args[0];

        await handleMessage({ type: 'sendMessage', text: 'hello' });

        assert.ok(postMessageStub.calledWith({
            type: 'error',
            message: 'Failed to create task: Network error'
        }));
    });

    test('handleMessage cancelTask handles error', async () => {
        apiClientMock.cancelTask.rejects(new Error('Failed to cancel'));
        const handleMessage = webviewViewMock.webview.onDidReceiveMessage.getCall(0).args[0];

        await handleMessage({ type: 'cancelTask', taskId: 'task-1' });

        assert.ok(postMessageStub.calledWith({
            type: 'error',
            message: 'Failed to cancel task: Failed to cancel'
        }));
    });

    test('handleMessage refreshTasks handles error', async () => {
        apiClientMock.listTasks.rejects(new Error('Failed to fetch'));
        const handleMessage = webviewViewMock.webview.onDidReceiveMessage.getCall(0).args[0];

        await handleMessage({ type: 'refreshTasks' });

        assert.ok(postMessageStub.calledWith({
            type: 'error',
            message: 'Failed to fetch tasks: Failed to fetch'
        }));
    });

    test('getTask handles completed status and polling', async () => {
        apiClientMock.getTask.resolves({ id: 'task-1', status: 'completed', pullRequestUrl: 'https://pr' });
        const handleMessage = webviewViewMock.webview.onDidReceiveMessage.getCall(0).args[0];

        // Let the polling timer execute using a mocked timer
        const clock = sinon.useFakeTimers();

        await handleMessage({ type: 'sendMessage', text: 'hello' });

        sinon.stub(vscode.env, 'openExternal').resolves();
        sinon.stub(vscode.window, 'showInformationMessage').resolves('Open PR' as any);

        // Advance timer
        clock.tick(5100);

        // Allow promises to resolve
        await Promise.resolve();
        await Promise.resolve();

        assert.ok(apiClientMock.getTask.calledWith('task-1'));
        assert.ok(postMessageStub.calledWith({
            type: 'taskUpdated',
            task: { id: 'task-1', status: 'completed', pullRequestUrl: 'https://pr' }
        }));

        clock.restore();
    });
});
