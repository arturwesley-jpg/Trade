import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { Provider } from 'react-redux';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { store } from '@store/store';
import { RootNavigator } from '@navigation/RootNavigator';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { NotificationService } from '@services/notification-service';

export default function App() {
  useEffect(() => {
    // Initialize notification service
    NotificationService.initialize();

    return () => {
      NotificationService.cleanup();
    };
  }, []);

  return (
    <Provider store={store}>
      <SafeAreaProvider>
        <ThemeProvider>
          <NavigationContainer>
            <RootNavigator />
            <StatusBar style="auto" />
          </NavigationContainer>
        </ThemeProvider>
      </SafeAreaProvider>
    </Provider>
  );
}
