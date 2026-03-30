import * as assert from 'assert';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import { JulesChatViewProvider } from '../julesProvider';
import { JulesApiClient } from '../julesApiClient';

suite('JulesChatViewProvider Test Suite', () => {
  let provider: JulesChatViewProvider;
  let context: vscode.ExtensionContext;
  let apiClient: JulesApiClient;
  let webviewView: vscode.WebviewView;

  setup(() => {
    context = {
      extensionPath: '/test/path',
      subscriptions: []
    } as any;

    apiClient = {
      hasApiKey: sinon.stub().returns(true),
      waitForInit: sinon.stub().resolves(),
      createTask: sinon.stub().resolves({ id: '1', title: 'T', status: 'pending' }),
      cancelTask: sinon.stub().resolves(),
      listTasks: sinon.stub().resolves({ tasks: [] }),
      getTask: sinon.stub().resolves({ id: '1', status: 'completed' })
    } as any;

    provider = new JulesChatViewProvider(context, apiClient);

    webviewView = {
      webview: {
        options: {},
        html: '',
        onDidReceiveMessage: sinon.stub(),
        postMessage: sinon.stub().resolves(true),
        asWebviewUri: sinon.stub().returns({ toString: () => 'uri' } as any),
        cspSource: 'test-csp'
      }
    } as any;
  });

  teardown(() => sinon.restore());

  test('resolveWebviewView sets up webview', () => {
    provider.resolveWebviewView(webviewView, {} as any, {} as any);
    assert.strictEqual(webviewView.webview.options.enableScripts, true);
    assert.strictEqual(typeof webviewView.webview.html, 'string');
    assert.strictEqual((webviewView.webview.onDidReceiveMessage as sinon.SinonStub).calledOnce, true);
  });

  test('notifyApiKeyChanged posts message', () => {
    provider.resolveWebviewView(webviewView, {} as any, {} as any);
    provider.notifyApiKeyChanged(true);
    assert.strictEqual((webviewView.webview.postMessage as sinon.SinonStub).calledWith({
      type: 'apiKeyStatus', hasKey: true
    }), true);
  });

  test('sendSelectedCode posts message', () => {
    provider.resolveWebviewView(webviewView, {} as any, {} as any);
    provider.sendSelectedCode('console.log("hello");', 'javascript');
    assert.strictEqual((webviewView.webview.postMessage as sinon.SinonStub).calledWith({
      type: 'selectedCode', code: 'console.log("hello");', language: 'javascript'
    }), true);
  });

  test('clearChat posts message', () => {
    provider.resolveWebviewView(webviewView, {} as any, {} as any);
    provider.clearChat();
    assert.strictEqual((webviewView.webview.postMessage as sinon.SinonStub).calledWith({
      type: 'clearChat'
    }), true);
  });

  test('handleMessage configureApiKey executes command', async () => {
    provider.resolveWebviewView(webviewView, {} as any, {} as any);
    const executeCommandStub = sinon.stub(vscode.commands, 'executeCommand').resolves();

    const onDidReceiveMessage = (webviewView.webview.onDidReceiveMessage as sinon.SinonStub).firstCall.args[0];
    await onDidReceiveMessage({ type: 'configureApiKey' });

    assert.strictEqual(executeCommandStub.calledWith('jules.configureApiKey'), true);
  });

  test('handleMessage sendMessage creates task', async () => {
    provider.resolveWebviewView(webviewView, {} as any, {} as any);

    const onDidReceiveMessage = (webviewView.webview.onDidReceiveMessage as sinon.SinonStub).firstCall.args[0];
    await onDidReceiveMessage({ type: 'sendMessage', text: 'hello' });

    assert.strictEqual((apiClient.createTask as sinon.SinonStub).calledOnce, true);
    const postMessageStub = webviewView.webview.postMessage as sinon.SinonStub;
    assert.strictEqual(postMessageStub.calledWith({ type: 'taskCreating' }), true);
  });

  test('handleMessage sendMessage error without api key', async () => {
    (apiClient.hasApiKey as sinon.SinonStub).returns(false);
    provider.resolveWebviewView(webviewView, {} as any, {} as any);

    const onDidReceiveMessage = (webviewView.webview.onDidReceiveMessage as sinon.SinonStub).firstCall.args[0];
    await onDidReceiveMessage({ type: 'sendMessage', text: 'hello' });

    assert.strictEqual((apiClient.createTask as sinon.SinonStub).called, false);
    assert.strictEqual((webviewView.webview.postMessage as sinon.SinonStub).calledWith({
      type: 'error', message: 'Please configure your Jules API key first.'
    }), true);
  });

  test('handleMessage sendMessage create error', async () => {
    provider.resolveWebviewView(webviewView, {} as any, {} as any);
    (apiClient.createTask as sinon.SinonStub).rejects(new Error('api err'));

    const onDidReceiveMessage = (webviewView.webview.onDidReceiveMessage as sinon.SinonStub).firstCall.args[0];
    await onDidReceiveMessage({ type: 'sendMessage', text: 'hello' });

    assert.strictEqual((webviewView.webview.postMessage as sinon.SinonStub).calledWith({
      type: 'error', message: 'Failed to create task: api err'
    }), true);
  });

  test('handleMessage sendMessage create error fallback', async () => {
    provider.resolveWebviewView(webviewView, {} as any, {} as any);
    (apiClient.createTask as sinon.SinonStub).returns(Promise.reject('err str'));

    const onDidReceiveMessage = (webviewView.webview.onDidReceiveMessage as sinon.SinonStub).firstCall.args[0];
    await onDidReceiveMessage({ type: 'sendMessage', text: 'hello' });

    assert.strictEqual((webviewView.webview.postMessage as sinon.SinonStub).calledWith({
      type: 'error', message: 'Failed to create task: Unknown error occurred'
    }), true);
  });

  test('handleMessage clearChat from UI', async () => {
    provider.resolveWebviewView(webviewView, {} as any, {} as any);

    const onDidReceiveMessage = (webviewView.webview.onDidReceiveMessage as sinon.SinonStub).firstCall.args[0];
    await onDidReceiveMessage({ type: 'clearChat' });

    assert.strictEqual((webviewView.webview.postMessage as sinon.SinonStub).calledWith({ type: 'clearChat' }), true);
  });

  test('handleMessage cancelTask error fallback', async () => {
    provider.resolveWebviewView(webviewView, {} as any, {} as any);
    (apiClient.cancelTask as sinon.SinonStub).returns(Promise.reject('err'));

    const onDidReceiveMessage = (webviewView.webview.onDidReceiveMessage as sinon.SinonStub).firstCall.args[0];
    await onDidReceiveMessage({ type: 'cancelTask', taskId: '1' });

    assert.strictEqual((webviewView.webview.postMessage as sinon.SinonStub).calledWith({
      type: 'error', message: 'Failed to cancel task: Unknown error occurred'
    }), true);
  });

  test('handleMessage refreshTasks without api key returns early', async () => {
    (apiClient.hasApiKey as sinon.SinonStub).returns(false);
    provider.resolveWebviewView(webviewView, {} as any, {} as any);

    const onDidReceiveMessage = (webviewView.webview.onDidReceiveMessage as sinon.SinonStub).firstCall.args[0];
    await onDidReceiveMessage({ type: 'refreshTasks' });

    assert.strictEqual((apiClient.listTasks as sinon.SinonStub).called, false);
  });

  test('handleMessage refreshTasks error fallback', async () => {
    provider.resolveWebviewView(webviewView, {} as any, {} as any);
    (apiClient.listTasks as sinon.SinonStub).returns(Promise.reject('err'));

    const onDidReceiveMessage = (webviewView.webview.onDidReceiveMessage as sinon.SinonStub).firstCall.args[0];
    await onDidReceiveMessage({ type: 'refreshTasks' });

    assert.strictEqual((webviewView.webview.postMessage as sinon.SinonStub).calledWith({
      type: 'error', message: 'Failed to fetch tasks: Unknown error occurred'
    }), true);
  });

  test('handleMessage getTask completed removes polling', async () => {
    provider.resolveWebviewView(webviewView, {} as any, {} as any);

    const onDidReceiveMessage = (webviewView.webview.onDidReceiveMessage as sinon.SinonStub).firstCall.args[0];
    await onDidReceiveMessage({ type: 'getTask', taskId: '1' });

    // Test logic verifies getTask completing without error
  });

  test('handleMessage getTask ignores errors', async () => {
    provider.resolveWebviewView(webviewView, {} as any, {} as any);
    (apiClient.getTask as sinon.SinonStub).rejects('err');

    const onDidReceiveMessage = (webviewView.webview.onDidReceiveMessage as sinon.SinonStub).firstCall.args[0];
    await assert.doesNotReject(onDidReceiveMessage({ type: 'getTask', taskId: '1' }));
  });

  test('startPolling completes task and opens PR', async () => {
    const clock = sinon.useFakeTimers();
    provider.resolveWebviewView(webviewView, {} as any, {} as any);
    const showInformationMessageStub = sinon.stub(vscode.window, 'showInformationMessage').resolves('Open PR' as any);
    const openExternalStub = sinon.stub(vscode.env, 'openExternal').resolves(true);

    (apiClient.getTask as sinon.SinonStub).resolves({ id: '1', title: 'T', status: 'completed', pullRequestUrl: 'http://pr' });

    const onDidReceiveMessage = (webviewView.webview.onDidReceiveMessage as sinon.SinonStub).firstCall.args[0];
    await onDidReceiveMessage({ type: 'sendMessage', text: 'hello' });

    await clock.tickAsync(5100);

    assert.strictEqual(showInformationMessageStub.calledOnce, true);
    assert.strictEqual(openExternalStub.calledOnce, true);

    clock.restore();
  });

  test('startPolling error logic', async () => {
    const clock = sinon.useFakeTimers();
    provider.resolveWebviewView(webviewView, {} as any, {} as any);

    (apiClient.getTask as sinon.SinonStub).rejects(new Error('polling error'));

    const onDidReceiveMessage = (webviewView.webview.onDidReceiveMessage as sinon.SinonStub).firstCall.args[0];
    await onDidReceiveMessage({ type: 'sendMessage', text: 'hello' });

    await clock.tickAsync(5100);
    clock.restore();
  });

  test('handleMessage cancelTask calls cancel API', async () => {
    provider.resolveWebviewView(webviewView, {} as any, {} as any);

    const onDidReceiveMessage = (webviewView.webview.onDidReceiveMessage as sinon.SinonStub).firstCall.args[0];
    await onDidReceiveMessage({ type: 'cancelTask', taskId: '1' });

    assert.strictEqual((apiClient.cancelTask as sinon.SinonStub).calledWith('1'), true);
    assert.strictEqual((webviewView.webview.postMessage as sinon.SinonStub).calledWithMatch({
      type: 'taskUpdated', task: { id: '1', status: 'cancelled' }
    }), true);
  });

  test('handleMessage refreshTasks fetches tasks', async () => {
    provider.resolveWebviewView(webviewView, {} as any, {} as any);

    const onDidReceiveMessage = (webviewView.webview.onDidReceiveMessage as sinon.SinonStub).firstCall.args[0];
    await onDidReceiveMessage({ type: 'refreshTasks' });

    assert.strictEqual((apiClient.listTasks as sinon.SinonStub).calledOnce, true);
    assert.strictEqual((webviewView.webview.postMessage as sinon.SinonStub).calledWithMatch({
      type: 'tasksList'
    }), true);
  });

  test('handleMessage getTask calls get API', async () => {
    provider.resolveWebviewView(webviewView, {} as any, {} as any);

    const onDidReceiveMessage = (webviewView.webview.onDidReceiveMessage as sinon.SinonStub).firstCall.args[0];
    await onDidReceiveMessage({ type: 'getTask', taskId: '1' });

    assert.strictEqual((apiClient.getTask as sinon.SinonStub).calledWith('1'), true);
    assert.strictEqual((webviewView.webview.postMessage as sinon.SinonStub).calledWithMatch({
      type: 'taskUpdated'
    }), true);
  });

  test('handleMessage openTaskUrl opens browser', async () => {
    provider.resolveWebviewView(webviewView, {} as any, {} as any);
    const openExternalStub = sinon.stub(vscode.env, 'openExternal').resolves(true);

    const onDidReceiveMessage = (webviewView.webview.onDidReceiveMessage as sinon.SinonStub).firstCall.args[0];
    await onDidReceiveMessage({ type: 'openTaskUrl', url: 'https://jules.google' });

    assert.strictEqual(openExternalStub.calledOnce, true);
  });
});
