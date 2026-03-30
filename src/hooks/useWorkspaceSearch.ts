import {
  startTransition,
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type * as Y from 'yjs';
import type { VirtualFS } from './useVirtualFS';
import {
  buildSearchRegex,
  groupSearchResults,
  replaceAllMatchesInText,
  replaceFirstMatchInText,
  searchWorkspace,
  type SearchResult,
} from '../services/workspaceSearch';

interface UseWorkspaceSearchOptions {
  fs: VirtualFS;
  ydoc: Y.Doc;
}

export function useWorkspaceSearch({ fs, ydoc }: UseWorkspaceSearchOptions) {
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
  const deferredQuery = useDeferredValue(query);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const runSearch = useCallback((currentQuery: string) => {
    const trimmedQuery = currentQuery.trim();

    if (!trimmedQuery) {
      startTransition(() => {
        setResults([]);
        setSearched(false);
        setRegexError(null);
        setSearching(false);
      });
      return;
    }

    try {
      const nextResults = searchWorkspace(fs.getAllFiles(), {
        query: currentQuery,
        useRegex,
        caseSensitive,
        wholeWord,
      });

      startTransition(() => {
        setRegexError(null);
        setResults(nextResults);
        setSearched(true);
        setSearching(false);
      });
    } catch (error) {
      startTransition(() => {
        setRegexError((error as Error).message);
        setResults([]);
        setSearched(true);
        setSearching(false);
      });
    }
  }, [caseSensitive, fs, useRegex, wholeWord]);

  useEffect(() => {
    if (!deferredQuery.trim()) {
      runSearch(deferredQuery);
      return;
    }

    setSearching(true);
    const timer = window.setTimeout(() => runSearch(deferredQuery), 200);

    return () => window.clearTimeout(timer);
  }, [deferredQuery, runSearch, fs.contentVersion, fs.files]);

  const handleReplace = useCallback(() => {
    if (!query.trim()) return;

    let regex: RegExp;

    try {
      regex = buildSearchRegex({ query, useRegex, caseSensitive, wholeWord }, false);
    } catch {
      return;
    }

    for (const result of results) {
      const ytext = fs.getFileText(result.file);
      if (!ytext) continue;

      const nextContent = replaceFirstMatchInText(ytext.toString(), regex, replaceText);
      if (!nextContent) continue;

      ydoc.transact(() => {
        ytext.delete(0, ytext.length);
        ytext.insert(0, nextContent);
      });

      runSearch(query);
      return;
    }
  }, [caseSensitive, fs, query, replaceText, results, runSearch, useRegex, wholeWord, ydoc]);

  const handleReplaceAll = useCallback(() => {
    if (!query.trim()) return;

    let regex: RegExp;

    try {
      regex = buildSearchRegex({ query, useRegex, caseSensitive, wholeWord });
    } catch {
      return;
    }

    let updatedAnyFile = false;

    for (const filePath of fs.files) {
      const ytext = fs.getFileText(filePath);
      if (!ytext) continue;

      const nextContent = replaceAllMatchesInText(ytext.toString(), regex, replaceText);
      regex.lastIndex = 0;

      if (!nextContent) continue;

      updatedAnyFile = true;

      ydoc.transact(() => {
        ytext.delete(0, ytext.length);
        ytext.insert(0, nextContent);
      });
    }

    if (updatedAnyFile) {
      runSearch(query);
    }
  }, [caseSensitive, fs, query, replaceText, runSearch, useRegex, wholeWord, ydoc]);

  const toggleCollapsed = useCallback((file: string) => {
    setCollapsed((currentCollapsed) => {
      const nextCollapsed = new Set(currentCollapsed);

      if (nextCollapsed.has(file)) {
        nextCollapsed.delete(file);
      } else {
        nextCollapsed.add(file);
      }

      return nextCollapsed;
    });
  }, []);

  const clearQuery = useCallback(() => {
    setQuery('');
    setResults([]);
    setSearched(false);
    setRegexError(null);
    setSearching(false);
  }, []);

  const groupedResults = useMemo(() => groupSearchResults(results), [results]);

  return {
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
    fileCount: groupedResults.size,
    matchCount: results.length,
    runSearch: () => runSearch(query),
    clearQuery,
    handleReplace,
    handleReplaceAll,
    toggleCollapsed,
  };
}

