import { getLanguageConfig } from './languages';
import javaReadme from './starters/java/README.md?raw';
import pythonReadme from './starters/python/README.md?raw';
import pythonRequirements from './starters/python/requirements.txt?raw';

export type RoomTemplateId = 'java' | 'python' | 'blank';

export interface RoomStarterFile {
  name: string;
  content: string;
}

export interface RoomStarterWorkspace {
  files: RoomStarterFile[];
  initialOpenFileName: string | null;
}

export interface RoomTemplateOption {
  id: RoomTemplateId;
  label: string;
  description: string;
  helper: string;
}

export const roomTemplates: RoomTemplateOption[] = [
  {
    id: 'java',
    label: 'Java starter',
    description: 'Open a ready-to-run Main.java file.',
    helper: 'Good for intro Java labs and AP CSA style exercises.',
  },
  {
    id: 'python',
    label: 'Python starter',
    description: 'Open a ready-to-run main.py file.',
    helper: 'Good for intro Python scripts and tutoring sessions.',
  },
  {
    id: 'blank',
    label: 'Blank room',
    description: 'Start empty and choose Java or Python inside the room.',
    helper: 'Good when you want students to make the first choice themselves.',
  },
];

// Per-language starter files (README and any supporting config) loaded as raw
// strings at build time from src/config/starters/<lang>/. Adding a new language
// is just dropping its files there and registering them here — no per-language
// string templating or conditional plumbing.
const starterExtras: Record<Exclude<RoomTemplateId, 'blank'>, RoomStarterFile[]> = {
  java: [{ name: 'README.md', content: javaReadme }],
  python: [
    { name: 'README.md', content: pythonReadme },
    { name: 'requirements.txt', content: pythonRequirements },
  ],
};

export function getRoomStarterWorkspace(templateId: RoomTemplateId): RoomStarterWorkspace | null {
  if (templateId === 'blank') {
    return null;
  }

  const defaultFile = getLanguageConfig(templateId)?.defaultFile;
  if (!defaultFile) {
    return null;
  }

  return {
    files: [defaultFile, ...starterExtras[templateId]],
    initialOpenFileName: defaultFile.name,
  };
}
