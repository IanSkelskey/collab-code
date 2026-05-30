import javaMain from './starters/java/Main.java?raw';
import javaReadme from './starters/java/README.md?raw';
import pythonMain from './starters/python/main.py?raw';
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

// Per-language starter workspaces loaded as raw strings from
// src/config/starters/<lang>/. Adding a new starter should only require a small
// manifest entry here plus the source/README/supporting files on disk.
const starterWorkspaces: Record<Exclude<RoomTemplateId, 'blank'>, RoomStarterWorkspace> = {
  java: {
    files: [
      { name: 'Main.java', content: javaMain },
      { name: 'README.md', content: javaReadme },
    ],
    initialOpenFileName: 'Main.java',
  },
  python: {
    files: [
      { name: 'main.py', content: pythonMain },
      { name: 'README.md', content: pythonReadme },
      { name: 'requirements.txt', content: pythonRequirements },
    ],
    initialOpenFileName: 'main.py',
  },
};

export function getRoomStarterWorkspace(templateId: RoomTemplateId): RoomStarterWorkspace | null {
  if (templateId === 'blank') {
    return null;
  }

  return starterWorkspaces[templateId];
}
