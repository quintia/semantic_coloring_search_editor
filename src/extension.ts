import * as vscode from 'vscode';
import { exec } from 'child_process';
import * as path from 'path';

export function activate(context: vscode.ExtensionContext) {
    const disposable = vscode.commands.registerCommand('semantic-color-grep-edit.search', () => {
        const panel = vscode.window.createWebviewPanel(
            'semanticColorGrepEdit',
            'Semantic Color Grep Edit',
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true
            }
        );

        panel.webview.html = getWebviewContent();

        panel.webview.onDidReceiveMessage(
            message => {
                switch (message.command) {
                    case 'search':
                        performSearch(message.text, message.directory, panel);
                        break;
                }
            },
            undefined,
            context.subscriptions
        );
    });

    context.subscriptions.push(disposable);
}

function getWebviewContent(): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Semantic Color Grep Edit</title>
    <style>
        body {
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
            padding: 20px;
        }
        .search-container {
            margin-bottom: 20px;
        }
        input[type="text"] {
            width: 70%;
            padding: 8px;
            margin-right: 10px;
            background-color: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border: 1px solid var(--vscode-input-border);
        }
        button {
            padding: 8px 16px;
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            cursor: pointer;
        }
        button:hover {
            background-color: var(--vscode-button-hoverBackground);
        }
        .results {
            white-space: pre-wrap;
            font-family: var(--vscode-editor-font-family);
            background-color: var(--vscode-editor-background);
            padding: 10px;
            border: 1px solid var(--vscode-panel-border);
            max-height: 600px;
            overflow-y: auto;
        }
        .error {
            color: var(--vscode-errorForeground);
        }
        a {
            color: var(--vscode-textLink-foreground);
            text-decoration: none;
        }
        a:hover {
            text-decoration: underline;
        }
    </style>
</head>
<body>
    <div class="search-container">
        <input type="text" id="searchInput" placeholder="Enter search term..." />
        <input type="text" id="directoryInput" placeholder="Search directory (optional)..." />
        <button onclick="performSearch()">Search</button>
    </div>
    <div id="results" class="results"></div>

    <script>
        const vscode = acquireVsCodeApi();
        
        function performSearch() {
            const searchInput = document.getElementById('searchInput');
            const directoryInput = document.getElementById('directoryInput');
            const searchText = searchInput.value.trim();
            const directory = directoryInput.value.trim();
            
            if (!searchText) {
                return;
            }
            
            vscode.postMessage({
                command: 'search',
                text: searchText,
                directory: directory
            });
        }
        
        document.getElementById('searchInput').addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                performSearch();
            }
        });
        
        window.addEventListener('message', event => {
            const message = event.data;
            switch (message.command) {
                case 'searchResult':
                    document.getElementById('results').innerHTML = message.html;
                    break;
            }
        });
    </script>
</body>
</html>`;
}

function performSearch(searchText: string, directory: string, panel: vscode.WebviewPanel) {
    let searchPath: string;
    let cwd: string;

    if (directory && directory.trim() !== '') {
        // Use provided directory
        searchPath = directory.trim();
        cwd = searchPath;
    } else {
        // Use workspace root if available, otherwise current working directory
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (workspaceFolder) {
            searchPath = workspaceFolder.uri.fsPath;
            cwd = searchPath;
        } else {
            searchPath = '.';
            cwd = process.cwd();
        }
    }

    const escapedSearchText = searchText.replace(/"/g, '\\"');
    const command = `rg --colors='path:none' --colors='line:none' --colors='column:none' "${escapedSearchText}" "${searchPath}"`;
    
    exec(command, { cwd: cwd }, (error, stdout, stderr) => {
        let html = '';
        
        if (stdout) {
            html += convertAnsiToHtml(stdout);
        }
        
        if (stderr) {
            html += `<div class="error">${escapeHtml(stderr)}</div>`;
        }
        
        if (error && !stdout && !stderr) {
            html = '<div class="error">No matches found or rg command failed</div>';
        }
        
        panel.webview.postMessage({
            command: 'searchResult',
            html: html
        });
    });
}

function convertAnsiToHtml(text: string): string {
    // ANSIエスケープシーケンスをHTMLに変換
    let html = text;
    
    // リセット
    html = html.replace(/\x1b\[0m/g, '</span>');
    
    // 色指定
    html = html.replace(/\x1b\[31m/g, '<span style="color: #ff6b6b;">'); // 赤
    html = html.replace(/\x1b\[32m/g, '<span style="color: #51cf66;">'); // 緑
    html = html.replace(/\x1b\[33m/g, '<span style="color: #ffd43b;">'); // 黄
    html = html.replace(/\x1b\[34m/g, '<span style="color: #339af0;">'); // 青
    html = html.replace(/\x1b\[35m/g, '<span style="color: #f783ac;">'); // マゼンタ
    html = html.replace(/\x1b\[36m/g, '<span style="color: #22b8cf;">'); // シアン
    html = html.replace(/\x1b\[37m/g, '<span style="color: #ffffff;">'); // 白
    
    // 太字
    html = html.replace(/\x1b\[1m/g, '<span style="font-weight: bold;">');
    
    // ファイルパス:行番号をリンクに変換
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (workspaceFolder) {
        const workspacePath = workspaceFolder.uri.fsPath;
        html = html.replace(/([^\s]+):(\d+):/g, (match, filePath, lineNumber) => {
            const fullPath = path.resolve(workspacePath, filePath);
            const uri = vscode.Uri.file(fullPath);
            return `<a href="command:vscode.open?${encodeURIComponent(JSON.stringify([uri, { selection: new vscode.Range(parseInt(lineNumber) - 1, 0, parseInt(lineNumber) - 1, 0) }]))}">${match}</a>`;
        });
    }
    
    // HTMLエスケープ（リンク部分以外）
    html = html.replace(/&/g, '&amp;')
               .replace(/</g, '&lt;')
               .replace(/>/g, '&gt;');
    
    // リンクを元に戻す
    html = html.replace(/&lt;a href="([^"]*)"&gt;([^&]*)&lt;\/a&gt;/g, '<a href="$1">$2</a>');
    html = html.replace(/&lt;span([^&]*)&gt;/g, '<span$1>');
    html = html.replace(/&lt;\/span&gt;/g, '</span>');
    
    return html;
}

function escapeHtml(text: string): string {
    return text.replace(/&/g, '&amp;')
               .replace(/</g, '&lt;')
               .replace(/>/g, '&gt;')
               .replace(/"/g, '&quot;')
               .replace(/'/g, '&#039;');
}

export function deactivate() {}
