import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type MouseEvent as ReactMouseEvent,
} from 'react';
import type { FSNode, VirtualFS } from './useVirtualFS';
import { getTopLevelPaths } from '../services/fileOps';

function flattenVisiblePaths(nodes: FSNode[], expandedDirs: Set<string>): string[] {
  const visiblePaths: string[] = [];

  const visit = (node: FSNode) => {
    visiblePaths.push(node.path);

    if (node.type === 'directory' && expandedDirs.has(node.path)) {
      node.children?.forEach(visit);
    }
  };

  nodes.forEach(visit);
  return visiblePaths;
}

function areSetsEqual(left: Set<string>, right: Set<string>): boolean {
  if (left.size !== right.size) {
    return false;
  }

  for (const value of left) {
    if (!right.has(value)) {
      return false;
    }
  }

  return true;
}

interface UseExplorerSelectionOptions {
  fs: VirtualFS;
  expandedDirs: Set<string>;
  toggleDir: (path: string) => void;
}

export function useExplorerSelection({ fs, expandedDirs, toggleDir }: UseExplorerSelectionOptions) {
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set());
  const [lastSelectedPath, setLastSelectedPath] = useState<string | null>(null);

  const visibleNodePaths = useMemo(
    () => flattenVisiblePaths(fs.tree.children ?? [], expandedDirs),
    [expandedDirs, fs.tree],
  );

  const selectedTopLevelPaths = useMemo(
    () => getTopLevelPaths(selectedPaths).filter((path) => fs.exists(path)),
    [fs, selectedPaths],
  );

  const clearSelection = useCallback(() => {
    setSelectedPaths(new Set());
    setLastSelectedPath(null);
  }, []);

  const replaceSelection = useCallback((paths: Iterable<string>, anchorPath?: string | null) => {
    const nextPaths = Array.from(paths);
    setSelectedPaths(new Set(nextPaths));
    setLastSelectedPath(anchorPath ?? nextPaths[nextPaths.length - 1] ?? null);
  }, []);

  const selectOnlyPath = useCallback(
    (path: string) => {
      replaceSelection([path], path);
    },
    [replaceSelection],
  );

  const ensurePathSelected = useCallback((path: string) => {
    setSelectedPaths((currentSelection) => {
      if (currentSelection.has(path)) {
        return currentSelection;
      }

      return new Set([path]);
    });
    setLastSelectedPath(path);
  }, []);

  useEffect(() => {
    setSelectedPaths((currentSelection) => {
      const nextSelection = new Set([...currentSelection].filter((path) => fs.exists(path)));

      return areSetsEqual(currentSelection, nextSelection) ? currentSelection : nextSelection;
    });

    setLastSelectedPath((currentPath) =>
      currentPath && fs.exists(currentPath) ? currentPath : null,
    );
  }, [fs, fs.tree]);

  const handleNodeClick = useCallback(
    (event: ReactMouseEvent, node: FSNode) => {
      const path = node.path;
      const allowMultiToggle = event.metaKey || event.ctrlKey;

      if (event.shiftKey && lastSelectedPath) {
        const anchorIndex = visibleNodePaths.indexOf(lastSelectedPath);
        const targetIndex = visibleNodePaths.indexOf(path);

        if (anchorIndex >= 0 && targetIndex >= 0) {
          const [startIndex, endIndex] =
            anchorIndex < targetIndex ? [anchorIndex, targetIndex] : [targetIndex, anchorIndex];
          const rangePaths = visibleNodePaths.slice(startIndex, endIndex + 1);

          setSelectedPaths((currentSelection) => {
            const nextSelection = allowMultiToggle ? new Set(currentSelection) : new Set<string>();
            rangePaths.forEach((rangePath) => nextSelection.add(rangePath));
            return nextSelection;
          });
          setLastSelectedPath(path);
          return;
        }
      }

      if (allowMultiToggle) {
        setSelectedPaths((currentSelection) => {
          const nextSelection = new Set(currentSelection);
          if (nextSelection.has(path)) {
            nextSelection.delete(path);
          } else {
            nextSelection.add(path);
          }
          return nextSelection;
        });
        setLastSelectedPath(path);
        return;
      }

      selectOnlyPath(path);

      if (node.type === 'directory') {
        toggleDir(path);
      } else {
        fs.openFile(path);
      }
    },
    [fs, lastSelectedPath, selectOnlyPath, toggleDir, visibleNodePaths],
  );

  return {
    selectedPaths,
    selectedTopLevelPaths,
    clearSelection,
    replaceSelection,
    selectOnlyPath,
    ensurePathSelected,
    handleNodeClick,
  };
}
