import * as fs from 'fs';
import * as path from 'path';

export function loadWebviewContent(): string {
    // コンパイル時のパス（outディレクトリ内のui/から相対的にsrcディレクトリを参照）
    const srcUiPath = path.join(__dirname, '..', '..', 'src', 'ui');
    
    const htmlPath = path.join(srcUiPath, 'webview.html');
    const cssPath = path.join(srcUiPath, 'webview.css');
    const jsPath = path.join(srcUiPath, 'webview.js');
    
    const htmlContent = fs.readFileSync(htmlPath, 'utf8');
    const cssContent = fs.readFileSync(cssPath, 'utf8');
    const jsContent = fs.readFileSync(jsPath, 'utf8');
    
    return htmlContent
        .replace('{{CSS_CONTENT}}', cssContent)
        .replace('{{JS_CONTENT}}', jsContent);
}