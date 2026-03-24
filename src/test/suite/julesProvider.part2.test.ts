import * as assert from 'assert';
import * as vscode from 'vscode';
import * as sinon from 'sinon';
import { JulesChatViewProvider } from '../../julesProvider';

suite('JulesProvider Test Suite - Part 2', () => {
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

  test('handleMessage refreshTasks no api key', async () => {
    mockApiClient.hasApiKey.returns(false);

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

    assert.strictEqual(mockApiClient.listTasks.called, false);
  });

  test('handleMessage getTask error ignored', async () => {
    mockApiClient.getTask.rejects(new Error('Get error'));

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
    // should not throw
    await messageHandler({ type: 'getTask', taskId: 'test-id' });
  });

  test('handleMessage openTaskUrl', async () => {
    const envStub = sinon.stub(vscode.env, 'openExternal').resolves();

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
    await messageHandler({ type: 'openTaskUrl', url: 'http://test' });

    assert.ok(envStub.called);
  });

  test('handleMessage clearChat from webview', async () => {
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
    await messageHandler({ type: 'clearChat' });

    const message = mockWebview.postMessage.getCalls().map((c: any) => c.args[0]).find((m: any) => m.type === 'clearChat');
    assert.ok(message);
  });

  test('polling completion notification', async () => {
    const clock = sinon.useFakeTimers({ shouldClearNativeTimers: true });
    const infoStub = sinon.stub(vscode.window, 'showInformationMessage').resolves('Open PR' as any);
    const envStub = sinon.stub(vscode.env, 'openExternal').resolves();

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

    // Create task starts polling
    await messageHandler({ type: 'sendMessage', text: 'test task' });

    // Fast forward to poll
    await clock.tickAsync(5100);

    assert.ok(infoStub.called);
    assert.ok(envStub.called);

    clock.restore();
  });
});
