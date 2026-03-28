import * as assert from 'assert';
import * as vscode from 'vscode';
import * as sinon from 'sinon';
import { JulesChatViewProvider } from '../julesProvider';
import { JulesApiClient } from '../julesApiClient';

suite('JulesChatViewProvider Test Suite', () => {
  let context: vscode.ExtensionContext;
  let apiClient: sinon.SinonStubbedInstance<JulesApiClient>;
  let provider: JulesChatViewProvider;
  let webviewView: vscode.WebviewView;
  let postMessageStub: sinon.SinonStub;

  setup(() => {
    context = {
      extensionPath: '/mock/path',
      subscriptions: [],
    } as unknown as vscode.ExtensionContext;

    apiClient = sinon.createStubInstance(JulesApiClient);
    apiClient.waitForInit.resolves();

    provider = new JulesChatViewProvider(context, apiClient as unknown as JulesApiClient);

    postMessageStub = sinon.stub().resolves(true);

    webviewView = {
      webview: {
        options: {},
        html: '',
        onDidReceiveMessage: sinon.stub(),
        postMessage: postMessageStub,
        asWebviewUri: (uri: vscode.Uri) => uri,
        cspSource: 'mock-csp'
      },
      onDidDispose: sinon.stub(),
      onDidChangeVisibility: sinon.stub(),
      visible: true
    } as unknown as vscode.WebviewView;
  });

  teardown(() => {
    sinon.restore();
  });

  test('resolveWebviewView should set up webview', () => {
    provider.resolveWebviewView(webviewView, {} as any, {} as any);

    assert.ok(webviewView.webview.html.includes('Jules AI Agent'));
    assert.ok((webviewView.webview.onDidReceiveMessage as sinon.SinonStub).calledOnce);
  });

  test('notifyApiKeyChanged should post message', () => {
    provider.resolveWebviewView(webviewView, {} as any, {} as any);
    provider.notifyApiKeyChanged(true);

    assert.ok(postMessageStub.calledWith({
      type: 'apiKeyStatus',
      hasKey: true
    }));
  });

  test('sendSelectedCode should post message', () => {
    provider.resolveWebviewView(webviewView, {} as any, {} as any);
    provider.sendSelectedCode('console.log("test");', 'javascript');

    assert.ok(postMessageStub.calledWith({
      type: 'selectedCode',
      code: 'console.log("test");',
      language: 'javascript'
    }));
  });

  test('clearChat should post message', () => {
    provider.resolveWebviewView(webviewView, {} as any, {} as any);
    provider.clearChat();

    assert.ok(postMessageStub.calledWith({
      type: 'clearChat'
    }));
  });

  suite('handleMessage', () => {
    let handleMessage: (message: any) => Promise<void>;

    setup(() => {
      provider.resolveWebviewView(webviewView, {} as any, {} as any);
      // Extract the message handler registered with the webview
      handleMessage = (webviewView.webview.onDidReceiveMessage as sinon.SinonStub).firstCall.args[0];
    });

    test('configureApiKey should execute command', async () => {
      const executeCommandStub = sinon.stub(vscode.commands, 'executeCommand');

      await handleMessage({ type: 'configureApiKey' });

      assert.ok(executeCommandStub.calledWith('jules.configureApiKey'));
    });

    test('sendMessage should create task if api key exists', async () => {
      apiClient.hasApiKey.returns(true);
      const mockTask = { id: 't1', title: 'Task 1', status: 'pending' };
      apiClient.createTask.resolves(mockTask as any);

      await handleMessage({ type: 'sendMessage', text: 'Fix bug', codeContext: 'code' });

      assert.ok(apiClient.createTask.calledWith({
        title: 'Fix bug',
        description: 'Fix bug',
        codeContext: 'code'
      }));
      assert.ok(postMessageStub.calledWith({ type: 'taskCreating' }));
      assert.ok(postMessageStub.calledWith({ type: 'taskCreated', task: mockTask }));
    });

    test('sendMessage should post error if no api key', async () => {
      apiClient.hasApiKey.returns(false);

      await handleMessage({ type: 'sendMessage', text: 'Fix bug' });

      assert.ok(postMessageStub.calledWith({
        type: 'error',
        message: 'Please configure your Jules API key first.'
      }));
      assert.ok(apiClient.createTask.notCalled);
    });

    test('sendMessage should post error on creation failure', async () => {
      apiClient.hasApiKey.returns(true);
      apiClient.createTask.rejects(new Error('API failure'));

      await handleMessage({ type: 'sendMessage', text: 'Fix bug' });

      assert.ok(postMessageStub.calledWith({
        type: 'error',
        message: 'Failed to create task: API failure'
      }));
    });

    test('clearChat message should clear chat', async () => {
      await handleMessage({ type: 'clearChat' });

      assert.ok(postMessageStub.calledWith({ type: 'clearChat' }));
    });

    test('cancelTask should call apiClient and notify', async () => {
      apiClient.cancelTask.resolves();

      await handleMessage({ type: 'cancelTask', taskId: 't1' });

      assert.ok(apiClient.cancelTask.calledWith('t1'));
      assert.ok(postMessageStub.calledWith({
        type: 'taskUpdated',
        task: { id: 't1', status: 'cancelled' }
      }));
    });

    test('cancelTask should post error on failure', async () => {
      apiClient.cancelTask.rejects(new Error('Cancel failed'));

      await handleMessage({ type: 'cancelTask', taskId: 't1' });

      assert.ok(postMessageStub.calledWith({
        type: 'error',
        message: 'Failed to cancel task: Cancel failed'
      }));
    });

    test('refreshTasks should fetch and post tasks', async () => {
      apiClient.hasApiKey.returns(true);
      const mockTasks = [{ id: 't1', title: 'Task 1' }];
      apiClient.listTasks.resolves({ tasks: mockTasks as any });

      await handleMessage({ type: 'refreshTasks' });

      assert.ok(apiClient.listTasks.calledOnce);
      assert.ok(postMessageStub.calledWith({
        type: 'tasksList',
        tasks: mockTasks
      }));
    });

    test('refreshTasks should return early if no api key', async () => {
      apiClient.hasApiKey.returns(false);

      await handleMessage({ type: 'refreshTasks' });

      assert.ok(apiClient.listTasks.notCalled);
    });

    test('refreshTasks should handle error on fetch failure', async () => {
      apiClient.hasApiKey.returns(true);
      apiClient.listTasks.rejects(new Error('Fetch failed'));

      await handleMessage({ type: 'refreshTasks' });

      assert.ok(postMessageStub.calledWith({
        type: 'error',
        message: 'Failed to fetch tasks: Fetch failed'
      }));
    });

    test('openTaskUrl should open external uri', async () => {
      const openExternalStub = sinon.stub(vscode.env, 'openExternal').resolves(true);

      await handleMessage({ type: 'openTaskUrl', url: 'https://example.com/pr/1' });

      assert.ok(openExternalStub.calledOnce);
      assert.strictEqual(openExternalStub.firstCall.args[0].toString(), 'https://example.com/pr/1');
    });

    test('getTask should fetch and update task', async () => {
      const mockTask = { id: 't1', title: 'Task 1', status: 'completed' };
      apiClient.getTask.resolves(mockTask as any);

      await handleMessage({ type: 'getTask', taskId: 't1' });

      assert.ok(apiClient.getTask.calledWith('t1'));
      assert.ok(postMessageStub.calledWith({
        type: 'taskUpdated',
        task: mockTask
      }));
    });
  });
});