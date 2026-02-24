import type { SVGProps, ComponentType } from 'react';
import {
  TypeScriptFileIcon,
  JavaScriptFileIcon,
  PythonFileIcon,
  MarkdownFileIcon,
  CFileIcon,
  CppFileIcon,
  HTMLFileIcon,
  CSSFileIcon,
  JavaFileIcon,
  JsonFileIcon,
  SqlFileIcon,
} from './Icons';

export type IconProps = SVGProps<SVGSVGElement>;

export const iconsByName: Record<string, ComponentType<IconProps>> = {
  ts: TypeScriptFileIcon,
  js: JavaScriptFileIcon,
  python: PythonFileIcon,
  markdown: MarkdownFileIcon,
  c: CFileIcon,
  cpp: CppFileIcon,
  html: HTMLFileIcon,
  css: CSSFileIcon,
  java: JavaFileIcon,
  json: JsonFileIcon,
  sql: SqlFileIcon,
};
