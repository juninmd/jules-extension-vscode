import { vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

// Carrega .env manualmente para o ambiente de teste
const envPath = path.join(process.cwd(), '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  const lines = envContent.split('\n');
  for (const line of lines) {
    const [key, value] = line.split('=');
    if (key && value) {
      process.env[key.trim()] = value.trim();
    }
  }
}

// Mock global do VS Code
vi.mock('vscode', () => {
  return {
    workspace: {
      getConfiguration: vi.fn().mockReturnValue({
        get: vi.fn((key: string) => {
          if (key === 'apiBaseUrl') return 'https://jules.googleapis.com/v1alpha';
          return undefined;
        }),
      }),
    },
    window: {
      showInformationMessage: vi.fn(),
      showErrorMessage: vi.fn(),
    },
    commands: {
      registerCommand: vi.fn(),
    },
    EventEmitter: class {
      event = vi.fn();
      fire = vi.fn();
    },
    TreeItem: class {
      constructor(public label: string) {}
    },
    TreeItemCollapsibleState: {
      None: 0,
      Collapsed: 1,
      Expanded: 2,
    },
    Uri: {
      parse: vi.fn((path: string) => ({ path })),
      file: vi.fn((path: string) => ({ path })),
    },
    ThemeIcon: class {
      constructor(public id: string) {}
    },
  };
});
