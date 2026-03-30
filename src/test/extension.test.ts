import * as assert from 'assert';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import * as extension from '../extension';
import { JulesApiClient } from '../julesApiClient';
import { JulesChatViewProvider } from '../julesProvider';

suite('Extension Test Suite', () => {
  let context: vscode.ExtensionContext;
  let registerWebviewViewProviderStub: sinon.SinonStub;
  let registerCommandStub: sinon.SinonStub;
  let executeCommandStub: sinon.SinonStub;
  let showInformationMessageStub: sinon.SinonStub;
  let showInputBoxStub: sinon.SinonStub;
  let getConfigurationStub: sinon.SinonStub;

  setup(() => {
    context = {
      subscriptions: [],
      secrets: {
        get: sinon.stub().resolves(undefined),
        store: sinon.stub().resolves(),
      },
      extensionPath: '/test/path'
    } as any;

    registerWebviewViewProviderStub = sinon.stub(vscode.window, 'registerWebviewViewProvider');
    registerCommandStub = sinon.stub(vscode.commands, 'registerCommand');
    executeCommandStub = sinon.stub(vscode.commands, 'executeCommand').resolves();
    showInformationMessageStub = sinon.stub(vscode.window, 'showInformationMessage').resolves('Later' as any);
    showInputBoxStub = sinon.stub(vscode.window, 'showInputBox').resolves('test-key');
    getConfigurationStub = sinon.stub(vscode.workspace, 'getConfiguration').returns({
      get: (key: string) => key === 'autoOpenOnStartup' ? false : undefined,
      has: () => true,
      inspect: () => undefined,
      update: () => Promise.resolve()
    } as any);

    sinon.stub(JulesApiClient.prototype, 'waitForInit').resolves();
    sinon.stub(JulesApiClient.prototype, 'hasApiKey').returns(false);
  });

  teardown(() => {
    sinon.restore();
    extension.deactivate();
  });

  test('activate registers provider and commands', async () => {
    await extension.activate(context);

    assert.strictEqual(registerWebviewViewProviderStub.calledOnce, true);
    assert.strictEqual(registerWebviewViewProviderStub.firstCall.args[0], JulesChatViewProvider.viewType);

    // openPanel, configureApiKey, newTask, clearChat
    assert.strictEqual(registerCommandStub.callCount, 4);
    assert.strictEqual(context.subscriptions.length, 5); // 1 provider + 4 commands

    // Check showInformationMessage was called (hasApiKey is mocked to return false)
    assert.strictEqual(showInformationMessageStub.calledOnce, true);
  });

  test('autoOpenOnStartup executes command', async () => {
    getConfigurationStub.returns({
      get: (key: string) => key === 'autoOpenOnStartup' ? true : undefined,
    } as any);

    await extension.activate(context);

    // Should execute workbench.view.extension.jules once
    assert.strictEqual(executeCommandStub.calledWith('workbench.view.extension.jules'), true);
  });

  test('jules.openPanel command opens view', async () => {
    await extension.activate(context);

    // Find openPanel command and execute it
    const openPanelCall = registerCommandStub.getCalls().find(c => c.args[0] === 'jules.openPanel');
    assert.ok(openPanelCall);
    const cmdCallback = openPanelCall.args[1];
    await cmdCallback();

    assert.strictEqual(executeCommandStub.calledWith('workbench.view.extension.jules'), true);
  });

  test('jules.configureApiKey command opens input box', async () => {
    await extension.activate(context);

    // Find configureApiKey command and execute it
    const configCall = registerCommandStub.getCalls().find(c => c.args[0] === 'jules.configureApiKey');
    assert.ok(configCall);
    const cmdCallback = configCall.args[1];
    await cmdCallback();

    assert.strictEqual(showInputBoxStub.calledOnce, true);
    assert.strictEqual((context.secrets.store as sinon.SinonStub).calledWith('jules.apiKey', 'test-key'), true);
    assert.strictEqual(showInformationMessageStub.calledWith('✅ Jules API key saved successfully!'), true);
  });

  test('jules.clearChat command calls provider', async () => {
    await extension.activate(context);

    // Find clearChat command and execute it
    const clearChatCall = registerCommandStub.getCalls().find(c => c.args[0] === 'jules.clearChat');
    assert.ok(clearChatCall);

    const cmdCallback = clearChatCall.args[1];
    assert.doesNotThrow(() => { cmdCallback(); });
  });

  test('jules.newTask command executes with selection', async () => {
    await extension.activate(context);

    // Stub activeTextEditor
    sinon.stub(vscode.window, 'activeTextEditor').get(() => ({
      document: { getText: () => 'selected code', languageId: 'typescript' },
      selection: {}
    }));

    // Find newTask command and execute it
    const newTaskCall = registerCommandStub.getCalls().find(c => c.args[0] === 'jules.newTask');
    assert.ok(newTaskCall);

    const cmdCallback = newTaskCall.args[1];
    await cmdCallback();

    assert.strictEqual(executeCommandStub.calledWith('workbench.view.extension.jules'), true);
  });

  test('jules.newTask command executes without selection', async () => {
    await extension.activate(context);

    // Stub activeTextEditor (no selection)
    sinon.stub(vscode.window, 'activeTextEditor').get(() => ({
      document: { getText: () => '', languageId: 'typescript' },
      selection: {}
    }));

    // Find newTask command and execute it
    const newTaskCall = registerCommandStub.getCalls().find(c => c.args[0] === 'jules.newTask');
    assert.ok(newTaskCall);

    const cmdCallback = newTaskCall.args[1];
    await cmdCallback();

    assert.strictEqual(executeCommandStub.calledWith('workbench.view.extension.jules'), true);
  });

  test('prompts for API key on first activation if configure is clicked', async () => {
    showInformationMessageStub.resolves('Configure API Key' as any);
    await extension.activate(context);

    assert.strictEqual(showInputBoxStub.calledOnce, true);
    assert.strictEqual((context.secrets.store as sinon.SinonStub).calledWith('jules.apiKey', 'test-key'), true);
  });
});
