# Trade Pro Mobile

React Native mobile application for the Trade Pro trading platform.

## Features

- **Authentication**: Login/Register with biometric authentication support
- **Real-time Market Data**: Live price updates via WebSocket
- **Trading Signals**: AI-powered trading signals with confidence scores
- **Price Alerts**: Custom price alerts with push notifications
- **Portfolio Management**: Track positions and performance metrics
- **Dark/Light Theme**: Automatic theme switching based on system preferences

## Tech Stack

- **React Native** with Expo
- **TypeScript** for type safety
- **Redux Toolkit** for state management
- **React Navigation** for routing
- **Expo Notifications** for push notifications
- **Expo Local Authentication** for biometric auth
- **Axios** for API communication
- **WebSocket** for real-time updates

## Prerequisites

- Node.js 18+
- npm or yarn
- Expo CLI (`npm install -g expo-cli`)
- iOS Simulator (Mac) or Android Emulator

## Installation

```bash
# Install dependencies
npm install

# Start development server
npm start

# Run on iOS
npm run ios

# Run on Android
npm run android
```

## Project Structure

```
src/
├── components/       # Reusable UI components
├── screens/         # Screen components
│   ├── auth/       # Authentication screens
│   └── main/       # Main app screens
├── navigation/      # Navigation configuration
├── services/        # API and WebSocket services
├── store/          # Redux store and slices
├── contexts/       # React contexts (Theme)
├── hooks/          # Custom React hooks
├── utils/          # Utility functions
└── types/          # TypeScript type definitions
```

## Configuration

Update the API endpoints in `src/services/api-client.ts` and `src/services/websocket-service.ts`:

```typescript
const API_BASE_URL = 'https://your-api-url.com/api';
const WS_URL = 'wss://your-api-url.com/ws';
```

## Environment Variables

Create a `.env` file:

```env
API_URL=https://your-api-url.com
WS_URL=wss://your-api-url.com
```

## Building for Production

### iOS

```bash
# Build for iOS
expo build:ios
```

### Android

```bash
# Build for Android
expo build:android
```

## Features Roadmap

- [ ] Advanced charting with technical indicators
- [ ] Paper trading mode
- [ ] Order execution
- [ ] Portfolio analytics
- [ ] Social trading features
- [ ] News feed integration

## License

MIT
