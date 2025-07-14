use ignore::Walk;
use serde::{Deserialize, Serialize};
use grep_searcher::SearcherBuilder;
use grep_matcher::Matcher;
use std::fs::File;

#[derive(Serialize, Deserialize)]
pub struct FileEntry {
    path: String,
    is_dir: bool,
    is_file: bool,
    size: Option<u64>,
}

#[derive(Serialize, Deserialize)]
pub struct WalkResult {
    entries: Vec<FileEntry>,
    error: Option<String>,
}

#[derive(Serialize, Deserialize)]
pub struct SearchMatch {
    file_path: String,
    line_number: u64,
    line_content: String,
    match_start: usize,
    match_end: usize,
}

#[derive(Serialize, Deserialize)]
pub struct SearchResult {
    matches: Vec<SearchMatch>,
    files_searched: u32,
    error: Option<String>,
}

pub fn walk_directory(path: &str) -> String {
    let result = walk_directory_impl(path);
    serde_json::to_string(&result).unwrap_or_else(|e| {
        let error_result = WalkResult {
            entries: vec![],
            error: Some(format!("JSON serialization error: {}", e)),
        };
        serde_json::to_string(&error_result).unwrap()
    })
}

fn walk_directory_impl(path: &str) -> WalkResult {
    let mut entries = Vec::new();
    let mut error = None;

    for result in Walk::new(path) {
        match result {
            Ok(entry) => {
                let path_str = entry.path().display().to_string();
                let file_type = entry.file_type();
                
                let size = if file_type.map(|ft| ft.is_file()).unwrap_or(false) {
                    entry.metadata().ok().map(|m| m.len())
                } else {
                    None
                };

                entries.push(FileEntry {
                    path: path_str,
                    is_dir: file_type.map(|ft| ft.is_dir()).unwrap_or(false),
                    is_file: file_type.map(|ft| ft.is_file()).unwrap_or(false),
                    size,
                });
            }
            Err(e) => {
                error = Some(format!("Walk error: {}", e));
                break;
            }
        }
    }

    WalkResult { entries, error }
}

pub fn search_files(path: &str, pattern: &str) -> String {
    let result = search_files_impl(path, pattern);
    serde_json::to_string(&result).unwrap_or_else(|e| {
        let error_result = SearchResult {
            matches: vec![],
            files_searched: 0,
            error: Some(format!("JSON serialization error: {}", e)),
        };
        serde_json::to_string(&error_result).unwrap()
    })
}

fn search_files_impl(path: &str, pattern: &str) -> SearchResult {
    use grep_regex::RegexMatcher;
    
    let matcher = match RegexMatcher::new(pattern) {
        Ok(m) => m,
        Err(e) => {
            return SearchResult {
                matches: vec![],
                files_searched: 0,
                error: Some(format!("Invalid regex pattern: {}", e)),
            };
        }
    };

    let mut matches = Vec::new();
    let mut files_searched = 0;
    let mut search_error = None;

    for result in Walk::new(path) {
        match result {
            Ok(entry) => {
                if entry.file_type().map(|ft| ft.is_file()).unwrap_or(false) {
                    files_searched += 1;
                    
                    if let Err(e) = search_in_file(&matcher, entry.path(), &mut matches) {
                        search_error = Some(format!("Error searching file {}: {}", 
                            entry.path().display(), e));
                        break;
                    }
                }
            }
            Err(e) => {
                search_error = Some(format!("Walk error: {}", e));
                break;
            }
        }
    }

    SearchResult {
        matches,
        files_searched,
        error: search_error,
    }
}

fn search_in_file<P: AsRef<std::path::Path>>(
    matcher: &grep_regex::RegexMatcher,
    file_path: P,
    matches: &mut Vec<SearchMatch>,
) -> Result<(), Box<dyn std::error::Error>> {
    let file = File::open(&file_path)?;
    let mut searcher = SearcherBuilder::new().build();
    
    let path_str = file_path.as_ref().display().to_string();
    
    searcher.search_file(
        matcher,
        &file,
        grep_searcher::sinks::UTF8(|line_num: u64, line: &str| {
            if let Some(mat) = matcher.find(line.as_bytes())? {
                matches.push(SearchMatch {
                    file_path: path_str.clone(),
                    line_number: line_num,
                    line_content: line.to_string(),
                    match_start: mat.start(),
                    match_end: mat.end(),
                });
            }
            Ok(true)
        }),
    )?;
    
    Ok(())
}

#[derive(Clone, Serialize, Deserialize)]
pub struct SearchOptions {
    pub ignore_case: bool,
    pub whole_word: bool,
    pub fixed_strings: bool,
    pub include_context: usize,
    pub json_output: bool,
    pub line_numbers: bool,
    pub file_globs: Vec<String>,
    pub max_columns: Option<usize>,
    pub max_columns_preview: bool,
    pub max_count: Option<usize>,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct RgJsonMatch {
    #[serde(rename = "type")]
    entry_type: String,
    data: RgJsonData,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct RgJsonContext {
    #[serde(rename = "type")]
    entry_type: String,
    data: RgJsonContextData,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct RgJsonContextData {
    path: RgJsonPath,
    lines: RgJsonLines,
    line_number: u64,
    absolute_offset: u64,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct RgJsonData {
    path: RgJsonPath,
    lines: RgJsonLines,
    line_number: u64,
    absolute_offset: u64,
    submatches: Vec<RgJsonSubmatch>,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct RgJsonPath {
    text: String,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct RgJsonLines {
    text: String,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct RgJsonSubmatch {
    #[serde(rename = "match")]
    match_data: RgJsonMatchData,
    start: usize,
    end: usize,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct RgJsonMatchData {
    text: String,
}

pub fn search_files_compatible(pattern: &str, path: &str, options: &SearchOptions) -> String {
    use grep_regex::RegexMatcher;
    use ignore::Walk;
    use globset::{Glob, GlobSetBuilder};
    
    let mut matcher_builder = grep_regex::RegexMatcherBuilder::new();
    matcher_builder.case_insensitive(options.ignore_case);
    if options.whole_word {
        matcher_builder.word(true);
    }
    
    let matcher = match if options.fixed_strings {
        matcher_builder.build(&regex::escape(pattern))
    } else {
        matcher_builder.build(pattern)
    } {
        Ok(m) => m,
        Err(e) => {
            return format!(r#"{{"error": "Invalid regex pattern: {}"}}"#, e);
        }
    };

    // Build globset for file filtering
    let globset = if !options.file_globs.is_empty() {
        let mut builder = GlobSetBuilder::new();
        for glob_pattern in &options.file_globs {
            if let Ok(glob) = Glob::new(glob_pattern) {
                builder.add(glob);
            }
        }
        builder.build().ok()
    } else {
        None
    };

    let mut results = Vec::new();
    let mut _files_searched = 0;

    for result in Walk::new(path) {
        match result {
            Ok(entry) => {
                if entry.file_type().map(|ft| ft.is_file()).unwrap_or(false) {
                    let file_path = entry.path();
                    
                    // Apply glob filtering if specified
                    if let Some(ref gs) = globset {
                        if !gs.is_match(file_path) {
                            continue;
                        }
                    }
                    
                    _files_searched += 1;
                    
                    if let Err(_e) = search_file_with_context(&matcher, file_path, &mut results, options) {
                        // Continue on file errors
                        continue;
                    }
                }
            }
            Err(_e) => {
                // Continue on walk errors
                continue;
            }
        }
    }

    // Convert to ripgrep-compatible JSON format
    let json_lines: Vec<String> = results.into_iter().map(|result| {
        match result {
            SearchResultType::Match(m) => serde_json::to_string(&m).unwrap_or_default(),
            SearchResultType::Context(c) => serde_json::to_string(&c).unwrap_or_default(),
        }
    }).collect();

    json_lines.join("\n")
}

#[derive(Debug)]
enum SearchResultType {
    Match(RgJsonMatch),
    Context(RgJsonContext),
}

fn search_file_with_context<P: AsRef<std::path::Path>>(
    matcher: &grep_regex::RegexMatcher,
    file_path: P,
    results: &mut Vec<SearchResultType>,
    options: &SearchOptions,
) -> Result<(), Box<dyn std::error::Error>> {
    let file = File::open(&file_path)?;
    
    // Configure searcher with binary detection and options
    let _searcher = SearcherBuilder::new()
        .before_context(options.include_context)
        .after_context(options.include_context)
        .binary_detection(grep_searcher::BinaryDetection::quit(b'\x00'))
        .build();
    
    let path_str = file_path.as_ref().display().to_string();
    let mut match_count = 0;
    let max_count = options.max_count;
    let max_columns = options.max_columns;
    let max_columns_preview = options.max_columns_preview;
    
    // Use a more direct approach with proper context handling
    use std::io::BufRead;
    use std::collections::HashSet;
    
    let file_reader = std::io::BufReader::new(file);
    let lines: Vec<String> = file_reader.lines().collect::<Result<Vec<_>, _>>()?;
    
    let context_size = options.include_context;
    let mut match_lines = Vec::new();
    
    // First pass: find all match lines
    for (line_idx, line) in lines.iter().enumerate() {
        
        // Check max_count limit
        if let Some(max) = max_count {
            if match_count >= max {
                break;
            }
        }
        
        // Check if this line matches the pattern
        if let Some(_mat) = matcher.find(line.as_bytes())? {
            match_count += 1;
            match_lines.push(line_idx);
        }
    }
    
    // Second pass: build context ranges and output
    let mut context_ranges = Vec::new();
    
    for &match_idx in &match_lines {
        let start = if match_idx >= context_size {
            match_idx - context_size
        } else {
            0
        };
        let end = std::cmp::min(match_idx + context_size + 1, lines.len());
        context_ranges.push((start, end, match_idx));
    }
    
    // Merge overlapping ranges
    context_ranges.sort_by_key(|&(start, _, _)| start);
    let mut merged_ranges = Vec::new();
    
    if !context_ranges.is_empty() {
        let (mut current_start, mut current_end, first_match) = context_ranges[0];
        let mut current_matches = vec![first_match];
        
        for (start, end, match_idx) in context_ranges.into_iter().skip(1) {
            if start <= current_end {
                // Overlapping ranges - merge them
                current_end = std::cmp::max(current_end, end);
                current_matches.push(match_idx);
            } else {
                // Non-overlapping - save current range and start new one
                merged_ranges.push((current_start, current_end, current_matches.clone()));
                current_start = start;
                current_end = end;
                current_matches = vec![match_idx];
            }
        }
        
        // Don't forget the last range
        merged_ranges.push((current_start, current_end, current_matches));
    }
    
    // Generate output for each merged range
    for (range_start, range_end, matches_in_range) in merged_ranges {
        let match_set: HashSet<usize> = matches_in_range.into_iter().collect();
        
        // Process lines in correct order within each range
        for line_idx in range_start..range_end {
            let line_num = (line_idx + 1) as u64;
            let line = &lines[line_idx];
            
            // Check max_columns limit
            let processed_line = if let Some(max_cols) = max_columns {
                if line.len() > max_cols {
                    if max_columns_preview {
                        format!("{}...", &line[..max_cols.min(line.len())])
                    } else {
                        continue; // Skip lines that are too long
                    }
                } else {
                    line.clone()
                }
            } else {
                line.clone()
            };
            
            if match_set.contains(&line_idx) {
                // This is a match line
                if let Some(mat) = matcher.find(line.as_bytes())? {
                    // Adjust submatch positions if line was truncated
                    let (start, end, match_text) = if let Some(max_cols) = max_columns {
                        if line.len() > max_cols && mat.start() < max_cols {
                            let end_pos = mat.end().min(max_cols);
                            (mat.start(), end_pos, &line[mat.start()..end_pos])
                        } else if line.len() > max_cols {
                            continue; // Match is beyond max_columns, skip this line
                        } else {
                            (mat.start(), mat.end(), &line[mat.start()..mat.end()])
                        }
                    } else {
                        (mat.start(), mat.end(), &line[mat.start()..mat.end()])
                    };
                    
                    let rg_match = RgJsonMatch {
                        entry_type: "match".to_string(),
                        data: RgJsonData {
                            path: RgJsonPath {
                                text: path_str.clone(),
                            },
                            lines: RgJsonLines {
                                text: processed_line,
                            },
                            line_number: line_num,
                            absolute_offset: 0,
                            submatches: vec![RgJsonSubmatch {
                                match_data: RgJsonMatchData {
                                    text: match_text.to_string(),
                                },
                                start,
                                end,
                            }],
                        },
                    };
                    results.push(SearchResultType::Match(rg_match));
                }
            } else if context_size > 0 {
                // This is a context line
                let rg_context = RgJsonContext {
                    entry_type: "context".to_string(),
                    data: RgJsonContextData {
                        path: RgJsonPath {
                            text: path_str.clone(),
                        },
                        lines: RgJsonLines {
                            text: processed_line,
                        },
                        line_number: line_num,
                        absolute_offset: 0,
                    },
                };
                results.push(SearchResultType::Context(rg_context));
            }
        }
    }
    
    Ok(())
}

// Keep the old function for compatibility
fn search_file_compatible<P: AsRef<std::path::Path>>(
    matcher: &grep_regex::RegexMatcher,
    file_path: P,
    results: &mut Vec<RgJsonMatch>,
) -> Result<(), Box<dyn std::error::Error>> {
    let mut search_results = Vec::new();
    let default_options = SearchOptions {
        ignore_case: false,
        whole_word: false,
        fixed_strings: false,
        include_context: 0,
        json_output: true,
        line_numbers: true,
        file_globs: Vec::new(),
        max_columns: None,
        max_columns_preview: false,
        max_count: None,
    };
    search_file_with_context(matcher, file_path, &mut search_results, &default_options)?;
    
    // Extract only match results
    for result in search_results {
        if let SearchResultType::Match(m) = result {
            results.push(m);
        }
    }
    
    Ok(())
}

pub fn wasm_search_files(pattern: &str, path: &str, options_json: &str) -> String {
    let options: SearchOptions = match serde_json::from_str(options_json) {
        Ok(opts) => opts,
        Err(e) => {
            return format!(r#"{{"error": "Invalid options JSON: {}"}}"#, e);
        }
    };
    
    search_files_compatible(pattern, path, &options)
}

pub fn wasm_search_files_simple(
    pattern: &str, 
    path: &str, 
    ignore_case: bool, 
    whole_word: bool, 
    fixed_strings: bool, 
    context: usize,
    file_globs_json: &str,
    max_columns: Option<usize>,
    max_columns_preview: bool,
    max_count: Option<usize>
) -> String {
    let file_globs: Vec<String> = if file_globs_json.is_empty() {
        Vec::new()
    } else {
        serde_json::from_str(file_globs_json).unwrap_or_default()
    };

    let options = SearchOptions {
        ignore_case,
        whole_word,
        fixed_strings,
        include_context: context,
        json_output: true,
        line_numbers: true,
        file_globs,
        max_columns,
        max_columns_preview,
        max_count,
    };
    
    search_files_compatible(pattern, path, &options)
}