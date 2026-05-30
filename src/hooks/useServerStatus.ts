import { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  ServerBannerState,
  ServerCompatibilityState,
  ServerFetchState,
  ServerRuntimeInfo,
  ServerStatusInfo,
  ServerStatusSnapshot,
  ServerSummaryState,
  SyncConnectionStatus,
} from '../types/serverStatus';

const STATUS_POLL_INTERVAL_MS = 45_000;

const EMPTY_SERVER_INFO: ServerStatusInfo = {
  status: null,
  service: null,
  serverVersion: null,
  protocolVersion: null,
  capabilities: [],
  runtimes: [],
  executionAllowed: null,
  executionSandboxed: null,
  executionSandboxStatus: null,
};

interface UseServerStatusOptions {
  syncStatus: SyncConnectionStatus;
}

interface ServerStatusState {
  fetchState: ServerFetchState;
  checkedAt: number | null;
  info: ServerStatusInfo;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function parseString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function parseBoolean(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null;
}

function parseNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function parseCapabilities(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    .map((item) => item.trim());
}

function parseRuntimes(value: unknown): ServerRuntimeInfo[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item): ServerRuntimeInfo | null => {
      if (!isRecord(item)) {
        return null;
      }

      const language = parseString(item.language);
      if (!language) {
        return null;
      }

      return {
        language,
        available: parseBoolean(item.available),
        version: parseString(item.version),
        canRun: parseBoolean(item.canRun) ?? false,
        canCheck: parseBoolean(item.canCheck) ?? false,
      };
    })
    .filter((runtime): runtime is ServerRuntimeInfo => runtime !== null);
}

function parseServerStatusInfo(payload: unknown): ServerStatusInfo {
  if (!isRecord(payload)) {
    return EMPTY_SERVER_INFO;
  }

  return {
    status: parseString(payload.status),
    service: parseString(payload.service),
    serverVersion: parseString(payload.serverVersion) ?? parseString(payload.version),
    protocolVersion: parseNumber(payload.protocolVersion),
    capabilities: parseCapabilities(payload.capabilities),
    runtimes: parseRuntimes(payload.runtimes),
    executionAllowed: parseBoolean(payload.executionAllowed),
    executionSandboxed: parseBoolean(payload.executionSandboxed),
    executionSandboxStatus: parseString(payload.executionSandboxStatus),
  };
}

function getServerStatusUrl(): string {
  const wsUrl = import.meta.env.VITE_WS_URL ?? 'ws://localhost:4444';
  const url = new URL(wsUrl, window.location.href);
  url.protocol = url.protocol === 'wss:' ? 'https:' : 'http:';
  url.pathname = url.pathname.replace(/\/$/, '') || '/';
  url.search = '';
  url.hash = '';
  return url.toString();
}

function getServerStatusUrls(): string[] {
  const primary = getServerStatusUrl();
  const urls = new Set<string>([primary]);
  const primaryUrl = new URL(primary);
  const localHostnames = new Set(['localhost', '127.0.0.1', '::1']);
  const shouldTryLocalFallbacks =
    localHostnames.has(primaryUrl.hostname) || localHostnames.has(window.location.hostname);

  if (shouldTryLocalFallbacks) {
    urls.add('http://localhost:4444/');
    urls.add('http://127.0.0.1:4444/');
  }

  return [...urls];
}

async function fetchServerStatus(signal: AbortSignal): Promise<ServerStatusInfo> {
  const candidates = getServerStatusUrls();
  let lastError: unknown = null;

  for (const candidate of candidates) {
    try {
      const response = await fetch(candidate, { signal });
      if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`);
      }

      const payload = (await response.json()) as unknown;
      return parseServerStatusInfo(payload);
    } catch (error) {
      if (signal.aborted) {
        throw error;
      }

      lastError = error;
    }
  }

  throw lastError ?? new Error('Unable to reach status endpoint');
}

function buildCompatibilityState(
  fetchState: ServerFetchState,
  info: ServerStatusInfo,
): ServerCompatibilityState {
  if (fetchState === 'idle' || fetchState === 'loading') {
    return {
      status: 'unknown',
      title: 'Checking server compatibility',
      detail: 'Waiting for the server status check to finish.',
    };
  }

  if (fetchState === 'error') {
    return {
      status: 'unknown',
      title: 'Server compatibility unknown',
      detail:
        'Unable to verify the server version or protocol. The app may still work, but compatibility could not be confirmed.',
    };
  }

  if (info.protocolVersion === null) {
    return {
      status: 'legacy-server',
      title: 'Legacy server status response',
      detail:
        'This server did not report a protocol version. It may be older than this frontend, so newer features may not work as expected.',
    };
  }

  if (info.protocolVersion !== __APP_PROTOCOL_VERSION__) {
    return {
      status: 'protocol-mismatch',
      title: 'Frontend and server are incompatible',
      detail: `Frontend protocol v${__APP_PROTOCOL_VERSION__} does not match server protocol v${info.protocolVersion}. Collaboration or execution features may fail until both are updated together.`,
    };
  }

  if (!info.serverVersion) {
    return {
      status: 'legacy-server',
      title: 'Server version not reported',
      detail:
        'The server status endpoint did not report a backend version. Core features may still work, but this backend may be older than the current frontend.',
    };
  }

  if (info.serverVersion !== __APP_VERSION__) {
    return {
      status: 'version-mismatch',
      title: 'Frontend and server versions differ',
      detail: `Frontend v${__APP_VERSION__} is running against server v${info.serverVersion}. The app may work, but some features may not behave as expected until the server is updated.`,
    };
  }

  return {
    status: 'compatible',
    title: 'Frontend and server are aligned',
    detail: `Frontend v${__APP_VERSION__} matches server v${info.serverVersion}.`,
  };
}

function buildSummaryState(
  syncStatus: SyncConnectionStatus,
  fetchState: ServerFetchState,
  info: ServerStatusInfo,
  compatibility: ServerCompatibilityState,
): ServerSummaryState {
  if (syncStatus === 'disconnected') {
    return {
      label: 'Offline',
      tone: 'danger',
      detail:
        'Disconnected from the sync server. Collaboration and code execution may not work until the connection returns.',
    };
  }

  if (compatibility.status === 'protocol-mismatch') {
    return {
      label: 'Incompatible',
      tone: 'danger',
      detail: compatibility.detail,
    };
  }

  if (compatibility.status === 'version-mismatch') {
    return {
      label: 'Version Mismatch',
      tone: 'warning',
      detail: compatibility.detail,
    };
  }

  if (compatibility.status === 'legacy-server') {
    return {
      label: 'Unverified',
      tone: 'warning',
      detail: compatibility.detail,
    };
  }

  if (fetchState === 'error') {
    return {
      label: 'Status Unknown',
      tone: 'warning',
      detail:
        'Connected to the sync server, but the status endpoint could not be reached to verify backend health.',
    };
  }

  if (syncStatus === 'connecting') {
    return {
      label: 'Connecting',
      tone: 'neutral',
      detail: 'Connecting to the sync server and waiting for initial synchronization.',
    };
  }

  if (info.executionAllowed === false) {
    return {
      label: 'Exec Disabled',
      tone: 'warning',
      detail: 'Connected to the server, but code execution is disabled on this backend.',
    };
  }

  return {
    label: 'Healthy',
    tone: 'success',
    detail:
      'Connected to the sync server. Server version, protocol, and execution status look healthy.',
  };
}

function buildBannerState(
  syncStatus: SyncConnectionStatus,
  fetchState: ServerFetchState,
  info: ServerStatusInfo,
  compatibility: ServerCompatibilityState,
): ServerBannerState | null {
  if (syncStatus === 'disconnected') {
    return null;
  }

  if (compatibility.status === 'protocol-mismatch') {
    return {
      key: `protocol-mismatch:${info.protocolVersion ?? 'unknown'}`,
      tone: 'danger',
      title: compatibility.title,
      message: compatibility.detail,
    };
  }

  if (compatibility.status === 'version-mismatch') {
    return {
      key: `version-mismatch:${info.serverVersion ?? 'unknown'}`,
      tone: 'warning',
      title: compatibility.title,
      message: compatibility.detail,
    };
  }

  if (compatibility.status === 'legacy-server') {
    return {
      key: `legacy-server:${info.serverVersion ?? 'unknown'}:${info.protocolVersion ?? 'unknown'}`,
      tone: 'warning',
      title: compatibility.title,
      message: compatibility.detail,
    };
  }

  if (fetchState === 'error') {
    return {
      key: 'status-check-error',
      tone: 'warning',
      title: 'Unable to verify server status',
      message:
        'The sync connection may still work, but backend health and feature compatibility could not be confirmed.',
    };
  }

  if (info.executionAllowed === false) {
    return {
      key: `execution-disabled:${info.executionSandboxStatus ?? 'unknown'}`,
      tone: 'warning',
      title: 'Code execution is disabled',
      message:
        'Editing and collaboration still work, but running Java or Python from the browser is currently disabled on this server.',
    };
  }

  return null;
}

export function useServerStatus({ syncStatus }: UseServerStatusOptions): ServerStatusSnapshot {
  const [state, setState] = useState<ServerStatusState>({
    fetchState: 'idle',
    checkedAt: null,
    info: EMPTY_SERVER_INFO,
  });
  const [refreshNonce, setRefreshNonce] = useState(0);

  const refresh = useCallback(() => {
    setRefreshNonce((current) => current + 1);
  }, []);

  useEffect(() => {
    let disposed = false;
    let activeController: AbortController | null = null;

    const runCheck = () => {
      activeController?.abort();
      const controller = new AbortController();
      activeController = controller;

      setState((current) =>
        current.checkedAt === null && current.fetchState !== 'loading'
          ? { ...current, fetchState: 'loading' }
          : current,
      );

      void fetchServerStatus(controller.signal)
        .then((info) => {
          if (disposed || controller.signal.aborted) {
            return;
          }

          setState({
            fetchState: 'ready',
            checkedAt: Date.now(),
            info,
          });
        })
        .catch(() => {
          if (disposed || controller.signal.aborted) {
            return;
          }

          setState((current) => ({
            ...current,
            fetchState: 'error',
          }));
        });
    };

    runCheck();

    const intervalId = window.setInterval(() => {
      if (!document.hidden) {
        runCheck();
      }
    }, STATUS_POLL_INTERVAL_MS);

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        runCheck();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      disposed = true;
      activeController?.abort();
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [refreshNonce, syncStatus]);

  return useMemo(() => {
    const compatibility = buildCompatibilityState(state.fetchState, state.info);
    const summary = buildSummaryState(syncStatus, state.fetchState, state.info, compatibility);
    const banner = buildBannerState(syncStatus, state.fetchState, state.info, compatibility);

    return {
      clientVersion: __APP_VERSION__,
      clientProtocolVersion: __APP_PROTOCOL_VERSION__,
      syncStatus,
      fetchState: state.fetchState,
      checkedAt: state.checkedAt,
      info: state.info,
      compatibility,
      summary,
      banner,
      refresh,
    };
  }, [refresh, state, syncStatus]);
}
