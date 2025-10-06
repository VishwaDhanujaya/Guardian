import { router } from "expo-router";
import { useEffect, useContext } from "react";
import { ActivityIndicator, InteractionManager, View } from "react-native";
import { AuthContext } from "@/context/AuthContext";

/**
 * Landing screen that waits for initial interactions before routing to login or home.
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
