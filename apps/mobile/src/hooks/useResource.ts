import { useCallback, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from 'expo-router';

export function useResource<T>(load: (signal: AbortSignal) => Promise<T>, initial: T) {
  const [data, setData] = useState(initial); const [loading, setLoading] = useState(true); const [error, setError] = useState('');
  const [revision, refresh] = useState(0); const ref = useRef(load); ref.current = load;
  useFocusEffect(useCallback(() => {
    let controller: AbortController | null = null; let generation = 0; let active = true;
    const fetchData = () => {
      controller?.abort(); controller = new AbortController(); const current = ++generation;
      setLoading(true); setError('');
      ref.current(controller.signal).then(result => { if (active && current === generation) setData(result); }).catch(err => {
        if (active && current === generation) setError(err instanceof Error ? err.message : 'Request failed.');
      }).finally(() => { if (active && current === generation) setLoading(false); });
    };
    fetchData(); const listener = AppState.addEventListener('change', state => { if (state === 'active') fetchData(); });
    return () => { active = false; controller?.abort(); listener.remove(); };
  }, [revision]));
  return { data, setData, loading, error, refresh: () => refresh(value => value + 1) };
}
