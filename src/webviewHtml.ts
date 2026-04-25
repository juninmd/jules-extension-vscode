import * as vscode from 'vscode';
import * as path from 'path';

export function getHtmlContent(webview: vscode.Webview, extensionPath: string): string {
  const nonce = getNonce();
  const styleUri = getMediaUri(webview, extensionPath, 'style.css');
  const scriptUri = getMediaUri(webview, extensionPath, 'main.js');

  return /* html */`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; script-src ${webview.cspSource} 'nonce-${nonce}'; img-src ${webview.cspSource} https: data:; connect-src ${webview.cspSource};">
  <link rel="stylesheet" href="${styleUri}">
  <title>Jules AI</title>
</head>
<body>
<!-- ═══ SETUP SCREEN ═══ -->
<div id="setup-screen" class="screen">
  <div class="setup-content">
    <div class="setup-logo">
      <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="32" cy="32" r="30" fill="url(#sg)"/>
        <text x="32" y="42" text-anchor="middle" font-size="28" font-family="monospace" fill="white" font-weight="800">J</text>
        <defs>
          <linearGradient id="sg" x1="2" y1="2" x2="62" y2="62" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stop-color="#4285F4"/>
            <stop offset="100%" stop-color="#34A853"/>
          </linearGradient>
        </defs>
      </svg>
    </div>
    <h1 class="setup-title">Jules AI Agent</h1>
    <p class="setup-subtitle">Google's AI coding agent — write code, fix bugs, and open PRs automatically.</p>
    <ol class="setup-steps">
      <li class="setup-step"><span class="step-num">1</span><span class="step-desc">Get your API key at <a href="#" id="link-portal">jules.google.com</a></span></li>
      <li class="setup-step"><span class="step-num">2</span><span class="step-desc">Click the button below to configure it securely</span></li>
      <li class="setup-step"><span class="step-num">3</span><span class="step-desc">Select a repository and start automating!</span></li>
    </ol>
    <button id="btn-configure-key" class="btn btn-primary lg">Configure API Key</button>
  </div>
</div>
<!-- ═══ MAIN SCREEN ═══ -->
<div id="main-screen" class="screen hidden">
  <header class="header">
    <div class="header-brand">
      <svg class="brand-logo" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="12" cy="12" r="11" fill="url(#hg)"/>
        <text x="12" y="16.5" text-anchor="middle" font-size="11" font-family="monospace" fill="white" font-weight="800">J</text>
        <defs>
          <linearGradient id="hg" x1="1" y1="1" x2="23" y2="23" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stop-color="#4285F4"/>
            <stop offset="100%" stop-color="#34A853"/>
          </linearGradient>
        </defs>
      </svg>
      <span class="brand-name">Jules</span>
      <span class="brand-badge">AI</span>
    </div>
    <div class="header-actions">
      <button class="icon-btn" id="btn-refresh" title="Refresh tasks">↻</button>
      <button class="icon-btn" id="btn-settings" title="Configure API Key">⚙</button>
    </div>
  </header>
  <div class="repo-zone">
    <span class="repo-label">Repository</span>
    <div class="repo-search-wrap">
      <input type="text" id="repo-search" class="repo-search" placeholder="Filter repositories…" autocomplete="off">
    </div>
    <div class="repo-select-wrap">
      <select id="repo-select" class="repo-select">
        <option value="">Loading repositories…</option>
      </select>
    </div>
  </div>
  <div class="filter-tabs" role="tablist">
    <button class="tab-btn active" role="tab" data-tab="all">All <span class="tab-count">0</span></button>
    <button class="tab-btn" role="tab" data-tab="active">Active <span class="tab-count">0</span></button>
    <button class="tab-btn" role="tab" data-tab="done">Done <span class="tab-count">0</span></button>
  </div>
  <div id="tasks-area" class="tasks-area">
    <div id="skeleton-loader" class="skeleton-wrap hidden">
      <div class="task-skeleton"><div class="skel w40 h8"></div><div class="skel w80"></div></div>
    </div>
  </div>
  <div id="code-context-banner" class="code-banner hidden">
    <span id="code-banner-text" class="code-banner-text">Code attached</span>
    <button id="btn-clear-context" class="code-banner-clear" title="Remove code context">✕</button>
  </div>
  <div class="input-zone">
    <div class="input-wrap">
      <textarea id="message-input" class="message-textarea" placeholder="Describe a task for Jules…" rows="3"></textarea>
      <button id="btn-send" class="btn-send" title="Send (Ctrl+Enter)" disabled>➤</button>
    </div>
    <div class="input-footer">
      <span id="char-count" class="char-count">0 / 2000</span>
      <span class="input-hint"><kbd>Ctrl</kbd>+<kbd>Enter</kbd> to send</span>
    </div>
  </div>
</div>
<script type="module" nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
}

function getMediaUri(webview: vscode.Webview, extensionPath: string, filename: string): vscode.Uri {
  return webview.asWebviewUri(
    vscode.Uri.file(path.join(extensionPath, 'out', 'media', filename))
  );
}

function getNonce(): string {
  let text = '';
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  // Use crypto to avoid SonarCloud rule S2245 (Math.random) if applicable,
  // but memory says to use crypto.randomBytes instead of Math.random().
  const crypto = require('crypto');
  const bytes = crypto.randomBytes(32);
  for (let i = 0; i < 32; i++) {
    text += chars.charAt(bytes[i] % chars.length);
  }
  return text;
}
