// useTimer — clean countdown timer hook with audio milestone support.
//
// Usage:
//   const timer = useTimer();
//   timer.start()         — start / restart at current duration
//   timer.stop()          — stop and reset
//   timer.display         — formatted string "1:05:00"
//   timer.isRunning       — bool
//   timer.isExpired       — bool (true when countdown reaches 0)
//   timer.showAlarm       — bool (drives the alarm modal)
//   timer.dismissAlarm()  — stops looping alarm sound, hides modal
//   timer.duration        — current duration in ms
//   timer.setDuration(ms) — change duration (only before starting)
//
// Sound files (in assets/sounds/):
//   40_min_left.mp3  — played when 40 minutes remain
//   20_min_left.mp3  — played when 20 minutes remain
//   alarm.wav        — looping alarm played when time expires

import { useState, useEffect, useRef, useCallback } from 'react';
import { useAudioPlayer, setAudioModeAsync } from 'expo-audio';

const DEFAULT_DURATION_MS = 65 * 60 * 1000; // 1:05:00

export default function useTimer({
  sound40min = null,
  sound20min = null,
  alarmSound = null,
} = {}) {
  const [duration, _setDuration] = useState(DEFAULT_DURATION_MS);
  const [timeLeft, setTimeLeft]   = useState(DEFAULT_DURATION_MS);
  const [isRunning, setIsRunning] = useState(false);
  const [isExpired, setIsExpired] = useState(false);
  const [isWarning, setIsWarning] = useState(false);
  const [showAlarm, setShowAlarm] = useState(false);

  const endTimeRef   = useRef(null);
  const intervalRef  = useRef(null);
  const beeped40Ref  = useRef(false);
  const beeped20Ref  = useRef(false);
  const durationRef  = useRef(DEFAULT_DURATION_MS);

  // ── Audio players ─────────────────────────────────────────────────────────
  // useAudioPlayer must be called unconditionally (React hook rules).
  const player40 = useAudioPlayer(sound40min);
  const player20 = useAudioPlayer(sound20min);
  const alarm    = useAudioPlayer(alarmSound);

  useEffect(() => {
    setAudioModeAsync({ playsInSilentModeIOS: true }).catch(() => {});
  }, []);

  useEffect(() => {
    if (alarmSound) {
      try { alarm.loop = true; } catch {}
    }
  }, [alarm, alarmSound]);

  // ── Internal audio helpers ────────────────────────────────────────────────

  const _play40 = useCallback(() => {
    if (!sound40min) return;
    try { player40.seekTo(0); player40.play(); } catch {}
  }, [player40, sound40min]);

  const _play20 = useCallback(() => {
    if (!sound20min) return;
    try { player20.seekTo(0); player20.play(); } catch {}
  }, [player20, sound20min]);

  const _startAlarm = useCallback(() => {
    if (alarmSound) {
      try { alarm.seekTo(0); alarm.play(); } catch {}
    }
    setShowAlarm(true);
  }, [alarm, alarmSound]);

  const _stopAlarm = useCallback(() => {
    if (alarmSound) {
      try { alarm.pause(); alarm.seekTo(0); } catch {}
    }
    setShowAlarm(false);
  }, [alarm, alarmSound]);

  // ── Tick ─────────────────────────────────────────────────────────────────

  const _tick = useCallback(() => {
    const remaining = endTimeRef.current - Date.now();

    if (remaining <= 0) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
      setTimeLeft(0);
      setIsRunning(false);
      setIsExpired(true);
      _startAlarm();
      return;
    }

    setTimeLeft(remaining);
    setIsWarning(remaining < 10 * 60 * 1000);

    if (!beeped40Ref.current && remaining <= 40 * 60 * 1000) {
      beeped40Ref.current = true;
      _play40();
    }
    if (!beeped20Ref.current && remaining <= 20 * 60 * 1000) {
      beeped20Ref.current = true;
      _play20();
    }
  }, [_play40, _play20, _startAlarm]);

  // ── Public controls ───────────────────────────────────────────────────────

  const start = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    endTimeRef.current  = Date.now() + durationRef.current;
    beeped40Ref.current = false;
    beeped20Ref.current = false;
    setTimeLeft(durationRef.current);
    setIsRunning(true);
    setIsExpired(false);
    setShowAlarm(false);
    intervalRef.current = setInterval(_tick, 1000);
  }, [_tick]);

  const stop = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    _stopAlarm();
    endTimeRef.current = null;
    setIsRunning(false);
    setIsExpired(false);
    setTimeLeft(durationRef.current);
    beeped40Ref.current = false;
    beeped20Ref.current = false;
  }, [_stopAlarm]);

  const setDuration = useCallback((ms) => {
    durationRef.current = ms;
    _setDuration(ms);
    if (!isRunning) setTimeLeft(ms);
  }, [isRunning]);

  // ── Cleanup on unmount ────────────────────────────────────────────────────

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  // ── Return ────────────────────────────────────────────────────────────────

  return {
    display:      _formatTime(Math.ceil(timeLeft / 1000)),
    isRunning,
    isExpired,
    isWarning,
    showAlarm,
    start,
    stop,
    dismissAlarm: _stopAlarm,
    duration,
    setDuration,
  };
}

function _formatTime(totalSec) {
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    : `${m}:${String(s).padStart(2, '0')}`;
}
