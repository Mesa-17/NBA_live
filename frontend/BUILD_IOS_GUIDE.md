# Building NBA Live Tracker for iOS (Real Push Notifications)

## Why You Need a Development Build

Expo Go does **NOT** support push notifications (as of SDK 53). To get real push notifications when the app is in the background, you need to create a **development build** or **production build**.

## Prerequisites

1. **Apple Developer Account** ($99/year) - Required for push notifications
2. **macOS computer** - Required for iOS builds
3. **Xcode** installed from the Mac App Store
4. **EAS CLI** installed globally:
   ```bash
   npm install -g eas-cli
   ```

## Step-by-Step Guide

### 1. Login to EAS

```bash
cd /app/frontend
eas login
```

### 2. Configure EAS Build

Create or update `eas.json`:

```json
{
  "cli": {
    "version": ">= 5.0.0"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "ios": {
        "simulator": false
      }
    },
    "preview": {
      "distribution": "internal",
      "ios": {
        "simulator": false
      }
    },
    "production": {}
  },
  "submit": {
    "production": {}
  }
}
```

### 3. Configure Push Notifications

The app.json already has the necessary configuration:

```json
{
  "expo": {
    "ios": {
      "infoPlist": {
        "UIBackgroundModes": ["remote-notification"]
      }
    },
    "plugins": [
      ["expo-notifications", {
        "sounds": [],
        "icon": "./assets/images/icon.png",
        "color": "#667eea"
      }]
    ]
  }
}
```

### 4. Build for iOS Device

```bash
# Create a development build for iOS device
eas build --platform ios --profile development

# Or create a preview build for internal testing
eas build --platform ios --profile preview
```

### 5. Install on Your Device

After the build completes:

1. **Development Build**: Download and install via QR code from the EAS dashboard
2. **Preview Build**: Use TestFlight for internal distribution

### 6. Configure Push Credentials

When building, EAS will ask for push notification credentials:
- Select **"Let EAS handle it"** to automatically create Apple Push Notification keys

## Alternative: Local Development Build

If you have a Mac with Xcode:

```bash
# Generate native iOS project
npx expo prebuild --platform ios

# Open in Xcode
open ios/*.xcworkspace

# Build and run on your connected device from Xcode
```

## Testing Push Notifications

Once the app is installed on your device:

1. Open the app
2. Allow notification permissions when prompted
3. Go to a **LIVE game** (dark card with LIVE badge)
4. Tap **Players** tab
5. Track a player by tapping the bell icon
6. Minimize the app (put it in background)
7. When the tracked player scores, you'll receive a push notification!

## Troubleshooting

### No notifications received?
- Ensure you've granted notification permissions in iOS Settings
- Check that the player is actually tracked (bell icon should be filled)
- The player must score a NEW basket (not replay of old events)

### Build fails?
- Ensure you have a valid Apple Developer account
- Run `eas credentials` to check/reset credentials
- Check the build logs in the EAS dashboard

## Current Limitations

- Push notifications only work on **real iOS devices**, not simulators
- The app must be built with EAS, not run via Expo Go
- Background fetch is limited by iOS battery optimization

## Support

For more details, see:
- [Expo Push Notifications](https://docs.expo.dev/push-notifications/overview/)
- [EAS Build](https://docs.expo.dev/build/introduction/)
- [Development Builds](https://docs.expo.dev/develop/development-builds/introduction/)
