import type { ExecutionResult } from '../types';

const PISTON_API_URL = 'https://emkc.org/api/v2/piston/execute';

export async function executeJava(sourceCode: string): Promise<ExecutionResult> {
  const response = await fetch(PISTON_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      language: 'java',
      version: '15.0.2',
      files: [{ content: sourceCode }],
    }),
  });

  if (!response.ok) {
    throw new Error(`Piston API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}
