/**
 * WebSocket client for interactive Java execution.
 *
 * Connects to the server's /exec WebSocket endpoint and manages
 * the lifecycle of a single Java execution session with streaming
 * stdin/stdout/stderr.
 */

export interface ExecCallbacks {
  onCompileStart: () => void;
  onCompileError: (data: string) => void;
  onCompileOk: () => void;
  onStdout: (data: string) => void;
  onStderr: (data: string) => void;
  onExit: (code: number) => void;
  onError: (error: string) => void;
}

export class InteractiveExecutor {
  private ws: WebSocket | null = null;

  /**
   * Open a WebSocket to /exec and start compiling + running the given source.
   * All lifecycle events are delivered through the callbacks object.
   */
  execute(sourceCode: string, callbacks: ExecCallbacks): void {
    // Derive WebSocket URL — reuse the same env var used for Yjs sync
    const wsUrl = import.meta.env.VITE_WS_URL ?? 'ws://localhost:4444';
    const execUrl = `${wsUrl}/exec`;

    this.ws = new WebSocket(execUrl);

    this.ws.onopen = () => {
      this.ws!.send(JSON.stringify({ type: 'exec', source_code: sourceCode }));
    };

    this.ws.onmessage = (event) => {
      let msg: { type: string; data?: string; code?: number };
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

  /** Send a string of stdin data to the running Java process. */
  sendStdin(data: string): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'stdin', data }));
    }
  }

  /** Kill the running Java process. */
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
