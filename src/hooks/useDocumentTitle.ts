import { useEffect } from 'react';

const BASE_TITLE = 'Collab Code';

/**
 * Sets `document.title` to `"${title} | Collab Code"` while the calling
 * component is mounted, and restores it to the base title on unmount. Pass
 * no argument to just set the base title.
 */
export function useDocumentTitle(title?: string): void {
  useEffect(() => {
    document.title = title ? `${title} | ${BASE_TITLE}` : BASE_TITLE;
    return () => {
      document.title = BASE_TITLE;
    };
  }, [title]);
}
