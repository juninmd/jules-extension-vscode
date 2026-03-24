import * as assert from 'assert';
import * as vscode from 'vscode';
import * as sinon from 'sinon';
import * as extension from '../../extension';

suite('Extension Test Suite', () => {
  let mockContext: any;
  let mockConfiguration: any;

  setup(() => {
    mockContext = {
      subscriptions: [],
      secrets: {
        get: sinon.stub().resolves('test-api-key'),
        store: sinon.stub().resolves()
      },
      extensionPath: '/test/path'
    };

    mockConfiguration = {
      get: sinon.stub().returns(true) // autoOpenOnStartup
    };

    sinon.stub(vscode.workspace, 'getConfiguration').returns(mockConfiguration);

    sinon.stub(vscode.window, 'showInformationMessage').resolves('Configure API Key' as any);
    sinon.stub(vscode.window, 'showInputBox').resolves('new-key');
    sinon.stub(vscode.commands, 'executeCommand').resolves();
    sinon.stub(vscode.commands, 'registerCommand').returns({ dispose: () => {} });
    sinon.stub(vscode.window, 'registerWebviewViewProvider').returns({ dispose: () => {} });
  });

  teardown(() => {
    sinon.restore();
  });

  test('activate registers commands and webview', async () => {
    await extension.activate(mockContext);

    const registerCommandStub = vscode.commands.registerCommand as sinon.SinonStub;
    assert.ok(registerCommandStub.calledWith('jules.openPanel'));
    assert.ok(registerCommandStub.calledWith('jules.configureApiKey'));
    assert.ok(registerCommandStub.calledWith('jules.newTask'));
    assert.ok(registerCommandStub.calledWith('jules.clearChat'));

    const registerWebviewStub = vscode.window.registerWebviewViewProvider as sinon.SinonStub;
    assert.ok(registerWebviewStub.calledWith('jules.chatView'));

    const execStub = vscode.commands.executeCommand as sinon.SinonStub;
    assert.ok(execStub.calledWith('workbench.view.extension.jules'));
  });

  test('activate shows configure key prompt if no key', async () => {
    mockContext.secrets.get = sinon.stub().resolves(undefined);
    await extension.activate(mockContext);

    const showInfoStub = vscode.window.showInformationMessage as sinon.SinonStub;
    assert.ok(showInfoStub.called);

    const storeSecretStub = mockContext.secrets.store as sinon.SinonStub;
    assert.ok(storeSecretStub.calledWith('jules.apiKey', 'new-key'));
  });

  test('commands execute properly', async () => {
    await extension.activate(mockContext);

    const registerCommandStub = vscode.commands.registerCommand as sinon.SinonStub;

    // jules.openPanel
    const openPanelCmd = registerCommandStub.getCalls().find(c => c.args[0] === 'jules.openPanel');
    if (openPanelCmd) {
      await openPanelCmd.args[1]();
      assert.ok((vscode.commands.executeCommand as sinon.SinonStub).calledWith('workbench.view.extension.jules'));
    }

    // jules.configureApiKey
    const configKeyCmd = registerCommandStub.getCalls().find(c => c.args[0] === 'jules.configureApiKey');
    if (configKeyCmd) {
      await configKeyCmd.args[1]();
      assert.ok(mockContext.secrets.store.calledWith('jules.apiKey', 'new-key'));
    }
  });

  test('commands newTask executes with selection', async () => {
    const mockEditor = {
      document: {
        getText: sinon.stub().returns('const a = 1;'),
        languageId: 'typescript'
      },
      selection: {}
    };
    sinon.stub(vscode.window, 'activeTextEditor').value(mockEditor);

    await extension.activate(mockContext);

    const registerCommandStub = vscode.commands.registerCommand as sinon.SinonStub;
    const newTaskCmd = registerCommandStub.getCalls().find(c => c.args[0] === 'jules.newTask');

    if (newTaskCmd) {
      await newTaskCmd.args[1]();
      assert.ok((vscode.commands.executeCommand as sinon.SinonStub).calledWith('workbench.view.extension.jules'));
    }
  });

  test('commands newTask executes without selection', async () => {
    const mockEditor = {
      document: {
        getText: sinon.stub().returns(''),
        languageId: 'typescript'
      },
      selection: {}
    };
    sinon.stub(vscode.window, 'activeTextEditor').value(mockEditor);

    await extension.activate(mockContext);

    const registerCommandStub = vscode.commands.registerCommand as sinon.SinonStub;
    const newTaskCmd = registerCommandStub.getCalls().find(c => c.args[0] === 'jules.newTask');

    if (newTaskCmd) {
      await newTaskCmd.args[1]();
      assert.ok((vscode.commands.executeCommand as sinon.SinonStub).calledWith('workbench.view.extension.jules'));
    }
  });

  test('commands clearChat executes', async () => {
    await extension.activate(mockContext);

    const registerCommandStub = vscode.commands.registerCommand as sinon.SinonStub;
    const clearChatCmd = registerCommandStub.getCalls().find(c => c.args[0] === 'jules.clearChat');

    if (clearChatCmd) {
      await clearChatCmd.args[1]();
    }
  });

  test('deactivate executes without error', () => {
    assert.doesNotThrow(() => extension.deactivate());
  });
});
