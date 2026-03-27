import * as assert from 'assert';
import * as vscode from 'vscode';
import * as sinon from 'sinon';
import { JulesChatViewProvider } from '../../julesProvider';
import { JulesApiClient } from '../../julesApiClient';

suite('JulesChatViewProvider Test Suite', () => {
  let contextMock: any;
  let apiClientMock: Partial<JulesApiClient>;
  let provider: JulesChatViewProvider;

  setup(() => {
    contextMock = {
      extensionPath: '/mock/path',
      subscriptions: []
    };

    apiClientMock = {
      waitForInit: sinon.stub().resolves(),
      hasApiKey: sinon.stub().returns(true),
      createTask: sinon.stub().resolves({ id: '123', status: 'pending' }),
      getTask: sinon.stub().resolves({ id: '123', status: 'completed', pullRequestUrl: 'https://github.com' }),
      listTasks: sinon.stub().resolves({ tasks: [] }),
      cancelTask: sinon.stub().resolves()
    };

    provider = new JulesChatViewProvider(contextMock as any, apiClientMock as JulesApiClient);
  });

  teardown(() => {
    sinon.restore();
  });

  test('resolveWebviewView should set up webview correctly', () => {
    const webviewViewMock: any = {
      webview: {
        options: {},
        html: '',
        onDidReceiveMessage: sinon.stub(),
        postMessage: sinon.stub(),
        asWebviewUri: sinon.stub().returns('mock-uri')
      }
    };

    provider.resolveWebviewView(webviewViewMock, {} as any, {} as any);

    assert.ok(webviewViewMock.webview.html.length > 0);
    assert.strictEqual(webviewViewMock.webview.options.enableScripts, true);
    assert.ok(webviewViewMock.webview.onDidReceiveMessage.calledOnce);
  });

  test('notifyApiKeyChanged should post message', () => {
    const postMessageStub = sinon.stub();
    const webviewViewMock: any = {
      webview: {
        options: {},
        html: '',
        onDidReceiveMessage: sinon.stub(),
        postMessage: postMessageStub,
        asWebviewUri: sinon.stub().returns('mock-uri')
      }
    };

    provider.resolveWebviewView(webviewViewMock, {} as any, {} as any);
    provider.notifyApiKeyChanged(true);

    assert.ok(postMessageStub.calledWith({ type: 'apiKeyStatus', hasKey: true }));
  });

  test('sendSelectedCode should post message', () => {
    const postMessageStub = sinon.stub();
    const webviewViewMock: any = {
      webview: {
        options: {},
        html: '',
        onDidReceiveMessage: sinon.stub(),
        postMessage: postMessageStub,
        asWebviewUri: sinon.stub().returns('mock-uri')
      }
    };

    provider.resolveWebviewView(webviewViewMock, {} as any, {} as any);
    provider.sendSelectedCode('const a = 1;', 'javascript');

    assert.ok(postMessageStub.calledWith({ type: 'selectedCode', code: 'const a = 1;', language: 'javascript' }));
  });

  test('clearChat should post message', () => {
    const postMessageStub = sinon.stub();
    const webviewViewMock: any = {
      webview: {
        options: {},
        html: '',
        onDidReceiveMessage: sinon.stub(),
        postMessage: postMessageStub,
        asWebviewUri: sinon.stub().returns('mock-uri')
      }
    };

    provider.resolveWebviewView(webviewViewMock, {} as any, {} as any);
    provider.clearChat();

    assert.ok(postMessageStub.calledWith({ type: 'clearChat' }));
  });
});
