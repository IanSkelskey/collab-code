import { getLanguageConfig } from './languages';

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

function getStarterReadmeContent(templateId: Exclude<RoomTemplateId, 'blank'>, starterFileName: string): string {
  const title = templateId === 'java' ? 'Java Starter Workspace' : 'Python Starter Workspace';
  const languageLabel = templateId === 'java' ? 'Java' : 'Python';

  return `# ${title}

This room starts with a small ${languageLabel} example so you can run code right away.

## Files

- \`${starterFileName}\`: the main starter program

## Run It

Open \`${starterFileName}\` and use the Run button or press \`Ctrl+Enter\`.
`;
}

export function getRoomStarterWorkspace(templateId: RoomTemplateId): RoomStarterWorkspace | null {
  if (templateId === 'blank') {
    return null;
  }

  const defaultFile = getLanguageConfig(templateId)?.defaultFile;
  if (!defaultFile) {
    return null;
  }

  return {
    files: [
      {
        name: 'README.md',
        content: getStarterReadmeContent(templateId, defaultFile.name),
      },
      defaultFile,
    ],
    initialOpenFileName: defaultFile.name,
  };
}
