import { getRoomStarterWorkspace, type RoomTemplateId } from '../config/roomTemplates';
import type { VirtualFS } from '../types/virtualFs';
import { ROOT_PATH, joinVfsPath } from './vfsPaths';

function getNextStarterPath(exists: (path: string) => boolean, fileName: string): string {
  const lastDotIndex = fileName.lastIndexOf('.');
  const stem = lastDotIndex > 0 ? fileName.slice(0, lastDotIndex) : fileName;
  const extension = lastDotIndex > 0 ? fileName.slice(lastDotIndex) : '';

  let candidateName = fileName;
  let candidatePath = joinVfsPath(ROOT_PATH, candidateName);
  let copyIndex = 2;

  while (exists(candidatePath)) {
    candidateName = `${stem} ${copyIndex}${extension}`;
    candidatePath = joinVfsPath(ROOT_PATH, candidateName);
    copyIndex += 1;
  }

  return candidatePath;
}

export function createStarterWorkspaceFiles(
  fs: Pick<VirtualFS, 'exists' | 'openFile' | 'writeFile'>,
  templateId: Exclude<RoomTemplateId, 'blank'>,
): { createdNames: string; openedPath: string | null } | null {
  const starterWorkspace = getRoomStarterWorkspace(templateId);
  if (!starterWorkspace) {
    return null;
  }

  const createdPaths = new Map<string, string>();

  for (const file of starterWorkspace.files) {
    const nextPath = getNextStarterPath(fs.exists, file.name);
    fs.writeFile(nextPath, file.content);
    createdPaths.set(file.name, nextPath);
  }

  const initialPath = starterWorkspace.initialOpenFileName
    ? createdPaths.get(starterWorkspace.initialOpenFileName)
    : undefined;
  const openedPath = initialPath ?? createdPaths.values().next().value ?? null;

  if (openedPath) {
    fs.openFile(openedPath);
  }

  return {
    createdNames: starterWorkspace.files.map((file) => file.name).join(' and '),
    openedPath,
  };
}
