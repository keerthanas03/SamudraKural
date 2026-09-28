import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  Alert,
  Platform,
  Animated,
  Dimensions,
  Image,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../theme/colors';
import { t, supportedLanguages, useLanguage } from '../i18n';
import { SupportedLanguage, FishermanUser } from '../types';
import { getUserSession, clearSession, saveLanguagePreference } from '../storage/storage';
import { PrimaryButton } from '../components/PrimaryButton';
import { BottomNavBar } from '../components/BottomNavBar';
import { SOSScreen } from '../sos/SOSScreen';
import { HeaderWaveBottom } from '../components/WavyBackground';

import { NavigationScreen } from './NavigationScreen';
import { FishingZonesScreen } from './FishingZonesScreen';
import { MyNetsScreen } from './MyNetsScreen';
import { ProfileScreen } from './ProfileScreen';
import { BotScreen } from './BotScreen';
import { HotspotInfo } from '../services/pfzService';
import { coastalGuardService } from '../services/coastalGuardService';

const { width } = Dimensions.get('window');
const DRAWER_WIDTH = width * 0.82;

interface HomeScreenProps {
  currentLanguage: SupportedLanguage;
  onLogout: () => void;
  onLanguageChange?: (lang: SupportedLanguage) => void;
  onOpenFishingZones?: () => void;
  onOpenNavigation?: () => void;
  onOpenProfile?: () => void;
  initialTab?: string;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  currentLanguage,
  onLogout,
  onLanguageChange,
  onOpenFishingZones,
  onOpenNavigation,
  onOpenProfile,
  initialTab,
}) => {
  const { setLanguage } = useLanguage();
  const [user, setUser] = useState<FishermanUser | null>(null);
  const [activeTab, setActiveTab] = useState<string>(initialTab || 'nav');
  const [selectedHotspot, setSelectedHotspot] = useState<HotspotInfo | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false);
  const [isLangModalOpen, setIsLangModalOpen] = useState<boolean>(false);

  // Slide animation for side menu drawer
  const drawerAnim = useRef(new Animated.Value(DRAWER_WIDTH)).current;

  useEffect(() => {
    loadUser();
  }, [activeTab]);

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  const loadUser = async () => {
    const session = await getUserSession();
    if (session) {
      setUser(session);
    }
  };

  const openMenuDrawer = () => {
    setIsDrawerOpen(true);
    Animated.timing(drawerAnim, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
  };

  const closeMenuDrawer = () => {
    Animated.timing(drawerAnim, {
      toValue: DRAWER_WIDTH,
      duration: 250,
      useNativeDriver: true,
    }).start(() => {
      setIsDrawerOpen(false);
    });
  };

  const [navTick, setNavTick] = useState<number>(0);

  const handleTabPress = (tabId: string) => {
    setActiveTab(tabId);
    setNavTick((t) => t + 1);
  };

  const handleLogout = async () => {
    closeMenuDrawer();
    await clearSession();
    onLogout();
  };

  // Find native name of current language
  const currentLangObj = supportedLanguages.find((l) => l.code === currentLanguage);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.primaryDark} translucent={false} />
      
      {/* Top Header Banner with comfortable top spacing and Top-Right Hamburger Menu on ALL pages */}
      <View style={styles.header}>
        <View style={styles.headerTopRow}>
          <View style={styles.titleContainer}>
            <Text style={styles.appTitle}>{t('homeTitle', currentLanguage)}</Text>
            <Text style={styles.welcomeText}>
              {t('homeWelcome', currentLanguage)}, {user?.name || 'Fisherman User'}!
            </Text>
            <Text style={styles.appSubtitle}>{t('homeSubtitle', currentLanguage)}</Text>
          </View>

          {/* Three Lines Top-Right Hamburger Button */}
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={openMenuDrawer}
            style={styles.hamburgerButton}
          >
            <Text style={styles.hamburgerIcon}>☰</Text>
          </TouchableOpacity>
        </View>
      </View>
      <HeaderWaveBottom color={Colors.primary} bgColor={Colors.background} height={22} />

      {/* Main Content Area with Instant Navigation Auto-Reload Keys */}
      {activeTab === 'sos' ? (
        <SOSScreen key={`sos_${navTick}`} currentLanguage={currentLanguage} />
      ) : activeTab === 'nav' ? (
        <NavigationScreen
          key={`nav_${navTick}`}
          currentLanguage={currentLanguage}
          initialTarget={selectedHotspot}
          onBack={() => handleTabPress('nav')}
          onOpenMap={() => handleTabPress('fishing')}
          onLogout={handleLogout}
          onOpenProfile={onOpenProfile}
          onTabPress={handleTabPress}
          hideTopHeader={true}
        />
      ) : activeTab === 'fishing' ? (
        <FishingZonesScreen
          key={`fishing_${navTick}`}
          currentLanguage={currentLanguage}
          initialTarget={selectedHotspot}
          onBack={() => handleTabPress('nav')}
          onNavigateToHotspot={(spot) => {
            setSelectedHotspot(spot);
            handleTabPress('nav');
          }}
          onTabPress={handleTabPress}
          hideTopHeader={true}
        />
      ) : activeTab === 'bot' ? (
        <BotScreen
          key={`bot_${navTick}`}
          currentLanguage={currentLanguage}
          onBack={() => handleTabPress('nav')}
          onNavigateToHotspot={(spot) => {
            setSelectedHotspot(spot);
            handleTabPress('fishing');
          }}
          onTabPress={handleTabPress}
          hideTopHeader={true}
        />
      ) : activeTab === 'nets' ? (
        <MyNetsScreen key={`nets_${navTick}`} />
      ) : activeTab === 'profile' ? (
        <ProfileScreen
          key={`profile_${navTick}`}
          currentLanguage={currentLanguage}
          onBack={() => handleTabPress('nav')}
          onLogout={handleLogout}
          onLanguageChange={onLanguageChange}
          onProfileUpdate={(updatedUser) => {
            setUser(updatedUser);
          }}
        />
      ) : null}

      {/* Floating Bottom Navigation Bar */}
      <BottomNavBar
        activeTab={activeTab}
        onTabPress={handleTabPress}
        currentLanguage={currentLanguage}
      />

      {/* Side Menu Drawer Slide Overlay */}
      {isDrawerOpen && (
        <View style={StyleSheet.absoluteFill}>
          {/* Backdrop Overlay */}
          <TouchableOpacity
            style={styles.backdrop}
            activeOpacity={1}
            onPress={closeMenuDrawer}
          />

          {/* Sliding Menu Drawer */}
          <Animated.View
            style={[
              styles.drawerContainer,
              { transform: [{ translateX: drawerAnim }] },
            ]}
          >
            <SafeAreaView style={{ flex: 1 }}>
              {/* Drawer Header */}
              <View style={styles.drawerHeader}>
                <Text style={styles.drawerHeaderTitle}>{t('menuAndProfile', currentLanguage)}</Text>
                <TouchableOpacity
                  onPress={closeMenuDrawer}
                  style={styles.closeButton}
                >
                  <Text style={styles.closeIcon}>✕</Text>
                </TouchableOpacity>
              </View>

              <ScrollView contentContainerStyle={styles.drawerBody} showsVerticalScrollIndicator={false}>
                {/* Complete Fisherman Profile Info Card */}
                <View style={styles.profileSection}>
                  <View style={styles.profileAvatar}>
                    <Text style={styles.avatarText}>👤</Text>
                  </View>

                  <View style={styles.verifiedBadgeDrawer}>
                    <Text style={styles.verifiedBadgeDrawerTxt}>✓ {t('verifiedFisherman', currentLanguage)}</Text>
                  </View>

                  <Text style={styles.profileName}>{user?.name || 'Fisherman User'}</Text>
                  <Text style={styles.profilePhone}>{user?.phone || '+91 98401 23456'}</Text>

                  <TouchableOpacity
                    style={styles.fullProfileDrawerBtn}
                    onPress={() => {
                      closeMenuDrawer();
                      setActiveTab('profile');
                    }}
                  >
                    <Text style={styles.fullProfileDrawerBtnTxt}>
                      {t('viewEditProfile', currentLanguage)}
                    </Text>
                  </TouchableOpacity>

                  {/* Official Fisherman Specs List */}
                  <View style={{ width: '100%', marginTop: 12 }}>
                    <View style={styles.infoBox}>
                      <Text style={styles.infoBoxLabel}>{t('emergencyContact', currentLanguage)}:</Text>
                      <Text style={styles.infoBoxValueHighlight}>{user?.emergencyPhone || '+91 94440 99999'}</Text>
                    </View>

                    <View style={styles.infoBox}>
                      <Text style={styles.infoBoxLabel}>{t('vesselBoat', currentLanguage)}:</Text>
                      <Text style={styles.infoBoxValue}>{user?.vesselName || 'Sea King IX'}</Text>
                    </View>

                    <View style={styles.infoBox}>
                      <Text style={styles.infoBoxLabel}>{t('registrationNumber', currentLanguage)}:</Text>
                      <Text style={styles.infoBoxValueBadge}>{user?.vesselRegistration || 'TN-01-MM-8492'}</Text>
                    </View>

                    <View style={styles.infoBox}>
                      <Text style={styles.infoBoxLabel}>{t('homeHarbor', currentLanguage)}:</Text>
                      <Text style={styles.infoBoxValue}>{user?.homePort || 'Kasimedu Harbour, Chennai'}</Text>
                    </View>

                    <View style={styles.infoBox}>
                      <Text style={styles.infoBoxLabel}>{t('licenseNumber', currentLanguage)}:</Text>
                      <Text style={styles.infoBoxValue}>{user?.licenseNumber || 'IND-TN-2024-94021'}</Text>
                    </View>

                    <View style={styles.infoBox}>
                      <Text style={styles.infoBoxLabel}>{t('aadhaarId', currentLanguage)}:</Text>
                      <Text style={styles.infoBoxValue}>{user?.aadhaarNumber || 'XXXX-XXXX-8492'}</Text>
                    </View>

                    <View style={styles.infoBox}>
                      <Text style={styles.infoBoxLabel}>{t('address', currentLanguage)}:</Text>
                      <Text style={styles.infoBoxValue}>{user?.address || 'Harbour Main Road'}</Text>
                    </View>

                    <View style={styles.infoBox}>
                      <Text style={styles.infoBoxLabel}>{t('pincode', currentLanguage)}:</Text>
                      <Text style={styles.infoBoxValue}>{user?.pincode || '600013'}</Text>
                    </View>
                  </View>
                </View>

                {/* Settings / Language Info */}
                <View style={styles.menuSection}>
                  <Text style={styles.menuSectionTitle}>{t('appSettings', currentLanguage)}</Text>
                  
                  <TouchableOpacity
                    style={styles.menuItem}
                    activeOpacity={0.7}
                    onPress={() => {
                      setIsLangModalOpen(true);
                    }}
                  >
                    <Text style={styles.menuItemLabel}>{t('language', currentLanguage)}</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={styles.menuItemValue}>
                        {currentLangObj ? `${currentLangObj.nativeName} (${currentLangObj.englishName})` : 'Tamil'}
                      </Text>
                      <Text style={{ color: Colors.primary, fontSize: 16, fontWeight: '900' }}>›</Text>
                    </View>
                  </TouchableOpacity>
                </View>

                {/* Logout Action */}
                <View style={styles.logoutWrapper}>
                  <PrimaryButton
                    title={t('logout', currentLanguage)}
                    variant="danger"
                    onPress={handleLogout}
                  />
                </View>
              </ScrollView>
            </SafeAreaView>
          </Animated.View>
        </View>
      )}

      {/* Interactive App Language Selection Modal */}
      <Modal
        visible={isLangModalOpen}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsLangModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Select App Language</Text>
                <Text style={styles.modalSubtitle}>Choose your preferred marine portal language</Text>
              </View>
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => setIsLangModalOpen(false)}
              >
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.langListScroll} showsVerticalScrollIndicator={false}>
              {supportedLanguages.map((langOption) => {
                const isSelected = langOption.code === currentLanguage;
                return (
                  <TouchableOpacity
                    key={langOption.code}
                    style={[
                      styles.langCard,
                      isSelected && styles.langCardSelected,
                    ]}
                    activeOpacity={0.8}
                    onPress={async () => {
                      setIsLangModalOpen(false);
                      await setLanguage(langOption.code);
                      if (onLanguageChange) {
                        onLanguageChange(langOption.code);
                      }
                      Alert.alert(
                        'Language Updated',
                        `Samudra Kural app language set to ${langOption.nativeName} (${langOption.englishName}).`
                      );
                    }}
                  >
                    <View style={styles.langTextGroup}>
                      <Text style={[styles.langNativeName, isSelected && styles.langTextSelected]}>
                        {langOption.nativeName}
                      </Text>
                      <Text style={[styles.langEnglishName, isSelected && styles.langSubSelected]}>
                        {langOption.englishName}
                      </Text>
                    </View>

                    {isSelected && (
                      <View style={styles.checkBadge}>
                        <Text style={styles.checkBadgeTxt}>✓ ACTIVE</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 24) + 6 : 10,
    paddingBottom: 10,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  titleContainer: {
    flex: 1,
    marginRight: 10,
  },
  appTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: Colors.textLight,
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  welcomeText: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.secondary,
    marginBottom: 1,
  },
  appSubtitle: {
    fontSize: 12,
    color: '#B0ECE8',
    fontWeight: '600',
  },
  hamburgerButton: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.4)',
  },
  hamburgerIcon: {
    fontSize: 22,
    color: Colors.textLight,
    fontWeight: '900',
  },
  mainContainer: {
    flex: 1,
    paddingHorizontal: 0,
    paddingTop: 0,
    paddingBottom: 0,
  },
  scrollContent: {
    paddingBottom: 24,
  },
  featureCard: {
    backgroundColor: Colors.surface,
    borderRadius: 22,
    padding: 22,
    borderWidth: 1.5,
    borderColor: Colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 4,
    marginBottom: 20,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    paddingBottom: 14,
  },
  featureIcon: {
    fontSize: 32,
    marginRight: 12,
  },
  botFeatureLogo: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginRight: 12,
  },
  featureTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: Colors.text,
  },
  noticeBox: {
    backgroundColor: Colors.secondary,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.secondaryDark,
  },
  noticeTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.primaryDark,
    marginBottom: 6,
  },
  noticeText: {
    fontSize: 13,
    color: Colors.text,
    lineHeight: 19,
    fontWeight: '500',
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
  },
  drawerContainer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    right: 0,
    width: DRAWER_WIDTH,
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 28,
    borderBottomLeftRadius: 28,
    shadowColor: '#000',
    shadowOffset: { width: -4, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 16,
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 24) + 12 : 16,
  },
  drawerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 16,
    borderBottomWidth: 1.5,
    borderBottomColor: Colors.border,
  },
  drawerHeaderTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: Colors.text,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  closeIcon: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.textSecondary,
  },
  drawerBody: {
    paddingVertical: 18,
  },
  profileSection: {
    alignItems: 'center',
    backgroundColor: Colors.background,
    padding: 18,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: Colors.border,
    marginBottom: 20,
  },
  profileAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.primary,
    marginBottom: 10,
  },
  avatarText: {
    fontSize: 32,
  },
  profileName: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.text,
    marginBottom: 2,
  },
  profilePhone: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontWeight: '600',
    marginBottom: 10,
  },
  infoBox: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  infoBoxLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.textSecondary,
    flex: 1,
  },
  infoBoxValue: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.text,
    textAlign: 'right',
    flex: 1.2,
  },
  verifiedBadgeDrawer: {
    backgroundColor: 'rgba(0, 168, 150, 0.15)',
    borderColor: Colors.primary,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    marginBottom: 6,
  },
  verifiedBadgeDrawerTxt: {
    color: Colors.primaryDark,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  fullProfileDrawerBtn: {
    backgroundColor: Colors.secondary,
    borderColor: Colors.secondaryDark,
    borderWidth: 1.5,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    alignItems: 'center',
    marginTop: 6,
    width: '100%',
  },
  fullProfileDrawerBtnTxt: {
    color: Colors.primaryDark,
    fontSize: 12,
    fontWeight: '900',
  },
  infoBoxValueHighlight: {
    fontSize: 13,
    fontWeight: '900',
    color: Colors.error,
    textAlign: 'right',
  },
  infoBoxValueBadge: {
    fontSize: 12,
    fontWeight: '900',
    color: Colors.primaryDark,
    backgroundColor: Colors.secondary,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  infoBoxValueActive: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.success,
  },
  menuSection: {
    marginBottom: 20,
  },
  menuSectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.textSecondary,
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  menuItem: {
    backgroundColor: Colors.background,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: Colors.border,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  menuItemLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text,
  },
  menuItemValue: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.primaryDark,
  },
  logoutWrapper: {
    marginTop: 10,
  },
  /* Language Modal Styles */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 30, 40, 0.65)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 18,
    paddingTop: 20,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
    maxHeight: '82%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 12,
    borderBottomWidth: 1.5,
    borderBottomColor: Colors.border,
    marginBottom: 12,
  },
  modalTitle: {
    color: Colors.primaryDark,
    fontSize: 20,
    fontWeight: '900',
  },
  modalSubtitle: {
    color: Colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
    marginTop: 2,
  },
  modalCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  modalCloseText: {
    color: Colors.textSecondary,
    fontSize: 18,
    fontWeight: '900',
  },
  langListScroll: {
    marginTop: 8,
  },
  langCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.background,
    borderColor: Colors.border,
    borderWidth: 1.5,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 10,
  },
  langCardSelected: {
    backgroundColor: 'rgba(0, 95, 96, 0.1)',
    borderColor: Colors.primary,
    borderWidth: 2,
  },
  langTextGroup: {
    flex: 1,
  },
  langNativeName: {
    fontSize: 18,
    fontWeight: '900',
    color: Colors.text,
    marginBottom: 2,
  },
  langEnglishName: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  langTextSelected: {
    color: Colors.primaryDark,
  },
  langSubSelected: {
    color: Colors.primary,
  },
  checkBadge: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  checkBadgeTxt: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900',
  },
});
