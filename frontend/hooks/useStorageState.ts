import { useCallback, useEffect, useState } from 'react';
import * as SecureStore from 'expo-secure-store';

import { primeTokenCache } from '@/lib/token-cache';

/**
 * Persists a value in secure storage while exposing loading state so screens can defer rendering
 * until the initial read resolves.
 */
export function useStorageState(key: string) {
  const [isLoading, setIsLoading] = useState(true);
  const [value, setValue] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const item = await SecureStore.getItemAsync(key);
      setValue(item);
      primeTokenCache(key, item);
      setIsLoading(false);
    })();
  }, [key]);

  const setStoredValue = useCallback(
    async (val: string | null) => {
      setIsLoading(true);
      if (val === null) {
        await SecureStore.deleteItemAsync(key);
      } else {
        await SecureStore.setItemAsync(key, val);
      }
      setValue(val);
      primeTokenCache(key, val);
      setIsLoading(false);
    },
    [key],
  );

  return [[isLoading, value], setStoredValue] as const;
}
