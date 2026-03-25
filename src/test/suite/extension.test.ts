import * as assert from 'assert';
import * as vscode from 'vscode';
import * as sinon from 'sinon';
import { activate, deactivate } from '../../extension';
import { JulesApiClient } from '../../julesApiClient';

suite('Extension Test Suite', () => {
	void vscode.window.showInformationMessage('Start all tests.');

	let context: vscode.ExtensionContext;
	let registerCommandStub: sinon.SinonStub;

	setup(() => {
		context = {
			subscriptions: [],
			secrets: {
				get: sinon.stub().resolves('test-key'),
				store: sinon.stub().resolves(),
				onDidChange: sinon.stub(),
				delete: sinon.stub().resolves()
			},
			extensionPath: '/test/path',
			workspaceState: {
				get: sinon.stub(),
				update: sinon.stub(),
				keys: sinon.stub()
			},
			globalState: {
				get: sinon.stub(),
				update: sinon.stub(),
				keys: sinon.stub(),
				setKeysForSync: sinon.stub()
			},
			extensionUri: vscode.Uri.file('/test/path'),
			environmentVariableCollection: {} as unknown,
			extensionMode: vscode.ExtensionMode.Test,
			storageUri: undefined,
			globalStorageUri: vscode.Uri.file('/test/storage'),
			logUri: vscode.Uri.file('/test/log'),
			extension: {} as unknown,
			asAbsolutePath: sinon.stub(),
			storagePath: '',
			globalStoragePath: '',
			logPath: ''
		} as unknown as vscode.ExtensionContext;

		registerCommandStub = sinon.stub(vscode.commands, 'registerCommand').returns({ dispose: () => {} });
		sinon.stub(vscode.window, 'registerWebviewViewProvider').returns({ dispose: () => {} });
		sinon.stub(vscode.workspace, 'getConfiguration').returns({
			get: sinon.stub().returns(false),
			has: sinon.stub(),
			inspect: sinon.stub(),
			update: sinon.stub()
		});
		sinon.stub(JulesApiClient.prototype, 'waitForInit').resolves();
	});

	teardown(() => {
		sinon.restore();
	});

	test('Extension should be present', () => {
		assert.ok(vscode.extensions.getExtension('juninmd.jules-extension-vscode'));
	});

	test('activate should register commands and provider', async () => {
		await activate(context);

		assert.ok(registerCommandStub.calledWith('jules.openPanel'));
		assert.ok(registerCommandStub.calledWith('jules.configureApiKey'));
		assert.ok(registerCommandStub.calledWith('jules.newTask'));
		assert.ok(registerCommandStub.calledWith('jules.clearChat'));
		assert.strictEqual(context.subscriptions.length, 5); // provider + 4 commands
	});

	test('deactivate should run without errors', () => {
		assert.doesNotThrow(() => {
			deactivate();
		});
	});
});