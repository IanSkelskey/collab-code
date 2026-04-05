import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useMonaco } from '@monaco-editor/react';
import DOMPurify from 'dompurify';
import { marked } from 'marked';
import { languages } from '../config/languages';
import type { VirtualFS } from '../hooks/useVirtualFS';
import { getParentPath, joinVfsPath, normalizeVfsPath } from '../lib/vfsPaths';
import { useTheme } from '../theme/ThemeProvider';
import './MarkdownPreview.css';

interface MarkdownPreviewProps {
  content: string;
  filePath: string;
  fs: VirtualFS;
}

const EXTERNAL_LINK_RE = /^(?:[a-z][a-z\d+\-.]*:|\/\/)/i;

interface CodeLanguageMeta {
  label: string;
  monacoLanguage: string;
}

const codeLanguageAliases = new Map<string, CodeLanguageMeta>();

function registerCodeLanguageAlias(alias: string, meta: CodeLanguageMeta): void {
  codeLanguageAliases.set(alias.toLowerCase(), meta);
}

for (const language of languages) {
  const meta: CodeLanguageMeta = {
    label: language.label,
    monacoLanguage: language.monacoLanguage,
  };

  registerCodeLanguageAlias(language.id, meta);
  registerCodeLanguageAlias(language.monacoLanguage, meta);

  for (const extension of language.extensions) {
    registerCodeLanguageAlias(extension.replace(/^\./, ''), meta);
  }
}

registerCodeLanguageAlias('text', { label: 'Plain text', monacoLanguage: 'plaintext' });
registerCodeLanguageAlias('plain', { label: 'Plain text', monacoLanguage: 'plaintext' });
registerCodeLanguageAlias('plaintext', { label: 'Plain text', monacoLanguage: 'plaintext' });
registerCodeLanguageAlias('txt', { label: 'Plain text', monacoLanguage: 'plaintext' });
registerCodeLanguageAlias('jsx', { label: 'JSX', monacoLanguage: 'javascript' });
registerCodeLanguageAlias('tsx', { label: 'TSX', monacoLanguage: 'typescript' });
registerCodeLanguageAlias('bash', { label: 'Bash', monacoLanguage: 'shell' });
registerCodeLanguageAlias('sh', { label: 'Shell', monacoLanguage: 'shell' });
registerCodeLanguageAlias('shell', { label: 'Shell', monacoLanguage: 'shell' });
registerCodeLanguageAlias('zsh', { label: 'Shell', monacoLanguage: 'shell' });
registerCodeLanguageAlias('console', { label: 'Console', monacoLanguage: 'shell' });
registerCodeLanguageAlias('ps1', { label: 'PowerShell', monacoLanguage: 'powershell' });
registerCodeLanguageAlias('powershell', { label: 'PowerShell', monacoLanguage: 'powershell' });
registerCodeLanguageAlias('yml', { label: 'YAML', monacoLanguage: 'yaml' });
registerCodeLanguageAlias('yaml', { label: 'YAML', monacoLanguage: 'yaml' });
registerCodeLanguageAlias('c++', { label: 'C++', monacoLanguage: 'cpp' });
registerCodeLanguageAlias('cs', { label: 'C#', monacoLanguage: 'csharp' });
registerCodeLanguageAlias('csharp', { label: 'C#', monacoLanguage: 'csharp' });

function isExternalLink(href: string): boolean {
  return EXTERNAL_LINK_RE.test(href);
}

function formatLanguageLabel(language: string): string {
  if (language.length <= 3) {
    return language.toUpperCase();
  }

  return language
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function normalizeCodeLanguage(rawLanguage: string | null | undefined): CodeLanguageMeta {
  const normalizedLanguage = rawLanguage
    ?.trim()
    .split(/\s+/, 1)[0]
    .replace(/^\./, '')
    .toLowerCase();

  if (!normalizedLanguage) {
    return {
      label: 'Plain text',
      monacoLanguage: 'plaintext',
    };
  }

  return codeLanguageAliases.get(normalizedLanguage) ?? {
    label: formatLanguageLabel(normalizedLanguage),
    monacoLanguage: normalizedLanguage,
  };
}

function extractCodeLanguage(codeElement: Element): string | null {
  const languageFromData = codeElement.getAttribute('data-lang');
  if (languageFromData) {
    return languageFromData;
  }

  const className = codeElement.getAttribute('class') ?? '';
  const match = className.match(/(?:^|\s)(?:language|lang)-([^\s]+)/i);
  return match?.[1] ?? null;
}

function wrapTables(documentFragment: Document): void {
  documentFragment.querySelectorAll('table').forEach((table) => {
    if (table.parentElement?.classList.contains('markdown-table-wrap')) {
      return;
    }

    const wrapper = documentFragment.createElement('div');
    wrapper.className = 'markdown-table-wrap';
    table.replaceWith(wrapper);
    wrapper.appendChild(table);
  });
}

function enhanceCodeBlocks(documentFragment: Document): void {
  documentFragment.querySelectorAll('pre > code').forEach((codeElement) => {
    if (!(codeElement instanceof HTMLElement)) {
      return;
    }

    const preElement = codeElement.parentElement;
    if (!(preElement instanceof HTMLPreElement)) {
      return;
    }

    if (preElement.parentElement?.classList.contains('markdown-code-block')) {
      return;
    }

    const { label, monacoLanguage } = normalizeCodeLanguage(extractCodeLanguage(codeElement));
    codeElement.dataset.lang = monacoLanguage;
    codeElement.classList.add('markdown-code-content');
    preElement.classList.add('markdown-code-pre');
    preElement.setAttribute('tabindex', '0');

    const wrapper = documentFragment.createElement('div');
    wrapper.className = 'markdown-code-block';

    const header = documentFragment.createElement('div');
    header.className = 'markdown-code-header';

    const languageLabel = documentFragment.createElement('span');
    languageLabel.className = 'markdown-code-language';
    languageLabel.textContent = label;

    const copyButton = documentFragment.createElement('button');
    copyButton.type = 'button';
    copyButton.className = 'markdown-code-copy';
    copyButton.dataset.copyCode = 'true';
    copyButton.textContent = 'Copy';

    header.append(languageLabel, copyButton);
    preElement.replaceWith(wrapper);
    wrapper.append(header, preElement);
  });
}

function buildPreviewHtml(markdown: string): string {
  const rendered = marked.parse(markdown, {
    async: false,
    breaks: true,
    gfm: true,
  });
  const rawHtml = typeof rendered === 'string' ? rendered : '';
  const sanitizedHtml = DOMPurify.sanitize(rawHtml, {
    USE_PROFILES: { html: true },
  });
  const documentFragment = new DOMParser().parseFromString(sanitizedHtml, 'text/html');

  documentFragment.querySelectorAll('a[href]').forEach((link) => {
    const href = link.getAttribute('href') ?? '';
    if (!isExternalLink(href)) {
      return;
    }

    link.setAttribute('target', '_blank');
    link.setAttribute('rel', 'noreferrer noopener');
  });

  documentFragment.querySelectorAll('img[src]').forEach((image) => {
    image.setAttribute('loading', 'lazy');
  });

  wrapTables(documentFragment);
  enhanceCodeBlocks(documentFragment);

  return documentFragment.body.innerHTML;
}

function resolveWorkspaceLink(filePath: string, href: string): string | null {
  const trimmedHref = href.trim();
  if (!trimmedHref || trimmedHref.startsWith('#') || isExternalLink(trimmedHref) || trimmedHref.startsWith('data:')) {
    return null;
  }

  const [rawPathPart] = trimmedHref.split('#', 1);
  if (!rawPathPart) {
    return null;
  }

  let pathPart = rawPathPart;
  try {
    pathPart = decodeURI(rawPathPart);
  } catch {
    pathPart = rawPathPart;
  }

  if (pathPart.startsWith('~')) {
    return normalizeVfsPath(pathPart);
  }

  if (pathPart.startsWith('/')) {
    return normalizeVfsPath(pathPart);
  }

  return joinVfsPath(getParentPath(filePath), pathPart);
}

export default function MarkdownPreview({ content, filePath, fs }: MarkdownPreviewProps) {
  const monaco = useMonaco();
  const { theme } = useTheme();
  const previewRef = useRef<HTMLDivElement>(null);
  const copyResetTimersRef = useRef(new Map<HTMLButtonElement, number>());
  const renderedHtml = useMemo(() => buildPreviewHtml(content), [content]);

  useEffect(() => {
    const activeTimers = copyResetTimersRef.current;

    return () => {
      for (const timeoutId of activeTimers.values()) {
        window.clearTimeout(timeoutId);
      }

      activeTimers.clear();
    };
  }, []);

  useEffect(() => {
    const previewElement = previewRef.current;
    if (!previewElement || !monaco) {
      return;
    }

    const supportedLanguages = new Set(
      monaco.languages.getLanguages().map((language) => language.id.toLowerCase()),
    );

    const colorizeCodeBlocks = async () => {
      const codeElements = Array.from(
        previewElement.querySelectorAll<HTMLElement>('pre > code[data-lang]'),
      );

      await Promise.all(codeElements.map(async (codeElement) => {
        const requestedLanguage = codeElement.dataset.lang?.trim().toLowerCase() ?? 'plaintext';
        const supportedLanguage = supportedLanguages.has(requestedLanguage)
          ? requestedLanguage
          : 'plaintext';

        if (supportedLanguage !== requestedLanguage) {
          codeElement.dataset.lang = supportedLanguage;
        }

        try {
          await monaco.editor.colorizeElement(codeElement, {
            tabSize: 2,
            theme: theme.monacoTheme,
          });
        } catch {
          // Keep the raw code content visible if Monaco colorization fails.
        }
      }));
    };

    void colorizeCodeBlocks();
  }, [monaco, renderedHtml, theme.monacoTheme]);

  const showCopiedState = useCallback((button: HTMLButtonElement) => {
    const existingTimeoutId = copyResetTimersRef.current.get(button);
    if (existingTimeoutId) {
      window.clearTimeout(existingTimeoutId);
    }

    button.dataset.copied = 'true';
    button.textContent = 'Copied';

    const timeoutId = window.setTimeout(() => {
      copyResetTimersRef.current.delete(button);

      if (!button.isConnected) {
        return;
      }

      delete button.dataset.copied;
      button.textContent = 'Copy';
    }, 1600);

    copyResetTimersRef.current.set(button, timeoutId);
  }, []);

  const handleCopyCodeBlock = useCallback(async (button: HTMLButtonElement) => {
    const codeElement = button
      .closest('.markdown-code-block')
      ?.querySelector<HTMLElement>('pre > code');

    const code = codeElement?.textContent ?? '';
    if (!code) {
      return;
    }

    try {
      await navigator.clipboard.writeText(code);
      showCopiedState(button);
    } catch {
      window.prompt('Copy this code:', code);
    }
  }, [showCopiedState]);

  const handleClick = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    const element = event.target;
    if (!(element instanceof Element)) {
      return;
    }

    const copyButton = element.closest('[data-copy-code]');
    if (copyButton instanceof HTMLButtonElement) {
      event.preventDefault();
      void handleCopyCodeBlock(copyButton);
      return;
    }

    const link = element.closest('a[href]');
    if (!(link instanceof HTMLAnchorElement)) {
      return;
    }

    const href = link.getAttribute('href') ?? '';
    const resolvedPath = resolveWorkspaceLink(filePath, href);
    if (!resolvedPath) {
      return;
    }

    event.preventDefault();
    if (!fs.exists(resolvedPath) || fs.isDirectory(resolvedPath)) {
      return;
    }

    fs.openFile(resolvedPath);
  }, [filePath, fs, handleCopyCodeBlock]);

  if (!content.trim()) {
    return (
      <div className="cc-preview-shell">
        <div className="cc-preview-empty">
          <p className="cc-text-muted text-sm">Nothing to preview yet.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="cc-preview-shell">
      <div className="cc-preview-frame">
        <div
          ref={previewRef}
          onClick={handleClick}
          className="markdown-preview cc-preview-content mx-auto min-h-full w-full max-w-4xl"
          dangerouslySetInnerHTML={{ __html: renderedHtml }}
        />
      </div>
    </div>
  );
}
