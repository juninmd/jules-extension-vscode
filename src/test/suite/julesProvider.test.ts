import * as assert from 'assert';
import * as vscode from 'vscode';
import * as sinon from 'sinon';
import { JulesChatViewProvider } from '../../julesProvider';
import { JulesApiClient } from '../../julesApiClient';

suite('JulesChatViewProvider Test Suite', () => {
    let context: vscode.ExtensionContext;
    let apiClient: JulesApiClient;
    let provider: JulesChatViewProvider;
    let webviewView: vscode.WebviewView;

    setup(() => {
        context = {
            extensionPath: '/test/path',
            subscriptions: [],
            secrets: {
                get: sinon.stub().resolves('test-key'),
                store: sinon.stub().resolves(),
                onDidChange: sinon.stub(),
                delete: sinon.stub().resolves()
            }
        } as unknown as vscode.ExtensionContext;

        apiClient = new JulesApiClient(context);
        sinon.stub(apiClient, 'waitForInit').resolves();
        sinon.stub(apiClient, 'hasApiKey').returns(true);
        sinon.stub(apiClient, 'createTask').resolves({
            id: 'task-1',
            title: 'Test',
            description: 'Test Description',
            status: 'pending',
            createdAt: 'now',
            updatedAt: 'now'
        });
        sinon.stub(apiClient, 'cancelTask').resolves();
        sinon.stub(apiClient, 'listTasks').resolves({ tasks: [] });
        sinon.stub(apiClient, 'getTask').resolves({
            id: 'task-1',
            title: 'Test',
            description: 'Test Description',
            status: 'completed',
            createdAt: 'now',
            updatedAt: 'now'
        });

        provider = new JulesChatViewProvider(context, apiClient);

        webviewView = {
            webview: {
                options: {},
                html: '',
                onDidReceiveMessage: sinon.stub(),
                postMessage: sinon.stub(),
                asWebviewUri: sinon.stub().returns(vscode.Uri.parse('https://webview.uri'))
            },
            onDidDispose: sinon.stub(),
            onDidChangeVisibility: sinon.stub()
        } as unknown as vscode.WebviewView;
    });

    teardown(() => {
        sinon.restore();
    });

    test('resolveWebviewView sets options and html', () => {
        provider.resolveWebviewView(webviewView, {} as vscode.WebviewViewResolveContext, {} as vscode.CancellationToken);

        assert.ok(webviewView.webview.options.enableScripts);
        assert.ok(webviewView.webview.html.includes('Jules AI Agent'));
    });

    test('notifyApiKeyChanged sends message', () => {
        provider.resolveWebviewView(webviewView, {} as vscode.WebviewViewResolveContext, {} as vscode.CancellationToken);
        provider.notifyApiKeyChanged(true);

        assert.ok((webviewView.webview.postMessage as sinon.SinonStub).calledWith({
            type: 'apiKeyStatus',
            hasKey: true
        }));
    });

    test('sendSelectedCode sends message', () => {
        provider.resolveWebviewView(webviewView, {} as vscode.WebviewViewResolveContext, {} as vscode.CancellationToken);
        provider.sendSelectedCode('const a = 1;', 'javascript');

        assert.ok((webviewView.webview.postMessage as sinon.SinonStub).calledWith({
            type: 'selectedCode',
            code: 'const a = 1;',
            language: 'javascript'
        }));
    });

    test('clearChat sends message', () => {
        provider.resolveWebviewView(webviewView, {} as vscode.WebviewViewResolveContext, {} as vscode.CancellationToken);
        provider.clearChat();

        assert.ok((webviewView.webview.postMessage as sinon.SinonStub).calledWith({
            type: 'clearChat'
        }));
    });
});