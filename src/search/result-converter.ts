import * as path from 'path';
import { CgrJsonEntry } from '../types/interfaces';

export function convertCgrJsonToHtml(text: string, searchPath: string, isDark: boolean, baseDir?: string): string {
    try {
        const lines = text.trim().split('\n');
        if (lines.length === 0) {
            return '<div class="error">No results found</div>';
        }
        
        let html = '';
        let currentFile = '';
        let fileGroups: { [file: string]: Array<any> } = {};
        let hasContextLines = false;
        
        // Parse JSON lines and detect if context lines are present
        for (const line of lines) {
            if (!line.trim()) continue;
            
            try {
                const entry = JSON.parse(line);
                
                if (entry.type === 'match' || entry.type === 'context') {
                    // Handle rg JSON format where path is in data.path.text
                    const filePath = entry.data?.path?.text || entry.data?.path || entry.path;
                    
                    if (filePath && !fileGroups[filePath]) {
                        fileGroups[filePath] = [];
                    }
                    if (filePath) {
                        fileGroups[filePath].push(entry);
                    }
                    
                    if (entry.type === 'context') {
                        hasContextLines = true;
                    }
                }
            } catch (error) {
                // Skip invalid JSON lines
                continue;
            }
        }
        
        // Convert each file group to HTML
        const fileNames = Object.keys(fileGroups);
        for (let fileIndex = 0; fileIndex < fileNames.length; fileIndex++) {
            const fileName = fileNames[fileIndex];
            const fileEntries = fileGroups[fileName];
            
            if (fileEntries.length === 0) continue;
            
            let fileHtml = '';
            
            // Add file group header (for grouped display mode)
            const firstEntry = fileEntries[0];
            const firstEntryData = firstEntry.data || firstEntry;
            const firstFilePath = firstEntryData.path?.text || firstEntryData.path || firstEntry.path;
            let displayPath = firstFilePath;
            
            // Make path relative for display
            if (displayPath.startsWith('./')) {
                displayPath = displayPath.substring(2);
            }
            
            if (baseDir && path.isAbsolute(firstFilePath)) {
                try {
                    const relativePath = path.relative(baseDir, firstFilePath);
                    if (!relativePath.startsWith('..')) {
                        displayPath = relativePath || path.basename(firstFilePath);
                    }
                } catch (error) {
                    displayPath = firstFilePath;
                }
            }
            
            const escapedDisplayPath = displayPath.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
            const coloredPath = applySemanticColorsToPath(escapedDisplayPath, isDark);
            
            fileHtml += `<div class="filename-group" data-file="${escapeHtml(displayPath)}">${coloredPath}</div>`;
            
            let previousLineNumber = -1;
            
            for (const entry of fileEntries) {
                // Handle both cgr and rg JSON formats
                const entryData = entry.data || entry;
                const type = entry.type;
                const filePath = entryData.path?.text || entryData.path || entry.path;
                const line_number = entryData.line_number;
                const line_text = entryData.lines?.text || entryData.text || entryData.line_text;
                const matches = entryData.submatches || entryData.matches;
                
                // Check for line number gaps and insert separator (only when context lines are present)
                if (hasContextLines && previousLineNumber !== -1 && line_number - previousLineNumber > 1) {
                    fileHtml += '<div class="context-gap"></div>';
                }
                previousLineNumber = line_number;
                
                // Make path relative for display
                let displayPath = filePath;
                
                // Remove leading './' from rg output if present
                if (displayPath.startsWith('./')) {
                    displayPath = displayPath.substring(2);
                }
                
                // Try to make path relative to baseDir (workspace root)
                if (baseDir && path.isAbsolute(filePath)) {
                    try {
                        const relativePath = path.relative(baseDir, filePath);
                        // Only use relative path if it doesn't start with '..' (outside workspace)
                        if (!relativePath.startsWith('..')) {
                            displayPath = relativePath || path.basename(filePath);
                        }
                    } catch (error) {
                        // Fallback to original path if relative calculation fails
                        displayPath = filePath;
                    }
                } else if (searchPath && searchPath !== '.' && filePath.startsWith(searchPath)) {
                    // Manual relative path calculation for backward compatibility
                    displayPath = path.relative(searchPath, filePath);
                    if (!displayPath) {
                        displayPath = path.basename(filePath);
                    }
                }
                
                const escapedDisplayPath = displayPath.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
                const coloredPath = applySemanticColorsToPath(escapedDisplayPath, isDark);
                
                const lineNum = line_number - 1; // Convert to 0-based for VS Code
                
                // Convert to absolute path for file opening
                let absoluteFilePath = filePath;
                if (baseDir && !path.isAbsolute(filePath)) {
                    absoluteFilePath = path.join(baseDir, filePath);
                }
                // Proper JavaScript string escaping for file paths
                const escapedFilePath = absoluteFilePath
                    .replace(/\\/g, '\\\\')  // Escape backslashes first
                    .replace(/'/g, "\\'")    // Escape single quotes
                    .replace(/"/g, '\\"')    // Escape double quotes
                    .replace(/\r/g, '\\r')   // Escape carriage returns
                    .replace(/\n/g, '\\n')   // Escape newlines
                    .replace(/\t/g, '\\t')   // Escape tabs
                    .replace(/\v/g, '\\v')   // Escape vertical tabs
                    .replace(/\f/g, '\\f');  // Escape form feeds
                
                // Process line content
                let processedContent = line_text;
                
                if (type === 'match') {
                    // Apply match highlighting for match lines
                    if (matches && matches.length > 0) {
                        // Sort matches by start position in reverse order to avoid offset issues
                        const sortedMatches = [...matches].sort((a, b) => b.start - a.start);
                        
                        for (const match of sortedMatches) {
                            const before = processedContent.slice(0, match.start);
                            const matchText = processedContent.slice(match.start, match.end);
                            const after = processedContent.slice(match.end);
                            
                            processedContent = before + `<span style="font-weight: bold; color: #ff6b6b; text-decoration: underline;">${escapeHtml(matchText)}</span>` + after;
                        }
                    }
                    
                    // HTML escape the remaining content
                    processedContent = escapeHtmlPreservingTags(processedContent);
                    
                    // Create match line
                    fileHtml += `<div class="match-line">` +
                        `<a href="#" onclick="openFile('${escapedFilePath}', ${lineNum}); return false;" class="match-link">` +
                        `<span class="file-path">${coloredPath}:</span><span class="line-number">${line_number}</span>:` +
                        `</a>` +
                        `<span class="match-content">${processedContent}</span>` +
                        `</div>`;
                } else if (type === 'context') {
                    // HTML escape context content
                    processedContent = escapeHtml(processedContent);
                    
                    // Create context line
                    fileHtml += `<div class="context-line">` +
                        `<a href="#" onclick="openFile('${escapedFilePath}', ${lineNum}); return false;" class="context-link">` +
                        `<span class="file-path">${coloredPath}:</span><span class="line-number">${line_number}</span>-` +
                        `</a>` +
                        `<span class="context-content">${processedContent}</span>` +
                        `</div>`;
                }
            }
            
            if (fileHtml) {
                html += `<div class="search-group">${fileHtml}</div>`;
                if (fileIndex < fileNames.length - 1) {
                    html += `<div class="group-separator context-element"></div>`;
                }
            }
        }
        
        return html || '<div class="no-matches">No matches found</div>';
        
    } catch (error) {
        return `<div class="error">Error parsing search results: ${escapeHtml(String(error))}</div>`;
    }
}

function generateSemanticColor(segment: string, isDark: boolean): string {
    // Simple hash function for consistent color generation
    let hash = 0;
    for (let i = 0; i < segment.length; i++) {
        const char = segment.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32-bit integer
    }
    
    // Generate HSL color with good contrast based on theme
    const hue = Math.abs(hash) % 360;
    const saturation = 60 + (Math.abs(hash) % 20); // 60-80%
    
    // Adjust lightness based on theme
    let lightness;
    if (isDark) {
        // Dark theme: lighter colors (60-80%)
        lightness = 60 + (Math.abs(hash) % 20);
    } else {
        // Light theme: darker colors (30-50%)
        lightness = 30 + (Math.abs(hash) % 20);
    }
    
    return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
}

function applySemanticColorsToPath(pathText: string, isDark: boolean): string {
    // Split path into segments
    const segments = pathText.split(/([/\\])/);
    
    return segments.map(segment => {
        if (segment === '/' || segment === '\\') {
            // Path separators keep normal color
            return segment;
        } else if (segment) {
            // Apply semantic color to path segments
            const color = generateSemanticColor(segment, isDark);
            return `<span style="color: ${color};">${segment}</span>`;
        }
        return segment;
    }).join('');
}

function escapeHtml(text: string | undefined): string {
    if (!text) return '';
    return text.replace(/&/g, '&amp;')
               .replace(/</g, '&lt;')
               .replace(/>/g, '&gt;')
               .replace(/"/g, '&quot;')
               .replace(/'/g, '&#039;');
}

function escapeHtmlPreservingTags(text: string): string {
    // First, temporarily replace span tags with placeholders
    let placeholders: string[] = [];
    let placeholderIndex = 0;
    
    // Replace span tags with placeholders
    text = text.replace(/<span[^>]*>.*?<\/span>/g, (match) => {
        const placeholder = `__SPAN_PLACEHOLDER_${placeholderIndex}__`;
        placeholders[placeholderIndex] = match;
        placeholderIndex++;
        return placeholder;
    });
    
    // Escape HTML in the remaining text
    text = escapeHtml(text);
    
    // Restore span tags
    for (let i = 0; i < placeholders.length; i++) {
        text = text.replace(`__SPAN_PLACEHOLDER_${i}__`, placeholders[i]);
    }
    
    return text;
}