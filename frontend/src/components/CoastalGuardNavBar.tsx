import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';
import { Colors } from '../theme/colors';

export type CGTab = 'dashboard' | 'alerts' | 'missions' | 'marine' | 'profile';

interface CoastalGuardNavBarProps {
  activeTab: CGTab;
  onTabPress: (tab: CGTab) => void;
  activeSOSCount?: number;
}

export const CoastalGuardNavBar: React.FC<CoastalGuardNavBarProps> = ({
  activeTab,
  onTabPress,
  activeSOSCount = 0,
}) => {
  const tabs: Array<{
    id: CGTab;
    label: string;
    icon: string;
    isCenter?: boolean;
  }> = [
    { id: 'dashboard', label: 'Command', icon: '🏛️' },
    { id: 'alerts', label: 'SOS Alerts', icon: '🚨' },
    { id: 'missions', label: 'Missions', icon: '🛥️', isCenter: true },
    { id: 'marine', label: 'Marine', icon: '🌊' },
    { id: 'profile', label: 'Profile', icon: '👤' },
  ];

  return (
    <View style={styles.navContainer}>
      <View style={styles.navBar}>
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          const isAlertTab = tab.id === 'alerts';

          if (tab.isCenter) {
            return (
              <TouchableOpacity
                key={tab.id}
                activeOpacity={0.85}
                onPress={() => onTabPress(tab.id)}
                style={styles.centerButtonWrapper}
              >
                <View style={[styles.centerButton, isActive && styles.activeCenterButton]}>
                  <Text style={styles.centerButtonIcon}>🛥️</Text>
                </View>
                <Text style={[styles.centerLabel, isActive && styles.activeCenterLabel]} numberOfLines={1}>
                  {tab.label}
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
              <View style={styles.iconContainer}>
                <Text style={[styles.tabIcon, isActive && styles.activeIcon]}>
                  {tab.icon}
                </Text>
                {isAlertTab && activeSOSCount > 0 && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{activeSOSCount}</Text>
                  </View>
                )}
              </View>
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
    borderColor: Colors.cgSecondaryDark,
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
  iconContainer: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
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
    color: Colors.cgTextSecondary,
  },
  activeLabel: {
    color: Colors.cgPrimary,
    fontWeight: '900',
  },
  activeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.cgPrimary,
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
    backgroundColor: Colors.cgPrimary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3.5,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 10,
  },
  activeCenterButton: {
    backgroundColor: Colors.cgPrimaryDark,
    borderColor: Colors.cgAccent,
    borderWidth: 4,
    transform: [{ scale: 1.05 }],
  },
  centerButtonIcon: {
    fontSize: 32,
  },
  centerLabel: {
    fontSize: 12,
    fontWeight: '900',
    color: Colors.cgPrimaryDark,
    marginTop: 2,
    textAlign: 'center',
  },
  activeCenterLabel: {
    color: Colors.cgPrimary,
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -10,
    backgroundColor: Colors.cgCritical,
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 1.5,
    borderColor: Colors.surface,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '900',
  },
});
