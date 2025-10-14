import * as SecureStore from 'expo-secure-store';

export type TokenKey = 'accessToken' | 'refreshToken';

type TokenCache = Record<TokenKey, string | null>;
type TokenLoadState = Record<TokenKey, boolean>;

type TokenPromises = Partial<Record<TokenKey, Promise<string | null>>>;

const cache: TokenCache = {
  accessToken: null,
  refreshToken: null,
};

const loaded: TokenLoadState = {
  accessToken: false,
  refreshToken: false,
};

const pending: TokenPromises = {};

function isTokenKey(key: string): key is TokenKey {
  return key === 'accessToken' || key === 'refreshToken';
}

async function readToken(key: TokenKey): Promise<string | null> {
  if (loaded[key]) {
    return cache[key];
  }

  if (!pending[key]) {
    pending[key] = SecureStore.getItemAsync(key).then((value) => {
      cache[key] = value;
      loaded[key] = true;
      delete pending[key];
      return value;
    });
  }

  return pending[key]!;
}

export async function getCachedTokens(): Promise<[string | null, string | null]> {
  const [accessToken, refreshToken] = await Promise.all([
    readToken('accessToken'),
    readToken('refreshToken'),
  ]);

  return [accessToken, refreshToken];
}

export function primeTokenCache(key: string, value: string | null): void {
  if (!isTokenKey(key)) {
    return;
  }

  cache[key] = value;
  loaded[key] = true;
  delete pending[key];
}

export function clearTokenCache(key?: TokenKey): void {
  if (key) {
    cache[key] = null;
    loaded[key] = true;
    delete pending[key];
    return;
  }

  (Object.keys(cache) as TokenKey[]).forEach((tokenKey) => {
    cache[tokenKey] = null;
    loaded[tokenKey] = true;
    delete pending[tokenKey];
  });
}
