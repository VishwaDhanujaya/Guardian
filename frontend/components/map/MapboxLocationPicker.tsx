import { useCallback, useEffect, useRef, useState } from "react";
import type { MutableRefObject } from "react";
import {
  ActivityIndicator,
  Keyboard,
  Modal,
  Platform,
  Pressable,
  TextInput,
  useColorScheme,
  View,
} from "react-native";
import type { WebViewMessageEvent } from "react-native-webview";
import { WebView } from "react-native-webview";
import { Image } from "expo-image";
import * as Location from "expo-location";
import { LocateFixed, MapPin, Search, X } from "lucide-react-native";

import { toast } from "@/components/toast";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Text } from "@/components/ui/text";
import {
  DEFAULT_MAPBOX_CENTER,
  buildStaticMapPreviewUrl,
  formatCoordinates,
  getMapboxAccessToken,
  MapboxLocation,
  MapboxSearchResult,
  reverseGeocodeLocation,
  searchMapboxLocations,
} from "@/lib/mapbox";

const INSETS = Platform.select({ ios: 20, android: 0, default: 0 });

type MapboxMessage =
  | { type: "move"; latitude: number; longitude: number }
  | { type: "confirm"; latitude: number; longitude: number }
  | { type: "ready" }
  | { type: "error"; message?: string };

type MapModalProps = {
  visible: boolean;
  initialLocation?: MapboxLocation | null;
  onSelect: (location: MapboxLocation) => void;
  onRequestClose: () => void;
};

type LocationFieldProps = {
  label?: string;
  value: MapboxLocation | null;
  onChange: (location: MapboxLocation | null) => void;
  placeholder?: string;
  helperText?: string;
  required?: boolean;
  allowClear?: boolean;
};

const mapHtmlTemplate = (
  token: string,
  center: MapboxLocation,
  theme: "light" | "dark",
): string => {
  const tokenLiteral = JSON.stringify(token);
  const centerLiteral = JSON.stringify([center.longitude, center.latitude]);
  const isDark = theme === "dark";
  const styleUrl = isDark ? "mapbox://styles/mapbox/dark-v11" : "mapbox://styles/mapbox/streets-v12";

  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta
      name="viewport"
      content="initial-scale=1,maximum-scale=1,user-scalable=no"
    />
    <title>Pick location</title>
    <link
      href="https://api.mapbox.com/mapbox-gl-js/v2.15.0/mapbox-gl.css"
      rel="stylesheet"
    />
    <style>
      body {
        margin: 0;
        padding: 0;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        background: ${isDark ? "#020817" : "#f8fafc"};
        color: ${isDark ? "#f8fafc" : "#0f172a"};
      }
      #map {
        position: absolute;
        top: 0;
        bottom: 0;
        width: 100%;
      }
      .marker {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -100%);
        width: 28px;
        height: 28px;
        pointer-events: none;
        background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Cpath fill='"
          +
          "%23ef4444' d='M16 2.667c-5.154 0-9.333 4.006-9.333 8.944 0 2.755 1.37 5.443 3.2 7.94 1.824 2.493 4.106 4.734 5.642 6.061a1.333 1"
          +
          ".333 0 0 0 1.81 0c1.536-1.327 3.818-3.568 5.642-6.061 1.83-2.497 3.2-5.185 3.2-7.94 0-4.938-4.179-8.944-9.333-8.944Zm0 12.777a3."
          +
          "833 3.833 0 1 1 0-7.666 3.833 3.833 0 0 1 0 7.666Z'/%3E%3C/svg%3E");
        background-size: contain;
      }
      .center-dot {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: ${isDark ? "#f8fafc" : "#0f172a"};
        box-shadow: 0 0 0 4px rgba(15, 23, 42, 0.15);
        pointer-events: none;
      }
      .instructions {
        position: absolute;
        top: 70px;
        left: 50%;
        transform: translate(-50%, -6px);
        padding: 9px 18px;
        border-radius: 999px;
        background: rgba(15, 23, 42, ${isDark ? "0.5" : "0.7"});
        backdrop-filter: blur(14px);
        color: #f8fafc;
        font-size: 13px;
        font-weight: 500;
        letter-spacing: 0.01em;
        box-shadow: 0 14px 36px rgba(15, 23, 42, 0.28);
        opacity: 0;
        pointer-events: none;
        animation: float-in 0.55s ease-out forwards, fade-away 0.7s ease-in forwards;
        animation-delay: 0s, 5s;
      }
      .confirm-button {
        position: absolute;
        bottom: 28px;
        left: 50%;
        transform: translateX(-50%);
        padding: 14px 24px;
        border: none;
        border-radius: 999px;
        background: ${isDark ? "#6366f1" : "#0f172a"};
        color: #f8fafc;
        font-size: 15px;
        font-weight: 600;
        letter-spacing: 0.01em;
        box-shadow: 0 16px 32px rgba(15, 23, 42, 0.35);
      }
      @keyframes float-in {
        from {
          opacity: 0;
          transform: translate(-50%, 4px);
        }
        to {
          opacity: 1;
          transform: translate(-50%, -6px);
        }
      }
      @keyframes fade-away {
        to {
          opacity: 0;
          transform: translate(-50%, -22px);
        }
      }
    </style>
  </head>
  <body>
    <div id="map"></div>
    <div class="marker"></div>
    <div class="center-dot"></div>
    <div class="instructions">Drag the map or use the search above</div>
    <button id="confirm" class="confirm-button">Use this location</button>

    <script src="https://api.mapbox.com/mapbox-gl-js/v2.15.0/mapbox-gl.js"></script>
    <script>
      const accessToken = ${tokenLiteral};
      const initialCenter = ${centerLiteral};
      mapboxgl.accessToken = accessToken;
      const map = new mapboxgl.Map({
        container: 'map',
        style: '${styleUrl}',
        center: initialCenter,
        zoom: 15,
      });
      map.addControl(new mapboxgl.NavigationControl({ visualizePitch: true }));

      function post(message) {
        if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
          window.ReactNativeWebView.postMessage(JSON.stringify(message));
        }
      }

      function applyCenter(lat, lng, animated, zoom) {
        const center = [lng, lat];
        const targetZoom = typeof zoom === 'number' && !Number.isNaN(zoom)
          ? zoom
          : Math.max(map.getZoom(), 15);
        if (animated) {
          map.flyTo({ center, zoom: targetZoom, speed: 1.2, essential: true });
        } else {
          map.jumpTo({ center, zoom: targetZoom });
        }
      }

      function receive(message) {
        if (!message) return;
        try {
          const payload = typeof message === 'string' ? JSON.parse(message) : message;
          if (payload?.type === 'setCenter') {
            const lat = Number(payload.latitude);
            const lng = Number(payload.longitude);
            if (Number.isFinite(lat) && Number.isFinite(lng)) {
              const animated = payload.animated !== false;
              const zoom = Number(payload.zoom);
              applyCenter(lat, lng, animated, Number.isFinite(zoom) ? zoom : undefined);
            }
          }
        } catch (error) {
          console.error('Failed to handle host message', error);
        }
      }

      window.addEventListener('message', (event) => receive(event.data));
      document.addEventListener('message', (event) => receive(event.data));

      map.on('load', () => {
        post({ type: 'ready' });
      });

      let moveTimeout = null;
      map.on('moveend', () => {
        const center = map.getCenter();
        if (moveTimeout) {
          clearTimeout(moveTimeout);
        }
        moveTimeout = setTimeout(() => {
          post({ type: 'move', latitude: center.lat, longitude: center.lng });
        }, 120);
      });

      const confirmBtn = document.getElementById('confirm');
      confirmBtn.addEventListener('click', () => {
        const center = map.getCenter();
        post({ type: 'confirm', latitude: center.lat, longitude: center.lng });
      });
    </script>
  </body>
</html>`;
};

const useLatest = <T,>(value: T): MutableRefObject<T> => {
  const ref = useRef(value);
  ref.current = value;
  return ref;
};

function MapboxLocationModal({ visible, initialLocation, onSelect, onRequestClose }: MapModalProps) {
  const colorScheme = useColorScheme() ?? "light";
  const isDarkMode = colorScheme === "dark";
  const indicatorColor = isDarkMode ? "#f8fafc" : "#0F172A";
  const [token, setToken] = useState<string | null>(null);
  const [loadingToken, setLoadingToken] = useState(false);
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [preview, setPreview] = useState<MapboxLocation>(initialLocation ?? DEFAULT_MAPBOX_CENTER);
  const previewRef = useLatest(preview);
  const [saving, setSaving] = useState(false);
  const selectRef = useLatest(onSelect);
  const closeRef = useLatest(onRequestClose);
  const [html, setHtml] = useState<string | null>(null);
  const webViewRef = useRef<WebView | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const pendingCenterRef = useRef<MapboxLocation | null>(null);
  const pendingAnimatedRef = useRef(true);
  const [requestingLocation, setRequestingLocation] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<MapboxSearchResult[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchFocused, setSearchFocused] = useState(false);
  const [searching, setSearching] = useState(false);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const sendCenterToMap = useCallback(
    (coords: MapboxLocation, animated = true) => {
      const message = JSON.stringify({
        type: "setCenter",
        latitude: coords.latitude,
        longitude: coords.longitude,
        animated,
      });
      if (mapReady && webViewRef.current) {
        webViewRef.current.postMessage(message);
      } else {
        pendingCenterRef.current = coords;
        pendingAnimatedRef.current = animated;
      }
    },
    [mapReady],
  );

  useEffect(() => {
    if (!visible) {
      setHtml(null);
      setMapReady(false);
      pendingCenterRef.current = null;
      pendingAnimatedRef.current = true;
      setLocationError(null);
      setRequestingLocation(false);
      setSearchQuery("");
      setSearchResults([]);
      setSearchError(null);
      setSearchFocused(false);
      setSearching(false);
      if (searchDebounceRef.current) {
        clearTimeout(searchDebounceRef.current);
        searchDebounceRef.current = null;
      }
      webViewRef.current = null;
      return;
    }

    let cancelled = false;
    setTokenError(null);

    if (!token) {
      setLoadingToken(true);
      getMapboxAccessToken()
        .then((value) => {
          if (cancelled) return;
          setToken(value);
        })
        .catch((error: any) => {
          console.error(error);
          if (cancelled) return;
          setTokenError(error?.message ?? "Unable to load Mapbox token");
        })
        .finally(() => {
          if (cancelled) return;
          setLoadingToken(false);
        });
    }

    return () => {
      cancelled = true;
    };
  }, [visible, token]);

  useEffect(() => {
    if (!visible) {
      return;
    }
    const effectiveLocation = initialLocation ?? DEFAULT_MAPBOX_CENTER;
    setPreview(effectiveLocation);
    if (token) {
      setMapReady(false);
      pendingCenterRef.current = null;
      pendingAnimatedRef.current = true;
      setHtml(mapHtmlTemplate(token, effectiveLocation, colorScheme === "dark" ? "dark" : "light"));
    }
  }, [visible, initialLocation, token, colorScheme]);

  const locateUser = useCallback(
    async (options?: { centerOnSuccess?: boolean }) => {
      try {
        setRequestingLocation(true);
        setLocationError(null);
        let permission = await Location.getForegroundPermissionsAsync();
        if (permission.status !== "granted") {
          permission = await Location.requestForegroundPermissionsAsync();
        }
        if (permission.status === "granted") {
          const current = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
          const coords: MapboxLocation = {
            latitude: current.coords.latitude,
            longitude: current.coords.longitude,
          };
          setPreview((prev) => ({ ...prev, ...coords }));
          if (options?.centerOnSuccess !== false) {
            sendCenterToMap(coords, true);
          }
          return coords;
        }
        const deniedMessage = "Location permission denied. You can still search manually.";
        setLocationError(deniedMessage);
        return null;
      } catch (error: any) {
        console.error(error);
        setLocationError(error?.message ?? "Unable to fetch current location");
        return null;
      } finally {
        setRequestingLocation(false);
      }
    },
    [sendCenterToMap],
  );

  useEffect(() => {
    if (!visible) {
      return;
    }

    if (!searchFocused) {
      setSearching(false);
      setSearchResults([]);
      setSearchError(null);
      return;
    }

    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
      searchDebounceRef.current = null;
    }

    const trimmed = searchQuery.trim();

    if (!token || !trimmed) {
      setSearchResults([]);
      setSearchError(null);
      setSearching(false);
      return;
    }

    setSearching(true);
    let cancelled = false;

    const timeout = setTimeout(async () => {
      try {
        const results = await searchMapboxLocations(trimmed, {
          token,
          proximity: previewRef.current,
          countries: "lk",
        });
        if (cancelled) {
          return;
        }
        setSearchResults(results);
        setSearchError(results.length === 0 ? "No matching places found." : null);
      } catch (error: any) {
        if (cancelled) {
          return;
        }
        console.error(error);
        setSearchResults([]);
        setSearchError(error?.message ?? "Search failed");
      } finally {
        if (!cancelled) {
          setSearching(false);
        }
      }
    }, 350);

    searchDebounceRef.current = timeout;

    return () => {
      cancelled = true;
      clearTimeout(timeout);
      if (searchDebounceRef.current === timeout) {
        searchDebounceRef.current = null;
      }
    };
  }, [visible, token, searchQuery, previewRef, searchFocused]);

  const handleSelectSearchResult = useCallback(
    (result: MapboxSearchResult) => {
      const coords: MapboxLocation = {
        latitude: result.latitude,
        longitude: result.longitude,
        label: result.label,
      };
      setPreview(coords);
      sendCenterToMap(coords, true);
      setSearchQuery(result.label ?? "");
      setSearchResults([]);
      setSearchError(null);
      setSearchFocused(false);
      Keyboard.dismiss();
    },
    [sendCenterToMap],
  );

  const handleUseMyLocation = useCallback(() => {
    setSearchFocused(false);
    setSearchQuery("");
    setSearchResults([]);
    setSearchError(null);
    locateUser({ centerOnSuccess: true }).catch((error) => {
      console.error("Failed to locate user on demand", error);
    });
    Keyboard.dismiss();
  }, [locateUser]);

  const shouldShowSearchResults =
    searchFocused &&
    (searchQuery.trim().length > 0 || searching || searchResults.length > 0 || Boolean(searchError));

  const handleMessage = useCallback(
    async (event: WebViewMessageEvent) => {
      try {
        const payload = JSON.parse(event.nativeEvent.data) as MapboxMessage;
        if (payload?.type === "ready") {
          setMapReady(true);
          if (pendingCenterRef.current && webViewRef.current) {
            const coords = pendingCenterRef.current;
            const animated = pendingAnimatedRef.current;
            pendingCenterRef.current = null;
            pendingAnimatedRef.current = true;
            webViewRef.current.postMessage(
              JSON.stringify({
                type: "setCenter",
                latitude: coords.latitude,
                longitude: coords.longitude,
                animated,
              }),
            );
          }
          return;
        }
        if (payload?.type === "error") {
          if (payload.message) {
            toast.error(payload.message);
          }
          return;
        }
        if (payload?.type === "move" && typeof payload.latitude === "number" && typeof payload.longitude === "number") {
          setPreview((prev) => ({
            ...prev,
            latitude: payload.latitude,
            longitude: payload.longitude,
          }));
        }
        if (payload?.type === "confirm" && typeof payload.latitude === "number" && typeof payload.longitude === "number") {
          if (!token) {
            toast.error("Map token missing. Please try again.");
            return;
          }
          try {
            setSaving(true);
            const label = await reverseGeocodeLocation(payload.latitude, payload.longitude, token);
            selectRef.current({ latitude: payload.latitude, longitude: payload.longitude, label });
            closeRef.current();
          } catch (error: any) {
            console.error(error);
            toast.error(error?.message ?? "Failed to confirm location");
          } finally {
            setSaving(false);
          }
        }
      } catch (error) {
        console.error("Failed to parse map message", error);
      }
    },
    [token, selectRef, closeRef],
  );

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onRequestClose}>
      <View className="flex-1 bg-background">
        <View className="flex-row items-center justify-between border-b border-border px-5" style={{ paddingTop: INSETS ?? 0, paddingBottom: 12 }}>
          <Text className="text-base font-semibold text-foreground">Choose location</Text>
          <Pressable
            onPress={() => {
              if (saving) return;
              onRequestClose();
            }}
            className="h-9 w-9 items-center justify-center rounded-full bg-muted"
          >
            <X size={18} color={indicatorColor} />
          </Pressable>
        </View>
        <View className="flex-1 bg-background">
          {loadingToken ? (
            <View className="flex-1 items-center justify-center">
              <ActivityIndicator size="large" color={indicatorColor} />
              <Text className="mt-3 text-sm text-muted-foreground">Loading map…</Text>
            </View>
          ) : tokenError ? (
            <View className="flex-1 items-center justify-center gap-3 px-6">
              <Text className="text-center text-sm text-muted-foreground">{tokenError}</Text>
              <Button
                variant="secondary"
                onPress={() => {
                  setTokenError(null);
                  setToken(null);
                }}
              >
                <Text className="text-sm font-medium text-foreground">Retry</Text>
              </Button>
            </View>
          ) : html ? (
            <View style={{ flex: 1 }}>
              <WebView
                ref={webViewRef}
                source={{ html }}
                onMessage={handleMessage}
                style={{ flex: 1 }}
              />
              <View pointerEvents="box-none" className="absolute inset-0">
                <View
                  pointerEvents="box-none"
                  style={{ paddingTop: (INSETS ?? 0) + 12 }}
                  className="gap-3 px-5"
                >
                  <View className="relative h-11 flex-row items-center overflow-hidden rounded-full border border-border/70 bg-background/95 pl-10 pr-4 shadow-lg shadow-black/20">
                    <Search
                      size={16}
                      color={isDarkMode ? "#cbd5f5" : "#475569"}
                      style={{ position: "absolute", left: 16, top: 14, opacity: 0.8 }}
                    />
                    <TextInput
                      value={searchQuery}
                      onChangeText={setSearchQuery}
                      placeholder="Search for a place"
                      placeholderTextColor={isDarkMode ? "#94a3b8" : "#64748b"}
                      returnKeyType="search"
                      autoCapitalize="none"
                      autoCorrect={false}
                      onFocus={() => setSearchFocused(true)}
                      onBlur={() => setSearchFocused(false)}
                      style={{
                        flex: 1,
                        color: isDarkMode ? "#f8fafc" : "#0F172A",
                        fontSize: 14,
                        fontWeight: "600",
                        paddingVertical: 0,
                      }}
                    />
                    {searching ? (
                      <ActivityIndicator size="small" color={indicatorColor} style={{ marginLeft: 8 }} />
                    ) : null}
                  </View>
                  {shouldShowSearchResults ? (
                    <View className="max-h-60 overflow-hidden rounded-3xl border border-border/70 bg-background/98 shadow-2xl shadow-black/20">
                      {searching ? (
                        <View className="items-center justify-center px-4 py-6">
                          <ActivityIndicator size="small" color={indicatorColor} />
                          <Text className="mt-2 text-xs text-muted-foreground">Searching…</Text>
                        </View>
                      ) : searchResults.length > 0 ? (
                        searchResults.map((result) => (
                          <Pressable
                            key={result.id}
                            onPress={() => handleSelectSearchResult(result)}
                            className="border-b border-border/60 px-4 py-3 last:border-b-0"
                          >
                            <Text className="text-sm font-medium text-foreground">{result.label}</Text>
                          </Pressable>
                        ))
                      ) : (
                        <View className="px-4 py-3">
                          <Text className="text-xs text-muted-foreground">
                            {searchError ?? "No matching places found."}
                          </Text>
                        </View>
                      )}
                    </View>
                  ) : null}
                  <View className="flex-row">
                    <Pressable
                      onPress={() => {
                        if (requestingLocation) return;
                        handleUseMyLocation();
                      }}
                      className="flex-1 flex-row items-center justify-center gap-2 rounded-full bg-primary px-4 py-3 shadow-lg shadow-black/25"
                      android_ripple={{ color: "rgba(255,255,255,0.28)", borderless: false }}
                    >
                      {requestingLocation ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <LocateFixed size={16} color="#FFFFFF" />
                      )}
                      <Text className="text-xs font-semibold text-primary-foreground">
                        {requestingLocation ? "Finding your location…" : "Use my location"}
                      </Text>
                    </Pressable>
                  </View>
                </View>
              </View>
            </View>
          ) : (
            <View className="flex-1 items-center justify-center">
              <ActivityIndicator size="small" color={indicatorColor} />
            </View>
          )}
        </View>
        <View className="border-t border-border bg-background px-5 py-3">
          <Text className="text-xs text-muted-foreground">
            {formatCoordinates(preview.latitude, preview.longitude)}
            {requestingLocation ? " · Locating you…" : ""}
          </Text>
          {locationError ? (
            <Text className="mt-1 text-[11px] text-destructive/80">{locationError}</Text>
          ) : null}
        </View>
        {saving ? (
          <View className="absolute inset-0 z-10 items-center justify-center bg-background/80">
            <ActivityIndicator size="large" color={indicatorColor} />
            <Text className="mt-3 text-sm text-muted-foreground">Saving location…</Text>
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

/**
 * Form field wrapper for selecting and previewing a Mapbox location with static map imagery.
 */
export function MapboxLocationField({
  label = "Location",
  value,
  onChange,
  placeholder = "Tap to choose on map",
  helperText,
  required,
  allowClear,
}: LocationFieldProps) {
  const [open, setOpen] = useState(false);
  const appearance = useColorScheme() ?? "light";
  const iconColor = appearance === "dark" ? "#e2e8f0" : "#0F172A";
  const previewIndicatorColor = appearance === "dark" ? "#f8fafc" : "#0F172A";
  const [mapPreviewUrl, setMapPreviewUrl] = useState<string | null>(null);
  const [mapPreviewLoading, setMapPreviewLoading] = useState(false);
  const [mapPreviewError, setMapPreviewError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    if (!value) {
      setMapPreviewUrl(null);
      setMapPreviewError(null);
      setMapPreviewLoading(false);
      return () => {
        cancelled = true;
      };
    }

    setMapPreviewLoading(true);
    setMapPreviewError(null);

    getMapboxAccessToken()
      .then((token) => {
        if (cancelled) return;
        const url = buildStaticMapPreviewUrl(value.latitude, value.longitude, token, {
          width: 640,
          height: 360,
          theme: "monochrome",
        });
        setMapPreviewUrl(url);
      })
      .catch((error: any) => {
        console.error(error);
        if (cancelled) return;
        setMapPreviewUrl(null);
        setMapPreviewError("Unable to load map preview");
      })
      .finally(() => {
        if (!cancelled) {
          setMapPreviewLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [value?.latitude, value?.longitude, appearance]);

  const onConfirm = useCallback(
    (location: MapboxLocation) => {
      onChange(location);
    },
    [onChange],
  );

  const helper = helperText ?? (required ? "Required field" : "We'll capture the exact coordinates");
  const description = value?.label ?? placeholder;

  const subtitle = value
    ? formatCoordinates(value.latitude, value.longitude)
    : helper;

  return (
    <View className="gap-2">
      {label ? (
        <Label className="text-xs font-semibold text-muted-foreground">
          {label}
          {required ? "*" : ""}
        </Label>
      ) : null}
      <Pressable
        onPress={() => setOpen(true)}
        className="flex-row items-center gap-3 rounded-2xl border border-border bg-background/60 px-4 py-3"
        android_ripple={{ color: "rgba(15,23,42,0.08)" }}
      >
        <MapPin size={18} color={iconColor} />
        <View className="flex-1">
          <Text className="text-sm font-medium text-foreground">{description}</Text>
          <Text className="text-[11px] text-muted-foreground">{subtitle}</Text>
        </View>
      </Pressable>
      {allowClear && value ? (
        <View className="flex-row">
          <Pressable
            onPress={() => onChange(null)}
            className="rounded-full bg-muted/60 px-3 py-1"
            android_ripple={{ color: "rgba(15,23,42,0.08)", borderless: false }}
          >
            <Text className="text-[11px] font-medium text-muted-foreground">Clear location</Text>
          </Pressable>
        </View>
      ) : null}
      {value ? (
        <View className="overflow-hidden rounded-2xl border border-border bg-muted/20">
          {mapPreviewUrl ? (
            <View style={{ height: 180, position: "relative" }}>
              <Image
                source={{ uri: mapPreviewUrl }}
                style={{ width: "100%", height: 180 }}
                contentFit="cover"
                transition={200}
              />
              <View className="absolute bottom-3 left-3 rounded-full bg-background/90 px-3 py-1">
                <Text className="text-[11px] text-foreground">
                  {value.label ?? formatCoordinates(value.latitude, value.longitude)}
                </Text>
              </View>
            </View>
          ) : mapPreviewLoading ? (
            <View className="h-40 items-center justify-center bg-muted/40">
              <ActivityIndicator size="small" color={previewIndicatorColor} />
              <Text className="mt-2 text-[11px] text-muted-foreground">Loading map preview…</Text>
            </View>
          ) : (
            <View className="h-32 items-center justify-center bg-muted/30 px-4">
              <Text className="text-center text-[11px] text-muted-foreground">
                {mapPreviewError ?? "Map preview unavailable."}
              </Text>
            </View>
          )}
        </View>
      ) : null}
      <MapboxLocationModal
        visible={open}
        onRequestClose={() => setOpen(false)}
        onSelect={(loc) => {
          onConfirm(loc);
          setOpen(false);
        }}
        initialLocation={value ?? undefined}
      />
    </View>
  );
}

export type { MapboxLocation };
