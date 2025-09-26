import {
  createContext,
  PropsWithChildren,
  useCallback,
  useEffect,
  useState,
} from 'react';
import { useStorageState } from '@/hooks/useStorageState';
import { apiService } from '@/services/apiService';

interface RefreshResponse {
  data: {
    accessToken: string;
    refreshToken: string;
  };
}

interface ProfileResponse {
  data: {
    is_officer: boolean;
  };
}

interface IAuthContext {
  session: string | null;
  isOfficer: boolean;
  login: (accessToken: string, refreshToken: string) => Promise<void>;
  logout: () => Promise<void>;
  checkAuthed: () => Promise<void>;
  refreshToken: (ignoreTimeCheck?: boolean) => Promise<boolean>;
}

export const AuthContext = createContext<IAuthContext>({
  session: null,
  isOfficer: false,
  login: async () => {},
  logout: async () => {},
  checkAuthed: async () => {},
  refreshToken: async () => false,
});

async function accessTokenIsValid(): Promise<boolean> {
  try {
    const request = await apiService.get('/api/v1/auth/is-authed');
    return request.status === 204;
  } catch {
    return false;
  }
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [[isLoadingAccess, accessTokenSession], setAccessTokenSession] =
    useStorageState('accessToken');
  const [[isLoadingRefresh, refreshTokenSession], setRefreshTokenSession] =
    useStorageState('refreshToken');
  const [lastRefreshCheck, setLastRefreshCheck] = useState<number>(Date.now());
  const [isOfficer, setIsOfficer] = useState<boolean>(false);

  const loading = isLoadingAccess || isLoadingRefresh;

  const fetchProfile = useCallback(async (): Promise<boolean> => {
    try {
      const response = await apiService.get<ProfileResponse>(
        '/api/v1/auth/profile',
      );

      if (response.status === 200) {
        setIsOfficer(Boolean(response.data.data.is_officer));
        return true;
      }

      setIsOfficer(false);
    } catch (error: any) {
      if (error?.response?.status === 401) {
        setIsOfficer(false);
      }
      return false;
    }

    return false;
  }, [setIsOfficer]);

  useEffect(() => {
    if (!loading && accessTokenSession) {
      accessTokenIsValid().then((valid) => {
        if (!valid) setAccessTokenSession(null);
      });
    }
  }, [loading, accessTokenSession, refreshTokenSession, setAccessTokenSession]);

  const login = useCallback(
    async (accessToken: string, refreshToken: string) => {
      await setAccessTokenSession(accessToken);
      await setRefreshTokenSession(refreshToken);
      await fetchProfile();
    },
    [fetchProfile, setAccessTokenSession, setRefreshTokenSession],
  );

  const logout = useCallback(async () => {
    try {
      await apiService.post('/api/v1/auth/logout');
    } catch {
      // no-op: network errors shouldn't block local logout
    }

    await setAccessTokenSession(null);
    await setRefreshTokenSession(null);
    setIsOfficer(false);
  }, [setAccessTokenSession, setRefreshTokenSession, setIsOfficer]);

  const refreshToken = useCallback(
    async (ignoreTimeCheck: boolean = false) => {
      const checkTokenEveryMs = 1000 * 5;
      const dateNow = Date.now();

      if (ignoreTimeCheck || dateNow > lastRefreshCheck + checkTokenEveryMs) {
        setLastRefreshCheck(dateNow);
        try {
          const response = await apiService.post<RefreshResponse>(
            '/api/v1/auth/refresh',
            undefined,
            refreshTokenSession
              ? { headers: { 'refresh-token': refreshTokenSession } }
              : undefined,
          );

          if (response.status === 200) {
            await setAccessTokenSession(response.data.data.accessToken);
            await setRefreshTokenSession(response.data.data.refreshToken);
            return true;
          }
        } catch {
          await setRefreshTokenSession(null);
        }
      }

      return false;
    },
    [
      lastRefreshCheck,
      refreshTokenSession,
      setAccessTokenSession,
      setRefreshTokenSession,
    ],
  );

  const checkAuthed = useCallback(async () => {
    try {
      const request = await apiService.get('/api/v1/auth/is-authed');
      if (request.status !== 204) {
        await setAccessTokenSession(null);
        setIsOfficer(false);
        if (await refreshToken(true)) {
          await checkAuthed();
        }
      } else {
        await fetchProfile();
      }
    } catch {
      await setAccessTokenSession(null);
      setIsOfficer(false);
    }
  }, [fetchProfile, refreshToken, setAccessTokenSession, setIsOfficer]);

  return (
    <AuthContext.Provider
      value={{
        session: accessTokenSession,
        isOfficer,
        login,
        logout,
        checkAuthed,
        refreshToken,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
