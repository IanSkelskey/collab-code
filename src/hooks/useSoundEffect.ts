import { useCallback, useEffect, useMemo, useRef } from 'react';
import { clampAudioVolume } from '../lib/audio';

interface UseSoundEffectOptions {
  src: string;
  volume?: number;
  enabled?: boolean;
  preload?: HTMLAudioElement['preload'];
  restartOnPlay?: boolean;
}

export function useSoundEffect({
  src,
  volume = 1,
  enabled = true,
  preload = 'auto',
  restartOnPlay = true,
}: UseSoundEffectOptions) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const normalizedVolume = useMemo(() => clampAudioVolume(volume, 1), [volume]);

  useEffect(() => {
    if (typeof Audio === 'undefined') {
      return undefined;
    }

    const audio = new Audio(src);
    audio.preload = preload;
    audioRef.current = audio;

    return () => {
      audio.pause();
      audioRef.current = null;
    };
  }, [src, preload]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = normalizedVolume;
    }
  }, [normalizedVolume]);

  const play = useCallback(() => {
    if (!enabled || !audioRef.current) {
      return;
    }

    if (restartOnPlay) {
      audioRef.current.currentTime = 0;
    }

    void audioRef.current.play().catch(() => {
      // Ignore autoplay or decode failures; callers should still handle the primary UI event.
    });
  }, [enabled, restartOnPlay]);

  const stop = useCallback(() => {
    if (!audioRef.current) {
      return;
    }

    audioRef.current.pause();

    if (restartOnPlay) {
      audioRef.current.currentTime = 0;
    }
  }, [restartOnPlay]);

  return {
    play,
    stop,
  };
}
