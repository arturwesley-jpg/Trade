# Mobile App Setup Instructions

## Installation

1. Install dependencies:
```bash
cd apps/mobile
npm install
```

2. Install Expo CLI globally (if not already installed):
```bash
npm install -g expo-cli
```

3. Configure environment:
   - Update API URLs in `src/services/api-client.ts`
   - Update WebSocket URL in `src/services/websocket-service.ts`

## Development

Start the development server:
```bash
npm start
```

Run on specific platform:
```bash
npm run ios      # iOS Simulator
npm run android  # Android Emulator
npm run web      # Web browser
```

## Testing on Physical Device

1. Install Expo Go app on your device:
   - iOS: https://apps.apple.com/app/expo-go/id982107779
   - Android: https://play.google.com/store/apps/details?id=host.exp.exponent

2. Scan the QR code from the terminal with:
   - iOS: Camera app
   - Android: Expo Go app

## Project Structure

```
apps/mobile/
├── src/
│   ├── components/          # Reusable UI components
│   │   ├── Card.tsx
│   │   ├── EmptyState.tsx
│   │   ├── LoadingSpinner.tsx
│   │   └── PriceChange.tsx
│   ├── contexts/            # React contexts
│   │   └── ThemeContext.tsx
│   ├── hooks/               # Custom hooks
│   │   ├── redux.ts
│   │   ├── useInterval.ts
│   │   └── useWebSocket.ts
│   ├── navigation/          # Navigation setup
│   │   ├── AuthNavigator.tsx
│   │   ├── MainNavigator.tsx
│   │   └── RootNavigator.tsx
│   ├── screens/             # Screen components
│   │   ├── auth/
│   │   │   ├── LoginScreen.tsx
│   │   │   └── RegisterScreen.tsx
│   │   ├── main/
│   │   │   ├── AlertsScreen.tsx
│   │   │   ├── DashboardScreen.tsx
│   │   │   ├── MarketScreen.tsx
│   │   │   ├── SignalsScreen.tsx
│   │   │   └── SettingsScreen.tsx
│   │   └── LoadingScreen.tsx
│   ├── services/            # API and services
│   │   ├── api-client.ts
│   │   ├── notification-service.ts
│   │   └── websocket-service.ts
│   ├── store/               # Redux store
│   │   ├── slices/
│   │   │   ├── alertsSlice.ts
│   │   │   ├── authSlice.ts
│   │   │   ├── marketSlice.ts
│   │   │   ├── ordersSlice.ts
│   │   │   ├── portfolioSlice.ts
│   │   │   └── signalsSlice.ts
│   │   └── store.ts
│   ├── types/               # TypeScript types
│   │   └── index.ts
│   ├── utils/               # Utility functions
│   │   ├── formatters.ts
│   │   └── validators.ts
│   └── App.tsx              # Root component
├── app.json                 # Expo configuration
├── babel.config.js          # Babel configuration
├── index.js                 # Entry point
├── package.json             # Dependencies
└── tsconfig.json            # TypeScript configuration
```

## Key Features Implemented

### Authentication
- Login/Register screens
- JWT token management with secure storage
- Biometric authentication support (Face ID/Touch ID)
- Auto token refresh

### Real-time Data
- WebSocket client for live updates
- Market data streaming
- Signal notifications
- Price alert triggers

### State Management
- Redux Toolkit for global state
- Separate slices for each domain
- Async thunks for API calls
- Type-safe hooks

### UI/UX
- Dark/Light theme with auto-detection
- Bottom tab navigation
- Pull-to-refresh on all lists
- Loading states and error handling
- Empty states with actions

### Notifications
- Push notifications setup
- Price alert notifications
- Signal notifications
- Custom notification channels

## Next Steps

1. **Install dependencies** in the mobile app
2. **Configure API endpoints** to match your backend
3. **Test authentication flow** with your API
4. **Setup push notifications** with Firebase (optional)
5. **Add charts** using react-native-chart-kit or lightweight-charts
6. **Implement paper trading** features
7. **Add order execution** functionality

## Dependencies

Core:
- expo ~50.0.0
- react 18.2.0
- react-native 0.73.2
- @react-navigation/native ^6.1.9
- @reduxjs/toolkit ^2.0.1
- react-redux ^9.0.4

Expo modules:
- expo-notifications
- expo-local-authentication
- expo-secure-store
- @react-native-async-storage/async-storage

UI:
- react-native-chart-kit
- react-native-svg
- @expo/vector-icons

## Troubleshooting

### Metro bundler issues
```bash
npm start -- --clear
```

### iOS build issues
```bash
cd ios && pod install && cd ..
```

### Android build issues
```bash
cd android && ./gradlew clean && cd ..
```
