export type SyncConnectionStatus = 'connected' | 'connecting' | 'disconnected';

export type ServerFetchState = 'idle' | 'loading' | 'ready' | 'error';

export type ServerStatusTone = 'success' | 'warning' | 'danger' | 'neutral';

export interface ServerStatusInfo {
  status: string | null;
  service: string | null;
  serverVersion: string | null;
  protocolVersion: number | null;
  capabilities: string[];
  javaAvailable: boolean | null;
  javaVersion: string | null;
  pythonAvailable: boolean | null;
  pythonVersion: string | null;
  executionAllowed: boolean | null;
  executionSandboxed: boolean | null;
  executionSandboxStatus: string | null;
}

export interface ServerCompatibilityState {
  status: 'compatible' | 'version-mismatch' | 'legacy-server' | 'protocol-mismatch' | 'unknown';
  title: string;
  detail: string;
}

export interface ServerSummaryState {
  label: string;
  detail: string;
  tone: ServerStatusTone;
}

export interface ServerBannerState {
  key: string;
  tone: Extract<ServerStatusTone, 'warning' | 'danger'>;
  title: string;
  message: string;
}

export interface ServerStatusSnapshot {
  clientVersion: string;
  clientProtocolVersion: number;
  syncStatus: SyncConnectionStatus;
  fetchState: ServerFetchState;
  checkedAt: number | null;
  info: ServerStatusInfo;
  compatibility: ServerCompatibilityState;
  summary: ServerSummaryState;
  banner: ServerBannerState | null;
  refresh: () => void;
}
