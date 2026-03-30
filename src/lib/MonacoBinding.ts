import { createMutex } from 'lib0/mutex';
import * as monaco from 'monaco-editor/esm/vs/editor/editor.api.js';
import type { IDisposable, SelectionDirection, editor } from 'monaco-editor';
import * as Y from 'yjs';

type RelativeSelection = {
  start: Y.RelativePosition;
  end: Y.RelativePosition;
  direction: SelectionDirection;
};

function createRelativeSelection(
  selection: monaco.Selection,
  model: editor.ITextModel,
  ytext: Y.Text,
): RelativeSelection {
  const start = selection.getStartPosition();
  const end = selection.getEndPosition();
  const assoc = selection.isEmpty() ? -1 : 0;

  return {
    // Empty carets are left-associated so remote inserts at the same index do
    // not make an idle cursor appear to type along.
    start: Y.createRelativePositionFromTypeIndex(ytext, model.getOffsetAt(start), assoc),
    end: Y.createRelativePositionFromTypeIndex(ytext, model.getOffsetAt(end), assoc),
    direction: selection.getDirection(),
  };
}

function createRelativeSelections(
  editorInstance: editor.IStandaloneCodeEditor,
  model: editor.ITextModel,
  ytext: Y.Text,
): RelativeSelection[] {
  const selections = editorInstance.getSelections() ?? [];
  return selections.map(selection => createRelativeSelection(selection, model, ytext));
}

function restoreMonacoSelection(
  model: editor.ITextModel,
  ytext: Y.Text,
  relSelection: RelativeSelection,
  doc: Y.Doc,
): monaco.Selection | null {
  const start = Y.createAbsolutePositionFromRelativePosition(relSelection.start, doc);
  const end = Y.createAbsolutePositionFromRelativePosition(relSelection.end, doc);

  if (!start || !end || start.type !== ytext || end.type !== ytext) {
    return null;
  }

  const startPos = model.getPositionAt(start.index);
  const endPos = model.getPositionAt(end.index);
  return monaco.Selection.createWithDirection(
    startPos.lineNumber,
    startPos.column,
    endPos.lineNumber,
    endPos.column,
    relSelection.direction,
  );
}

export class MonacoBinding {
  private readonly doc: Y.Doc;
  private readonly ytext: Y.Text;
  private readonly monacoModel: editor.ITextModel;
  private readonly editors: Set<editor.IStandaloneCodeEditor>;
  private readonly mux = createMutex();
  private savedSelections = new Map<editor.IStandaloneCodeEditor, RelativeSelection[]>();
  private destroyed = false;

  private readonly beforeTransaction = () => {
    this.mux(() => {
      this.savedSelections = new Map();
      this.editors.forEach(editorInstance => {
        if (editorInstance.getModel() !== this.monacoModel) return;
        const selections = createRelativeSelections(editorInstance, this.monacoModel, this.ytext);
        if (selections.length > 0) {
          this.savedSelections.set(editorInstance, selections);
        }
      });
    });
  };

  private readonly ytextObserver = (event: Y.YTextEvent) => {
    this.mux(() => {
      let index = 0;
      event.delta.forEach((op) => {
        if (op.retain !== undefined) {
          index += op.retain;
          return;
        }

        if (op.insert !== undefined) {
          const pos = this.monacoModel.getPositionAt(index);
          const range = new monaco.Selection(pos.lineNumber, pos.column, pos.lineNumber, pos.column);
          this.monacoModel.applyEdits([{ range, text: String(op.insert) }]);
          index += String(op.insert).length;
          return;
        }

        if (op.delete !== undefined) {
          const pos = this.monacoModel.getPositionAt(index);
          const endPos = this.monacoModel.getPositionAt(index + op.delete);
          const range = new monaco.Selection(pos.lineNumber, pos.column, endPos.lineNumber, endPos.column);
          this.monacoModel.applyEdits([{ range, text: '' }]);
        }
      });

      this.savedSelections.forEach((selections, editorInstance) => {
        const restoredSelections = selections
          .map(selection => restoreMonacoSelection(this.monacoModel, this.ytext, selection, this.doc))
          .filter((selection): selection is monaco.Selection => selection !== null);

        if (restoredSelections.length > 0) {
          editorInstance.setSelections(restoredSelections);
        }
      });
    });
  };

  private readonly monacoChangeHandler: IDisposable;
  private readonly monacoDisposeHandler: IDisposable;

  constructor(
    ytext: Y.Text,
    monacoModel: editor.ITextModel,
    editors: Set<editor.IStandaloneCodeEditor> = new Set(),
  ) {
    const doc = ytext.doc;
    if (!doc) {
      throw new Error('MonacoBinding requires the provided Y.Text to belong to a Y.Doc');
    }

    this.doc = doc;
    this.ytext = ytext;
    this.monacoModel = monacoModel;
    this.editors = editors;

    this.doc.on('beforeAllTransactions', this.beforeTransaction);
    this.ytext.observe(this.ytextObserver);

    const initialValue = this.ytext.toString();
    if (this.monacoModel.getValue() !== initialValue) {
      this.monacoModel.setValue(initialValue);
    }

    this.monacoChangeHandler = this.monacoModel.onDidChangeContent((event) => {
      this.mux(() => {
        this.doc.transact(() => {
          const changes = [...event.changes].sort((a, b) => b.rangeOffset - a.rangeOffset);
          changes.forEach((change) => {
            this.ytext.delete(change.rangeOffset, change.rangeLength);
            this.ytext.insert(change.rangeOffset, change.text);
          });
        }, this);
      });
    });

    this.monacoDisposeHandler = this.monacoModel.onWillDispose(() => {
      this.destroy();
    });
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;

    this.monacoChangeHandler.dispose();
    this.monacoDisposeHandler.dispose();
    this.ytext.unobserve(this.ytextObserver);
    this.doc.off('beforeAllTransactions', this.beforeTransaction);
    this.savedSelections.clear();
  }
}
