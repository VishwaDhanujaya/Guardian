import {
  createContext,
  PropsWithChildren,
  useCallback,
  useEffect,
  useState,
} from 'react';

import { fetchProfile, type Profile } from '@/lib/api';
import { useStorageState } from '@/hooks/useStorageState';
import { apiService } from '@/services/apiService';

interface RefreshResponse {
  data: {
    accessToken: string;
    refreshToken: string;
  };
}

interface IAuthContext {
  session: string | null;
  profile: Profile | null;
  profileLoading: boolean;
  isOfficer: boolean;
  login: (accessToken: string, refreshToken: string) => Promise<void>;
  logout: () => Promise<void>;
  checkAuthed: () => Promise<void>;
  refreshToken: (ignoreTimeCheck?: boolean) => Promise<boolean>;
  refreshProfile: (tokenOverride?: string | null) => Promise<Profile | null>;
}

export const AuthContext = createContext<IAuthContext>({
  session: null,
  profile: null,
  profileLoading: false,
  isOfficer: false,
  login: async () => {},
  logout: async () => {},
  checkAuthed: async () => {},
  refreshToken: async () => false,
  refreshProfile: async () => null,
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
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [isOfficer, setIsOfficer] = useState<boolean>(false);

  const loading = isLoadingAccess || isLoadingRefresh;

  useEffect(() => {
    if (!loading && accessTokenSession) {
      accessTokenIsValid().then((valid) => {
        if (!valid) setAccessTokenSession(null);
      });
    }
  }, [loading, accessTokenSession, refreshTokenSession, setAccessTokenSession]);

  const refreshProfile = useCallback(
    async (tokenOverride?: string | null): Promise<Profile | null> => {
      const hasToken = tokenOverride ?? accessTokenSession;
      if (!hasToken) {
        setProfile(null);
        setIsOfficer(false);
        return null;
      }

      setProfileLoading(true);
      try {
        const nextProfile = await fetchProfile();
        setProfile(nextProfile);
        setIsOfficer(nextProfile.isOfficer);
        return nextProfile;
      } finally {
        setProfileLoading(false);
      }
    },
    [accessTokenSession],
  );

  const login = useCallback(
    async (accessToken: string, refreshToken: string) => {
      await setAccessTokenSession(accessToken);
      await setRefreshTokenSession(refreshToken);
      await refreshProfile(accessToken);
    },
    [refreshProfile, setAccessTokenSession, setRefreshTokenSession],
  );

  const logout = useCallback(async () => {
    await setAccessTokenSession(null);
    await setRefreshTokenSession(null);
    setProfile(null);
    setIsOfficer(false);
  }, [setAccessTokenSession, setRefreshTokenSession]);

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
            const { accessToken: nextAccess, refreshToken: nextRefresh } =
              response.data.data;
            await setAccessTokenSession(nextAccess);
            await setRefreshTokenSession(nextRefresh);
            await refreshProfile(nextAccess).catch(() => {});
            return true;
          }
        } catch {
          await setRefreshTokenSession(null);
          setProfile(null);
          setIsOfficer(false);
        }
      }

      return false;
    },
    [
      lastRefreshCheck,
      refreshTokenSession,
      setAccessTokenSession,
      setRefreshTokenSession,
      refreshProfile,
    ],
  );

  const checkAuthed = useCallback(async () => {
    try {
      const request = await apiService.get('/api/v1/auth/is-authed');
      if (request.status !== 204) {
        await setAccessTokenSession(null);
        if (await refreshToken(true)) {
          await checkAuthed();
        }
      } else {
        await refreshProfile().catch(() => {});
      }
    } catch {
      await setAccessTokenSession(null);
      setProfile(null);
      setIsOfficer(false);
    }
  }, [refreshToken, refreshProfile, setAccessTokenSession]);

  useEffect(() => {
    if (loading) return;
    if (!accessTokenSession) {
      setProfile(null);
      setIsOfficer(false);
      return;
    }

    refreshProfile().catch(() => {});
  }, [loading, accessTokenSession, refreshProfile]);

  return (
    <AuthContext.Provider
      value={{
        session: accessTokenSession,
        profile,
        profileLoading,
        isOfficer,
        login,
        logout,
        checkAuthed,
        refreshToken,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
