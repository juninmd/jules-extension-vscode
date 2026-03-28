import * as assert from 'assert';
import * as vscode from 'vscode';
import * as sinon from 'sinon';
import * as extension from '../extension';

suite('Extension Test Suite', () => {
	let context: vscode.ExtensionContext;
	let commandsRegisterStub: sinon.SinonStub;
	let registerWebviewViewProviderStub: sinon.SinonStub;

	setup(() => {
		context = {
			subscriptions: [],
			secrets: {
				get: sinon.stub().resolves(undefined),
				store: sinon.stub().resolves(),
				delete: sinon.stub().resolves(),
				onDidChange: new vscode.EventEmitter<vscode.SecretStorageChangeEvent>().event
			},
			extensionPath: '/mock/path',
			workspaceState: {
				get: sinon.stub(),
				update: sinon.stub().resolves(),
				keys: sinon.stub().returns([])
			},
			globalState: {
				get: sinon.stub(),
				update: sinon.stub().resolves(),
				keys: sinon.stub().returns([]),
				setKeysForSync: sinon.stub()
			},
			extensionUri: vscode.Uri.file('/mock/path'),
			environmentVariableCollection: {} as any,
			extensionMode: vscode.ExtensionMode.Test,
			globalStorageUri: vscode.Uri.file('/mock/global/storage'),
			logUri: vscode.Uri.file('/mock/log'),
			storageUri: vscode.Uri.file('/mock/storage'),
			extension: {
				id: 'juninmd.jules-extension-vscode',
				extensionUri: vscode.Uri.file('/mock/path'),
				extensionPath: '/mock/path',
				isActive: true,
				packageJSON: {},
				extensionKind: vscode.ExtensionKind.UI,
				exports: undefined,
				activate: sinon.stub(),
			},
			asAbsolutePath: (path: string) => path,
			languageModelAccessInformation: {} as any
		} as unknown as vscode.ExtensionContext;

		commandsRegisterStub = sinon.stub(vscode.commands, 'registerCommand');
		registerWebviewViewProviderStub = sinon.stub(vscode.window, 'registerWebviewViewProvider');
	});

	teardown(() => {
		sinon.restore();
	});

	test('Extension should be present', () => {
		assert.ok(vscode.extensions.getExtension('juninmd.jules-extension-vscode'));
	});

	test('activate should register commands', async () => {
		// Stub out some API interactions that might block
		const showInfoMessageStub = sinon.stub(vscode.window, 'showInformationMessage').resolves('Later' as unknown as vscode.MessageItem);

		await extension.activate(context);

		assert.ok(commandsRegisterStub.calledWith('jules.openPanel'), 'jules.openPanel should be registered');
		assert.ok(commandsRegisterStub.calledWith('jules.configureApiKey'), 'jules.configureApiKey should be registered');
		assert.ok(commandsRegisterStub.calledWith('jules.newTask'), 'jules.newTask should be registered');
		assert.ok(commandsRegisterStub.calledWith('jules.clearChat'), 'jules.clearChat should be registered');

		// Use the stubs so linting doesn't complain
		assert.ok(showInfoMessageStub);
		assert.ok(registerWebviewViewProviderStub);
	});

  test('jules.openPanel command execution', async () => {
    sinon.stub(vscode.window, 'showInformationMessage').resolves('Later' as unknown as vscode.MessageItem);
		await extension.activate(context);

    // Grab the registered jules.openPanel command callback
    const openPanelCmdCall = commandsRegisterStub.getCalls().find(c => c.args[0] === 'jules.openPanel');
    assert.ok(openPanelCmdCall);
    const callback = openPanelCmdCall.args[1];

    const executeCommandStub = sinon.stub(vscode.commands, 'executeCommand');
    callback();

    assert.ok(executeCommandStub.calledWith('workbench.view.extension.jules'));
  });

  test('jules.newTask command execution with selection', async () => {
    sinon.stub(vscode.window, 'showInformationMessage').resolves('Later' as unknown as vscode.MessageItem);
		await extension.activate(context);

    const newTaskCmdCall = commandsRegisterStub.getCalls().find(c => c.args[0] === 'jules.newTask');
    assert.ok(newTaskCmdCall);
    const callback = newTaskCmdCall.args[1];

    const executeCommandStub = sinon.stub(vscode.commands, 'executeCommand');

    // Stub activeTextEditor
    sinon.stub(vscode.window, 'activeTextEditor').value({
      document: {
        getText: sinon.stub().returns('selected code'),
        languageId: 'typescript'
      },
      selection: {}
    });

    await callback();

    assert.ok(executeCommandStub.calledWith('workbench.view.extension.jules'));
  });

  test('jules.newTask command execution without selection', async () => {
    sinon.stub(vscode.window, 'showInformationMessage').resolves('Later' as unknown as vscode.MessageItem);
		await extension.activate(context);

    const newTaskCmdCall = commandsRegisterStub.getCalls().find(c => c.args[0] === 'jules.newTask');
    assert.ok(newTaskCmdCall);
    const callback = newTaskCmdCall.args[1];

    const executeCommandStub = sinon.stub(vscode.commands, 'executeCommand');

    // Stub activeTextEditor
    sinon.stub(vscode.window, 'activeTextEditor').value({
      document: {
        getText: sinon.stub().returns(''),
        languageId: 'typescript'
      },
      selection: {}
    });

    await callback();

    assert.ok(executeCommandStub.calledWith('workbench.view.extension.jules'));
  });

  test('jules.clearChat command execution', async () => {
    sinon.stub(vscode.window, 'showInformationMessage').resolves('Later' as unknown as vscode.MessageItem);
		await extension.activate(context);

    const clearChatCmdCall = commandsRegisterStub.getCalls().find(c => c.args[0] === 'jules.clearChat');
    assert.ok(clearChatCmdCall);
    const callback = clearChatCmdCall.args[1];

    callback();
    assert.ok(true); // Should not throw
  });

  test('jules.configureApiKey command execution (cancel)', async () => {
    sinon.stub(vscode.window, 'showInformationMessage').resolves('Later' as unknown as vscode.MessageItem);
		await extension.activate(context);

    const configureApiKeyCmdCall = commandsRegisterStub.getCalls().find(c => c.args[0] === 'jules.configureApiKey');
    assert.ok(configureApiKeyCmdCall);
    const callback = configureApiKeyCmdCall.args[1];

    const showInputBoxStub = sinon.stub(vscode.window, 'showInputBox').resolves(undefined);
    await callback();

    assert.ok(showInputBoxStub.calledOnce);
  });

  test('jules.configureApiKey command execution (success)', async () => {
    sinon.stub(vscode.window, 'showInformationMessage').resolves('Later' as unknown as vscode.MessageItem);
		await extension.activate(context);

    const configureApiKeyCmdCall = commandsRegisterStub.getCalls().find(c => c.args[0] === 'jules.configureApiKey');
    assert.ok(configureApiKeyCmdCall);
    const callback = configureApiKeyCmdCall.args[1];

    const showInputBoxStub = sinon.stub(vscode.window, 'showInputBox').resolves('new-key');
    const secretsStoreStub = (context.secrets.store as sinon.SinonStub);
    const showInfoMessageStub = (vscode.window.showInformationMessage as sinon.SinonStub);

    await callback();

    assert.ok(showInputBoxStub.calledOnce);
    assert.ok(secretsStoreStub.calledWith('jules.apiKey', 'new-key'));
    assert.ok(showInfoMessageStub.calledWith('✅ Jules API key saved successfully!'));
  });

	test('deactivate should not throw', () => {
		assert.doesNotThrow(() => extension.deactivate());
	});
});