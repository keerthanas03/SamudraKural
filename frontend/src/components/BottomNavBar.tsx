import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Image,
} from 'react-native';
import { Colors } from '../theme/colors';
import { t, useLanguage } from '../i18n';
import { SupportedLanguage } from '../types';

interface BottomNavBarProps {
  activeTab: string;
  onTabPress: (tabId: string) => void;
  currentLanguage?: SupportedLanguage;
}

export const BottomNavBar: React.FC<BottomNavBarProps> = ({
  activeTab,
  onTabPress,
  currentLanguage,
}) => {
  const { language: ctxLang } = useLanguage();
  const lang = (currentLanguage || ctxLang || 'en') as SupportedLanguage;

  const tabs = [
    { id: 'nav', icon: '🧭', label: t('placeholderNav', lang) },
    { id: 'fishing', icon: '🎣', label: t('placeholderFishing', lang) },
    { id: 'bot', label: t('askBot', lang), isCenter: true },
    { id: 'nets', icon: '🕸️', label: t('placeholderNets', lang) },
    { id: 'sos', icon: '🆘', label: t('placeholderEmergency', lang) },
  ];

  return (
    <View style={styles.navContainer}>
      <View style={styles.navBar}>
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;

          if (tab.isCenter) {
            return (
              <TouchableOpacity
                key={tab.id}
                activeOpacity={0.85}
                onPress={() => onTabPress(tab.id)}
                style={styles.centerButtonWrapper}
              >
                <View style={[styles.centerButton, isActive && styles.activeCenterButton]}>
                  <Image
                    source={require('../../assets/chatbot-logo.png')}
                    style={styles.centerLogoImage}
                    resizeMode="cover"
                  />
                </View>
                <Text style={[styles.centerLabel, isActive && styles.activeCenterLabel]} numberOfLines={1}>
                  {t('askBot', currentLanguage)}
                </Text>
              </TouchableOpacity>
            );
          }

          return (
            <TouchableOpacity
              key={tab.id}
              activeOpacity={0.75}
              onPress={() => onTabPress(tab.id)}
              style={styles.tabItem}
            >
              <Text style={[styles.tabIcon, isActive && styles.activeIcon]}>
                {tab.icon}
              </Text>
              <Text
                style={[styles.tabLabel, isActive && styles.activeLabel]}
                numberOfLines={1}
              >
                {tab.label}
              </Text>
              {isActive && <View style={styles.activeDot} />}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  navContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'transparent',
  },
  navBar: {
    flexDirection: 'row',
    height: Platform.OS === 'ios' ? 88 : 76,
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 8,
    paddingBottom: Platform.OS === 'ios' ? 18 : 8,
    alignItems: 'center',
    justifyContent: 'space-around',
    borderTopWidth: 1.5,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: Colors.secondaryDark,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 16,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
  },
  tabIcon: {
    fontSize: 26,
    marginBottom: 2,
    opacity: 0.7,
  },
  activeIcon: {
    opacity: 1,
    transform: [{ scale: 1.18 }],
  },
  tabLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  activeLabel: {
    color: Colors.primary,
    fontWeight: '900',
  },
  activeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.primary,
    marginTop: 3,
  },
  centerButtonWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -28,
    maxWidth: 80,
  },
  centerButton: {
    width: 66,
    height: 66,
    borderRadius: 33,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3.5,
    borderColor: Colors.primary,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 10,
    overflow: 'hidden',
  },
  activeCenterButton: {
    borderColor: Colors.accent,
    borderWidth: 4,
    transform: [{ scale: 1.05 }],
  },
  centerLogoImage: {
    width: '100%',
    height: '100%',
    borderRadius: 30,
  },
  centerLabel: {
    fontSize: 12,
    fontWeight: '900',
    color: Colors.primaryDark,
    marginTop: 2,
    textAlign: 'center',
  },
  activeCenterLabel: {
    color: Colors.primary,
  },
});
