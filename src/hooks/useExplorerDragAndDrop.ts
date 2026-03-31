import { useCallback, useRef, useState, type DragEvent as ReactDragEvent } from 'react';
import type { FSNode, VirtualFS } from './useVirtualFS';
import { ROOT_PATH, getParentPath } from '../lib/vfsPaths';
import { getTopLevelPaths, movePaths, planMovePaths } from '../services/fileOps';

interface UseExplorerDragAndDropOptions {
  fs: VirtualFS;
  selectedPaths: Set<string>;
  selectOnlyPath: (path: string) => void;
  replaceSelection: (paths: Iterable<string>, anchorPath?: string | null) => void;
  expandDir: (path: string) => void;
}

function getDropTargetDir(node: FSNode): string {
  return node.type === 'directory' ? node.path : getParentPath(node.path);
}

export function useExplorerDragAndDrop({
  fs,
  selectedPaths,
  selectOnlyPath,
  replaceSelection,
  expandDir,
}: UseExplorerDragAndDropOptions) {
  const draggedPathsRef = useRef<string[]>([]);
  const [dragTarget, setDragTarget] = useState<string | null>(null);

  const applyMoveResult = useCallback((targetDir: string) => {
    const result = movePaths(fs, draggedPathsRef.current, targetDir);
    draggedPathsRef.current = [];

    if (result.error || result.moves.length === 0) {
      return;
    }

    const nextSelectedPaths = [
      ...result.moves.map((move) => move.to),
      ...result.skipped,
    ];
    const latestMovedPath = result.moves[result.moves.length - 1]?.to
      ?? result.skipped[result.skipped.length - 1]
      ?? null;

    replaceSelection(nextSelectedPaths, latestMovedPath);
    expandDir(targetDir);
  }, [expandDir, fs, replaceSelection]);

  const onDragStartNode = useCallback((event: ReactDragEvent, node: FSNode) => {
    if (node.path === ROOT_PATH) {
      event.preventDefault();
      return;
    }

    const activeDragPaths = selectedPaths.has(node.path)
      ? getTopLevelPaths(selectedPaths)
      : [node.path];

    if (!selectedPaths.has(node.path)) {
      selectOnlyPath(node.path);
    }

    draggedPathsRef.current = activeDragPaths;
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData(
      'text/plain',
      activeDragPaths.length > 1 ? `${activeDragPaths.length} items` : node.name,
    );
  }, [selectOnlyPath, selectedPaths]);

  const onDragOverNode = useCallback((event: ReactDragEvent, node: FSNode) => {
    if (draggedPathsRef.current.length === 0) {
      return;
    }

    const targetDir = getDropTargetDir(node);
    const plan = planMovePaths(fs, draggedPathsRef.current, targetDir);
    if (plan.error || plan.moves.length === 0) {
      return;
    }

    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    setDragTarget(targetDir);
  }, [fs]);

  const onDragLeaveNode = useCallback(() => {
    setDragTarget(null);
  }, []);

  const onDropNode = useCallback((event: ReactDragEvent, node: FSNode) => {
    event.preventDefault();
    setDragTarget(null);

    if (draggedPathsRef.current.length === 0) {
      return;
    }

    applyMoveResult(getDropTargetDir(node));
  }, [applyMoveResult]);

  const onDragEnd = useCallback(() => {
    draggedPathsRef.current = [];
    setDragTarget(null);
  }, []);

  const onRootDragOver = useCallback((event: ReactDragEvent<HTMLDivElement>) => {
    if (draggedPathsRef.current.length === 0) {
      return;
    }

    const plan = planMovePaths(fs, draggedPathsRef.current, ROOT_PATH);
    if (plan.error || plan.moves.length === 0) {
      return;
    }

    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    setDragTarget(ROOT_PATH);
  }, [fs]);

  const onRootDragLeave = useCallback((event: ReactDragEvent<HTMLDivElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget as Node)) {
      setDragTarget(null);
    }
  }, []);

  const onRootDrop = useCallback((event: ReactDragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragTarget(null);

    if (draggedPathsRef.current.length === 0) {
      return;
    }

    applyMoveResult(ROOT_PATH);
  }, [applyMoveResult]);

  return {
    dragTarget,
    onDragStartNode,
    onDragOverNode,
    onDragLeaveNode,
    onDropNode,
    onDragEnd,
    onRootDragOver,
    onRootDragLeave,
    onRootDrop,
  };
}
