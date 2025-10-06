import { router } from "expo-router";
import { useEffect, useContext } from "react";
import { ActivityIndicator, InteractionManager, View } from "react-native";
import { AuthContext } from "@/context/AuthContext";

/**
 * Splash screen that decides whether to route to the auth flow or the app shell.
 * Waits for initial interactions to settle so navigation runs after mounting.
 *
 * @returns A placeholder view while navigation occurs.
 */
export default function Index() {
  const { session } = useContext(AuthContext);

  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => {
      router.replace(session ? "/home" : "/login");
    });
    return () => task.cancel();
  }, [session]);

  return (
    <View
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#FFFFFF",
      }}
    >
      <ActivityIndicator />
    </View>
  );
}
