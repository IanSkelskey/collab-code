// Remote awareness state (peer name/color) is attacker-controllable: any
// connected client can broadcast arbitrary strings. Peer colors flow into CSS
// — both injected into a generated <style> rule for remote cursors/selections
// and used as inline style values for avatars — so a non-color string could
// break out of a CSS declaration or simply render garbage. Reject anything
// that isn't a strict hex color to a safe default before it reaches the DOM.

const HEX_COLOR_RE = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

export const DEFAULT_PEER_COLOR = '#61afef';

/** True only for strict `#rgb` / `#rrggbb` hex strings. */
export function isValidHexColor(value: unknown): value is string {
  return typeof value === 'string' && HEX_COLOR_RE.test(value.trim());
}

/** Returns a trimmed hex color, or {@link DEFAULT_PEER_COLOR} if invalid. */
export function normalizePeerColor(value: unknown): string {
  return isValidHexColor(value) ? value.trim() : DEFAULT_PEER_COLOR;
}
