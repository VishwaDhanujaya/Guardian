# Minimal Template

This is a [React Native](https://reactnative.dev/) project built with [Expo](https://expo.dev/) and [React Native Reusables](https://reactnativereusables.com).

It was initialized using the following command:

```bash
npx react-native-reusables/cli@latest init -t .
```

## Recent Updates

- Refined the color palette for improved contrast while retaining existing tokens.
- Simplified the citizen safety alerts preview by removing category filters.
- Added a username field to the citizen sign-up flow.

## Getting Started

To run the development server:

```bash
    npm run dev
    # or
    yarn dev
    # or
    pnpm dev
    # or
    bun dev
```

This will start the Expo Dev Server. Open the app in:

- **iOS**: press `i` to launch in the iOS simulator _(Mac only)_
- **Android**: press `a` to launch in the Android emulator
- **Web**: press `w` to run in a browser

You can also scan the QR code using the [Expo Go](https://expo.dev/go) app on your device. This project fully supports running in Expo Go for quick testing on physical devices.

> The start script automatically detects your computer's local IP address and
> shares it with Expo so phones on the same network can reach the backend API.
> Set `GUARDIAN_API_HOST` to force a specific host or `EXPO_PUBLIC_API_URL` to
> supply a fully-qualified URL.

### Backend API

This frontend expects a backend API base URL provided via the `EXPO_PUBLIC_API_URL` environment variable. The startup script sets this automatically based on your local network configuration, but you can override it manually:

```bash
export GUARDIAN_API_HOST="192.168.1.100" # or set EXPO_PUBLIC_API_URL directly
npm run dev
```

If the variable is not set when bundling a production build, the app will fail to boot. Always provide a reachable backend URL for release builds.

## Build an Android APK

The project ships with an [EAS Build](https://docs.expo.dev/build/introduction/) configuration that produces installable APKs for testing on physical devices:

```bash
cd frontend
npx expo install expo-dev-client # first time only, ensures native deps are synced
npx eas build -p android --profile preview
```

The `preview` profile creates an unsigned APK stored in the Expo dashboard. Download it from the build logs or run with the `--local` flag to build entirely on your machine:

```bash
npx eas build -p android --profile preview --local
```

Before running a production build, update `EXPO_PUBLIC_API_URL` (or the corresponding secret in Expo) to point at your deployed backend.

## Adding components

You can add more reusable components using the CLI:

```bash
npx react-native-reusables/cli@latest add [...components]
```

> e.g. `npx react-native-reusables/cli@latest add input textarea`

If you don't specify any component names, you'll be prompted to select which components to add interactively. Use the `--all` flag to install all available components at once.

## Project Features

- ⚛️ Built with [Expo Router](https://expo.dev/router)
- 🎨 Styled with [Tailwind CSS](https://tailwindcss.com/) via [Nativewind](https://www.nativewind.dev/)
- 📦 UI powered by [React Native Reusables](https://github.com/founded-labs/react-native-reusables)
- 🚀 New Architecture enabled
- 🔥 Edge to Edge enabled
- 📱 Runs on iOS, Android, and Web

## Learn More

To dive deeper into the technologies used:

- [React Native Docs](https://reactnative.dev/docs/getting-started)
- [Expo Docs](https://docs.expo.dev/)
- [Nativewind Docs](https://www.nativewind.dev/)
- [React Native Reusables](https://reactnativereusables.com)

## Deploy with EAS

The easiest way to deploy your app is with [Expo Application Services (EAS)](https://expo.dev/eas).

- [EAS Build](https://docs.expo.dev/build/introduction/)
- [EAS Updates](https://docs.expo.dev/eas-update/introduction/)
- [EAS Submit](https://docs.expo.dev/submit/introduction/)

---

If you enjoy using React Native Reusables, please consider giving it a ⭐ on [GitHub](https://github.com/founded-labs/react-native-reusables). Your support means a lot!
