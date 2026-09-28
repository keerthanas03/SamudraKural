import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator, StyleSheet, Alert } from 'react-native';
import { Colors } from '../theme/colors';
import { SupportedLanguage } from '../types';
import { getLanguagePreference, getAuthToken } from '../storage/storage';
import { useLanguage } from '../i18n';
import { LanguageScreen } from '../screens/LanguageScreen';
import { WelcomeScreen } from '../screens/WelcomeScreen';
import { LoginScreen } from '../screens/LoginScreen';
import { RegisterScreen } from '../screens/RegisterScreen';
import { HomeScreen } from '../screens/HomeScreen';
import { FishingZonesScreen } from '../screens/FishingZonesScreen';
import { NavigationScreen } from '../screens/NavigationScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { BotScreen } from '../screens/BotScreen';
import { CoastalGuardHomeScreen } from '../screens/coastal_guard/CoastalGuardHomeScreen';
import { CGLoginScreen } from '../screens/coastal_guard/CGLoginScreen';
import { CGRegisterScreen } from '../screens/coastal_guard/CGRegisterScreen';
import { HotspotInfo } from '../services/pfzService';
import { clearSessionChatMessages } from '../services/botService';

type ScreenState = 'loading' | 'welcome' | 'language' | 'login' | 'register' | 'home' | 'fishing_zones' | 'navigation' | 'profile' | 'bot' | 'cg_login' | 'cg_register' | 'coastal_guard';

export const AppNavigator: React.FC = () => {
  const [currentScreen, setCurrentScreen] = useState<ScreenState>('loading');
  const [previousScreen, setPreviousScreen] = useState<ScreenState>('welcome');
  const { language, setLanguage, t } = useLanguage();
  const [selectedHotspot, setSelectedHotspot] = useState<HotspotInfo | null>(null);

  useEffect(() => {
    bootstrapApp();
  }, []);

  const bootstrapApp = async () => {
    try {
      const savedLang = await getLanguagePreference();
      const token = await getAuthToken();

      if (savedLang) {
        await setLanguage(savedLang);
        if (token) {
          setCurrentScreen('home');
        } else {
          setCurrentScreen('welcome');
        }
      } else {
        // First launch - show language selection screen
        setCurrentScreen('language');
      }
    } catch (e) {
      setCurrentScreen('welcome');
    }
  };

  const handleOpenLanguage = () => {
    setPreviousScreen(currentScreen);
    setCurrentScreen('language');
  };

  // Step 1: Welcome Screen "GET STARTED" -> Navigates to Login Screen
  const handleGetStarted = () => {
    setCurrentScreen('login');
  };

  // Step 2: Language Selection Screen "Continue" -> Navigates to appropriate destination
  const handleLanguageSelect = async (selectedLang: SupportedLanguage) => {
    await setLanguage(selectedLang);
    try {
      if (previousScreen && previousScreen !== 'loading' && previousScreen !== 'language') {
        setCurrentScreen(previousScreen);
        return;
      }
      const token = await getAuthToken();
      if (token) {
        setCurrentScreen('home');
      } else {
        setCurrentScreen('welcome');
      }
    } catch (e) {
      setCurrentScreen('welcome');
    }
  };

  // Step 3: Register Screen success -> Navigates back to Login Screen
  const handleRegisterSuccess = () => {
    Alert.alert(
      t('registrationComplete'),
      t('registrationSuccessMsg')
    );
    setCurrentScreen('login');
  };

  // Step 4: Login Screen success -> Navigates to Home Screen
  const handleLoginSuccess = () => {
    setCurrentScreen('home');
  };

  // Step 5: Logout -> Returns to Welcome Screen
  const handleLogout = () => {
    clearSessionChatMessages();
    setCurrentScreen('welcome');
  };

  const handleStartNavigationToHotspot = (spot: HotspotInfo) => {
    setSelectedHotspot(spot);
    setCurrentScreen('fishing_zones');
  };

  if (currentScreen === 'loading') {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* 1. WELCOME SCREEN */}
      {currentScreen === 'welcome' && (
        <WelcomeScreen
          currentLanguage={language}
          onGetStarted={handleGetStarted}
          onChangeLanguage={handleOpenLanguage}
          onOpenCoastalGuard={() => setCurrentScreen('cg_login')}
        />
      )}

      {/* 2. PREFERRED LANGUAGE SELECTION SCREEN */}
      {currentScreen === 'language' && (
        <LanguageScreen
          initialLanguage={language}
          onLanguageSelected={handleLanguageSelect}
          onCancel={previousScreen && previousScreen !== 'loading' && previousScreen !== 'language' ? () => setCurrentScreen(previousScreen) : undefined}
        />
      )}

      {/* 3. LOGIN SCREEN */}
      {currentScreen === 'login' && (
        <LoginScreen
          currentLanguage={language}
          onLoginSuccess={handleLoginSuccess}
          onLoginCoastalGuard={() => setCurrentScreen('cg_login')}
          onNavigateToRegister={() => setCurrentScreen('register')}
        />
      )}

      {/* 4. DEDICATED SAMUDRA KURAL COASTAL GUARD OFFICER LOGIN SCREEN */}
      {currentScreen === 'cg_login' && (
        <CGLoginScreen
          onLoginSuccess={() => setCurrentScreen('coastal_guard')}
          onNavigateToFishermanLogin={() => setCurrentScreen('login')}
          onNavigateToRegister={() => setCurrentScreen('cg_register')}
        />
      )}

      {/* 5. COASTAL GUARD OFFICER REGISTRATION SCREEN */}
      {currentScreen === 'cg_register' && (
        <CGRegisterScreen
          onRegisterSuccess={() => setCurrentScreen('cg_login')}
          onNavigateToLogin={() => setCurrentScreen('cg_login')}
        />
      )}

      {/* 6. FISHERMAN REGISTER SCREEN */}
      {currentScreen === 'register' && (
        <RegisterScreen
          currentLanguage={language}
          onRegisterSuccess={handleRegisterSuccess}
          onNavigateToLogin={() => setCurrentScreen('login')}
        />
      )}

      {/* 6. COASTAL GUARD COMMAND CENTER MODULE */}
      {currentScreen === 'coastal_guard' && (
        <CoastalGuardHomeScreen
          onLogout={handleLogout}
          onSwitchToFishermanView={() => setCurrentScreen('home')}
        />
      )}

      {/* 6. HOME & AUTHENTICATED MAIN APP CONTAINER */}
      {currentScreen === 'home' && (
        <HomeScreen
          currentLanguage={language}
          onLogout={handleLogout}
          onLanguageChange={async (newLang) => await setLanguage(newLang)}
          onOpenFishingZones={() => setCurrentScreen('fishing_zones')}
          onOpenNavigation={() => setCurrentScreen('navigation')}
          onOpenProfile={() => setCurrentScreen('profile')}
          initialTab={undefined}
        />
      )}

      {/* 7. POTENTIAL FISHING ZONES SCREEN (INCOIS REAL DATA) */}
      {currentScreen === 'fishing_zones' && (
        <FishingZonesScreen
          currentLanguage={language}
          initialTarget={selectedHotspot}
          onBack={() => setCurrentScreen('home')}
          onNavigateToHotspot={handleStartNavigationToHotspot}
          onTabPress={(tabId) => {
            if (tabId === 'nets' || tabId === 'home') {
              setCurrentScreen('home');
            } else if (tabId === 'nav') {
              setCurrentScreen('navigation');
            } else if (tabId === 'bot') {
              setCurrentScreen('bot');
            } else if (tabId === 'sos') {
              Alert.alert(
                t('emergencySosTitle'),
                t('emergencySosMsg')
              );
            }
          }}
        />
      )}

      {/* 8. LIVE MARINE NAVIGATION SCREEN */}
      {currentScreen === 'navigation' && (
        <NavigationScreen
          currentLanguage={language}
          initialTarget={selectedHotspot}
          onBack={() => setCurrentScreen('home')}
          onOpenMap={() => setCurrentScreen('fishing_zones')}
          onLogout={handleLogout}
          onOpenProfile={() => setCurrentScreen('profile')}
          onTabPress={(tabId) => {
            if (tabId === 'nets' || tabId === 'home') {
              setCurrentScreen('home');
            } else if (tabId === 'fishing') {
              setCurrentScreen('fishing_zones');
            } else if (tabId === 'bot') {
              setCurrentScreen('bot');
            } else if (tabId === 'sos') {
              Alert.alert(
                t('emergencySosTitle'),
                t('emergencySosMsg')
              );
            }
          }}
        />
      )}

      {/* 9. DEDICATED FISHERMAN PROFILE & SPECS SCREEN */}
      {currentScreen === 'profile' && (
        <ProfileScreen
          currentLanguage={language}
          onBack={() => setCurrentScreen('home')}
          onLogout={handleLogout}
          onLanguageChange={async (newLang) => await setLanguage(newLang)}
        />
      )}

      {/* 10. ASK BOT SCREEN */}
      {currentScreen === 'bot' && (
        <BotScreen
          currentLanguage={language}
          onBack={() => setCurrentScreen('home')}
          onNavigateToHotspot={handleStartNavigationToHotspot}
          onTabPress={(tabId) => {
            if (tabId === 'home' || tabId === 'nets') {
              setCurrentScreen('home');
            } else if (tabId === 'fishing') {
              setCurrentScreen('fishing_zones');
            } else if (tabId === 'nav') {
              setCurrentScreen('navigation');
            } else if (tabId === 'sos') {
              Alert.alert(
                t('emergencySosTitle'),
                t('emergencySosMsg')
              );
            }
          }}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
});
