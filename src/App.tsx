import { lazy, Suspense, useCallback, useState } from 'react';
import ErrorBoundary from './components/ErrorBoundary';
import LandingPage from './components/LandingPage';
import WorkspaceFallback from './components/WorkspaceFallback';
import { getRoomStarterWorkspace, type RoomTemplateId } from './config/roomTemplates';
import { useRoom } from './hooks/useRoom';

// Split the in-room experience (Monaco, Yjs, xterm, CollabProvider) off the
// Landing bundle. Loaded on demand when the user enters a room.
const WorkspaceRoute = lazy(() => import('./components/WorkspaceRoute'));

function getInitialRoomTemplate(
  createdRoomId: string | null,
  createdRoomTemplate: RoomTemplateId | null,
  roomId: string,
): RoomTemplateId | null {
  if (createdRoomId !== roomId || !createdRoomTemplate) {
    return null;
  }

  return getRoomStarterWorkspace(createdRoomTemplate) ? createdRoomTemplate : null;
}

export default function App() {
  const roomId = useRoom();
  const [createdRoomId, setCreatedRoomId] = useState<string | null>(null);
  const [createdRoomTemplate, setCreatedRoomTemplate] = useState<RoomTemplateId | null>(null);

  const navigateToRoom = useCallback((nextRoomId: string, nextTemplate: RoomTemplateId | null) => {
    setCreatedRoomId(nextTemplate ? nextRoomId : null);
    setCreatedRoomTemplate(nextTemplate);
    window.location.hash = nextRoomId;
  }, []);

  const handleCreateRoom = useCallback(
    (nextRoomId: string, templateId: RoomTemplateId) => {
      navigateToRoom(nextRoomId, templateId);
    },
    [navigateToRoom],
  );

  const handleJoinRoom = useCallback(
    (nextRoomId: string) => {
      navigateToRoom(nextRoomId, null);
    },
    [navigateToRoom],
  );

  const handleExitRoom = useCallback(() => {
    setCreatedRoomId(null);
    setCreatedRoomTemplate(null);
    window.location.hash = '';
  }, []);

  if (!roomId) {
    return <LandingPage onCreateRoom={handleCreateRoom} onJoinRoom={handleJoinRoom} />;
  }

  return (
    <ErrorBoundary resetKey={roomId}>
      <Suspense fallback={<WorkspaceFallback />}>
        <WorkspaceRoute
          roomId={roomId}
          onExitRoom={handleExitRoom}
          initialRoomTemplate={getInitialRoomTemplate(createdRoomId, createdRoomTemplate, roomId)}
        />
      </Suspense>
    </ErrorBoundary>
  );
}
