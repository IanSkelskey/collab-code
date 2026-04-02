import { getLanguageConfig } from './languages';

export type RoomTemplateId = 'java' | 'python' | 'blank';

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

export function getRoomStarterFile(templateId: RoomTemplateId): { name: string; content: string } | null {
  if (templateId === 'blank') {
    return null;
  }

  return getLanguageConfig(templateId)?.defaultFile ?? null;
}
