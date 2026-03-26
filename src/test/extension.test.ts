import * as assert from 'assert';
import * as vscode from 'vscode';
import * as sinon from 'sinon';
import { activate, deactivate } from '../extension';

suite('Extension Test Suite', function () {
    this.timeout(30000);

    teardown(() => {
        sinon.restore();
    });

	test('Extension should be present', () => {
		assert.ok(vscode.extensions.getExtension('juninmd.jules-extension-vscode'));
	});

    test('activate handles context correctly and prompts for key', async () => {
        const contextMock = {
            subscriptions: [],
            extensionPath: '/fake/path',
            extensionUri: vscode.Uri.parse('fake://uri'),
            secrets: {
                get: sinon.stub().resolves(),
                store: sinon.stub().resolves(),
                delete: sinon.stub().resolves()
            }
        };

        const commandsStub = sinon.stub(vscode.commands, 'registerCommand').returns({ dispose: () => {} });
        const windowStub = sinon.stub(vscode.window, 'registerWebviewViewProvider').returns({ dispose: () => {} });

        sinon.stub(vscode.workspace, 'getConfiguration').returns({
            get: sinon.stub().returns(false),
            has: sinon.stub(),
            inspect: sinon.stub(),
            update: sinon.stub()
        });

        // Test the code path where user clicks 'Configure API Key' from info message
        const showInfoStub = sinon.stub(vscode.window, 'showInformationMessage');
        showInfoStub.onFirstCall().resolves('Configure API Key' as any);
        showInfoStub.onSecondCall().resolves(); // From configureApiKey success

        const inputBoxStub = sinon.stub(vscode.window, 'showInputBox').resolves('my-api-key');

        await activate(contextMock as any);

        assert.ok(commandsStub.called);
        assert.ok(windowStub.calledWith('jules.chatView'));
        assert.strictEqual(contextMock.subscriptions.length, 5); // 4 commands + 1 provider

        assert.ok(inputBoxStub.called);
        assert.ok(contextMock.secrets.store.calledWith('jules.apiKey', 'my-api-key'));
    });

    test('activate handles context correctly and auto opens', async () => {
        const contextMock = {
            subscriptions: [],
            extensionPath: '/fake/path',
            extensionUri: vscode.Uri.parse('fake://uri'),
            secrets: {
                get: sinon.stub().resolves('existing-key'),
                store: sinon.stub().resolves(),
                delete: sinon.stub().resolves()
            }
        };

        const commandsStub = sinon.stub(vscode.commands, 'registerCommand').returns({ dispose: () => {} });
        const windowStub = sinon.stub(vscode.window, 'registerWebviewViewProvider').returns({ dispose: () => {} });
        const execCommandStub = sinon.stub(vscode.commands, 'executeCommand').resolves();

        sinon.stub(vscode.workspace, 'getConfiguration').returns({
            get: sinon.stub().returns(true), // autoOpenOnStartup = true
            has: sinon.stub(),
            inspect: sinon.stub(),
            update: sinon.stub()
        });

        await activate(contextMock as any);

        assert.ok(execCommandStub.calledWith('workbench.view.extension.jules'));
    });

    test('commands execute expected logic', async () => {
        const contextMock = {
            subscriptions: [],
            extensionPath: '/fake/path',
            extensionUri: vscode.Uri.parse('fake://uri'),
            secrets: {
                get: sinon.stub().resolves('existing-key'),
                store: sinon.stub().resolves(),
                delete: sinon.stub().resolves()
            }
        };

        let registeredCommands: Record<string, Function> = {};

        sinon.stub(vscode.commands, 'registerCommand').callsFake((cmd, cb) => {
            registeredCommands[cmd] = cb;
            return { dispose: () => {} };
        });

        sinon.stub(vscode.window, 'registerWebviewViewProvider').returns({ dispose: () => {} });
        const execCommandStub = sinon.stub(vscode.commands, 'executeCommand').resolves();

        sinon.stub(vscode.workspace, 'getConfiguration').returns({
            get: sinon.stub().returns(false),
            has: sinon.stub(),
            inspect: sinon.stub(),
            update: sinon.stub()
        });

        await activate(contextMock as any);

        // Test jules.openPanel
        await registeredCommands['jules.openPanel']();
        assert.ok(execCommandStub.calledWith('workbench.view.extension.jules'));

        // Test jules.configureApiKey
        const inputBoxStub = sinon.stub(vscode.window, 'showInputBox').resolves('new-key');
        const showInfoStub = sinon.stub(vscode.window, 'showInformationMessage').resolves();
        await registeredCommands['jules.configureApiKey']();
        assert.ok(inputBoxStub.called);
        assert.ok(contextMock.secrets.store.calledWith('jules.apiKey', 'new-key'));

        // Also test validateInput of inputBox
        const validateInput = inputBoxStub.getCall(0).args[0]?.validateInput;
        if (validateInput) {
            assert.strictEqual(validateInput(''), 'API key cannot be empty');
            assert.strictEqual(validateInput('  '), 'API key cannot be empty');
            assert.strictEqual(validateInput(' valid '), undefined);
        }

        // Test jules.clearChat
        await registeredCommands['jules.clearChat']();

        // Test jules.newTask without selection
        sinon.stub(vscode.window, 'activeTextEditor').value(undefined);
        await registeredCommands['jules.newTask']();
        assert.ok(execCommandStub.calledWith('workbench.view.extension.jules'));

        // Test jules.newTask with selection
        const documentMock = {
            getText: sinon.stub().returns('selected code'),
            languageId: 'typescript'
        };
        sinon.stub(vscode.window, 'activeTextEditor').value({
            document: documentMock,
            selection: {}
        });
        await registeredCommands['jules.newTask']();
        assert.ok(execCommandStub.calledWith('workbench.view.extension.jules'));
    });

    test('deactivate executes safely', () => {
        deactivate();
        assert.ok(true);
    });
});
