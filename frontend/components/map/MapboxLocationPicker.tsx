import { useCallback, useEffect, useRef, useState } from "react";
import type { MutableRefObject } from "react";
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  useColorScheme,
  View,
} from "react-native";
import type { WebViewMessageEvent } from "react-native-webview";
import { WebView } from "react-native-webview";
import { MapPin, X } from "lucide-react-native";

import { toast } from "@/components/toast";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Text } from "@/components/ui/text";
import {
  DEFAULT_MAPBOX_CENTER,
  formatCoordinates,
  getMapboxAccessToken,
  MapboxLocation,
  reverseGeocodeLocation,
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
        background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Cpath fill='%23ef4444' d='M16 2.667c-5.154 0-9.333 4.006-9.333 8.944 0 2.755 1.37 5.443 3.2 7.94 1.824 2.493 4.106 4.734 5.642 6.061a1.333 1.333 0 0 0 1.81 0c1.536-1.327 3.818-3.568 5.642-6.061 1.83-2.497 3.2-5.185 3.2-7.94 0-4.938-4.179-8.944-9.333-8.944Zm0 12.777a3.833 3.833 0 1 1 0-7.666 3.833 3.833 0 0 1 0 7.666Z'/%3E%3C/svg%3E");
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
        top: 12px;
        left: 50%;
        transform: translateX(-50%);
        padding: 8px 14px;
        border-radius: 999px;
        background: rgba(15, 23, 42, ${isDark ? "0.6" : "0.8"});
        color: #f8fafc;
        font-size: 13px;
        letter-spacing: 0.01em;
        box-shadow: 0 10px 24px rgba(15, 23, 42, 0.25);
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
    </style>
  </head>
  <body>
    <div id="map"></div>
    <div class="marker"></div>
    <div class="center-dot"></div>
    <div class="instructions">Drag the map to position the pin</div>
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
  const [token, setToken] = useState<string | null>(null);
  const [loadingToken, setLoadingToken] = useState(false);
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [preview, setPreview] = useState<MapboxLocation>(initialLocation ?? DEFAULT_MAPBOX_CENTER);
  const [saving, setSaving] = useState(false);
  const selectRef = useLatest(onSelect);
  const closeRef = useLatest(onRequestClose);
  const [html, setHtml] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) {
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
      setHtml(mapHtmlTemplate(token, effectiveLocation, colorScheme === "dark" ? "dark" : "light"));
    }
  }, [visible, initialLocation, token, colorScheme]);

  const handleMessage = useCallback(
    async (event: WebViewMessageEvent) => {
      try {
        const payload = JSON.parse(event.nativeEvent.data) as MapboxMessage;
        if (payload?.type === "move" && typeof payload.latitude === "number" && typeof payload.longitude === "number") {
          setPreview({ latitude: payload.latitude, longitude: payload.longitude });
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
            <X size={18} color="#0F172A" />
          </Pressable>
        </View>
        <View className="flex-1 bg-background">
          {loadingToken ? (
            <View className="flex-1 items-center justify-center">
              <ActivityIndicator size="large" color="#0F172A" />
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
            <WebView source={{ html }} onMessage={handleMessage} style={{ flex: 1 }} />
          ) : (
            <View className="flex-1 items-center justify-center">
              <ActivityIndicator size="small" color="#0F172A" />
            </View>
          )}
        </View>
        <View className="border-t border-border bg-background px-5 py-3">
          <Text className="text-xs text-muted-foreground">{formatCoordinates(preview.latitude, preview.longitude)}</Text>
        </View>
        {saving ? (
          <View className="absolute inset-0 z-10 items-center justify-center bg-background/80">
            <ActivityIndicator size="large" color="#0F172A" />
            <Text className="mt-3 text-sm text-muted-foreground">Saving location…</Text>
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

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
        <MapPin size={18} color="#0F172A" />
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
