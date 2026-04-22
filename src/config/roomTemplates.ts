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

function getStarterReadmeContent(
  templateId: Exclude<RoomTemplateId, 'blank'>,
  starterFileName: string,
): string {
  const title = templateId === 'java' ? 'Java Starter Workspace' : 'Python Starter Workspace';
  const languageLabel = templateId === 'java' ? 'Java' : 'Python';
  const pythonPackagesSection =
    templateId === 'python'
      ? `
## Python Packages

- \`requirements.txt\`: add Python packages here, one per line

Each run creates a fresh isolated virtual environment on the server. If \`requirements.txt\` is present next to \`${starterFileName}\` or in a parent folder, those packages are installed into that temporary environment before the program starts.

This does not modify the server's global Python installation. Update \`requirements.txt\`, then run the program again to install the new packages.

The starter \`${starterFileName}\` already imports \`rich\`, and the starter \`requirements.txt\` includes it so the room runs immediately.
`
      : '';

  return `# ${title}

This room starts with a small ${languageLabel} example so you can run code right away.

## Files

- \`${starterFileName}\`: the main starter program
${templateId === 'python' ? '- `requirements.txt`: optional Python dependencies for this room' : ''}

${pythonPackagesSection}

## Run It

Open \`${starterFileName}\` and use the Run button or press \`Ctrl+Enter\`.
`;
}

function getPythonStarterRequirementsContent(): string {
  return `rich

# Add more Python packages below, one per line.
# They will be installed into an isolated temporary virtual environment on run.
#
# Example:
# requests
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
      ...(templateId === 'python'
        ? [
            {
              name: 'requirements.txt',
              content: getPythonStarterRequirementsContent(),
            },
          ]
        : []),
    ],
    initialOpenFileName: defaultFile.name,
  };
}
