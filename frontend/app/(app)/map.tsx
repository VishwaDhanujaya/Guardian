import { useCallback, useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';

import { AppCard, AppScreen, ScreenHeader } from '@/components/app/shell';
import { Text } from '@/components/ui/text';
import MapboxGL, { isMapboxConfigured } from '@/lib/mapbox';

import { Map as MapIcon } from 'lucide-react-native';

const DEFAULT_CENTER: [number, number] = [-73.985664, 40.748514];

export default function CommunityMapScreen() {
  const [mapLoaded, setMapLoaded] = useState(false);

  const handleBack = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/home');
    }
  }, []);

  const handleMapLoaded = useCallback(() => {
    setMapLoaded(true);
  }, []);

  const isWeb = Platform.OS === 'web';

  return (
    <AppScreen scroll={false} contentClassName="flex-1">
      <ScreenHeader
        title="Community map"
        subtitle="Visualise incidents, alerts, and resources"
        onBack={handleBack}
        icon={MapIcon}
      />

      <AppCard className="flex-1 overflow-hidden" style={styles.mapCard}>
        {isWeb ? (
          <View style={styles.message}>
            <Text className="text-center text-sm text-muted-foreground">
              The interactive map is currently available on iOS and Android builds.
              Use a native development client or production build to explore the map experience.
            </Text>
          </View>
        ) : !isMapboxConfigured ? (
          <View style={styles.message}>
            <Text className="text-center text-sm text-muted-foreground">
              Mapbox is not configured yet. Set the EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN environment variable
              before starting the app to enable the interactive map.
            </Text>
          </View>
        ) : (
          <View style={styles.mapWrapper}>
            <MapboxGL.MapView
              style={styles.map}
              styleURL={MapboxGL.StyleURL.Street}
              compassEnabled
              logoEnabled={false}
              onDidFinishLoadingMap={handleMapLoaded}
            >
              <MapboxGL.Camera
                centerCoordinate={DEFAULT_CENTER}
                zoomLevel={12}
                animationMode="flyTo"
                animationDuration={0}
              />

              <MapboxGL.PointAnnotation id="guardian-default" coordinate={DEFAULT_CENTER}>
                <View style={styles.annotation} />
              </MapboxGL.PointAnnotation>
            </MapboxGL.MapView>

            {!mapLoaded ? (
              <View style={styles.loadingOverlay} pointerEvents="none">
                <ActivityIndicator size="small" />
                <Text className="mt-2 text-xs text-muted-foreground">Loading map…</Text>
              </View>
            ) : null}
          </View>
        )}
      </AppCard>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  mapCard: {
    padding: 0,
  },
  mapWrapper: {
    flex: 1,
    minHeight: 320,
  },
  map: {
    flex: 1,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(248, 250, 252, 0.85)',
  },
  message: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  annotation: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#2563EB',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    shadowColor: '#0F172A',
    shadowOpacity: 0.3,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
});
