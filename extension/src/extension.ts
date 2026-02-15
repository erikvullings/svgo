import * as vscode from 'vscode';
import * as fs from 'fs';

let currentPanel: vscode.WebviewPanel | undefined;
let currentDocumentUri: vscode.Uri | undefined;

export function activate(context: vscode.ExtensionContext) {
  const openCommand = vscode.commands.registerCommand('svgOptimizer.open', () => {
    const editor = vscode.window.activeTextEditor;
    if (editor && isSvgDocument(editor.document)) {
      showPanel(context, editor.document);
      return;
    }
    showPanel(context);
  });

  context.subscriptions.push(openCommand);

  context.subscriptions.push(
    vscode.workspace.onDidOpenTextDocument((doc: vscode.TextDocument) => {
      if (isSvgDocument(doc)) {
        showPanel(context, doc);
      }
    })
  );

  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor((editor: vscode.TextEditor | undefined) => {
      if (editor && isSvgDocument(editor.document)) {
        showPanel(context, editor.document);
      }
    })
  );
}

export function deactivate() {}

function isSvgDocument(doc: vscode.TextDocument): boolean {
  return doc.languageId === 'svg' || doc.fileName.toLowerCase().endsWith('.svg');
}

function showPanel(context: vscode.ExtensionContext, document?: vscode.TextDocument) {
  const webviewRootUri = getWebviewRootUri(context);
  if (currentPanel) {
    currentPanel.reveal(vscode.ViewColumn.Beside);
  } else {
    currentPanel = vscode.window.createWebviewPanel(
      'svgOptimizer',
      'SVG Optimizer',
      vscode.ViewColumn.Beside,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [webviewRootUri]
      }
    );

    currentPanel.onDidDispose(() => {
      currentPanel = undefined;
      currentDocumentUri = undefined;
    });

    currentPanel.webview.onDidReceiveMessage(async (message: { type?: string; svg?: string }) => {
      if (!message || typeof message !== 'object') return;
      switch (message.type) {
        case 'update-svg': {
          if (!currentDocumentUri) return;
          const doc = await vscode.workspace.openTextDocument(currentDocumentUri);
          const edit = new vscode.WorkspaceEdit();
          const fullRange = new vscode.Range(
            doc.positionAt(0),
            doc.positionAt(doc.getText().length)
          );
          edit.replace(doc.uri, fullRange, message.svg ?? '');
          await vscode.workspace.applyEdit(edit);
          await doc.save();
          break;
        }
        default:
          break;
      }
    });
  }

  currentPanel.webview.html = getWebviewHtml(currentPanel.webview, context);

  if (document) {
    currentDocumentUri = document.uri;
    currentPanel.webview.postMessage({
      type: 'load-svg',
      svg: document.getText(),
      uri: document.uri.toString()
    });
  }
}

function getWebviewRootUri(context: vscode.ExtensionContext): vscode.Uri {
  return vscode.Uri.joinPath(context.extensionUri, 'webview');
}

function getWebviewHtml(webview: vscode.Webview, context: vscode.ExtensionContext): string {
  const webviewRootUri = getWebviewRootUri(context);
  const indexUri = vscode.Uri.joinPath(webviewRootUri, 'index.html');
  let html = fs.readFileSync(indexUri.fsPath, 'utf8');

  const nonce = getNonce();
  const assetsUri = webview.asWebviewUri(vscode.Uri.joinPath(webviewRootUri, 'assets'));

  html = html.replace(/(src|href)=\"\/?assets\/(.*?)\"/g, (_m, attr, file) => {
    return `${attr}="${assetsUri}/${file}"`;
  });

  const staticFiles = [
    'apple-touch-icon.png',
    'favicon-32x32.png',
    'favicon-16x16.png',
    'favicon.ico',
    'android-chrome-192x192.png',
    'android-chrome-512x512.png',
    'site.webmanifest',
    'logo.svg'
  ];

  staticFiles.forEach((file) => {
    const fileUri = webview.asWebviewUri(vscode.Uri.joinPath(webviewRootUri, file));
    html = html.replace(new RegExp(file, 'g'), fileUri.toString());
  });

  const csp = [
    `default-src 'none'`,
    `img-src ${webview.cspSource} https: data:`,
    `style-src ${webview.cspSource} 'unsafe-inline'`,
    `script-src ${webview.cspSource} https://cdnjs.cloudflare.com 'nonce-${nonce}'`
  ].join('; ');

  html = html.replace('</head>', `<meta http-equiv="Content-Security-Policy" content="${csp}"></head>`);
  html = html.replace(/<script type=\"module\"/g, `<script type="module" nonce="${nonce}"`);

  return html;
}

function getNonce() {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}
