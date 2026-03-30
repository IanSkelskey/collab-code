export interface WorkspaceSearchOptions {
  query: string;
  useRegex: boolean;
  caseSensitive: boolean;
  wholeWord: boolean;
  maxResults?: number;
}

export interface SearchResult {
  file: string;
  line: number;
  col: number;
  matchLength: number;
  text: string;
}

export interface HighlightedSegment {
  text: string;
  isMatch: boolean;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function buildSearchRegex(
  options: Pick<WorkspaceSearchOptions, 'query' | 'useRegex' | 'caseSensitive' | 'wholeWord'>,
  global = true,
): RegExp {
  const trimmedQuery = options.query.trim();

  if (!trimmedQuery) {
    throw new Error('Empty pattern');
  }

  let pattern = options.useRegex ? trimmedQuery : escapeRegex(trimmedQuery);

  if (options.wholeWord) {
    pattern = `\\b${pattern}\\b`;
  }

  const flags = `${global ? 'g' : ''}${options.caseSensitive ? '' : 'i'}`;

  return new RegExp(pattern, flags);
}

export function searchWorkspace(
  files: Record<string, string>,
  options: WorkspaceSearchOptions,
): SearchResult[] {
  const regex = buildSearchRegex(options);
  const results: SearchResult[] = [];
  const maxResults = options.maxResults ?? 1000;
  const sortedEntries = Object.entries(files).sort(([leftPath], [rightPath]) => leftPath.localeCompare(rightPath));

  for (const [relativePath, content] of sortedEntries) {
    const lines = content.split('\n');

    for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
      const lineText = lines[lineIndex];
      regex.lastIndex = 0;

      let match: RegExpExecArray | null;

      while ((match = regex.exec(lineText)) !== null) {
        results.push({
          file: `~/${relativePath}`,
          line: lineIndex + 1,
          col: match.index + 1,
          matchLength: match[0].length,
          text: lineText,
        });

        if (results.length >= maxResults) {
          return results;
        }

        if (match[0].length === 0) {
          break;
        }
      }
    }
  }

  return results;
}

export function replaceFirstMatchInText(
  text: string,
  regex: RegExp,
  replacement: string,
): string | null {
  const nextText = text.replace(regex, replacement);
  return nextText === text ? null : nextText;
}

export function replaceAllMatchesInText(
  text: string,
  regex: RegExp,
  replacement: string,
): string | null {
  const nextText = text.replace(regex, replacement);
  return nextText === text ? null : nextText;
}

export function groupSearchResults(results: SearchResult[]): Map<string, SearchResult[]> {
  const groupedResults = new Map<string, SearchResult[]>();

  for (const result of results) {
    const fileResults = groupedResults.get(result.file) ?? [];
    fileResults.push(result);
    groupedResults.set(result.file, fileResults);
  }

  return groupedResults;
}

export function highlightSearchMatch(
  text: string,
  options: Pick<WorkspaceSearchOptions, 'query' | 'useRegex' | 'caseSensitive' | 'wholeWord'>,
): HighlightedSegment[] {
  if (!options.query.trim()) {
    return [{ text, isMatch: false }];
  }

  const regex = buildSearchRegex(options);
  const segments: HighlightedSegment[] = [];
  let lastIndex = 0;

  for (const match of text.matchAll(regex)) {
    const matchStart = match.index ?? 0;
    const matchText = match[0] ?? '';

    if (matchStart > lastIndex) {
      segments.push({
        text: text.slice(lastIndex, matchStart),
        isMatch: false,
      });
    }

    segments.push({
      text: matchText,
      isMatch: true,
    });

    lastIndex = matchStart + matchText.length;

    if (matchText.length === 0) {
      break;
    }
  }

  if (lastIndex < text.length) {
    segments.push({
      text: text.slice(lastIndex),
      isMatch: false,
    });
  }

  return segments.length > 0 ? segments : [{ text, isMatch: false }];
}

