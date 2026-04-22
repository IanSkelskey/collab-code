import Toolbar, { ActivityBar } from './Toolbar';
import ConfirmDialog from './ConfirmDialog';
import ToastContainer from './ToastContainer';
import HelpModal from './HelpModal';
import ServerStatusBanner from './ServerStatusBanner';
import WorkspaceMainPane from './WorkspaceMainPane';
import type { RoomTemplateId } from '../config/roomTemplates';
import { useWorkspaceController } from '../hooks/useWorkspaceController';
import { useDocumentTitle } from '../hooks/useDocumentTitle';

interface WorkspaceScreenProps {
  onExitRoom: () => void;
  initialRoomTemplate: RoomTemplateId | null;
}

export default function WorkspaceScreen({ onExitRoom, initialRoomTemplate }: WorkspaceScreenProps) {
  const controller = useWorkspaceController({ initialRoomTemplate });
  useDocumentTitle(`Room #${controller.roomId}`);

  return (
    <div
      className="cc-app-shell flex h-[100dvh] w-screen flex-col overflow-hidden"
      {...controller.dragHandlers}
    >
      <Toolbar
        roomId={controller.roomId}
        peerCount={controller.peerCount}
        peers={controller.peers}
        serverStatus={controller.serverStatus}
        followedPeer={controller.followedPeer}
        followedPeerId={controller.followedPeerId}
        running={controller.running}
        onRun={() => controller.handleRun()}
        currentRunTarget={controller.currentRunTarget}
        runTargets={controller.runnableTargets}
        onRunTargetSelect={(filePath) => controller.handleRun(filePath)}
        onExitRoom={onExitRoom}
        onSaveAll={controller.handleSaveAll}
        onConfirmLeave={(options) => controller.layout.setConfirmDialog(options)}
        onToggleFollowPeer={controller.toggleFollowPeer}
        onStopFollowing={controller.stopFollowing}
        onOpenServerHelp={controller.openServerHelp}
      />

      {controller.activeServerBanner && (
        <ServerStatusBanner
          banner={controller.activeServerBanner}
          onOpenHelp={controller.openServerHelp}
          onDismiss={controller.dismissServerBanner}
        />
      )}

      <div ref={controller.containerRef} className="flex-1 flex min-h-0">
        <ActivityBar
          explorerVisible={controller.layout.explorerVisible}
          searchVisible={controller.layout.searchVisible}
          codeCopied={controller.codeCopied}
          fontSize={controller.layout.fontSize}
          activeFileName={controller.activeFileName}
          onToggleExplorer={controller.layout.handleToggleExplorer}
          onToggleSearch={controller.layout.handleToggleSearch}
          onFormat={controller.layout.handleFormat}
          onCopyCode={controller.handleCopyCode}
          onSaveFile={controller.handleSaveFile}
          onSaveAll={controller.handleSaveAll}
          onFontSizeUp={controller.layout.handleFontSizeUp}
          onFontSizeDown={controller.layout.handleFontSizeDown}
          presenceSoundsEnabled={controller.presenceSoundsEnabled}
          presenceSoundVolume={controller.presenceSoundVolume}
          onPresenceSoundsEnabledChange={controller.setPresenceSoundsEnabled}
          onPresenceSoundVolumeChange={controller.setPresenceSoundVolume}
          onHelpOpen={controller.openAboutHelp}
        />

        <WorkspaceMainPane controller={controller} />
      </div>

      {controller.layout.confirmDialog && (
        <ConfirmDialog
          title={controller.layout.confirmDialog.title}
          message={controller.layout.confirmDialog.message}
          confirmLabel={controller.layout.confirmDialog.confirmLabel}
          secondaryLabel={controller.layout.confirmDialog.secondaryLabel}
          onSecondary={controller.layout.confirmDialog.onSecondary}
          onConfirm={() => {
            controller.layout.confirmDialog?.onConfirm();
            controller.layout.setConfirmDialog(null);
          }}
          onCancel={() => controller.layout.setConfirmDialog(null)}
        />
      )}

      <ToastContainer toasts={controller.toasts} onDismiss={controller.dismissToast} />
      {controller.layout.helpOpen && (
        <HelpModal
          onClose={() => controller.layout.setHelpOpen(false)}
          serverStatus={controller.serverStatus}
          initialTab={controller.helpInitialTab}
        />
      )}

      {controller.osDragActive && (
        <div className="cc-overlay pointer-events-none fixed inset-0 z-40 flex items-center justify-center">
          <div className="mx-4 w-full max-w-md rounded-lg border-2 border-dashed border-[var(--cc-accent)] bg-[var(--cc-bg-panel)] px-6 py-8 text-center shadow-[var(--cc-shadow-lg)]">
            <p className="text-sm font-medium text-[var(--cc-accent)]">
              Drop files or folders to import
            </p>
            <p className="cc-text-muted mt-1 text-[11px]">They&apos;ll be added under ~/</p>
          </div>
        </div>
      )}
    </div>
  );
}
