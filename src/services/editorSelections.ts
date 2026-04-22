import type { ISelection, editor } from 'monaco-editor';
import * as Y from 'yjs';

export const REMOTE_SELECTIONS_FIELD = 'selections';
export const LEGACY_SELECTION_FIELD = 'selection';
export const REMOTE_SELECTION_ACTIVITY_FIELD = 'selectionActivityAt';

const DEFAULT_REMOTE_COLOR = '#61afef';
const DEFAULT_REMOTE_NAME = 'Peer';
const REMOTE_LABEL_ANIMATION_MS = 2600;

export type RelativeCursorSelection = {
  anchor: Y.RelativePosition;
  head: Y.RelativePosition;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isRelativeCursorSelection(value: unknown): value is RelativeCursorSelection {
  if (!isRecord(value)) return false;
  return value.anchor != null && value.head != null;
}

function getPeerMeta(state: unknown): { name: string; color: string } {
  if (!isRecord(state)) {
    return { name: DEFAULT_REMOTE_NAME, color: DEFAULT_REMOTE_COLOR };
  }

  const user = isRecord(state.user) ? state.user : null;
  const name =
    typeof user?.name === 'string' && user.name.trim() ? user.name.trim() : DEFAULT_REMOTE_NAME;
  const color =
    typeof user?.color === 'string' && user.color.trim() ? user.color.trim() : DEFAULT_REMOTE_COLOR;

  return { name, color };
}

function getSelectionActivityAt(state: unknown): number | null {
  if (!isRecord(state)) return null;
  const activityAt = state[REMOTE_SELECTION_ACTIVITY_FIELD];
  return typeof activityAt === 'number' && Number.isFinite(activityAt) ? activityAt : null;
}

function selectionKey(selection: ISelection): string {
  return [
    selection.selectionStartLineNumber,
    selection.selectionStartColumn,
    selection.positionLineNumber,
    selection.positionColumn,
  ].join(':');
}

function hexToRgba(hex: string, alpha: number): string {
  const normalized = hex.trim().replace(/^#/, '');
  const expanded =
    normalized.length === 3
      ? normalized
          .split('')
          .map((char) => char + char)
          .join('')
      : normalized;

  if (!/^[\da-fA-F]{6}$/.test(expanded)) {
    return `rgba(97, 175, 239, ${alpha})`;
  }

  const parsedHex = Number.parseInt(expanded, 16);
  const r = (parsedHex >> 16) & 255;
  const g = (parsedHex >> 8) & 255;
  const b = parsedHex & 255;

  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function escapeCssContent(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\r/g, ' ').replace(/\n/g, ' ');
}

export function getRemoteSelections(state: unknown): RelativeCursorSelection[] {
  if (!isRecord(state)) return [];

  const multiSelections = state[REMOTE_SELECTIONS_FIELD];
  if (Array.isArray(multiSelections)) {
    return multiSelections.filter(isRelativeCursorSelection);
  }

  const singleSelection = state[LEGACY_SELECTION_FIELD];
  return isRelativeCursorSelection(singleSelection) ? [singleSelection] : [];
}

export function getOrderedSelections(editorInstance: editor.IStandaloneCodeEditor): ISelection[] {
  const selections = editorInstance.getSelections() ?? [];
  const primarySelection = editorInstance.getSelection();

  if (!primarySelection || selections.length <= 1) {
    return selections;
  }

  const primaryKey = selectionKey(primarySelection);
  const primarySelections = selections.filter(
    (selection) => selectionKey(selection) === primaryKey,
  );
  const secondarySelections = selections.filter(
    (selection) => selectionKey(selection) !== primaryKey,
  );

  return [...primarySelections, ...secondarySelections];
}

export function createRelativeSelection(
  selection: ISelection,
  model: editor.ITextModel,
  ytext: Y.Text,
): RelativeCursorSelection {
  const anchorOffset = model.getOffsetAt({
    lineNumber: selection.selectionStartLineNumber,
    column: selection.selectionStartColumn,
  });
  const headOffset = model.getOffsetAt({
    lineNumber: selection.positionLineNumber,
    column: selection.positionColumn,
  });
  const isCollapsed = anchorOffset === headOffset;
  const assoc = isCollapsed ? -1 : 0;

  return {
    anchor: Y.createRelativePositionFromTypeIndex(ytext, anchorOffset, assoc),
    head: Y.createRelativePositionFromTypeIndex(ytext, headOffset, assoc),
  };
}

export function buildRemotePeerStyles(
  states: Map<number, unknown>,
  localClientId: number,
  currentTime: number,
): string {
  const rules: string[] = [];

  states.forEach((state, clientId) => {
    if (clientId === localClientId) return;

    const { name, color } = getPeerMeta(state);
    const activityAt = getSelectionActivityAt(state);
    const elapsed =
      activityAt == null ? REMOTE_LABEL_ANIMATION_MS : Math.max(0, currentTime - activityAt);
    const animationDelay = -Math.min(elapsed, REMOTE_LABEL_ANIMATION_MS);
    const selectionFill = hexToRgba(color, 0.18);
    const selectionOutline = hexToRgba(color, 0.45);

    rules.push(`
.ccRemoteSelection-${clientId} {
  background-color: ${selectionFill};
  box-shadow: inset 0 0 0 1px ${selectionOutline};
}

.ccRemoteCursorHead-${clientId} {
  border-color: ${color};
}

.ccRemoteCursorHead-${clientId}::after {
  content: "${escapeCssContent(name)}";
  background-color: ${color};
  animation-delay: ${animationDelay}ms;
}
`);
  });

  return rules.join('\n');
}
