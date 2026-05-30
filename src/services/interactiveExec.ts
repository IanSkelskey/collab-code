/**
 * WebSocket client for interactive code execution.
 *
 * Connects to the server's /exec WebSocket endpoint and manages
 * the lifecycle of a single run session with streaming stdin/stdout/stderr.
 */

export type SupportedExecutionLanguage = 'java' | 'python';

export interface ExecuteOptions {
  language: SupportedExecutionLanguage;
  entryPoint: string;
}

export interface ExecCallbacks {
  onCompileStart: () => void;
  onCompileError: (data: string) => void;
  onCompileOk: () => void;
  onStdout: (data: string) => void;
  onStderr: (data: string) => void;
  onExit: (code: number) => void;
  onError: (error: string) => void;
  /** Called with files created/modified by the executed program, to sync back to VFS */
  onFilesSync?: (files: Record<string, string>) => void;
}

export class InteractiveExecutor {
  private ws: WebSocket | null = null;

  execute(files: Record<string, string>, callbacks: ExecCallbacks, options: ExecuteOptions): void {
    const wsUrl = import.meta.env.VITE_WS_URL ?? 'ws://localhost:4444';
    const execUrl = `${wsUrl}/exec`;

    this.ws = new WebSocket(execUrl);

    this.ws.onopen = () => {
      this.ws!.send(
        JSON.stringify({
          type: 'exec',
          files,
          language: options.language,
          entryPoint: options.entryPoint,
        }),
      );
    };

    this.ws.onmessage = (event) => {
      let msg: { type: string; data?: string; code?: number; files?: Record<string, string> };
      try {
        msg = JSON.parse(event.data as string);
      } catch {
        return;
      }

      switch (msg.type) {
        case 'compile-start':
          callbacks.onCompileStart();
          break;
        case 'compile-error':
          callbacks.onCompileError(msg.data ?? '');
          break;
        case 'compile-ok':
          callbacks.onCompileOk();
          break;
        case 'stdout':
          callbacks.onStdout(msg.data ?? '');
          break;
        case 'stderr':
          callbacks.onStderr(msg.data ?? '');
          break;
        case 'exit':
          callbacks.onExit(msg.code ?? 1);
          this.close();
          break;
        case 'files-sync':
          if (msg.files) callbacks.onFilesSync?.(msg.files);
          break;
        case 'error':
          callbacks.onError(msg.data ?? 'Unknown execution error');
          break;
      }
    };

    this.ws.onerror = () => {
      callbacks.onError('Failed to connect to execution server');
    };

    this.ws.onclose = () => {
      this.ws = null;
    };
  }

  /** Send a string of stdin data to the running process. */
  sendStdin(data: string): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'stdin', data }));
    }
  }

  /** Kill the running process. */
  kill(): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'kill' }));
    }
  }

  /** Close the WebSocket connection and clean up. */
  close(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}

export interface CheckResult {
  language: string;
  output: string;
}

/**
 * One-shot request to the server's compile-only check path. Opens a WebSocket,
 * sends a single `check` message, awaits one `check-result`, and closes. Used
 * by the live "as you type" diagnostics flow.
 */
export function requestCheck(
  files: Record<string, string>,
  language: SupportedExecutionLanguage,
  signal?: AbortSignal,
): Promise<CheckResult> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('aborted', 'AbortError'));
      return;
    }

    const wsUrl = import.meta.env.VITE_WS_URL ?? 'ws://localhost:4444';
    const ws = new WebSocket(`${wsUrl}/exec`);

    let settled = false;
    const closeSocket = () => {
      try {
        ws.close();
      } catch {
        // closing is best-effort; the connection may already be torn down
      }
    };

    const onAbort = () => {
      if (settled) return;
      settled = true;
      closeSocket();
      reject(new DOMException('aborted', 'AbortError'));
    };
    signal?.addEventListener('abort', onAbort);

    const timer = window.setTimeout(() => {
      if (settled) return;
      settled = true;
      signal?.removeEventListener('abort', onAbort);
      closeSocket();
      reject(new Error('check timed out'));
    }, 15000);

    ws.onopen = () => {
      if (settled) return;
      ws.send(JSON.stringify({ type: 'check', files, language }));
    };

    ws.onmessage = (event) => {
      let msg: { type?: string; language?: string; output?: string };
      try {
        msg = JSON.parse(event.data as string);
      } catch {
        return;
      }
      if (msg.type !== 'check-result' || settled) return;
      settled = true;
      window.clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
      closeSocket();
      resolve({ language: msg.language ?? language, output: msg.output ?? '' });
    };

    ws.onerror = () => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
      closeSocket();
      reject(new Error('check failed: connection error'));
    };

    ws.onclose = () => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
      reject(new Error('check connection closed unexpectedly'));
    };
  });
}
