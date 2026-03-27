import * as assert from 'assert';
import * as vscode from 'vscode';
import * as sinon from 'sinon';

suite('Extension Test Suite', () => {
  vscode.window.showInformationMessage('Start all tests.');

  test('Extension should be present', () => {
    assert.ok(vscode.extensions.getExtension('juninmd.jules-extension-vscode'));
  });

  test('Commands should be registered', async () => {
    // Just test that commands are registered in the manifest without activating
    const ext = vscode.extensions.getExtension('juninmd.jules-extension-vscode');
    assert.ok(ext);

    // Commands are available in the package.json contributes section
    const packageJSON = ext?.packageJSON;
    const commands = packageJSON.contributes.commands.map((c: any) => c.command);

    assert.ok(commands.includes('jules.openPanel'));
    assert.ok(commands.includes('jules.configureApiKey'));
    assert.ok(commands.includes('jules.newTask'));
    assert.ok(commands.includes('jules.clearChat'));
  });
});
