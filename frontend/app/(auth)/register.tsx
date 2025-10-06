import { router } from "expo-router";
import { useRef, useState } from "react";
import { ActivityIndicator, Animated, Image, Keyboard, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";

import Logo from "@/assets/images/dark-logo.png";
import { toast } from "@/components/toast";
import { AppCard, AppScreen } from "@/components/app/shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Text } from "@/components/ui/text";
import { Lock, Mail, UserRound } from "lucide-react-native";
import { apiService } from "@/services/apiService";
import useMountAnimation from "@/hooks/useMountAnimation";

/**
 * Citizen account registration screen that posts the form to the backend API.
 * Performs light validation and redirects to login after a successful signup.
 *
 * @returns The registration form UI.
 */
export default function Register() {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);

  const lastNameRef = useRef<any>(null);
  const usernameRef = useRef<any>(null);
  const emailRef = useRef<any>(null);
  const passwordRef = useRef<any>(null);
  const confirmRef = useRef<any>(null);

  const canSubmit =
    firstName.trim().length > 1 &&
    lastName.trim().length > 1 &&
    username.trim().length > 2 &&
    email.trim().length > 3 &&
    password.length >= 6 &&
    confirm === password;

  /**
   * Submit the registration payload to the backend and handle success or failure.
   */
  const onSignUp = async (): Promise<void> => {
    if (!canSubmit || loading) return;
    try {
      setLoading(true);
      await apiService.post("/api/v1/auth/register", {
        first_name: sanitize(firstName),
        last_name: sanitize(lastName),
        username: sanitize(username),
        email: sanitize(email),
        password,
      });
      toast.success("Account created. Please sign in.");
      router.replace("/login");
    } catch (e: any) {
      const message = e.response?.data?.message ?? e.message ?? "Registration failed";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const { value: formAnim } = useMountAnimation({
    damping: 14,
    stiffness: 160,
    mass: 0.6,
  });

  const formOpacity = formAnim.interpolate({ inputRange: [0.9, 1], outputRange: [0.95, 1] });
  const formTranslateY = formAnim.interpolate({ inputRange: [0.9, 1], outputRange: [6, 0] });

  /**
   * Normalise input before submission to trim and collapse whitespace.
   */
  const sanitize = (v: string): string => v.trim().replace(/\s+/g, " ");

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
        <Text className="text-3xl font-bold text-foreground">Create account</Text>
        <Text className="text-sm text-muted-foreground text-center">Citizen sign up</Text>
      </View>

      <Animated.View style={{ opacity: formOpacity, transform: [{ translateY: formTranslateY }] }} className="w-full">
        <AppCard className="gap-4">
          <View className="gap-1">
            <Label nativeID="firstNameLabel" className="text-xs">
              <Text className="text-xs text-foreground">First name</Text>
            </Label>
              <View className="relative">
                <UserRound size={16} color="#94A3B8" style={{ position: "absolute", left: 12, top: 14 }} />
                <Input
                  aria-labelledby="firstNameLabel"
                  value={firstName}
                  onChangeText={setFirstName}
                  onBlur={() => setFirstName((v) => sanitize(v))}
                  placeholder="Alex"
                  returnKeyType="next"
                  blurOnSubmit={false}
                  onSubmitEditing={() => lastNameRef.current?.focus()}
                  className="bg-background h-12 rounded-xl pl-9"
                />
              </View>
            </View>

          <View className="gap-1">
            <Label nativeID="lastNameLabel" className="text-xs">
              <Text className="text-xs text-foreground">Last name</Text>
            </Label>
              <View className="relative">
                <UserRound size={16} color="#94A3B8" style={{ position: "absolute", left: 12, top: 14 }} />
                <Input
                  ref={lastNameRef}
                  aria-labelledby="lastNameLabel"
                  value={lastName}
                  onChangeText={setLastName}
                  onBlur={() => setLastName((v) => sanitize(v))}
                  placeholder="Johnson"
                  returnKeyType="next"
                  blurOnSubmit={false}
                  onSubmitEditing={() => usernameRef.current?.focus()}
                  className="bg-background h-12 rounded-xl pl-9"
                />
              </View>
            </View>

          <View className="gap-1">
            <Label nativeID="usernameLabel" className="text-xs">
              <Text className="text-xs text-foreground">Username</Text>
            </Label>
              <View className="relative">
                <UserRound size={16} color="#94A3B8" style={{ position: "absolute", left: 12, top: 14 }} />
                <Input
                  ref={usernameRef}
                  aria-labelledby="usernameLabel"
                  value={username}
                  onChangeText={setUsername}
                  onBlur={() => setUsername((v) => sanitize(v))}
                  autoCapitalize="none"
                  placeholder="alexj"
                  returnKeyType="next"
                  blurOnSubmit={false}
                  onSubmitEditing={() => emailRef.current?.focus()}
                  className="bg-background h-12 rounded-xl pl-9"
                />
              </View>
            </View>

          <View className="gap-1">
            <Label nativeID="emailLabel" className="text-xs">
              <Text className="text-xs text-foreground">Email</Text>
            </Label>
              <View className="relative">
                <Mail size={16} color="#94A3B8" style={{ position: "absolute", left: 12, top: 14 }} />
                <Input
                  ref={emailRef}
                  aria-labelledby="emailLabel"
                  value={email}
                  onChangeText={setEmail}
                  onBlur={() => setEmail((v) => sanitize(v))}
                  autoCapitalize="none"
                  autoComplete="email"
                  keyboardType="email-address"
                  placeholder="m@example.com"
                  returnKeyType="next"
                  blurOnSubmit={false}
                  onSubmitEditing={() => passwordRef.current?.focus()}
                  className="bg-background h-12 rounded-xl pl-9"
                />
              </View>
            </View>

          <View className="gap-1">
            <Label nativeID="passwordLabel" className="text-xs">
              <Text className="text-xs text-foreground">Password</Text>
            </Label>
              <View className="relative">
                <Lock size={16} color="#94A3B8" style={{ position: "absolute", left: 12, top: 14 }} />
                <Input
                  ref={passwordRef}
                  aria-labelledby="passwordLabel"
                  value={password}
                  onChangeText={setPassword}
                  autoComplete="password-new"
                  secureTextEntry={!showPw}
                  placeholder="••••••••"
                  returnKeyType="next"
                  blurOnSubmit={false}
                  onSubmitEditing={() => confirmRef.current?.focus()}
                  className="bg-background h-12 rounded-xl pl-9"
                />
              </View>
            </View>

          <View className="gap-1">
            <Label nativeID="confirmLabel" className="text-xs">
              <Text className="text-xs text-foreground">Confirm password</Text>
            </Label>
              <View className="relative">
                <Lock size={16} color="#94A3B8" style={{ position: "absolute", left: 12, top: 14 }} />
                <Input
                  ref={confirmRef}
                  aria-labelledby="confirmLabel"
                  value={confirm}
                  onChangeText={setConfirm}
                  autoComplete="password-new"
                  secureTextEntry={!showPw}
                  placeholder="••••••••"
                  returnKeyType="done"
                  onSubmitEditing={onSignUp}
                  className="bg-background h-12 rounded-xl pl-9"
                />
              </View>

              {/* Password visibility toggle */}
              <View className="items-end mt-1">
                <Button
                  variant="link"
                  onPress={() => setShowPw((v) => !v)}
                  className="h-auto p-0"
                  accessibilityLabel={showPw ? "Hide password" : "Show password"}
                >
                  <Text className="text-xs text-primary">
                    {showPw ? "Hide password" : "Show password"}
                  </Text>
                </Button>
              </View>
            </View>

            {/* Submit */}
            <Button
              onPress={onSignUp}
              size="lg"
              variant="default"
              className="mt-1 h-12 rounded-xl"
              disabled={!canSubmit || loading}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text className="font-semibold text-primary-foreground">Create account</Text>
              )}
            </Button>
        </AppCard>
      </Animated.View>

      <View className="items-center">
        <Button variant="link" onPress={() => router.replace("/login")} className="h-auto p-0">
          <Text className="text-sm text-primary">Back to login</Text>
        </Button>
      </View>
    </AppScreen>
  );
}
