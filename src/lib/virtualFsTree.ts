import type { FSNode } from '../types/virtualFs';
import { ROOT_PATH, getBaseName, getParentPath } from './vfsPaths';

export function buildVirtualFsTree(filePaths: string[], dirPaths: string[]): FSNode {
  const root: FSNode = { name: ROOT_PATH, path: ROOT_PATH, type: 'directory', children: [] };
  const allDirs = new Set<string>([ROOT_PATH]);

  for (const directoryPath of dirPaths) {
    const parts = directoryPath.split('/');
    for (let index = 1; index <= parts.length; index += 1) {
      allDirs.add(parts.slice(0, index).join('/'));
    }
  }

  for (const filePath of filePaths) {
    const parts = filePath.split('/');
    for (let index = 1; index < parts.length; index += 1) {
      allDirs.add(parts.slice(0, index).join('/'));
    }
  }

  const nodeMap = new Map<string, FSNode>([[ROOT_PATH, root]]);

  for (const directoryPath of [...allDirs].sort()) {
    if (directoryPath === ROOT_PATH) {
      continue;
    }

    const directoryNode: FSNode = {
      name: getBaseName(directoryPath),
      path: directoryPath,
      type: 'directory',
      children: [],
    };

    nodeMap.set(directoryPath, directoryNode);
    nodeMap.get(getParentPath(directoryPath))?.children?.push(directoryNode);
  }

  for (const filePath of filePaths) {
    const fileNode: FSNode = {
      name: getBaseName(filePath),
      path: filePath,
      type: 'file',
    };

    nodeMap.get(getParentPath(filePath))?.children?.push(fileNode);
  }

  const sortChildren = (node: FSNode) => {
    if (!node.children) {
      return;
    }

    node.children.sort((left, right) => {
      if (left.type !== right.type) {
        return left.type === 'directory' ? -1 : 1;
      }

      return left.name.localeCompare(right.name);
    });

    node.children.forEach(sortChildren);
  };

  sortChildren(root);

  return root;
}
