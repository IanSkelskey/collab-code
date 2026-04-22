/**
 * Shown by <Suspense> while the workspace chunk (Monaco, Yjs, xterm) is
 * loading. Styled to match the workspace shell so the transition from
 * Landing → Workspace feels intentional instead of janky.
 */
export default function WorkspaceFallback() {
  return (
    <div
      className="cc-app-shell flex h-[100dvh] w-screen flex-col items-center justify-center gap-4"
      role="status"
      aria-live="polite"
    >
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--cc-border-strong)] border-t-[var(--cc-accent)]" />
      <p className="cc-text-muted text-xs">Loading workspace…</p>
    </div>
  );
}
