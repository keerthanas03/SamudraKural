import React, { useEffect } from 'react';
import { LogBox } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { LanguageProvider } from './src/i18n';
import { AppNavigator } from './src/navigation/AppNavigator';
import { coastalGuardService } from './src/services/coastalGuardService';

LogBox.ignoreLogs([
  'Cannot connect to Expo CLI',
  'Require cycle:',
  'High-accuracy GPS position timed out',
  'Current location is unavailable',
]);

export default function App() {
  useEffect(() => {
    // Purge legacy mock data on launch so both logins start clean
    coastalGuardService.clearAllMockData().catch(() => {});
  }, []);

  return (
    <SafeAreaProvider>
      <LanguageProvider>
        <AppNavigator />
      </LanguageProvider>
    </SafeAreaProvider>
  );
}

