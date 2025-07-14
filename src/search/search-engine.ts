import * as vscode from 'vscode';
import { exec } from 'child_process';
import * as path from 'path';
import * as os from 'os';
import { SearchOptions } from '../types/interfaces';
import { processFilePattern, parseCSVInput } from './file-pattern-parser';
import { convertCgrJsonToHtml } from './result-converter';

function getBinaryName(): string {
    const platform = os.platform();
    const arch = os.arch();
    
    if (platform === 'darwin') {
        return arch === 'arm64' ? 'file_walker-darwin-arm64' : 'file_walker-darwin-x64';
    } else if (platform === 'win32') {
        return 'file_walker-win32-x64.exe';
    } else {
        // Linux: use system ripgrep
        return 'rg';
    }
}

function shouldUseSystemRipgrep(): boolean {
    const platform = os.platform();
    return platform === 'linux';
}

export function performSearch(
    searchText: string, 
    filePatternOrDirectory: string, 
    panel: vscode.WebviewPanel, 
    historyId?: number, 
    options?: SearchOptions,
    searchPath?: string
) {
    
    let cwd: string;
    let baseDir: string | undefined;
    let patterns: string[];

    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    const workspaceRoot = workspaceFolder?.uri.fsPath;

    // Set working directory and base directory
    if (workspaceRoot) {
        cwd = workspaceRoot;
        baseDir = workspaceRoot;
    } else {
        cwd = process.cwd();
    }

    // Get path to our file_walker binary or system ripgrep
    const binaryName = getBinaryName();
    let binaryPath: string;
    
    if (shouldUseSystemRipgrep()) {
        // Linux: use system ripgrep directly
        binaryPath = 'rg';
    } else {
        // macOS/Windows: use bundled binary
        const extensionPath = vscode.extensions.getExtension('quintia.semantic-coloring-search-editor')?.extensionPath;
        if (!extensionPath) {
            console.error('Extension path not found');
            return;
        }
        binaryPath = path.join(extensionPath, 'bin', binaryName);
    }
    
    // Build command arguments
    let args: string[];
    
    if (shouldUseSystemRipgrep()) {
        // Linux: use ripgrep arguments
        args = [
            '--json',
            '--line-number',
            '-C', '2', // Default context lines
        ];
        
        // Apply search options for ripgrep
        if (options) {
            if (options.ignoreCase) {
                args.push('--ignore-case');
            }
            if (options.wholeWord) {
                args.push('--word-regexp');
            }
            if (!options.regex) {
                args.push('--fixed-strings');
            }
        }
    } else {
        // macOS/Windows: use our custom binary arguments (ripgrep compatible)
        args = [
            '--json',
            '--line-number',
            '-C', '2', // Default context lines for VS Code extension
        ];
        
        // Apply search options for our binary (same as ripgrep)
        if (options) {
            if (options.ignoreCase) {
                args.push('--ignore-case');
            }
            if (options.wholeWord) {
                args.push('--word-regexp');
            }
            if (!options.regex) {
                args.push('--fixed-strings');
            }
        }
    }
    
    // Add file pattern if provided (using -g option)
    if (filePatternOrDirectory && filePatternOrDirectory.trim()) {
        // Parse as CSV to support comma-separated patterns with quotes
        const patterns = parseCSVInput(filePatternOrDirectory);
        patterns.forEach(pattern => {
            args.push('-g', pattern);
        });
    }
    
    // Prepare search text (escape for shell)
    const processedSearchText = searchText.replace(/"/g, '\\"');
    
    // Build path arguments
    let pathArgs = '.'; // Default to current directory
    if (searchPath && searchPath.trim()) {
        // Parse as CSV to support comma-separated paths with quotes
        const paths = parseCSVInput(searchPath);
        pathArgs = paths[0] || '.'; // Use first path for now
    }
    
    const command = `"${binaryPath}" ${args.join(' ')} "${processedSearchText}" "${pathArgs}"`;
    
    exec(command, { 
        cwd: cwd,
        env: { ...process.env },
        timeout: 30000 // 30 seconds timeout
    }, (error, stdout, stderr) => {
        
        let html = '';
        
        if (stdout) {
            const isDark = vscode.window.activeColorTheme.kind === vscode.ColorThemeKind.Dark;
            html += convertCgrJsonToHtml(stdout, cwd, isDark, baseDir);
        }
        
        if (stderr) {
            html += `<div class="error">${escapeHtml(stderr)}</div>`;
        }
        
        if (error && !stdout) {
            // Check exit code to distinguish between no matches (1) and real errors (2+)
            const exitCode = error.code;
            if (exitCode === 1 && !stderr) {
                // Exit code 1 with no stderr means no matches found (normal for ripgrep)
                html = '<div class="no-matches">No matches found</div>';
            } else if (!html) {
                // Exit code 2+ or other errors
                html = '<div class="error">Search command failed</div>';
            }
        }
        
        const hasResults = stdout && stdout.trim().length > 0;
        
        panel.webview.postMessage({
            command: 'searchResult',
            html: html,
            historyId: historyId,
            hasResults: hasResults
        });
    });
}

function escapeHtml(text: string): string {
    return text.replace(/&/g, '&amp;')
               .replace(/</g, '&lt;')
               .replace(/>/g, '&gt;')
               .replace(/"/g, '&quot;')
               .replace(/'/g, '&#039;');
}