import * as vscode from 'vscode';
import { JulesApiClient } from './julesApiClient.js';
import { JulesChatViewProvider } from './julesProvider.js';

let chatProvider: JulesChatViewProvider | undefined;

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  // Initialize the API client (reads API key from secret storage)
  const apiClient = new JulesApiClient(context);

  // Register the sidebar webview provider
  chatProvider = new JulesChatViewProvider(context, apiClient);

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      JulesChatViewProvider.viewType,
      chatProvider,
      { webviewOptions: { retainContextWhenHidden: true } }
    )
  );

  // Wait for the API client to finish loading the stored key before
  // checking whether to show the "configure key" prompt.
  await apiClient.waitForInit();

  // Command: Open Jules panel in the sidebar
  context.subscriptions.push(
    vscode.commands.registerCommand('jules.openPanel', () => {
      vscode.commands.executeCommand('workbench.view.extension.jules');
    })
  );

  // Command: Configure API Key via secure secret storage
  context.subscriptions.push(
    vscode.commands.registerCommand('jules.configureApiKey', async () => {
      await configureApiKey(context, apiClient, chatProvider);
    })
  );

  // Command: Start a new task (optionally with selected text)
  context.subscriptions.push(
    vscode.commands.registerCommand('jules.newTask', async () => {
      const editor = vscode.window.activeTextEditor;
      const selection = editor?.document.getText(editor.selection);

      if (selection) {
        await vscode.commands.executeCommand('workbench.view.extension.jules');
        chatProvider?.sendSelectedCode(selection, editor?.document.languageId ?? '');
      } else {
        await vscode.commands.executeCommand('workbench.view.extension.jules');
      }
    })
  );

  // Command: Clear chat history
  context.subscriptions.push(
    vscode.commands.registerCommand('jules.clearChat', () => {
      chatProvider?.clearChat();
    })
  );

  // Auto-open panel on startup if configured
  const config = vscode.workspace.getConfiguration('jules');
  if (config.get<boolean>('autoOpenOnStartup')) {
    await vscode.commands.executeCommand('workbench.view.extension.jules');
  }

  // Prompt for API key on first activation if not set
  const existingKey = apiClient.hasApiKey();
  if (!existingKey) {
    const action = await vscode.window.showInformationMessage(
      'Jules AI: Please configure your API key to get started.',
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
    title: 'Jules AI – Configure API Key',
    prompt: 'Enter your Jules API key. It will be stored securely in VS Code secret storage.',
    placeHolder: 'Paste your Jules API key here...',
    value: current ?? '',
    password: true,
    ignoreFocusOut: true,
    validateInput: (value) => {
      if (!value.trim()) {
        return 'API key cannot be empty';
      }
      return undefined;
    }
  });

  if (apiKey !== undefined) {
    await context.secrets.store('jules.apiKey', apiKey.trim());
    apiClient.setApiKey(apiKey.trim());
    provider?.notifyApiKeyChanged(!!apiKey.trim());

    vscode.window.showInformationMessage(
      '✅ Jules API key saved successfully!'
    );
  }
}

export function deactivate(): void {
  // Cleanup handled by VS Code subscriptions
}
