import * as assert from 'node:assert/strict';
import * as vscode from 'vscode';
import * as sinon from 'sinon';
import * as extension from '../extension';

suite('Extension Activation Test Suite', () => {
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
		const showInfoMessageStub = sinon.stub(vscode.window, 'showInformationMessage').resolves('Later' as unknown as vscode.MessageItem);

		await extension.activate(context);

		assert.ok(commandsRegisterStub.calledWith('jules.openPanel'), 'jules.openPanel should be registered');
		assert.ok(commandsRegisterStub.calledWith('jules.configureApiKey'), 'jules.configureApiKey should be registered');
		assert.ok(commandsRegisterStub.calledWith('jules.newTask'), 'jules.newTask should be registered');
		assert.ok(commandsRegisterStub.calledWith('jules.clearChat'), 'jules.clearChat should be registered');

		assert.ok(showInfoMessageStub);
		assert.ok(registerWebviewViewProviderStub);
	});

	test('deactivate should not throw', () => {
		assert.doesNotThrow(() => extension.deactivate());
	});
});