import { useCallback, useEffect, useState } from 'react';
import { readLocalStorageJson, writeLocalStorageJson } from '../lib/localStorage';
import { clampAudioVolume } from '../lib/audio';

const AUDIO_PREFERENCES_STORAGE_KEY = 'collab-code-audio-preferences';
const DEFAULT_PRESENCE_SOUNDS_ENABLED = true;
const DEFAULT_PRESENCE_SOUND_VOLUME = 0.35;

interface AudioPreferencesState {
  presenceSoundsEnabled: boolean;
  presenceSoundVolume: number;
}

function clampPresenceSoundVolume(value: unknown): number {
  return clampAudioVolume(value, DEFAULT_PRESENCE_SOUND_VOLUME);
}

function parseAudioPreferences(value: unknown): AudioPreferencesState | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const candidate = value as {
    presenceSoundsEnabled?: unknown;
    presenceSoundVolume?: unknown;
  };

  return {
    presenceSoundsEnabled: typeof candidate.presenceSoundsEnabled === 'boolean'
      ? candidate.presenceSoundsEnabled
      : DEFAULT_PRESENCE_SOUNDS_ENABLED,
    presenceSoundVolume: clampPresenceSoundVolume(candidate.presenceSoundVolume),
  };
}

function getInitialAudioPreferences(): AudioPreferencesState {
  return readLocalStorageJson(AUDIO_PREFERENCES_STORAGE_KEY, parseAudioPreferences) ?? {
    presenceSoundsEnabled: DEFAULT_PRESENCE_SOUNDS_ENABLED,
    presenceSoundVolume: DEFAULT_PRESENCE_SOUND_VOLUME,
  };
}

export function useAudioPreferences() {
  const [audioPreferences, setAudioPreferences] = useState<AudioPreferencesState>(getInitialAudioPreferences);

  useEffect(() => {
    writeLocalStorageJson(AUDIO_PREFERENCES_STORAGE_KEY, audioPreferences);
  }, [audioPreferences]);

  const setPresenceSoundsEnabled = useCallback((enabled: boolean) => {
    setAudioPreferences((current) => ({
      ...current,
      presenceSoundsEnabled: enabled,
    }));
  }, []);

  const setPresenceSoundVolume = useCallback((volume: number) => {
    setAudioPreferences((current) => ({
      ...current,
      presenceSoundVolume: clampPresenceSoundVolume(volume),
    }));
  }, []);

  return {
    presenceSoundsEnabled: audioPreferences.presenceSoundsEnabled,
    presenceSoundVolume: audioPreferences.presenceSoundVolume,
    setPresenceSoundsEnabled,
    setPresenceSoundVolume,
  };
}
