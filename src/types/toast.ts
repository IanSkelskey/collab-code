export interface AppToastAction {
  label: string;
  onAction: () => void;
}

export interface AppToast {
  id: number;
  label: string;
  action?: AppToastAction;
}

export interface ToastActionOptions {
  label?: string;
  onAction: () => void;
}

export type ToastActionInput = (() => void) | ToastActionOptions;

export type PushToast = (label: string, action?: ToastActionInput) => void;
