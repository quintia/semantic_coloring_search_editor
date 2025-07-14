import * as vscode from 'vscode';
import { SearchHistoryData, SearchConstants } from '../types/interfaces';

const CONSTANTS: SearchConstants = {
    HISTORY_VERSION: 1,
    MAX_HISTORY_SIZE: 300,
    HISTORY_STORAGE_KEY: 'searchHistory'
};

export function loadSearchHistory(context: vscode.ExtensionContext): string[] {
    const stored = context.globalState.get<SearchHistoryData>(CONSTANTS.HISTORY_STORAGE_KEY);
    
    if (!stored || stored.version !== CONSTANTS.HISTORY_VERSION) {
        // Version mismatch or no data - start fresh
        return [];
    }
    
    return stored.searches || [];
}

export function saveSearchHistory(context: vscode.ExtensionContext, searches: string[]): void {
    const data: SearchHistoryData = {
        version: CONSTANTS.HISTORY_VERSION,
        searches: searches.slice(0, CONSTANTS.MAX_HISTORY_SIZE) // Limit to max size
    };
    
    context.globalState.update(CONSTANTS.HISTORY_STORAGE_KEY, data);
}

export function addToSearchHistory(context: vscode.ExtensionContext, searchText: string): string[] {
    let searches = loadSearchHistory(context);
    
    // Remove existing occurrence if present
    searches = searches.filter(item => item !== searchText);
    
    // Add to beginning
    searches.unshift(searchText);
    
    // Limit size and save
    searches = searches.slice(0, CONSTANTS.MAX_HISTORY_SIZE);
    saveSearchHistory(context, searches);
    
    return searches;
}

export function deleteFromSearchHistory(context: vscode.ExtensionContext, searchText: string): string[] {
    let searches = loadSearchHistory(context);
    
    // Remove the specified item
    searches = searches.filter(item => item !== searchText);
    
    // Save updated history
    saveSearchHistory(context, searches);
    
    return searches;
}