# Semantic Coloring Search Editor

**English** | [日本語](README.md)

A VS Code extension for file search with colorized results. Use it as an alternative to VS Code's built-in Search Editor.

## Features

- **Fast File Search**: Built-in search engine (ripgrep-compatible subset) with no external dependencies
- **Semantic Coloring of Paths**: Semantic coloring of file paths for better visual organization
- **Context Lines**: Toggle display of context around hit locations
- **Search Options**: Support for case-insensitive search, whole word matching, and regex patterns
- **File Pattern Filtering**: Use glob patterns to filter search results by file type
- **Search History**: Persistent search history with quick access via dropdown
- **Gitignore Support**: Automatically respects .gitignore rules during search
- **Cross-Platform**: Works on macOS and Windows without requiring ripgrep installation (Linux supported if ripgrep is available)

## Usage

1. Open the Command Palette (`Cmd+Shift+P` on macOS, `Ctrl+Shift+P` on Windows/Linux)
2. Run "Semantic Coloring Search Editor: Search"
3. Enter your search term and optional file patterns
4. Configure search options using the toggle buttons:
   - **Aa**: Toggle case sensitivity
   - **|ab|**: Toggle whole word matching
   - **.***: Toggle regex mode
5. Click "Search" or press Enter

## Search Options

- **Search Term**: The text or regex pattern to search for
- **File Pattern**: Glob patterns to filter files (e.g., `*.js`, `*.ts,*.tsx`)
- **Path**: Specific directory paths to search within (e.g., `src/`, `static/js/,static/css/`)