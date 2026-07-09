import { useEffect, useMemo, useRef } from 'react';
import { supabase } from '../lib/supabase.js';

const DEFAULT_DEBOUNCE_MS = 600;
const DEFAULT_POLL_INTERVAL_MS = 60000;

export function useSupabaseRealtimeRefresh(
  tables,
  onRefresh,
  {
    enabled = true,
    debounceMs = DEFAULT_DEBOUNCE_MS,
    pollIntervalMs = DEFAULT_POLL_INTERVAL_MS,
    channelName = 'agroflow-realtime-refresh',
  } = {},
) {
  const refreshRef = useRef(onRefresh);
  const realtimeConnectedRef = useRef(false);
  const realtimeTimerRef = useRef(null);
  const pollingTimerRef = useRef(null);

  const tablesKey = useMemo(
    () => [...new Set((tables || []).filter(Boolean))].sort().join('|'),
    [tables],
  );

  useEffect(() => {
    refreshRef.current = onRefresh;
  }, [onRefresh]);

  useEffect(() => {
    if (!enabled || !tablesKey) return undefined;
    realtimeConnectedRef.current = false;

    const runRefresh = () => {
      if (typeof document !== 'undefined' && document.hidden) return;
      refreshRef.current?.();
    };

    const scheduleRefresh = () => {
      if (realtimeTimerRef.current) window.clearTimeout(realtimeTimerRef.current);
      realtimeTimerRef.current = window.setTimeout(runRefresh, debounceMs);
    };

    const channel = supabase.channel(`${channelName}:${tablesKey}`);
    tablesKey.split('|').forEach((table) => {
      channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table },
        scheduleRefresh,
      );
    });
    channel.subscribe((status) => {
      realtimeConnectedRef.current = status === 'SUBSCRIBED';
    });

    if (pollIntervalMs > 0) {
      pollingTimerRef.current = window.setInterval(() => {
        if (realtimeConnectedRef.current) return;
        runRefresh();
      }, pollIntervalMs);
    }

    return () => {
      realtimeConnectedRef.current = false;
      if (realtimeTimerRef.current) window.clearTimeout(realtimeTimerRef.current);
      if (pollingTimerRef.current) window.clearInterval(pollingTimerRef.current);
      supabase.removeChannel(channel);
    };
  }, [enabled, tablesKey, debounceMs, pollIntervalMs, channelName]);
}
