# Building NBA Live Tracker for iOS

## FREE Option: Run on Your Own iPhone (No $99 Required!)

You can run this app on your personal iPhone **for free** using Xcode with a free Apple ID. 

### Requirements:
- **Mac computer** with Xcode installed
- **iPhone** connected via USB cable
- **Free Apple ID** (any iCloud account works)

### Steps:

```bash
# 1. Navigate to frontend folder
cd /app/frontend

# 2. Generate native iOS project
npx expo prebuild --platform ios

# 3. Install iOS dependencies
cd ios && pod install && cd ..

# 4. Open in Xcode
open ios/frontend.xcworkspace
```

### In Xcode:

1. **Select your iPhone** from the device dropdown (top left)
2. Go to **Signing & Capabilities** tab
3. Click **Team** dropdown → **Add an Account** → Sign in with your Apple ID
4. Select **Personal Team** (your Apple ID)
5. Change **Bundle Identifier** to something unique: `com.yourname.courtwatch`
6. Click **Play button** (▶️) to build and install

### Limitations of Free Signing:
- ⚠️ App expires after **7 days** - just rebuild to reinstall
- ⚠️ Can only install on **3 devices** max
- ⚠️ **Push notifications** (when app is in background) require paid account
- ✅ **In-app notifications** work fine!

---

## Paid Option: Full Push Notifications ($99/year)

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
