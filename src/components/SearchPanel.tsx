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
  return `cursor-pointer rounded px-1.5 py-0.5 text-[10px] font-bold transition-colors ${
    active
      ? 'border border-[var(--cc-accent)] bg-[var(--cc-bg-selection)] text-[var(--cc-accent)]'
      : 'cc-text-muted border border-transparent hover:border-[color:var(--cc-border)] hover:text-[var(--cc-text-primary)]'
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

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        runSearch();
      }
    },
    [runSearch],
  );

  const handleResultClick = useCallback(
    (result: SearchResult) => {
      if (onNavigateTo) {
        onNavigateTo(result.file, result.line, result.col);
        return;
      }

      fs.openFile(result.file);
    },
    [fs, onNavigateTo],
  );

  return (
    <div className="cc-sidebar-shell cc-divider flex h-full flex-col border-r">
      <div className="cc-divider flex min-h-[38px] items-center justify-between border-b px-3 py-2">
        <span className="cc-section-label text-[10px] font-semibold">Search</span>
        <button
          onClick={() => setReplaceVisible((isVisible) => !isVisible)}
          title={replaceVisible ? 'Hide Replace' : 'Find and Replace'}
          className="cc-icon-button cursor-pointer rounded p-1"
        >
          <ChevronRightIcon
            className={`w-3 h-3 transition-transform ${replaceVisible ? 'rotate-90' : ''}`}
          />
        </button>
      </div>

      <div className="px-2 pt-2 pb-1 space-y-1.5">
        <div className="cc-input-shell flex items-center gap-1 rounded px-2 py-1">
          {searching ? (
            <SpinnerIcon className="h-3.5 w-3.5 shrink-0 animate-spin text-[var(--cc-accent)]" />
          ) : (
            <SearchIcon className="cc-text-muted h-3.5 w-3.5 shrink-0" />
          )}
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search files..."
            className="cc-input min-w-0 flex-1 bg-transparent text-xs outline-none"
          />
          {query && (
            <button onClick={clearQuery} className="cc-button-ghost cursor-pointer rounded">
              <CloseIcon className="w-3 h-3" />
            </button>
          )}
        </div>

        {replaceVisible && (
          <div className="flex items-center gap-1">
            <div className="cc-input-shell flex flex-1 items-center gap-1 rounded px-2 py-1">
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
                className="cc-input min-w-0 flex-1 bg-transparent text-xs outline-none"
              />
              {replaceText && (
                <button
                  onClick={() => setReplaceText('')}
                  className="cc-button-ghost cursor-pointer rounded"
                >
                  <CloseIcon className="w-3 h-3" />
                </button>
              )}
            </div>
            <button
              onClick={handleReplace}
              disabled={results.length === 0}
              title="Replace"
              className="cc-icon-button cursor-pointer rounded p-1 disabled:cursor-default disabled:opacity-30"
            >
              <ReplaceIcon className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleReplaceAll}
              disabled={results.length === 0}
              title="Replace All"
              className="cc-icon-button cursor-pointer rounded p-1 disabled:cursor-default disabled:opacity-30"
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

      {regexError && <div className="px-3 py-1 text-[10px] text-red-400">{regexError}</div>}

      {searched && !regexError && results.length > 0 && (
        <div className="cc-text-muted cc-divider border-b px-3 py-1.5 text-[10px]">
          {matchCount} result{matchCount !== 1 ? 's' : ''} in {fileCount} file
          {fileCount !== 1 ? 's' : ''}
          {matchCount >= 1000 && ' (limited)'}
        </div>
      )}

      <div className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-thin">
        {searching && (
          <div className="px-3 py-8 flex flex-col items-center gap-2">
            <SpinnerIcon className="h-6 w-6 animate-spin text-[var(--cc-accent)]" />
            <p className="cc-text-faint text-[10px]">Searching...</p>
          </div>
        )}

        {!searching && searched && results.length === 0 && !regexError && (
          <div className="px-3 py-8 text-center">
            <SearchIcon className="cc-text-faint mx-auto mb-2 h-8 w-8" />
            <p className="cc-text-faint text-xs">No results found</p>
          </div>
        )}

        {!searched && !query.trim() && (
          <div className="px-3 py-8 text-center">
            <SearchIcon className="cc-text-faint mx-auto mb-2 h-8 w-8" />
            <p className="cc-text-faint text-xs">Search across all files</p>
            <p className="cc-text-faint mt-1 text-[10px]">
              Use toggles for case, whole word, or regex
            </p>
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
                className="cc-topbar cc-text-muted sticky top-0 flex w-full cursor-pointer items-center gap-1.5 px-2 py-1 text-[11px] font-medium transition-colors hover:bg-[var(--cc-bg-hover)]"
              >
                <ChevronRightIcon
                  className={`w-3 h-3 shrink-0 transition-transform ${isCollapsed ? '' : 'rotate-90'}`}
                />
                <FileIcon name={fileName} />
                <span className="truncate" title={relativePath}>
                  {relativePath}
                </span>
                <span className="cc-text-faint ml-auto shrink-0 text-[10px]">
                  {fileResults.length}
                </span>
              </button>

              {!isCollapsed &&
                fileResults.map((result, index) => (
                  <button
                    key={`${file}:${result.line}:${result.col}:${index}`}
                    onClick={() => handleResultClick(result)}
                    className="group flex w-full cursor-pointer items-baseline gap-2 px-3 py-0.5 text-left text-xs transition-colors hover:bg-[var(--cc-bg-hover)]"
                  >
                    <span className="cc-text-faint w-5 shrink-0 text-right text-[10px]">
                      {result.line}
                    </span>
                    <span className="cc-text-secondary group-hover:text-[var(--cc-text-primary)] truncate">
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
          <div className="cc-text-faint px-3 py-2 text-center text-[10px]">
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
            className={
              segment.isMatch
                ? 'rounded-sm bg-[var(--cc-bg-selection)] font-medium text-[var(--cc-accent)]'
                : undefined
            }
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
