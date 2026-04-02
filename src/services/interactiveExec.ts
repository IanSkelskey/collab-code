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
      this.ws!.send(JSON.stringify({
        type: 'exec',
        files,
        language: options.language,
        entryPoint: options.entryPoint,
      }));
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
