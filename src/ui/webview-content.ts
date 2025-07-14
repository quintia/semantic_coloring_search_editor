import { SearchOptions } from '../types/interfaces';
import { parseShellArguments } from '../search/file-pattern-parser';

export function generateDisplayStrings(
    searchText: string, 
    filePattern: string, 
    options: SearchOptions,
    path?: string
): { 
    searchTextDisplay: string; 
    filePatternDisplay: string; 
    pathDisplay: string; 
} {
    // Generate search text display (always use multi mode)
    const searchTextDisplay = searchText;
    
    // Generate file pattern display (always use multi mode)
    let filePatternDisplay = '';
    if (filePattern) {
        // Multi mode: show parsed arguments, quote if contains space or quote
        const patterns = parseShellArguments(filePattern);
        filePatternDisplay = patterns.map(p => 
            (p.includes(' ') || p.includes('"')) ? '"' + p + '"' : p
        ).join(' ');
    }
    
    // Generate path display (always use multi mode)
    let pathDisplay = '';
    if (path) {
        // Multi mode: show parsed arguments, quote if contains space or quote
        const paths = parseShellArguments(path);
        pathDisplay = paths.map(p => 
            (p.includes(' ') || p.includes('"')) ? '"' + p + '"' : p
        ).join(' ');
    }
    
    return { searchTextDisplay, filePatternDisplay, pathDisplay };
}