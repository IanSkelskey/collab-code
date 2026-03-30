import { useCallback, type KeyboardEvent } from 'react';
import type { VirtualFS } from '../hooks/useVirtualFS';
import { useWorkspaceSearch } from '../hooks/useWorkspaceSearch';
import { useCollab } from '../context/CollabContext';
import { getBaseName, stripVfsRoot } from '../lib/vfsPaths';
import { highlightSearchMatch, type SearchResult } from '../services/workspaceSearch';
import {
  ChevronRightIcon,
  CloseIcon,
  ReplaceAllIcon,
  ReplaceIcon,
  SearchIcon,
  SpinnerIcon,
} from './Icons';
import { FileIcon } from './TreeNode';

interface SearchPanelProps {
  fs: VirtualFS;
  onNavigateTo?: (file: string, line: number, col: number) => void;
}

function toggleButtonClass(active: boolean): string {
  return `px-1.5 py-0.5 rounded text-[10px] font-bold transition-colors cursor-pointer ${
    active
      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
      : 'text-zinc-500 hover:text-zinc-300 border border-transparent hover:border-zinc-600'
  }`;
}

export default function SearchPanel({ fs, onNavigateTo }: SearchPanelProps) {
  const { ydoc } = useCollab();
  const {
    query,
    setQuery,
    replaceText,
    setReplaceText,
    replaceVisible,
    setReplaceVisible,
    useRegex,
    setUseRegex,
    caseSensitive,
    setCaseSensitive,
    wholeWord,
    setWholeWord,
    results,
    searched,
    regexError,
    searching,
    collapsed,
    inputRef,
    groupedResults,
    fileCount,
    matchCount,
    runSearch,
    clearQuery,
    handleReplace,
    handleReplaceAll,
    toggleCollapsed,
  } = useWorkspaceSearch({ fs, ydoc });

  const handleKeyDown = useCallback((event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      runSearch();
    }
  }, [runSearch]);

  const handleResultClick = useCallback((result: SearchResult) => {
    if (onNavigateTo) {
      onNavigateTo(result.file, result.line, result.col);
      return;
    }

    fs.openFile(result.file);
  }, [fs, onNavigateTo]);

  return (
    <div className="h-full flex flex-col bg-[#0d1117] text-zinc-300 border-r border-zinc-700/50">
      <div className="flex items-center justify-between px-3 py-2 min-h-[38px] border-b border-zinc-700/50">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
          Search
        </span>
        <button
          onClick={() => setReplaceVisible((isVisible) => !isVisible)}
          title={replaceVisible ? 'Hide Replace' : 'Find and Replace'}
          className="p-1 rounded hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer"
        >
          <ChevronRightIcon className={`w-3 h-3 transition-transform ${replaceVisible ? 'rotate-90' : ''}`} />
        </button>
      </div>

      <div className="px-2 pt-2 pb-1 space-y-1.5">
        <div className="flex items-center gap-1 bg-zinc-800 border border-zinc-700 rounded px-2 py-1 focus-within:border-emerald-400 transition-colors">
          {searching ? (
            <SpinnerIcon className="w-3.5 h-3.5 text-emerald-400 shrink-0 animate-spin" />
          ) : (
            <SearchIcon className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
          )}
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search files..."
            className="flex-1 bg-transparent text-xs text-zinc-200 outline-none placeholder-zinc-500 min-w-0"
          />
          {query && (
            <button
              onClick={clearQuery}
              className="text-zinc-400 hover:text-zinc-200 cursor-pointer"
            >
              <CloseIcon className="w-3 h-3" />
            </button>
          )}
        </div>

        {replaceVisible && (
          <div className="flex items-center gap-1">
            <div className="flex-1 flex items-center gap-1 bg-zinc-800 border border-zinc-700 rounded px-2 py-1 focus-within:border-emerald-400 transition-colors">
              <input
                value={replaceText}
                onChange={(event) => setReplaceText(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    handleReplace();
                  }
                }}
                placeholder="Replace..."
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

        <div className="flex items-center gap-1 px-0.5">
          <button
            onClick={() => setCaseSensitive((isEnabled) => !isEnabled)}
            title="Match Case"
            className={toggleButtonClass(caseSensitive)}
          >
            Aa
          </button>
          <button
            onClick={() => setWholeWord((isEnabled) => !isEnabled)}
            title="Match Whole Word"
            className={toggleButtonClass(wholeWord)}
          >
            <span className="underline decoration-1 underline-offset-2">ab</span>
          </button>
          <button
            onClick={() => setUseRegex((isEnabled) => !isEnabled)}
            title="Use Regular Expression"
            className={`${toggleButtonClass(useRegex)} font-mono`}
          >
            .*
          </button>
        </div>
      </div>

      {regexError && (
        <div className="px-3 py-1 text-[10px] text-red-400">{regexError}</div>
      )}

      {searched && !regexError && results.length > 0 && (
        <div className="px-3 py-1.5 text-[10px] text-zinc-400 border-b border-zinc-700/50">
          {matchCount} result{matchCount !== 1 ? 's' : ''} in {fileCount} file{fileCount !== 1 ? 's' : ''}
          {matchCount >= 1000 && ' (limited)'}
        </div>
      )}

      <div className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-thin">
        {searching && (
          <div className="px-3 py-8 flex flex-col items-center gap-2">
            <SpinnerIcon className="w-6 h-6 text-emerald-400 animate-spin" />
            <p className="text-[10px] text-zinc-500">Searching...</p>
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

        {[...groupedResults.entries()].map(([file, fileResults]) => {
          const fileName = getBaseName(file);
          const relativePath = stripVfsRoot(file);
          const isCollapsed = collapsed.has(file);

          return (
            <div key={file}>
              <button
                onClick={() => toggleCollapsed(file)}
                className="w-full flex items-center gap-1.5 px-2 py-1 bg-[#161b22] text-[11px] font-medium text-zinc-400 sticky top-0 hover:bg-zinc-800/80 cursor-pointer transition-colors"
              >
                <ChevronRightIcon className={`w-3 h-3 shrink-0 transition-transform ${isCollapsed ? '' : 'rotate-90'}`} />
                <FileIcon name={fileName} />
                <span className="truncate" title={relativePath}>{relativePath}</span>
                <span className="ml-auto text-[10px] text-zinc-500 shrink-0">{fileResults.length}</span>
              </button>

              {!isCollapsed && fileResults.map((result, index) => (
                <button
                  key={`${file}:${result.line}:${result.col}:${index}`}
                  onClick={() => handleResultClick(result)}
                  className="w-full text-left px-3 py-0.5 text-xs hover:bg-zinc-700/50 cursor-pointer transition-colors flex items-baseline gap-2 group"
                >
                  <span className="text-[10px] text-zinc-500 shrink-0 w-5 text-right">{result.line}</span>
                  <span className="truncate text-zinc-300 group-hover:text-zinc-100">
                    <HighlightedLine
                      text={result.text}
                      query={query}
                      useRegex={useRegex}
                      caseSensitive={caseSensitive}
                      wholeWord={wholeWord}
                    />
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

function HighlightedLine({
  text,
  query,
  useRegex,
  caseSensitive,
  wholeWord,
}: {
  text: string;
  query: string;
  useRegex: boolean;
  caseSensitive: boolean;
  wholeWord: boolean;
}) {
  try {
    const segments = highlightSearchMatch(text, {
      query,
      useRegex,
      caseSensitive,
      wholeWord,
    });

    return (
      <>
        {segments.map((segment, index) => (
          <span
            key={`${segment.text}-${index}`}
            className={segment.isMatch ? 'text-emerald-400 bg-emerald-400/10 rounded-sm font-medium' : undefined}
          >
            {segment.text}
          </span>
        ))}
      </>
    );
  } catch {
    return <>{text}</>;
  }
}
