import { useEffect, useRef, useContext } from 'react';
import api from '../utils/axios';
import { AuthContext } from '../context/AuthContext';

const IDLE_THRESHOLD_MS = 4 * 60 * 1000;   // 4 minutes
const TAB_CLOSE_IDLE_MSG = 'You are currently checked in. If you close this tab, you will be marked as idle after 5 minutes.';

export default function ScreenTimeTracker() {
  const { user } = useContext(AuthContext);
  const lastActivityRef    = useRef(Date.now());
  const lastPingTimeRef    = useRef(Date.now());
  const isTrackingRef      = useRef(false);
  const isIdleRef          = useRef(false);
  const intervalRef        = useRef(null);
  const screenshotTimerRef = useRef(null);
  const checkedInRef       = useRef(false);

  // ── helpers ──────────────────────────────────────────────────────────────
  const getToday = () => new Date().toISOString().split('T')[0];

  const isCheckedIn = async () => {
    try {
      const { data } = await api.get('/attendance/today');
      return Array.isArray(data) && data.length > 0 && data[0]?.checkIn && !data[0]?.checkOut;
    } catch { return false; }
  };

  // ── screenshot scheduling ─────────────────────────────────────────────────
  const scheduleScreenshots = async () => {
    try {
      const { data } = await api.get('/screen-time/screenshot-config');
      const count = data?.screenshotsPerDay || 0;
      if (count <= 0) return;

      // Working window: 09:00 – 18:00 (9 hours = 32400 seconds)
      const WINDOW_MS = 9 * 60 * 60 * 1000;
      const now = new Date();
      const windowStart = new Date(now); windowStart.setHours(9, 0, 0, 0);
      const windowEnd   = new Date(now); windowEnd.setHours(18, 0, 0, 0);
      const remaining   = Math.max(0, windowEnd - now);
      if (remaining <= 0) return;

      // Generate `count` random offsets within remaining window
      const offsets = Array.from({ length: count }, () => Math.random() * remaining)
        .sort((a, b) => a - b);

      offsets.forEach(offset => {
        setTimeout(() => captureAndUploadScreenshot(), offset);
      });
    } catch { /* silent */ }
  };

  const captureAndUploadScreenshot = async () => {
    try {
      // Use html2canvas if available, otherwise skip silently
      if (typeof window.html2canvas !== 'function') return;
      const canvas = await window.html2canvas(document.body, { logging: false, useCORS: true });
      canvas.toBlob(async (blob) => {
        if (!blob) return;
        const form = new FormData();
        form.append('screenshot', blob, `ss-${Date.now()}.png`);
        await api.post('/screen-time/screenshot', form, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
      }, 'image/png', 0.7);
    } catch { /* silent — never surface to user */ }
  };

  // ── main effect ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;

    const markActive = () => {
      lastActivityRef.current = Date.now();
      // If we were idle, resume active tracking
      if (isIdleRef.current) {
        isIdleRef.current = false;
      }
    };

    const events = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart', 'wheel'];
    events.forEach(e => window.addEventListener(e, markActive, { passive: true }));
    window.addEventListener('focus', markActive);

    // ── beforeunload warning for checked-in users ─────────────────────────
    const handleBeforeUnload = (e) => {
      if (!checkedInRef.current) return;
      e.preventDefault();
      e.returnValue = TAB_CLOSE_IDLE_MSG;
      // Log tab-close idle event — fires best-effort before page unloads
      navigator.sendBeacon
        ? navigator.sendBeacon('/api/screen-time/idle-event', JSON.stringify({ reason: 'tab_closed', date: getToday() }))
        : api.post('/screen-time/idle-event', { reason: 'tab_closed', date: getToday() }).catch(() => {});
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    // ── heartbeat + idle detection ────────────────────────────────────────
    const ping = async () => {
      if (isTrackingRef.current) return;
      isTrackingRef.current = true;

      try {
        const now = Date.now();
        const durationSeconds = Math.max(0, Math.round((now - lastPingTimeRef.current) / 1000));
        if (durationSeconds < 5) { isTrackingRef.current = false; return; }

        const timeSinceActivity = now - lastActivityRef.current;
        const shouldBeIdle = timeSinceActivity >= IDLE_THRESHOLD_MS || document.hidden;

        // Transition: active → idle
        if (shouldBeIdle && !isIdleRef.current) {
          isIdleRef.current = true;
          await api.post('/screen-time/idle-event', {
            reason: 'keyboard_mouse_idle',
            date: getToday()
          }).catch(() => {});
        }

        const state = shouldBeIdle ? 'IDLE' : 'ACTIVE';
        lastPingTimeRef.current = now;

        await api.post('/screen-time/heartbeat', { state, durationSeconds });

        // Refresh checked-in status every ping
        checkedInRef.current = await isCheckedIn();
      } catch { /* silent */ } finally {
        isTrackingRef.current = false;
      }
    };

    intervalRef.current = setInterval(ping, 60000);

    // Initial check-in status + schedule screenshots
    isCheckedIn().then(checked => {
      checkedInRef.current = checked;
      if (checked) scheduleScreenshots();
    });

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (screenshotTimerRef.current) clearTimeout(screenshotTimerRef.current);
      events.forEach(e => window.removeEventListener(e, markActive));
      window.removeEventListener('focus', markActive);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [user]);

  return null;
}
