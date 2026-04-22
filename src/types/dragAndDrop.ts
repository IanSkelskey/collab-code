export interface WebkitFileSystemEntry {
  readonly isDirectory: boolean;
  readonly isFile: boolean;
  readonly name: string;
  readonly fullPath: string;
}

export interface WebkitFileSystemFileEntry extends WebkitFileSystemEntry {
  readonly isDirectory: false;
  readonly isFile: true;
  file(successCallback: (file: File) => void, errorCallback?: (error: DOMException) => void): void;
}

export interface WebkitFileSystemDirectoryReader {
  readEntries(
    successCallback: (entries: WebkitFileSystemEntry[]) => void,
    errorCallback?: (error: DOMException) => void,
  ): void;
}

export interface WebkitFileSystemDirectoryEntry extends WebkitFileSystemEntry {
  readonly isDirectory: true;
  readonly isFile: false;
  createReader(): WebkitFileSystemDirectoryReader;
}

export type WebkitEntry = WebkitFileSystemFileEntry | WebkitFileSystemDirectoryEntry;

export type WebkitDataTransferItem = DataTransferItem & {
  webkitGetAsEntry?: () => WebkitEntry | null;
};

export function hasWebkitEntry(item: DataTransferItem): item is WebkitDataTransferItem {
  return typeof (item as WebkitDataTransferItem).webkitGetAsEntry === 'function';
}

export function isWebkitDirectoryEntry(
  entry: WebkitEntry,
): entry is WebkitFileSystemDirectoryEntry {
  return entry.isDirectory;
}

export function isWebkitFileEntry(entry: WebkitEntry): entry is WebkitFileSystemFileEntry {
  return entry.isFile;
}
