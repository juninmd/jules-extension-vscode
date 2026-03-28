import * as assert from 'node:assert/strict';
import * as vscode from 'vscode';
import * as sinon from 'sinon';
import { JulesChatViewProvider } from '../julesProvider';
import { JulesApiClient } from '../julesApiClient';

suite('JulesChatViewProvider Core Test Suite', () => {
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
});