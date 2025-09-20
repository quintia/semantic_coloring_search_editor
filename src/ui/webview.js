const vscode = acquireVsCodeApi();
let searchHistory = [];
let nextHistoryId = 1;

// Search option states
let searchOptions = {
    ignoreCase: false,
    wholeWord: false,
    regex: true,  // Default to regex enabled like VS Code
    context: true,  // Default to context enabled
};

// Theme information
let isDarkTheme = false;

// Search history from extension
let persistentSearchHistory = [];

// History selection state
let selectedHistoryIndex = -1;
let isInHistoryNavigation = false;

// Context display modes: 0=show context, 1=grouped, 2=no context
let contextDisplayModes = {};

function performSearch() {
    const searchInput = document.getElementById('searchInput');
    const filePatternInput = document.getElementById('filePatternInput');
    const pathInput = document.getElementById('pathInput');
    const searchText = searchInput.value.trim();
    const filePattern = filePatternInput.value.trim();
    const path = pathInput.value.trim();
    
    if (!searchText) {
        return;
    }
    
    // Check if file pattern input is required but empty
    if (filePatternInput.hasAttribute('required') && !filePattern) {
        filePatternInput.style.border = '2px solid var(--vscode-inputValidation-errorBorder)';
        filePatternInput.focus();
        return;
    }
    
    // Reset any previous error styling
    filePatternInput.style.border = '';
    pathInput.style.border = '';
    
    const historyEntry = {
        id: nextHistoryId++,
        searchText: searchText,
        filePattern: filePattern,
        path: path,
        expanded: true,
        options: { ...searchOptions, multi: true }
    };
    
    // Add to beginning of history
    searchHistory.unshift(historyEntry);
    
    vscode.postMessage({
        command: 'search',
        text: searchText,
        filePattern: filePattern,
        path: path,
        historyId: historyEntry.id,
        options: searchOptions
    });
}

function reloadSearch(historyId) {
    const entry = searchHistory.find(h => h.id === historyId);
    if (entry) {
        // Auto-expand result tab if collapsed
        if (!entry.expanded) {
            entry.expanded = true;
            const contentElement = document.getElementById('content-' + historyId);
            const toggleElement = document.getElementById('toggle-' + historyId);
            if (contentElement && toggleElement) {
                contentElement.classList.remove('collapsed');
                toggleElement.textContent = '▼';
            }
        }
        
        vscode.postMessage({
            command: 'search',
            text: entry.searchText,
            filePattern: entry.filePattern || '',
            path: entry.path || '',
            historyId: historyId,
            options: { ...entry.options, multi: true }
        });
    }
}

function deleteSearch(historyId) {
    searchHistory = searchHistory.filter(h => h.id !== historyId);
    const entryElement = document.getElementById('history-' + historyId);
    if (entryElement) {
        entryElement.remove();
    }
}

function toggleContextDisplay(historyId) {
    const contentElement = document.getElementById('content-' + historyId);
    const toggleButton = document.getElementById('toggle-context-' + historyId);
    
    if (!contentElement || !toggleButton) return;
    
    // Auto-expand result tab if collapsed
    const entry = searchHistory.find(h => h.id === historyId);
    if (entry && !entry.expanded) {
        entry.expanded = true;
        const toggleElement = document.getElementById('toggle-' + historyId);
        if (toggleElement) {
            contentElement.classList.remove('collapsed');
            toggleElement.textContent = '▼';
        }
    }
    
    // Initialize mode if not set
    if (contextDisplayModes[historyId] === undefined) {
        contextDisplayModes[historyId] = 0; // Start with show context
    }
    
    // Cycle through modes: 0 -> 1 -> 2 -> 0
    contextDisplayModes[historyId] = (contextDisplayModes[historyId] + 1) % 3;
    
    applyContextDisplayMode(historyId);
}

function applyContextDisplayMode(historyId) {
    const contentElement = document.getElementById('content-' + historyId);
    const toggleButton = document.getElementById('toggle-context-' + historyId);
    
    if (!contentElement || !toggleButton) return;
    
    const mode = contextDisplayModes[historyId] || 0;
    
    // Remove any existing mode classes
    contentElement.classList.remove('grouped-mode', 'no-context-mode');
    
    switch(mode) {
        case 0: // Show context (default)
            toggleButton.textContent = 'Group Context';
            // Default state - no special classes needed
            break;
            
        case 1: // Grouped mode (ripgrep style)
            toggleButton.textContent = 'Hide Context';
            contentElement.classList.add('grouped-mode');
            break;
            
        case 2: // No context
            toggleButton.textContent = 'Show Context';
            contentElement.classList.add('no-context-mode');
            break;
    }
}



function toggleSearchResult(historyId) {
    const entry = searchHistory.find(h => h.id === historyId);
    if (entry) {
        entry.expanded = !entry.expanded;
        const contentElement = document.getElementById('content-' + historyId);
        const toggleElement = document.getElementById('toggle-' + historyId);
        
        if (entry.expanded) {
            contentElement.classList.remove('collapsed');
            toggleElement.textContent = '▼';
        } else {
            contentElement.classList.add('collapsed');
            toggleElement.textContent = '▶';
        }
    }
}

function createHistoryEntry(entry, hasResults, isError = false) {
    // Use pre-generated display strings
    const searchTextDisplay = entry.searchTextDisplay || entry.searchText;
    const filePatternDisplay = entry.filePatternDisplay || entry.filePattern || '';
    const pathDisplay = entry.pathDisplay || entry.path || '';
    
    // No longer needed - removed backward compatibility
    
    let displayParts = [searchTextDisplay];
    if (filePatternDisplay) displayParts.push('pattern: ' + filePatternDisplay);
    if (pathDisplay) displayParts.push('path: ' + pathDisplay);
    
    const baseText = displayParts.join(' '); 
    
    // Add option indicators (excluding context which is always on)
    let optionIndicators = '';
    if (entry.options) {
        if (entry.options.ignoreCase) optionIndicators += '[Aa]';
        if (entry.options.wholeWord) optionIndicators += '[|ab|]';
        if (entry.options.regex) optionIndicators += '[.*]';
    }
    
    const displayText = baseText + (optionIndicators ? ' ' + optionIndicators : '');
    
    const headerClick = 'onclick="toggleSearchResult(' + entry.id + ')"';
    const headerClass = 'class="history-header has-results"';
    const toggleIcon = '<span class="history-toggle" id="toggle-' + entry.id + '">▼</span>';
    const contentDiv = '<div class="history-content" id="content-' + entry.id + '">Loading...</div>';
    
    // Create buttons based on result type
    let buttonsHtml = '';
    if (isError) {
        // Error case: only Delete button
        buttonsHtml = '<button class="history-button" onclick="deleteSearch(' + entry.id + ')">Delete</button>';
    } else if (hasResults) {
        // Success case: Context toggle, Reload, and Delete buttons
        buttonsHtml = '<button class="history-button" id="toggle-context-' + entry.id + '" onclick="toggleContextDisplay(' + entry.id + ')">Hide Context</button>' +
                     '<button class="history-button" onclick="reloadSearch(' + entry.id + ')">Reload</button>' +
                     '<button class="history-button" onclick="deleteSearch(' + entry.id + ')">Delete</button>';
    } else {
        // No matches case: Reload and Delete buttons (no context toggle)
        buttonsHtml = '<button class="history-button" onclick="reloadSearch(' + entry.id + ')">Reload</button>' +
                     '<button class="history-button" onclick="deleteSearch(' + entry.id + ')">Delete</button>';
    }
        
    return '<div class="history-entry" id="history-' + entry.id + '">' +
        '<div ' + headerClass + ' ' + headerClick + '>' +
        '<div class="history-label" id="label-' + entry.id + '">' + displayText + '</div>' +
        toggleIcon +
        '<div class="history-buttons" onclick="event.stopPropagation()">' +
        buttonsHtml +
        '</div>' +
        '</div>' +
        contentDiv +
        '</div>';
}

document.getElementById('searchInput').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        if (selectedHistoryIndex >= 0 && selectedHistoryIndex < persistentSearchHistory.length) {
            selectCurrentHistoryItem();
        } else {
            performSearch();
        }
    }
});

document.getElementById('searchInput').addEventListener('keydown', function(e) {
    const dropdown = document.getElementById('historyDropdownContent');
    const isDropdownOpen = dropdown.classList.contains('show');
    
    // Check if IME is active (composing)
    const isIMEActive = e.isComposing || e.keyCode === 229;
    
    switch(e.key) {
        case 'ArrowDown':
            if (!isIMEActive) {
                e.preventDefault();
                if (!isDropdownOpen) {
                    // Show dropdown
                    dropdown.classList.add('show');
                    selectedHistoryIndex = -1;
                    isInHistoryNavigation = false;
                } else {
                    // Move to/within history
                    if (persistentSearchHistory.length > 0) {
                        if (selectedHistoryIndex === -1) {
                            // First navigation - select first item (index 0)
                            selectedHistoryIndex = 0;
                            isInHistoryNavigation = true;
                            updateHistorySelection();
                            scrollToSelectedItem();
                            e.stopPropagation();
                        } else {
                            // Already navigating - move down
                            navigateHistory(1);
                        }
                    }
                }
            }
            break;
        case 'ArrowUp':
            if (!isIMEActive) {
                e.preventDefault();
                if (isDropdownOpen) {
                    if (isInHistoryNavigation) {
                        // Navigate up in history
                        navigateHistory(-1);
                    } else {
                        // Hide dropdown
                        dropdown.classList.remove('show');
                        selectedHistoryIndex = -1;
                        isInHistoryNavigation = false;
                        updateHistorySelection();
                    }
                }
            }
            break;
        case 'Escape':
            e.preventDefault();
            if (isDropdownOpen) {
                dropdown.classList.remove('show');
                selectedHistoryIndex = -1;
                isInHistoryNavigation = false;
                updateHistorySelection();
            }
            break;
    }
});

document.getElementById('filePatternInput').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        performSearch();
    }
});

document.getElementById('pathInput').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        performSearch();
    }
});

window.addEventListener('message', event => {
    const message = event.data;
    switch (message.command) {
        case 'setDisplayStrings':
            // Set display strings for history entry
            const entry = searchHistory.find(h => h.id === message.historyId);
            if (entry) {
                entry.searchTextDisplay = message.searchTextDisplay;
                entry.filePatternDisplay = message.filePatternDisplay;
                entry.pathDisplay = message.pathDisplay;
            }
            break;
        case 'searchResult':
            if (message.historyId) {
                // Update existing or create new entry
                let entryElement = document.getElementById('history-' + message.historyId);
                if (!entryElement) {
                    const entry = searchHistory.find(h => h.id === message.historyId);
                    if (entry) {
                        const historyContainer = document.getElementById('historyContainer');
                        const isError = !message.hasResults && message.html && message.html.includes('class="error"') && !message.html.includes('No matches found');
                        historyContainer.insertAdjacentHTML('afterbegin', createHistoryEntry(entry, message.hasResults, isError));
                    }
                }
                
                if (message.hasResults) {
                    const contentElement = document.getElementById('content-' + message.historyId);
                    if (contentElement) {
                        contentElement.innerHTML = message.html;
                        
                        // Preserve existing context display mode, or initialize to 0 if new
                        if (contextDisplayModes[message.historyId] === undefined) {
                            contextDisplayModes[message.historyId] = 0; // Start with show context
                        }
                        
                        // Apply the current context display mode
                        applyContextDisplayMode(message.historyId);
                        
                        // Count only match lines (not context lines) for accurate hit count
                        // Match lines have class="match-line"
                        const matchCount = (message.html.match(/class="match-line"/g) || []).length;
                        const labelElement = document.getElementById('label-' + message.historyId);
                        if (labelElement) {
                            const entry = searchHistory.find(h => h.id === message.historyId);
                            if (entry) {
                                // Use pre-generated display strings
                                const searchTextDisplay = entry.searchTextDisplay || entry.searchText;
                                const filePatternDisplay = entry.filePatternDisplay || entry.filePattern || '';
                                const pathDisplay = entry.pathDisplay || entry.path || '';
                                
                                let displayParts = [searchTextDisplay];
                                if (filePatternDisplay) displayParts.push('pattern: ' + filePatternDisplay);
                                if (pathDisplay) displayParts.push('path: ' + pathDisplay);
                                
                                const baseText = displayParts.join(' ');
                                
                                // Add option indicators (excluding context which is always on)
                                let optionIndicators = '';
                                if (entry.options) {
                                    if (entry.options.ignoreCase) optionIndicators += '[Aa]';
                                    if (entry.options.wholeWord) optionIndicators += '[|ab|]';
                                    if (entry.options.regex) optionIndicators += '[.*]';
                                            }
                                
                                const displayText = baseText + (optionIndicators ? ' ' + optionIndicators : '');
                                labelElement.textContent = displayText + ' (' + matchCount + ')';
                            }
                        }
                    }
                } else {
                    // No results or error - display HTML content
                    const contentElement = document.getElementById('content-' + message.historyId);
                    if (contentElement) {
                        contentElement.innerHTML = message.html;
                    }
                    
                    // Update label to show (0) or error status
                    const labelElement = document.getElementById('label-' + message.historyId);
                    if (labelElement) {
                        const entry = searchHistory.find(h => h.id === message.historyId);
                        if (entry) {
                            // Use pre-generated display strings
                            const searchTextDisplay = entry.searchTextDisplay || entry.searchText;
                            const filePatternDisplay = entry.filePatternDisplay || entry.filePattern || '';
                            const pathDisplay = entry.pathDisplay || entry.path || '';
                            
                            let displayParts = [searchTextDisplay];
                            if (filePatternDisplay) displayParts.push('pattern: ' + filePatternDisplay);
                            if (pathDisplay) displayParts.push('path: ' + pathDisplay);
                            
                            const baseText = displayParts.join(' ');
                            
                            // Add option indicators (excluding context which is always on)
                            let optionIndicators = '';
                            if (entry.options) {
                                if (entry.options.ignoreCase) optionIndicators += '[Aa]';
                                if (entry.options.wholeWord) optionIndicators += '[|ab|]';
                                if (entry.options.regex) optionIndicators += '[.*]';
                                    }
                            
                            const displayText = baseText + (optionIndicators ? ' ' + optionIndicators : '');
                            // Check if this is an error message
                            const isError = message.html && message.html.includes('class="error"') && !message.html.includes('No matches found');
                            labelElement.textContent = displayText + (isError ? ' (Error)' : ' (0)');
                        }
                    }
                }
                
            }
            break;
        case 'themeInfo':
            isDarkTheme = message.isDark;
            break;
        case 'searchHistory':
            persistentSearchHistory = message.history || [];
            selectedHistoryIndex = -1; // Reset selection when history updates
            isInHistoryNavigation = false;
            updateSearchHistory();
            break;
        case 'baseDirInfo':
            const filePatternInput = document.getElementById('filePatternInput');
            const pathInput = document.getElementById('pathInput');
            if (filePatternInput && pathInput) {
                if (message.hasWorkspace && message.baseDir) {
                    filePatternInput.placeholder = 'File pattern (e.g., *.html,*.css)...';
                    pathInput.placeholder = 'Path (e.g., src/, docs/)...';
                    filePatternInput.removeAttribute('required');
                } else {
                    filePatternInput.placeholder = 'File pattern (required - e.g., *.js)...';
                    pathInput.placeholder = 'Path (e.g., src/, docs/)...';
                    filePatternInput.setAttribute('required', 'required');
                }
            }
            break;
        case 'focusSearchInput':
            // Focus on search input when window is activated
            document.getElementById('searchInput').focus();
            break;
    }
});

// Toggle functions for search options
function toggleIgnoreCase() {
    searchOptions.ignoreCase = !searchOptions.ignoreCase;
    updateOptionButtonState('ignoreCaseBtn', searchOptions.ignoreCase);
}

function toggleWholeWord() {
    searchOptions.wholeWord = !searchOptions.wholeWord;
    updateOptionButtonState('wholeWordBtn', searchOptions.wholeWord);
}

function toggleRegex() {
    searchOptions.regex = !searchOptions.regex;
    updateOptionButtonState('regexBtn', searchOptions.regex);
}


function updateOptionButtonState(buttonId, isActive) {
    const button = document.getElementById(buttonId);
    if (isActive) {
        button.classList.add('active');
    } else {
        button.classList.remove('active');
    }
}

// Toggle history dropdown
function toggleHistoryDropdown() {
    const dropdown = document.getElementById('historyDropdownContent');
    if (dropdown.classList.contains('show')) {
        dropdown.classList.remove('show');
        selectedHistoryIndex = -1;
        isInHistoryNavigation = false;
        updateHistorySelection();
    } else {
        dropdown.classList.add('show');
        isInHistoryNavigation = false;
    }
}

// Navigate through history items (only used for history navigation within dropdown)
function navigateHistory(direction) {
    if (persistentSearchHistory.length === 0) return;
    
    const newIndex = selectedHistoryIndex + direction;
    
    // No ring movement - stop at boundaries
    if (newIndex >= 0 && newIndex < persistentSearchHistory.length) {
        selectedHistoryIndex = newIndex;
        updateHistorySelection();
        scrollToSelectedItem();
    }
}

// Select current history item
function selectCurrentHistoryItem() {
    if (selectedHistoryIndex >= 0 && selectedHistoryIndex < persistentSearchHistory.length) {
        const searchText = persistentSearchHistory[selectedHistoryIndex];
        selectHistoryItem(searchText);
    }
}

// Initialize option buttons and add event listeners
function initializeOptionButtons() {
    document.getElementById('ignoreCaseBtn').addEventListener('click', toggleIgnoreCase);
    document.getElementById('wholeWordBtn').addEventListener('click', toggleWholeWord);
    document.getElementById('regexBtn').addEventListener('click', toggleRegex);
    document.getElementById('historyBtn').addEventListener('click', toggleHistoryDropdown);
    
    // Set initial states (regex is enabled by default)
    updateOptionButtonState('regexBtn', searchOptions.regex);
}

// Close dropdown when clicking outside
document.addEventListener('click', function(event) {
    const dropdown = document.getElementById('historyDropdownContent');
    const historyBtn = document.getElementById('historyBtn');
    
    // Close history dropdown
    if (!historyBtn.contains(event.target) && !dropdown.contains(event.target)) {
        dropdown.classList.remove('show');
        selectedHistoryIndex = -1;
        isInHistoryNavigation = false;
        updateHistorySelection();
    }
});

// Handle arrow keys when focus is within history dropdown
document.addEventListener('keydown', function(e) {
    const dropdown = document.getElementById('historyDropdownContent');
    const isDropdownOpen = dropdown.classList.contains('show');
    
    if (isDropdownOpen && selectedHistoryIndex >= 0) {
        switch(e.key) {
            case 'ArrowDown':
                e.preventDefault();
                navigateHistory(1);
                break;
            case 'ArrowUp':
                e.preventDefault();
                navigateHistory(-1);
                break;
            case 'Escape':
                e.preventDefault();
                dropdown.classList.remove('show');
                selectedHistoryIndex = -1;
                isInHistoryNavigation = false;
                updateHistorySelection();
                document.getElementById('searchInput').focus();
                break;
        }
    }
});

// Focus on search input when webview loads
window.addEventListener('load', () => {
    document.getElementById('searchInput').focus();
    initializeOptionButtons();
    setupKeyboardShortcuts();
});

// Update history selection visual state
function updateHistorySelection() {
    const dropdown = document.getElementById('historyDropdownContent');
    const items = dropdown.querySelectorAll('.history-item');
    
    items.forEach((item, index) => {
        if (index === selectedHistoryIndex) {
            item.classList.add('selected');
            item.focus(); // Move focus to selected item
        } else {
            item.classList.remove('selected');
        }
    });
}

// Scroll to selected item if out of view
function scrollToSelectedItem() {
    if (selectedHistoryIndex < 0) return;
    
    const dropdown = document.getElementById('historyDropdownContent');
    const items = dropdown.querySelectorAll('.history-item');
    
    if (selectedHistoryIndex < items.length) {
        const selectedItem = items[selectedHistoryIndex];
        selectedItem.scrollIntoView({
            behavior: 'smooth',
            block: 'nearest'
        });
    }
}

// Function to select history item
function selectHistoryItem(searchText) {
    document.getElementById('searchInput').value = searchText;
    document.getElementById('historyDropdownContent').classList.remove('show');
    selectedHistoryIndex = -1;
    isInHistoryNavigation = false;
    updateHistorySelection();
    // Return focus to search input
    document.getElementById('searchInput').focus();
}

// Function to delete history item
function deleteHistoryItem(searchText) {
    vscode.postMessage({
        command: 'deleteHistory',
        text: searchText
    });
}

// Function to update search history dropdown
function updateSearchHistory() {
    const dropdown = document.getElementById('historyDropdownContent');
    dropdown.innerHTML = '';
    
    if (persistentSearchHistory.length === 0) {
        const emptyItem = document.createElement('div');
        emptyItem.className = 'history-item';
        emptyItem.innerHTML = '<span class="history-item-text">No search history</span>';
        dropdown.appendChild(emptyItem);
        return;
    }
    
    persistentSearchHistory.forEach((search, index) => {
        const item = document.createElement('div');
        item.className = 'history-item';
        item.tabIndex = -1; // Make focusable
        
        // Add selected class if this is the selected item
        if (index === selectedHistoryIndex) {
            item.classList.add('selected');
        }
        
        const textSpan = document.createElement('span');
        textSpan.className = 'history-item-text';
        textSpan.textContent = search;
        textSpan.onclick = () => selectHistoryItem(search);
        
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'history-item-delete';
        deleteBtn.textContent = '×';
        deleteBtn.onclick = (e) => {
            e.stopPropagation();
            deleteHistoryItem(search);
        };
        
        // Handle Enter key on history item
        item.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                selectHistoryItem(search);
            }
        });
        
        item.appendChild(textSpan);
        item.appendChild(deleteBtn);
        dropdown.appendChild(item);
    });
}

// Function to open file at specific line
function openFile(filePath, lineNumber) {
    vscode.postMessage({
        command: 'openFile',
        filePath: filePath,
        lineNumber: lineNumber
    });
}

// Setup keyboard shortcuts
function setupKeyboardShortcuts() {
    document.addEventListener('keydown', function(e) {
        // Check for Mac (cmd key) or Windows/Linux (ctrl key)
        const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
        const modifierKey = isMac ? e.metaKey : e.ctrlKey;
        
        
        // Cmd/Ctrl + F: Focus search input
        if (modifierKey && e.key === 'f') {
            e.preventDefault();
            document.getElementById('searchInput').focus();
            document.getElementById('searchInput').select();
            return;
        }
        
        // Cmd/Ctrl + Option/Alt + w: Toggle whole word
        if (modifierKey && e.altKey && (e.key === 'w' || e.code === 'KeyW')) {
            e.preventDefault();
            toggleWholeWord();
            return;
        }
        
        // Cmd/Ctrl + Option/Alt + c: Toggle case sensitivity  
        if (modifierKey && e.altKey && (e.key === 'c' || e.code === 'KeyC')) {
            e.preventDefault();
            toggleIgnoreCase();
            return;
        }
        
        // Cmd/Ctrl + Option/Alt + r: Toggle regex
        if (modifierKey && e.altKey && (e.key === 'r' || e.code === 'KeyR')) {
            e.preventDefault();
            toggleRegex();
            return;
        }
        
    });
}
