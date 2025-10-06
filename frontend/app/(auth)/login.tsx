import { router } from "expo-router";
import {
  useEffect,
  useRef,
  useState,
  useContext,
  type ComponentType,
} from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  Image,
  Keyboard,
  Pressable,
  View,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";

import Logo from "@/assets/images/dark-logo.png";
import { toast } from "@/components/toast";
import { AppCard, AppScreen } from "@/components/app/shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Text } from "@/components/ui/text";

import {
  Eye,
  EyeOff,
  IdCard,
  Lock,
  Shield,
  UserRound,
} from "lucide-react-native";
import { AuthContext } from "@/context/AuthContext";
import { apiService } from "@/services/apiService";

interface LoginResponse {
  status: string;
  data: {
    accessToken?: string;
    refreshToken?: string;
    mfa_token?: string;
  };
  message?: string;
}

type Role = "citizen" | "officer";

/**
 * Login screen that authenticates citizens and officers against the backend API.
 * Provides animated role switching and triggers MFA routing when required.
 *
 * @returns The login form UI.
 */
export default function Login() {
  const [tab, setTab] = useState<Role>("citizen");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const { login } = useContext(AuthContext);

  const OFFICER_ID_LENGTH = 3;
  const isOfficer = tab === "officer";

  const extractOfficerDigits = (value: string): string =>
    value.replace(/\D+/g, "").slice(0, OFFICER_ID_LENGTH);

  const formatOfficerId = (value: string): string => {
    const digits = extractOfficerDigits(value);
    return `OF-${digits}`;
  };

  const officerDigits = extractOfficerDigits(identifier);
  const citizenIdentifier = identifier.trim();
  const canContinue = isOfficer
    ? officerDigits.length === OFFICER_ID_LENGTH && password.length >= 6
    : citizenIdentifier.length > 0 && password.length >= 6;
  const passwordRef = useRef<any>(null);

  const roleAnim = useRef(new Animated.Value(0)).current;
  const formSwitchAnim = useRef(new Animated.Value(1)).current;
  const textSwitchAnim = useRef(new Animated.Value(1)).current;
  const [railW, setRailW] = useState(0);

  useEffect(() => {
    Animated.timing(roleAnim, {
      toValue: isOfficer ? 1 : 0,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();

    formSwitchAnim.setValue(0.9);
    Animated.spring(formSwitchAnim, {
      toValue: 1,
      damping: 14,
      stiffness: 160,
      mass: 0.6,
      useNativeDriver: true,
    }).start();

    textSwitchAnim.setValue(0);
    Animated.timing(textSwitchAnim, {
      toValue: 1,
      duration: 180,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [isOfficer, formSwitchAnim, roleAnim, textSwitchAnim]);

  useEffect(() => {
    setIdentifier((prev) => {
      if (isOfficer) {
        return formatOfficerId(prev);
      }
      return prev.replace(/^OF-/, "");
    });
  }, [isOfficer]);

  const tabWidth = railW > 0 ? railW / 2 : 0;
  const indicatorTX = roleAnim.interpolate({ inputRange: [0, 1], outputRange: [0, tabWidth] });
  const formOpacity = formSwitchAnim.interpolate({ inputRange: [0.9, 1], outputRange: [0.95, 1] });
  const formTranslateY = formSwitchAnim.interpolate({ inputRange: [0.9, 1], outputRange: [6, 0] });
  const labelOpacity = textSwitchAnim;
  const labelTranslateY = textSwitchAnim.interpolate({ inputRange: [0, 1], outputRange: [4, 0] });

  /**
   * Normalise the identifier before submission so the API receives consistent data.
   */
  const sanitizeIdentifier = (value: string): string => {
    return isOfficer ? formatOfficerId(value) : value.replace(/\s+/g, "");
  };

  /**
   * Submit credentials to the backend, handling MFA redirects and login persistence.
   */
  const onSignIn = async (): Promise<void> => {
    if (loading) return;
    const safeId = sanitizeIdentifier(identifier);
    if (safeId !== identifier) setIdentifier(safeId);
    try {
      setLoading(true);
      const res = await apiService.post<LoginResponse>(
        "/api/v1/auth/login",
        {
          username: safeId,
          password,
        },
      );

      if (res.data.message === "mfa_required") {
        if (res.data.data?.mfa_token) {
          toast.info("Two-factor verification required");
          router.push({
            pathname: "/mfa",
            params: {
              role: isOfficer ? "officer" : "citizen",
              token: res.data.data.mfa_token,
            },
          });
          return;
        }

        throw new Error("Missing MFA token");
      }

      const { accessToken, refreshToken } = res.data.data;

      if (!accessToken || !refreshToken) {
        throw new Error("Authentication tokens were not returned");
      }

      await login(accessToken, refreshToken);
      toast.success("Welcome back!");
      router.replace("/home");
    } catch (e: any) {
      const message = e.response?.data?.message ?? e.message ?? "Sign in failed";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const IdentifierIcon = isOfficer ? IdCard : UserRound;

  return (
    <AppScreen
      scrollComponent={KeyboardAwareScrollView}
      scrollViewProps={{
        enableOnAndroid: true,
        keyboardShouldPersistTaps: "handled",
        extraScrollHeight: 80,
        onScrollBeginDrag: Keyboard.dismiss,
      }}
      contentClassName="pb-10"
    >
      <View className="items-center gap-2 pt-6">
        <Image
          source={Logo}
          style={{ width: 96, height: 96, borderRadius: 20 }}
          resizeMode="contain"
        />
        <Text className="text-3xl font-bold text-foreground">Guardian</Text>
        <Text className="text-sm text-muted-foreground text-center">Sign in to continue</Text>
      </View>

      <Animated.View style={{ opacity: formOpacity, transform: [{ translateY: formTranslateY }] }} className="w-full">
        <AppCard className="gap-5">
          {/* Role switcher */}
          <View
            onLayout={(e) => setRailW(e.nativeEvent.layout.width)}
            className="bg-background rounded-xl border border-border p-1 overflow-hidden"
          >
              {tabWidth > 0 ? (
                <Animated.View
                  pointerEvents="none"
                  style={{
                    position: "absolute",
                    top: 2,
                    left: 2,
                    width: tabWidth - 4,
                    height: 36,
                    borderRadius: 10,
                    backgroundColor: "#0F172A",
                    transform: [{ translateX: indicatorTX }],
                  }}
                />
              ) : null}

              <View className="flex-row">
                <SegTab
                  active={!isOfficer}
                  label="Citizen"
                  icon={UserRound}
                  onPress={() => setTab("citizen")}
                />
                <SegTab
                  active={isOfficer}
                  label="Officer"
                  icon={Shield}
                  onPress={() => setTab("officer")}
                />
              </View>
            </View>

            {/* Identifier input */}
            <View className="gap-1">
              <Label nativeID="identifierLabel" className="text-xs">
                <Animated.Text
                  style={{
                    opacity: labelOpacity,
                    transform: [{ translateY: labelTranslateY }],
                  }}
                  className="text-xs text-foreground"
                >
                  {isOfficer ? "Officer ID" : "Username"}
                </Animated.Text>
              </Label>

              <View className="relative">
                <IdentifierIcon size={16} color="#94A3B8" style={{ position: "absolute", left: 12, top: 14 }} />
                <Input
                  aria-labelledby="identifierLabel"
                  value={identifier}
                  onChangeText={(text) => {
                    setIdentifier(isOfficer ? formatOfficerId(text) : text.replace(/\s+/g, ""));
                  }}
                  onBlur={() => setIdentifier((prev) => sanitizeIdentifier(prev))}
                  autoCapitalize="none"
                  autoComplete={isOfficer ? "off" : "username"}
                  keyboardType={isOfficer ? "number-pad" : "default"}
                  returnKeyType="next"
                  blurOnSubmit={false}
                  onSubmitEditing={() => passwordRef.current?.focus()}
                  placeholder={isOfficer ? "OF-123" : "username"}
                  className="bg-background h-12 rounded-xl pl-9"
                />
              </View>
              {isOfficer ? (
                <Text className="text-[11px] text-muted-foreground">Officer IDs always start with OF-.</Text>
              ) : null}
            </View>

            {/* Password input */}
            <View className="gap-1">
              <View className="flex-row items-center justify-between">
                <Label nativeID="passwordLabel" className="text-xs">
                  <Text className="text-xs text-foreground">Password</Text>
                </Label>
                <Button variant="link" onPress={() => {}} className="h-auto p-0" accessibilityRole="link">
                  <Text className="text-[11px] text-muted-foreground">Forgot your password?</Text>
                </Button>
              </View>

              <View className="relative">
                <Lock size={16} color="#94A3B8" style={{ position: "absolute", left: 12, top: 14 }} />
                <Input
                  ref={passwordRef}
                  aria-labelledby="passwordLabel"
                  value={password}
                  onChangeText={setPassword}
                  autoComplete="password"
                  returnKeyType="done"
                  onSubmitEditing={onSignIn}
                  secureTextEntry={!showPw}
                  placeholder="••••••••"
                  className="bg-background h-12 rounded-xl pl-9 pr-12"
                />
                <Pressable
                  onPress={() => setShowPw((v) => !v)}
                  accessibilityLabel={showPw ? "Hide password" : "Show password"}
                  style={{
                    position: "absolute",
                    right: 6,
                    top: 6,
                    height: 36,
                    width: 36,
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: 18,
                  }}
                  android_ripple={{ color: "rgba(0,0,0,0.08)", borderless: true }}
                >
                  {showPw ? <EyeOff size={18} color="#0F172A" /> : <Eye size={18} color="#0F172A" />}
                </Pressable>
              </View>
            </View>

            {/* Submit */}
            <Button
              onPress={onSignIn}
              size="lg"
              variant="default"
              className="mt-1 h-12 rounded-xl active:opacity-90 active:scale-95"
              disabled={!canContinue || loading}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text className="font-semibold text-primary-foreground">Sign in</Text>
              )}
            </Button>
        </AppCard>
      </Animated.View>

      <View className="items-center">
        {!isOfficer ? (
          <Button variant="link" onPress={() => router.push("/register")} className="h-auto p-0">
            <Text className="text-sm text-primary">
              Don&apos;t have an account? <Text className="underline">Sign up</Text>
            </Text>
          </Button>
        ) : (
          <Text className="text-xs text-muted-foreground text-center">
            Officer access is provisioned by your department. Contact your admin.
          </Text>
        )}
      </View>
    </AppScreen>
  );
}

/** Segmented control tab. */
function SegTab({
  active,
  label,
  icon: IconCmp,
  onPress,
}: {
  active: boolean;
  label: string;
    icon: ComponentType<{ size?: number; color?: string }>;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className="flex-1 h-9 rounded-lg"
      android_ripple={{ color: "rgba(0,0,0,0.06)", borderless: false }}
      style={{ justifyContent: "center", alignItems: "center" }}
    >
      <View className="flex-row items-center justify-center gap-1.5">
        <IconCmp size={16} color={active ? "#FFFFFF" : "#64748B"} />
        <Text className={active ? "font-semibold text-white" : "text-muted-foreground"}>
          {label}
        </Text>
      </View>
    </Pressable>
  );
}
