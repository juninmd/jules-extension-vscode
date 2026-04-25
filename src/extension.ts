import * as vscode from 'vscode';
import { JulesApiClient } from './julesApiClient.js';
import { JulesChatViewProvider } from './julesProvider.js';

let chatProvider: JulesChatViewProvider | undefined;

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const apiClient = new JulesApiClient(context);

  // Status bar item
  const statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  statusBar.name    = 'Jules AI';
  statusBar.command = 'jules.openPanel';
  statusBar.text    = '$(sparkle) Jules';
  statusBar.tooltip = 'Jules AI — Click to open';
  statusBar.show();
  context.subscriptions.push(statusBar);

  chatProvider = new JulesChatViewProvider(context, apiClient, statusBar);

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      JulesChatViewProvider.viewType,
      chatProvider,
      { webviewOptions: { retainContextWhenHidden: true } }
    )
  );

  await apiClient.waitForInit();

  context.subscriptions.push(
    vscode.commands.registerCommand('jules.openPanel', () => {
      vscode.commands.executeCommand('workbench.view.extension.jules');
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('jules.configureApiKey', async () => {
      await configureApiKey(context, apiClient, chatProvider);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('jules.newTask', async () => {
      const editor    = vscode.window.activeTextEditor;
      const selection = editor?.document.getText(editor.selection);

      await vscode.commands.executeCommand('workbench.view.extension.jules');

      if (selection) {
        chatProvider?.sendSelectedCode(selection, editor?.document.languageId ?? '');
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('jules.clearChat', () => {
      chatProvider?.clearChat();
    })
  );

  const config = vscode.workspace.getConfiguration('jules');
  if (config.get<boolean>('autoOpenOnStartup')) {
    await vscode.commands.executeCommand('workbench.view.extension.jules');
  }

  if (!apiClient.hasApiKey()) {
    const action = await vscode.window.showInformationMessage(
      'Jules AI: Configure your API key to get started.',
      'Configure API Key',
      'Later'
    );
    if (action === 'Configure API Key') {
      await configureApiKey(context, apiClient, chatProvider);
    }
  }
}

async function configureApiKey(
  context: vscode.ExtensionContext,
  apiClient: JulesApiClient,
  provider: JulesChatViewProvider | undefined
): Promise<void> {
  const current = await context.secrets.get('jules.apiKey');

  const apiKey = await vscode.window.showInputBox({
    title:        'Jules AI — Configure API Key',
    prompt:       'Enter your Jules API key (stored securely in VS Code secret storage).',
    placeHolder:  'Paste your Jules API key here…',
    value:        current ?? '',
    password:     true,
    ignoreFocusOut: true,
    validateInput: (v) => (!v.trim() ? 'API key cannot be empty' : undefined),
  });

  if (apiKey !== undefined) {
    await context.secrets.store('jules.apiKey', apiKey.trim());
    apiClient.setApiKey(apiKey.trim());
    provider?.notifyApiKeyChanged(!!apiKey.trim());
    vscode.window.showInformationMessage('✅ Jules API key saved successfully!');
  }
}

export function deactivate(): void {}
