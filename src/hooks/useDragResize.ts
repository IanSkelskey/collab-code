import { useCallback, useRef } from 'react';

type Axis = 'horizontal' | 'vertical';

interface UseDragResizeOptions {
  axis: Axis;
  /** Current size value (width or height) */
  value: number;
  /** State setter for the size */
  setValue: (v: number) => void;
  min: number;
  max: number | (() => number);
}

/**
 * Generic drag-to-resize hook for panels.
 * Returns an `onDragStart` handler to attach to the resize handle.
 */
export function useDragResize({ axis, value, setValue, min, max }: UseDragResizeOptions) {
  const isDragging = useRef(false);

  const onDragStart = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    isDragging.current = true;

    const isHorizontal = axis === 'horizontal';
    const startPos = 'touches' in e
      ? (isHorizontal ? e.touches[0].clientX : e.touches[0].clientY)
      : (isHorizontal ? e.clientX : e.clientY);
    const startSize = value;

    const onMove = (ev: MouseEvent | TouchEvent) => {
      if (!isDragging.current) return;
      const currentPos = 'touches' in ev
        ? (isHorizontal ? ev.touches[0].clientX : ev.touches[0].clientY)
        : (isHorizontal ? ev.clientX : ev.clientY);

      // For vertical (terminal), dragging up increases height (delta is inverted)
      const delta = isHorizontal
        ? currentPos - startPos
        : startPos - currentPos;

      const maxVal = typeof max === 'function' ? max() : max;
      setValue(Math.max(min, Math.min(maxVal, startSize + delta)));
    };

    const onEnd = () => {
      isDragging.current = false;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onEnd);
      document.removeEventListener('touchmove', onMove);
      document.removeEventListener('touchend', onEnd);
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onEnd);
    document.addEventListener('touchmove', onMove);
    document.addEventListener('touchend', onEnd);
  }, [axis, value, setValue, min, max]);

  return { onDragStart };
}
