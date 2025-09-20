import * as vscode from 'vscode';
import { 
    SearchMessage, 
    DeleteHistoryMessage, 
    OpenFileMessage,
    WebViewMessage 
} from './types/interfaces';
import { 
    loadSearchHistory, 
    addToSearchHistory, 
    deleteFromSearchHistory 
} from './history/search-history';
import { performSearch } from './search/search-engine';
import { generateDisplayStrings } from './ui/webview-content';
import { loadWebviewContent } from './ui/webview-loader';

// Global reference to the current panel
let currentPanel: vscode.WebviewPanel | undefined = undefined;

export function activate(context: vscode.ExtensionContext) {
    const disposable = vscode.commands.registerCommand('semantic-color-grep-edit.search', () => {
        // If panel already exists, just reveal it and restore focus
        if (currentPanel) {
            currentPanel.reveal(vscode.ViewColumn.One);
            // Send focus message to webview after revealing
            currentPanel.webview.postMessage({
                command: 'focusSearchInput'
            });
            return;
        }
        
        const panel = vscode.window.createWebviewPanel(
            'semanticColorGrepEdit',
            'Color Grep',
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                enableCommandUris: true
            }
        );
        
        // Store reference to current panel
        currentPanel = panel;

        panel.webview.html = loadWebviewContent();

        // Send initial data to webview
        sendInitialData(panel, context);

        // Handle messages from webview
        panel.webview.onDidReceiveMessage(
            (message: WebViewMessage) => handleWebViewMessage(message, panel, context),
            undefined,
            context.subscriptions
        );
        
        // Clear panel reference when disposed
        panel.onDidDispose(
            () => {
                currentPanel = undefined;
            },
            null,
            context.subscriptions
        );
    });

    context.subscriptions.push(disposable);
}

function sendInitialData(panel: vscode.WebviewPanel, context: vscode.ExtensionContext) {
    // Send theme information
    const isDark = vscode.window.activeColorTheme.kind === vscode.ColorThemeKind.Dark;
    panel.webview.postMessage({
        command: 'themeInfo',
        isDark: isDark
    });
    
    // Send search history
    const searchHistory = loadSearchHistory(context);
    panel.webview.postMessage({
        command: 'searchHistory',
        history: searchHistory
    });
    
    // Send workspace information
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    const workspaceRoot = workspaceFolder?.uri.fsPath;
    panel.webview.postMessage({
        command: 'baseDirInfo',
        baseDir: workspaceRoot || null,
        hasWorkspace: !!workspaceRoot
    });
}

function handleWebViewMessage(
    message: WebViewMessage, 
    panel: vscode.WebviewPanel, 
    context: vscode.ExtensionContext
) {
    switch (message.command) {
        case 'search':
            handleSearchMessage(message as SearchMessage, panel, context);
            break;
        case 'deleteHistory':
            handleDeleteHistoryMessage(message as DeleteHistoryMessage, panel, context);
            break;
        case 'openFile':
            handleOpenFileMessage(message as OpenFileMessage);
            break;
    }
}

function handleSearchMessage(
    message: SearchMessage, 
    panel: vscode.WebviewPanel, 
    context: vscode.ExtensionContext
) {
    // Add to persistent history
    const newHistory = addToSearchHistory(context, message.text);
    
    // Generate display strings
    const { searchTextDisplay, filePatternDisplay, pathDisplay } = generateDisplayStrings(
        message.text, 
        message.filePattern || '',
        message.options,
        message.path
    );
    
    // Send display strings to webview
    panel.webview.postMessage({
        command: 'setDisplayStrings',
        historyId: message.historyId,
        searchTextDisplay: searchTextDisplay,
        filePatternDisplay: filePatternDisplay,
        pathDisplay: pathDisplay
    });
    
    // Perform search
    const filePatternToUse = message.filePattern || '';
    
    performSearch(
        message.text, 
        filePatternToUse,
        panel, 
        message.historyId, 
        message.options,
        message.path
    );
    
    // Send updated history to webview
    panel.webview.postMessage({
        command: 'searchHistory',
        history: newHistory
    });
}

function handleDeleteHistoryMessage(
    message: DeleteHistoryMessage, 
    panel: vscode.WebviewPanel, 
    context: vscode.ExtensionContext
) {
    deleteFromSearchHistory(context, message.text);
    // Send updated history to webview
    const updatedHistory = loadSearchHistory(context);
    panel.webview.postMessage({
        command: 'searchHistory',
        history: updatedHistory
    });
}

function handleOpenFileMessage(message: OpenFileMessage) {
    const uri = vscode.Uri.file(message.filePath);
    const range = new vscode.Range(message.lineNumber, 0, message.lineNumber, 0);
    vscode.window.showTextDocument(uri, { selection: range });
}

export function deactivate() {}