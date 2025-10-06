import { ToastOverlay } from "@/components/toast";
import { AuthProvider } from "@/context/AuthContext";
import { PortalHost } from "@rn-primitives/portal";
import { Slot } from "expo-router";
import { SafeAreaView, StatusBar } from "react-native";
import "../global.css";

/**
 * Root application layout that wires global providers and overlay hosts.
 * Applies a light safe-area container and renders the routed content.
 *
 * @returns The root layout tree shared by every screen.
 */
export default function RootLayout() {
  return (
    <>
      <StatusBar barStyle="dark-content" />
      <AuthProvider>
        <SafeAreaView style={{ flex: 1, backgroundColor: "#FFFFFF" }}>
          <Slot />
        </SafeAreaView>
      </AuthProvider>

      <ToastOverlay />
      <PortalHost />
    </>
  );
}
