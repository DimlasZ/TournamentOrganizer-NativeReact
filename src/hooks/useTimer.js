// useTimer — countdown timer with notification-based background audio.
//
// OS-scheduled notifications are the PRIMARY mechanism for lock-screen /
// background alerts. Each alert (40 min, 20 min, time-up) has its own
// Android notification channel with a custom sound file, so the OS plays
// the correct sound even when the JS thread is suspended.
//
// In-app expo-audio playback is a SUPPLEMENT for when the app is in the
// foreground. A foreground service keeps the process alive as a bonus.
//
// An AppState listener re-syncs timer state when the app returns to foreground.

import { useState, useEffect, useRef, useCallback } from 'react';
import { AppState, Platform } from 'react-native';
import { useAudioPlayer, setAudioModeAsync } from 'expo-audio';
import * as Notifications from 'expo-notifications';
import ForegroundService from '@supersami/rn-foreground-service';

const DEFAULT_DURATION_MS = 65 * 60 * 1000; // 1:05:00

const FG_NOTIF_ID = 1001;

// Suppress banners when app is foregrounded — we handle alerts in-app.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: false,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

// ── Foreground service helpers (Android only) ─────────────────────────────────

async function _fgStart() {
  if (Platform.OS !== 'android') return;
  try {
    await ForegroundService.startService({
      id: FG_NOTIF_ID,
      title: 'Tournament Timer Running',
      message: 'Timer is active — sounds will play on time.',
      ServiceType: 'mediaPlayback',
      importance: 'high',
      visibility: 'public',
      icon: 'ic_launcher',
    });
  } catch {}
}

async function _fgStop() {
  if (Platform.OS !== 'android') return;
  try {
    await ForegroundService.stopServiceAll();
  } catch {}
}

// ─────────────────────────────────────────────────────────────────────────────

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

  const endTimeRef    = useRef(null);
  const intervalRef   = useRef(null);
  const beeped40Ref   = useRef(false);
  const beeped20Ref   = useRef(false);
  const durationRef   = useRef(DEFAULT_DURATION_MS);
  const isRunningRef  = useRef(false);
  const notifIdsRef   = useRef([]);

  // ── Audio players ─────────────────────────────────────────────────────────
  const player40 = useAudioPlayer(sound40min);
  const player20 = useAudioPlayer(sound20min);
  const alarm    = useAudioPlayer(alarmSound);

  useEffect(() => {
    setAudioModeAsync({ playsInSilentModeIOS: true, staysActiveInBackground: true }).catch(() => {});
  }, []);

  useEffect(() => {
    if (alarmSound) {
      try { alarm.loop = true; } catch {}
    }
  }, [alarm, alarmSound]);

  // ── Notification channels (one per sound, new IDs so Android picks up custom sounds) ──
  useEffect(() => {
    Notifications.requestPermissionsAsync().catch(() => {});

    const channelOpts = {
      importance: Notifications.AndroidImportance.MAX,
      enableVibrate: true,
      lockscreenVisibility: 1, // VISIBILITY_PUBLIC
    };

    Notifications.setNotificationChannelAsync('timer-40min', {
      name: 'Timer — 40 min warning',
      sound: 'alert_40min.mp3',
      ...channelOpts,
    }).catch(() => {});

    Notifications.setNotificationChannelAsync('timer-20min', {
      name: 'Timer — 20 min warning',
      sound: 'alert_20min.mp3',
      ...channelOpts,
    }).catch(() => {});

    Notifications.setNotificationChannelAsync('timer-alarm', {
      name: 'Timer — Time Up',
      sound: 'alarm.wav',
      ...channelOpts,
    }).catch(() => {});
  }, []);

  // ── Internal audio helpers ────────────────────────────────────────────────

  const _play40 = useCallback(() => {
    if (!sound40min) return;
    try { player40.seekTo(0); player40.play(); } catch {}
  }, [player40, sound40min]);

  const _play20 = useCallback(() => {
    if (!sound20min) return;
    try { player20.seekTo(0); player20.play(); } catch {}
  }, [player20, sound20min]);

  // ── Notification helpers ──────────────────────────────────────────────────

  const _cancelNotifications = useCallback(() => {
    const ids = notifIdsRef.current;
    notifIdsRef.current = [];
    ids.forEach(id => Notifications.cancelScheduledNotificationAsync(id).catch(() => {}));
  }, []);

  const _scheduleNotifications = useCallback((durationMs) => {
    _cancelNotifications();
    const ids = [];

    const schedule = async () => {
      if (durationMs > 40 * 60 * 1000) {
        const secs = Math.max(1, Math.round((durationMs - 40 * 60 * 1000) / 1000));
        const id = await Notifications.scheduleNotificationAsync({
          content: {
            title: '40 Minutes Remaining',
            body: 'Round time check',
            sound: 'alert_40min.mp3',
          },
          trigger: { seconds: secs, repeats: false, channelId: 'timer-40min' },
        }).catch(() => null);
        if (id) ids.push(id);
      }

      if (durationMs > 20 * 60 * 1000) {
        const secs = Math.max(1, Math.round((durationMs - 20 * 60 * 1000) / 1000));
        const id = await Notifications.scheduleNotificationAsync({
          content: {
            title: '20 Minutes Remaining',
            body: 'Round time check',
            sound: 'alert_20min.mp3',
          },
          trigger: { seconds: secs, repeats: false, channelId: 'timer-20min' },
        }).catch(() => null);
        if (id) ids.push(id);
      }

      const endSecs = Math.max(1, Math.round(durationMs / 1000));
      const id = await Notifications.scheduleNotificationAsync({
        content: {
          title: "Time's Up!",
          body: 'Round has ended',
          sound: 'alarm.wav',
          sticky: true,
        },
        trigger: { seconds: endSecs, repeats: false, channelId: 'timer-alarm' },
      }).catch(() => null);
      if (id) ids.push(id);

      notifIdsRef.current = ids;
    };

    schedule();
  }, [_cancelNotifications]);

  // ── Alarm ─────────────────────────────────────────────────────────────────

  const _startAlarm = useCallback(() => {
    if (alarmSound) {
      try { alarm.seekTo(0); alarm.play(); } catch {}
    }
    setShowAlarm(true);
    _cancelNotifications();
  }, [alarm, alarmSound, _cancelNotifications]);

  const _stopAlarm = useCallback(() => {
    if (alarmSound) {
      try { alarm.pause(); alarm.seekTo(0); } catch {}
    }
    setShowAlarm(false);
    _fgStop();
  }, [alarm, alarmSound]);

  // ── Tick ──────────────────────────────────────────────────────────────────

  const _tick = useCallback(() => {
    const remaining = endTimeRef.current - Date.now();

    if (remaining <= 0) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
      setTimeLeft(0);
      setIsRunning(false);
      isRunningRef.current = false;
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

  // ── AppState sync: re-check timer when app returns to foreground ──────────

  useEffect(() => {
    const sub = AppState.addEventListener('change', nextState => {
      if (nextState === 'active' && isRunningRef.current && endTimeRef.current) {
        const remaining = endTimeRef.current - Date.now();
        if (remaining <= 0) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
          setTimeLeft(0);
          setIsRunning(false);
          isRunningRef.current = false;
          setIsExpired(true);
          _startAlarm();
        } else {
          setTimeLeft(remaining);
          setIsWarning(remaining < 10 * 60 * 1000);
        }
      }
    });
    return () => sub.remove();
  }, [_startAlarm]);

  // ── Public controls ───────────────────────────────────────────────────────

  const start = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    endTimeRef.current   = Date.now() + durationRef.current;
    beeped40Ref.current  = false;
    beeped20Ref.current  = false;
    setTimeLeft(durationRef.current);
    setIsRunning(true);
    isRunningRef.current = true;
    setIsExpired(false);
    setShowAlarm(false);
    intervalRef.current  = setInterval(_tick, 1000);
    _scheduleNotifications(durationRef.current);
    _fgStart();
  }, [_tick, _scheduleNotifications]);

  const stop = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    _stopAlarm();
    _cancelNotifications();
    endTimeRef.current   = null;
    setIsRunning(false);
    isRunningRef.current = false;
    setIsExpired(false);
    setTimeLeft(durationRef.current);
    beeped40Ref.current  = false;
    beeped20Ref.current  = false;
    _fgStop();
  }, [_stopAlarm, _cancelNotifications]);

  const setDuration = useCallback((ms) => {
    durationRef.current = ms;
    _setDuration(ms);
    if (!isRunning) setTimeLeft(ms);
  }, [isRunning]);

  // ── Cleanup on unmount ────────────────────────────────────────────────────

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      notifIdsRef.current.forEach(id =>
        Notifications.cancelScheduledNotificationAsync(id).catch(() => {})
      );
      _fgStop();
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
