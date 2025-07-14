use file_walker::{walk_directory, search_files_compatible, SearchOptions, SearchStatus};
use std::process;
use clap::{Parser, ArgAction};

#[derive(Parser)]
#[command(name = "file_walker")]
#[command(about = "A fast file walker and searcher with gitignore support")]
struct Cli {
    /// Pattern to search for
    pattern: String,
    
    /// Paths to search in
    #[arg(default_value = ".")]
    paths: Vec<String>,
    
    /// Enable JSON output format
    #[arg(long)]
    json: bool,
    
    /// Show line numbers
    #[arg(short = 'n', long = "line-number", action = ArgAction::SetTrue)]
    line_number: bool,
    
    /// Case insensitive search
    #[arg(short = 'i', long = "ignore-case", action = ArgAction::SetTrue)]
    ignore_case: bool,
    
    /// Whole word search
    #[arg(short = 'w', long = "word-regexp", action = ArgAction::SetTrue)]
    word_regexp: bool,
    
    /// Fixed string search (not regex)
    #[arg(short = 'F', long = "fixed-strings", action = ArgAction::SetTrue)]
    fixed_strings: bool,
    
    /// Include file glob patterns
    #[arg(short = 'g', action = ArgAction::Append)]
    glob: Vec<String>,
    
    /// Context lines around match
    #[arg(short = 'C')]
    context: Option<usize>,
    
    /// Sort by path
    #[arg(long)]
    sort: Option<String>,
    
    /// Disable color output
    #[arg(long)]
    color: Option<String>,
    
    /// Disable heading
    #[arg(long)]
    no_heading: bool,
    
    /// Don't print lines longer than this limit
    #[arg(short = 'M', long = "max-columns")]
    max_columns: Option<usize>,
    
    /// When the '--max-columns' flag is used, ripgrep will try to preview the matching line
    #[arg(long = "max-columns-preview")]
    max_columns_preview: bool,
    
    /// Limit the number of matching lines per file searched to NUM
    #[arg(short = 'm', long = "max-count")]
    max_count: Option<usize>,
}

fn main() {
    let cli = Cli::parse();
    
    if cli.pattern.is_empty() {
        // List mode
        let default_path = ".".to_string();
        let path = cli.paths.first().unwrap_or(&default_path);
        let result = walk_directory(path);
        println!("{}", result);
    } else {
        // Search mode - create search options
        let search_options = SearchOptions {
            ignore_case: cli.ignore_case,
            whole_word: cli.word_regexp,
            fixed_strings: cli.fixed_strings,
            include_context: cli.context.unwrap_or(0),
            json_output: cli.json,
            line_numbers: cli.line_number,
            file_globs: cli.glob,
            max_columns: cli.max_columns,
            max_columns_preview: cli.max_columns_preview,
            max_count: cli.max_count,
        };
        
        let default_path = ".".to_string();
        let path = cli.paths.first().unwrap_or(&default_path);
        let result = search_files_compatible(&cli.pattern, path, &search_options);
        println!("{}", result.output);
        
        // Set appropriate exit status to match ripgrep behavior
        match result.status {
            SearchStatus::HasMatches => process::exit(0),
            SearchStatus::NoMatches => process::exit(1),
            SearchStatus::Error(_) => process::exit(2),
        }
    }
}

