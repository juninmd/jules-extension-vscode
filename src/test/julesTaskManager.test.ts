import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as vscode from 'vscode';
import { JulesTaskManager } from '../julesTaskManager.js';

function makeManager(getTask: (id: string) => Promise<unknown>) {
  const apiClient = { getTask: vi.fn(getTask), approvePlan: vi.fn() };
  const provider = { postMessage: vi.fn(), statusBarItem: undefined };
  const manager = new JulesTaskManager(apiClient as never, provider as never);
  return { manager, apiClient, provider };
}

describe('JulesTaskManager polling', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.mocked(vscode.window.showInformationMessage).mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('notifies about a pending plan approval only once while polling continues', async () => {
    const pending = { name: 'sessions/1', id: '1', title: 't', prompt: 'p', status: 'pendingApproval' };
    const { manager } = makeManager(async () => pending);
    vi.mocked(vscode.window.showInformationMessage).mockResolvedValue(undefined as never);

    manager.startPolling('sessions/1');
    await vi.advanceTimersByTimeAsync(15000);
    manager.stopPolling('sessions/1');

    const approvalPrompts = vi
      .mocked(vscode.window.showInformationMessage)
      .mock.calls.filter(([msg]) => String(msg).includes('plan approval'));
    expect(approvalPrompts).toHaveLength(1);
  });

  it('stops polling and clears the timer once a task completes', async () => {
    const done = { name: 'sessions/2', id: '2', title: 't', prompt: 'p', status: 'completed' };
    const { manager, apiClient } = makeManager(async () => done);
    vi.mocked(vscode.window.showInformationMessage).mockResolvedValue(undefined as never);

    manager.startPolling('sessions/2');
    await vi.advanceTimersByTimeAsync(5000);
    expect(manager.isPolling('sessions/2')).toBe(false);

    await vi.advanceTimersByTimeAsync(20000);
    expect(apiClient.getTask).toHaveBeenCalledTimes(1);
  });
});
