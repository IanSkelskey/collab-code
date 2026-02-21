import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import type { VirtualFS } from '../hooks/useVirtualFS';
import { useCollab } from '../context/CollabContext';
import { SearchIcon, CloseIcon, ChevronRightIcon, ReplaceIcon, ReplaceAllIcon, SpinnerIcon } from './Icons';
import { FileIcon } from './TreeNode';

interface SearchResult {
  file: string;
  line: number;
  col: number;
  matchLength: number;
  text: string;
}

interface SearchPanelProps {
  fs: VirtualFS;
  onNavigateTo?: (file: string, line: number, col: number) => void;
}

export default function SearchPanel({ fs, onNavigateTo }: SearchPanelProps) {
  const { ydoc } = useCollab();
  const [query, setQuery] = useState('');
  const [replaceText, setReplaceText] = useState('');
  const [replaceVisible, setReplaceVisible] = useState(false);
  const [useRegex, setUseRegex] = useState(false);
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [wholeWord, setWholeWord] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searched, setSearched] = useState(false);
  const [regexError, setRegexError] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const buildRegex = useCallback((flags: string) => {
    let pattern = query.trim();
    if (!pattern) throw new Error('Empty pattern');
    if (!useRegex) pattern = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (wholeWord) pattern = `\\b${pattern}\\b`;
    return new RegExp(pattern, flags);
  }, [query, useRegex, wholeWord]);

  const doSearch = useCallback(() => {
    const q = query.trim();
    if (!q) {
      setResults([]);
      setSearched(false);
      setRegexError(null);
      return;
    }

    setRegexError(null);
    const allFiles = fs.getAllFiles();
    const found: SearchResult[] = [];

    let regex: RegExp;
    try {
      regex = buildRegex(caseSensitive ? 'g' : 'gi');
    } catch (e) {
      if (q) {
        setRegexError((e as Error).message);
        setResults([]);
        setSearched(true);
      }
      return;
    }

    for (const [relPath, content] of Object.entries(allFiles)) {
      const lines = content.split('\n');
      for (let i = 0; i < lines.length; i++) {
        regex.lastIndex = 0;
        let match;
        while ((match = regex.exec(lines[i])) !== null) {
          found.push({
            file: '~/' + relPath,
            line: i + 1,
            col: match.index + 1,
            matchLength: match[0].length,
            text: lines[i],
          });
          if (found.length >= 1000) break;
          if (match[0].length === 0) break; // Prevent infinite loop on zero-length match
        }
        if (found.length >= 1000) break;
      }
      if (found.length >= 1000) break;
    }

    setResults(found);
    setSearched(true);
    setSearching(false);
  }, [query, caseSensitive, buildRegex, fs]);

  // Re-search when toggles change
  useEffect(() => {
    if (query.trim()) doSearch();
  }, [useRegex, caseSensitive, wholeWord]); // eslint-disable-line react-hooks/exhaustive-deps

  // Debounced live search as user types
  useEffect(() => {
    if (query.trim()) setSearching(true);
    const timer = setTimeout(() => doSearch(), 200);
    return () => clearTimeout(timer);
  }, [query]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      doSearch();
    }
  };

  const handleResultClick = (result: SearchResult) => {
    if (onNavigateTo) {
      onNavigateTo(result.file, result.line, result.col);
    } else {
      fs.openFile(result.file);
    }
  };

  // Replace the first match
  const handleReplace = useCallback(() => {
    if (results.length === 0 || !query.trim()) return;
    const first = results[0];
    const ytext = fs.getFileText(first.file);
    if (!ytext) return;

    const content = ytext.toString();
    let regex: RegExp;
    try {
      regex = buildRegex(caseSensitive ? '' : 'i');
    } catch { return; }

    const match = regex.exec(content);
    if (!match) return;

    ydoc.transact(() => {
      ytext.delete(match.index, match[0].length);
      ytext.insert(match.index, replaceText);
    });

    setTimeout(doSearch, 50);
  }, [results, query, replaceText, fs, ydoc, buildRegex, caseSensitive, doSearch]);

  // Replace all matches across all files
  const handleReplaceAll = useCallback(() => {
    if (results.length === 0 || !query.trim()) return;

    let regex: RegExp;
    try {
      regex = buildRegex(caseSensitive ? 'g' : 'gi');
    } catch { return; }

    const filesProcessed = new Set<string>();

    for (const r of results) {
      if (filesProcessed.has(r.file)) continue;
      filesProcessed.add(r.file);

      const ytext = fs.getFileText(r.file);
      if (!ytext) continue;

      const content = ytext.toString();
      const matches: { index: number; length: number }[] = [];
      regex.lastIndex = 0;
      let m;
      while ((m = regex.exec(content)) !== null) {
        matches.push({ index: m.index, length: m[0].length });
        if (m[0].length === 0) break;
      }

      if (matches.length === 0) continue;

      ydoc.transact(() => {
        for (let i = matches.length - 1; i >= 0; i--) {
          ytext.delete(matches[i].index, matches[i].length);
          ytext.insert(matches[i].index, replaceText);
        }
      });
    }

    setTimeout(doSearch, 50);
  }, [results, query, replaceText, fs, ydoc, buildRegex, caseSensitive, doSearch]);

  const toggleCollapsed = (file: string) => {
    setCollapsed(prev => {
      const next = new Set(prev);
      if (next.has(file)) next.delete(file);
      else next.add(file);
      return next;
    });
  };

  // Group results by file
  const grouped = useMemo(() => {
    const map = new Map<string, SearchResult[]>();
    for (const r of results) {
      const list = map.get(r.file) ?? [];
      list.push(r);
      map.set(r.file, list);
    }
    return map;
  }, [results]);

  const fileCount = grouped.size;
  const matchCount = results.length;

  const toggleBtnClass = (active: boolean) =>
    `px-1.5 py-0.5 rounded text-[10px] font-bold transition-colors cursor-pointer ${
      active
        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
        : 'text-zinc-500 hover:text-zinc-300 border border-transparent hover:border-zinc-600'
    }`;

  return (
    <div className="h-full flex flex-col bg-[#0d1117] text-zinc-300 border-r border-zinc-700/50">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 min-h-[38px] border-b border-zinc-700/50">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
          Search
        </span>
        <button
          onClick={() => setReplaceVisible(v => !v)}
          title={replaceVisible ? 'Hide Replace' : 'Find and Replace'}
          className="p-1 rounded hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer"
        >
          <ChevronRightIcon className={`w-3 h-3 transition-transform ${replaceVisible ? 'rotate-90' : ''}`} />
        </button>
      </div>

      {/* Search & Replace inputs */}
      <div className="px-2 pt-2 pb-1 space-y-1.5">
        {/* Search input */}
        <div className="flex items-center gap-1 bg-zinc-800 border border-zinc-700 rounded px-2 py-1 focus-within:border-emerald-400 transition-colors">
          {searching ? (
            <SpinnerIcon className="w-3.5 h-3.5 text-emerald-400 shrink-0 animate-spin" />
          ) : (
            <SearchIcon className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
          )}
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search files…"
            className="flex-1 bg-transparent text-xs text-zinc-200 outline-none placeholder-zinc-500 min-w-0"
          />
          {query && (
            <button
              onClick={() => { setQuery(''); setResults([]); setSearched(false); setRegexError(null); }}
              className="text-zinc-400 hover:text-zinc-200 cursor-pointer"
            >
              <CloseIcon className="w-3 h-3" />
            </button>
          )}
        </div>

        {/* Replace input */}
        {replaceVisible && (
          <div className="flex items-center gap-1">
            <div className="flex-1 flex items-center gap-1 bg-zinc-800 border border-zinc-700 rounded px-2 py-1 focus-within:border-emerald-400 transition-colors">
              <input
                value={replaceText}
                onChange={(e) => setReplaceText(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleReplace(); } }}
                placeholder="Replace…"
                className="flex-1 bg-transparent text-xs text-zinc-200 outline-none placeholder-zinc-500 min-w-0"
              />
              {replaceText && (
                <button
                  onClick={() => setReplaceText('')}
                  className="text-zinc-400 hover:text-zinc-200 cursor-pointer"
                >
                  <CloseIcon className="w-3 h-3" />
                </button>
              )}
            </div>
            <button
              onClick={handleReplace}
              disabled={results.length === 0}
              title="Replace"
              className="p-1 rounded hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-default"
            >
              <ReplaceIcon className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleReplaceAll}
              disabled={results.length === 0}
              title="Replace All"
              className="p-1 rounded hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-default"
            >
              <ReplaceAllIcon className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Toggle buttons */}
        <div className="flex items-center gap-1 px-0.5">
          <button onClick={() => setCaseSensitive(v => !v)} title="Match Case" className={toggleBtnClass(caseSensitive)}>
            Aa
          </button>
          <button onClick={() => setWholeWord(v => !v)} title="Match Whole Word" className={toggleBtnClass(wholeWord)}>
            <span className="underline decoration-1 underline-offset-2">ab</span>
          </button>
          <button onClick={() => setUseRegex(v => !v)} title="Use Regular Expression" className={`${toggleBtnClass(useRegex)} font-mono`}>
            .*
          </button>
        </div>
      </div>

      {regexError && (
        <div className="px-3 py-1 text-[10px] text-red-400">{regexError}</div>
      )}

      {/* Result summary */}
      {searched && !regexError && results.length > 0 && (
        <div className="px-3 py-1.5 text-[10px] text-zinc-400 border-b border-zinc-700/50">
          {matchCount} result{matchCount !== 1 ? 's' : ''} in {fileCount} file{fileCount !== 1 ? 's' : ''}
          {matchCount >= 1000 && ' (limited)'}
        </div>
      )}

      {/* Results */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-thin">
        {searching && (
          <div className="px-3 py-8 flex flex-col items-center gap-2">
            <SpinnerIcon className="w-6 h-6 text-emerald-400 animate-spin" />
            <p className="text-[10px] text-zinc-500">Searching…</p>
          </div>
        )}

        {!searching && searched && results.length === 0 && !regexError && (
          <div className="px-3 py-8 text-center">
            <SearchIcon className="w-8 h-8 text-zinc-600 mx-auto mb-2" />
            <p className="text-xs text-zinc-500">No results found</p>
          </div>
        )}

        {!searched && !query.trim() && (
          <div className="px-3 py-8 text-center">
            <SearchIcon className="w-8 h-8 text-zinc-600 mx-auto mb-2" />
            <p className="text-xs text-zinc-500">Search across all files</p>
            <p className="text-[10px] text-zinc-600 mt-1">Use toggles for case, whole word, or regex</p>
          </div>
        )}

        {[...grouped.entries()].map(([file, fileResults]) => {
          const fileName = file.split('/').pop() ?? file;
          const relPath = file.replace('~/', '');
          const isCollapsed = collapsed.has(file);
          return (
            <div key={file}>
              {/* File header */}
              <button
                onClick={() => toggleCollapsed(file)}
                className="w-full flex items-center gap-1.5 px-2 py-1 bg-[#161b22] text-[11px] font-medium text-zinc-400 sticky top-0 hover:bg-zinc-800/80 cursor-pointer transition-colors"
              >
                <ChevronRightIcon className={`w-3 h-3 shrink-0 transition-transform ${isCollapsed ? '' : 'rotate-90'}`} />
                <FileIcon name={fileName} />
                <span className="truncate" title={relPath}>{relPath}</span>
                <span className="ml-auto text-[10px] text-zinc-500 shrink-0">{fileResults.length}</span>
              </button>
              {/* Matches */}
              {!isCollapsed && fileResults.map((r, i) => (
                <button
                  key={i}
                  onClick={() => handleResultClick(r)}
                  className="w-full text-left px-3 py-0.5 text-xs hover:bg-zinc-700/50 cursor-pointer transition-colors flex items-baseline gap-2 group"
                >
                  <span className="text-[10px] text-zinc-500 shrink-0 w-5 text-right">{r.line}</span>
                  <span className="truncate text-zinc-300 group-hover:text-zinc-100">
                    <HighlightedLine text={r.text} query={query} useRegex={useRegex} caseSensitive={caseSensitive} wholeWord={wholeWord} />
                  </span>
                </button>
              ))}
            </div>
          );
        })}

        {results.length >= 1000 && (
          <div className="px-3 py-2 text-[10px] text-zinc-500 text-center">
            Results capped at 1,000
          </div>
        )}
      </div>
    </div>
  );
}

function HighlightedLine({ text, query, useRegex, caseSensitive, wholeWord }: {
  text: string; query: string; useRegex: boolean; caseSensitive: boolean; wholeWord: boolean;
}) {
  if (!query.trim()) return <>{text}</>;

  try {
    const flags = caseSensitive ? 'g' : 'gi';
    let pattern = useRegex ? query : query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (wholeWord) pattern = `\\b${pattern}\\b`;
    const regex = new RegExp(`(${pattern})`, flags);

    const parts = text.split(regex);
    return (
      <>
        {parts.map((part, i) =>
          regex.test(part) ? (
            <span key={i} className="text-emerald-400 bg-emerald-400/10 rounded-sm font-medium">{part}</span>
          ) : (
            <span key={i}>{part}</span>
          )
        )}
      </>
    );
  } catch {
    return <>{text}</>;
  }
}
