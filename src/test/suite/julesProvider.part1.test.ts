import * as assert from 'assert';
import * as vscode from 'vscode';
import * as sinon from 'sinon';
import { JulesChatViewProvider } from '../../julesProvider';

suite('JulesProvider Test Suite - Part 1', () => {
  let provider: JulesChatViewProvider;
  let mockContext: any;
  let mockApiClient: any;

  setup(() => {
    mockContext = {
      extensionPath: '/test/path',
      subscriptions: []
    };

    mockApiClient = {
      waitForInit: sinon.stub().resolves(),
      hasApiKey: sinon.stub().returns(true),
      createTask: sinon.stub().resolves({ id: 'test-id', status: 'pending', title: 'Task 1' }),
      cancelTask: sinon.stub().resolves(),
      listTasks: sinon.stub().resolves({ tasks: [] }),
      getTask: sinon.stub().resolves({ id: 'test-id', status: 'completed', title: 'Task 1', pullRequestUrl: 'http://pr' })
    };

    provider = new JulesChatViewProvider(mockContext, mockApiClient);
  });

  teardown(() => {
    sinon.restore();
  });

  test('constructor creates provider', () => {
    assert.ok(provider);
  });

  test('resolveWebviewView sets up webview', async () => {
    const mockWebview: any = {
      options: {},
      html: '',
      onDidReceiveMessage: sinon.stub(),
      postMessage: sinon.stub(),
      asWebviewUri: sinon.stub().returns({ toString: () => 'vscode-webview://test-uri' }),
      cspSource: 'vscode-webview://test-csp'
    };

    const mockWebviewView: any = {
      webview: mockWebview
    };

    provider.resolveWebviewView(mockWebviewView, {} as any, {} as any);

    assert.ok(mockWebview.options.enableScripts);
    assert.ok(mockWebview.html.includes('Jules AI Agent'));

    await mockApiClient.waitForInit();
    assert.ok(mockWebview.postMessage.called);
  });

  test('handleMessage sendMessage failure', async () => {
    mockApiClient.createTask.rejects(new Error('Test error'));

    const mockWebview: any = {
      options: {},
      html: '',
      onDidReceiveMessage: sinon.stub(),
      postMessage: sinon.stub(),
      asWebviewUri: sinon.stub().returns({ toString: () => 'vscode-webview://test-uri' }),
      cspSource: 'vscode-webview://test-csp'
    };

    const mockWebviewView: any = {
      webview: mockWebview
    };

    provider.resolveWebviewView(mockWebviewView, {} as any, {} as any);

    const messageHandler = mockWebview.onDidReceiveMessage.getCall(0).args[0];
    await messageHandler({ type: 'sendMessage', text: 'test task' });

    const message = mockWebview.postMessage.getCalls().map((c: any) => c.args[0]).find((m: any) => m.type === 'error');
    assert.ok(message);
    assert.strictEqual(message.message, 'Failed to create task: Test error');
  });

  test('handleMessage cancelTask failure', async () => {
    mockApiClient.cancelTask.rejects(new Error('Cancel error'));

    const mockWebview: any = {
      options: {},
      html: '',
      onDidReceiveMessage: sinon.stub(),
      postMessage: sinon.stub(),
      asWebviewUri: sinon.stub().returns({ toString: () => 'vscode-webview://test-uri' }),
      cspSource: 'vscode-webview://test-csp'
    };

    const mockWebviewView: any = {
      webview: mockWebview
    };

    provider.resolveWebviewView(mockWebviewView, {} as any, {} as any);

    const messageHandler = mockWebview.onDidReceiveMessage.getCall(0).args[0];
    await messageHandler({ type: 'cancelTask', taskId: 'test-id' });

    const message = mockWebview.postMessage.getCalls().map((c: any) => c.args[0]).find((m: any) => m.type === 'error');
    assert.ok(message);
    assert.strictEqual(message.message, 'Failed to cancel task: Cancel error');
  });

  test('handleMessage refreshTasks failure', async () => {
    mockApiClient.listTasks.rejects(new Error('Refresh error'));

    const mockWebview: any = {
      options: {},
      html: '',
      onDidReceiveMessage: sinon.stub(),
      postMessage: sinon.stub(),
      asWebviewUri: sinon.stub().returns({ toString: () => 'vscode-webview://test-uri' }),
      cspSource: 'vscode-webview://test-csp'
    };

    const mockWebviewView: any = {
      webview: mockWebview
    };

    provider.resolveWebviewView(mockWebviewView, {} as any, {} as any);

    const messageHandler = mockWebview.onDidReceiveMessage.getCall(0).args[0];
    await messageHandler({ type: 'refreshTasks' });

    const message = mockWebview.postMessage.getCalls().map((c: any) => c.args[0]).find((m: any) => m.type === 'error');
    assert.ok(message);
    assert.strictEqual(message.message, 'Failed to fetch tasks: Refresh error');
  });
});
