export interface SearchHistoryData {
    version: number;
    searches: string[];
}

export interface SearchOptions {
    ignoreCase: boolean;
    wholeWord: boolean;
    regex: boolean;
    context: boolean;
    multi: boolean;
}

export interface HistoryEntry {
    id: number;
    searchText: string;
    // directory?: string; // For backward compatibility - removed
    filePattern?: string;
    path?: string;
    expanded: boolean;
    options: SearchOptions;
    searchTextDisplay?: string;
    // directoryDisplay?: string; // For backward compatibility - removed
    filePatternDisplay?: string;
    pathDisplay?: string;
}

export interface WebViewMessage {
    command: string;
    [key: string]: any;
}

export interface SearchMessage extends WebViewMessage {
    command: 'search';
    text: string;
    // directory?: string; // For backward compatibility - removed
    filePattern?: string;
    path?: string;
    historyId: number;
    options: SearchOptions;
}

export interface DeleteHistoryMessage extends WebViewMessage {
    command: 'deleteHistory';
    text: string;
}

export interface OpenFileMessage extends WebViewMessage {
    command: 'openFile';
    filePath: string;
    lineNumber: number;
}

export interface SetDisplayStringsMessage extends WebViewMessage {
    command: 'setDisplayStrings';
    historyId: number;
    searchTextDisplay: string;
    // directoryDisplay?: string; // For backward compatibility - removed
    filePatternDisplay?: string;
    pathDisplay?: string;
}

export interface SearchResultMessage extends WebViewMessage {
    command: 'searchResult';
    html: string;
    historyId: number;
    hasResults: boolean;
}

export interface ThemeInfoMessage extends WebViewMessage {
    command: 'themeInfo';
    isDark: boolean;
}

export interface SearchHistoryMessage extends WebViewMessage {
    command: 'searchHistory';
    history: string[];
}

export interface BaseDirInfoMessage extends WebViewMessage {
    command: 'baseDirInfo';
    baseDir: string | null;
    hasWorkspace: boolean;
}

export interface CgrJsonEntry {
    type: 'match' | 'context';
    path: string;
    line_number: number;
    line_text: string;
    matches?: Array<{
        start: number;
        end: number;
    }>;
}

export interface SearchConstants {
    HISTORY_VERSION: number;
    MAX_HISTORY_SIZE: number;
    HISTORY_STORAGE_KEY: string;
}