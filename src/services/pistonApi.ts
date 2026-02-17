import type { ExecutionResult } from '../types';

/**
 * Derive the HTTP API URL from the WebSocket URL.
 * wss://host -> https://host, ws://host -> http://host
 * Falls back to the current origin in development.
 */
function getApiUrl(): string {
  const wsUrl = import.meta.env.VITE_WS_URL ?? '';
  if (wsUrl) {
    return wsUrl.replace(/^wss:/, 'https:').replace(/^ws:/, 'http:');
  }
  return window.location.origin;
}

export async function executeJava(sourceCode: string): Promise<ExecutionResult> {
  const response = await fetch(`${getApiUrl()}/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      language: 'java',
      source_code: sourceCode,
    }),
  });

  if (!response.ok) {
    throw new Error(`Execution API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}
