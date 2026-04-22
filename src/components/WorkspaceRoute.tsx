import WorkspaceScreen from './WorkspaceScreen';
import { CollabProvider } from '../providers/CollabProvider';
import type { RoomTemplateId } from '../config/roomTemplates';

interface WorkspaceRouteProps {
  roomId: string;
  initialRoomTemplate: RoomTemplateId | null;
  onExitRoom: () => void;
}

/**
 * Lazy-loaded entry point for the in-room experience. Bundling
 * `CollabProvider` (Yjs) and `WorkspaceScreen` (Monaco, xterm) here means
 * the Landing page ships without any of them.
 */
export default function WorkspaceRoute({
  roomId,
  initialRoomTemplate,
  onExitRoom,
}: WorkspaceRouteProps) {
  return (
    <CollabProvider key={roomId} roomId={roomId}>
      <WorkspaceScreen onExitRoom={onExitRoom} initialRoomTemplate={initialRoomTemplate} />
    </CollabProvider>
  );
}
