import * as path from 'path';
import * as fs from 'fs';

export function parseShellArguments(input: string): string[] {
    const args: string[] = [];
    let current = '';
    let inQuotes = false;
    let quoteChar = '';
    let i = 0;
    
    while (i < input.length) {
        const char = input[i];
        
        if (!inQuotes && (char === '"' || char === "'")) {
            inQuotes = true;
            quoteChar = char;
        } else if (inQuotes && char === quoteChar) {
            inQuotes = false;
            quoteChar = '';
        } else if (!inQuotes && /\s/.test(char)) {
            if (current) {
                args.push(current);
                current = '';
            }
        } else {
            current += char;
        }
        i++;
    }
    
    if (current) {
        args.push(current);
    }
    
    return args;
}

export function processFilePattern(pattern: string, workspaceRoot?: string, multiMode?: boolean): string[] {
    if (!pattern || pattern.trim() === '') {
        return ['.'];  // Default to recursive search
    }
    
    const trimmedPattern = pattern.trim();
    
    // Use shell-style argument parsing for multi mode, simple split for single mode
    const patterns = multiMode ? 
        parseShellArguments(trimmedPattern) : 
        [trimmedPattern];
    if (patterns.length === 0) {
        return ['.'];
    }
    
    // Process each pattern
    const processedPatterns: string[] = [];
    for (const singlePattern of patterns) {
        // Smart directory detection - if pattern has no glob chars and exists as directory, append /
        if (workspaceRoot && !hasGlobChars(singlePattern)) {
            let testPath: string;
            if (path.isAbsolute(singlePattern)) {
                testPath = singlePattern;
            } else {
                testPath = path.join(workspaceRoot, singlePattern);
            }
            
            try {
                const stats = fs.statSync(testPath);
                if (stats.isDirectory() && !singlePattern.endsWith('/')) {
                    processedPatterns.push(singlePattern + '/');
                } else {
                    processedPatterns.push(singlePattern);
                }
            } catch (error) {
                // Path doesn't exist or can't be accessed, treat as pattern
                processedPatterns.push(singlePattern);
            }
        } else {
            processedPatterns.push(singlePattern);
        }
    }
    
    return processedPatterns;
}

export function hasGlobChars(pattern: string): boolean {
    return /[*?[\]{}]/.test(pattern);
}

/**
 * Parse CSV-style input with support for quoted values containing commas and spaces
 * Examples:
 * - "*.py,*.ts" -> ["*.py", "*.ts"]
 * - "*.py,\"*.ts\"" -> ["*.py", "*.ts"]
 * - "./csv/,\"./A B/\"" -> ["./csv/", "./A B/"]
 */
export function parseCSVInput(input: string): string[] {
    if (!input.trim()) {
        return [];
    }
    
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    let quoteChar = '';
    
    for (let i = 0; i < input.length; i++) {
        const char = input[i];
        
        if (!inQuotes && (char === '"' || char === "'")) {
            // Start of quoted section
            inQuotes = true;
            quoteChar = char;
        } else if (inQuotes && char === quoteChar) {
            // Check for escaped quote (double quote)
            if (i + 1 < input.length && input[i + 1] === quoteChar) {
                current += char; // Add the quote character
                i++; // Skip the next quote
            } else {
                // End of quoted section
                inQuotes = false;
                quoteChar = '';
            }
        } else if (!inQuotes && char === ',') {
            // Comma separator outside of quotes
            if (current.trim()) {
                result.push(current.trim());
            }
            current = '';
        } else {
            current += char;
        }
    }
    
    // Add the last item
    if (current.trim()) {
        result.push(current.trim());
    }
    
    return result;
}