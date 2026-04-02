const fs = require('fs');
const path = require('path');

function sanitizeRelativePath(relativePath) {
  return String(relativePath || '')
    .replace(/\\/g, '/')
    .replace(/\.\./g, '')
    .replace(/^[/]+/, '');
}

function normalizeProjectFiles(message) {
  const inputFiles = message.files || { 'Main.java': message.source_code };
  const normalizedFiles = {};

  for (const [relativePath, content] of Object.entries(inputFiles)) {
    const safePath = sanitizeRelativePath(relativePath);
    if (!safePath) {
      continue;
    }

    normalizedFiles[safePath] = typeof content === 'string' ? content : String(content ?? '');
  }

  return normalizedFiles;
}

function writeProjectFiles(rootDir, files) {
  for (const [relativePath, content] of Object.entries(files)) {
    const fullPath = path.join(rootDir, relativePath);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, content);
  }
}

function findFilesByExtension(files, extension) {
  return Object.keys(files)
    .filter((filePath) => filePath.endsWith(extension))
    .sort((left, right) => left.localeCompare(right));
}

function collectSyncedFiles(rootDir, originalFiles, ignoredDirs, ignoredExtensions) {
  const syncedFiles = {};

  const scanDir = (directory, relativePrefix) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const fullPath = path.join(directory, entry.name);
      const relativePath = relativePrefix ? `${relativePrefix}/${entry.name}` : entry.name;

      if (entry.isSymbolicLink()) {
        continue;
      }

      if (entry.isDirectory()) {
        if (ignoredDirs.has(entry.name)) {
          continue;
        }
        scanDir(fullPath, relativePath);
        continue;
      }

      const stat = fs.lstatSync(fullPath);
      if (!stat.isFile()) {
        continue;
      }

      const extension = path.extname(entry.name);
      if (ignoredExtensions.has(extension)) {
        continue;
      }

      if (stat.size > 1024 * 256) {
        continue;
      }

      const buffer = fs.readFileSync(fullPath);
      if (buffer.includes(0)) {
        continue;
      }

      const content = buffer.toString('utf-8');
      if (originalFiles[relativePath] === undefined || originalFiles[relativePath] !== content) {
        syncedFiles[relativePath] = content;
      }
    }
  };

  scanDir(rootDir, '');
  return syncedFiles;
}

module.exports = {
  sanitizeRelativePath,
  normalizeProjectFiles,
  writeProjectFiles,
  findFilesByExtension,
  collectSyncedFiles,
};
