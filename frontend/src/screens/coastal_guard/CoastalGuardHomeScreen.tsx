import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  Animated,
  Dimensions,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../../theme/colors';
import { PrimaryButton } from '../../components/PrimaryButton';
import { CoastalGuardNavBar, CGTab } from '../../components/CoastalGuardNavBar';
import { HeaderWaveBottom } from '../../components/WavyBackground';
import { CGDashboardScreen } from './CGDashboardScreen';
import { CGSOSAlertsScreen } from './CGSOSAlertsScreen';
import { CGSOSDetailsScreen } from './CGSOSDetailsScreen';
import { CGCreateMissionScreen } from './CGCreateMissionScreen';
import { CGRescueMissionsScreen } from './CGRescueMissionsScreen';
import { CGMissionDetailsScreen } from './CGMissionDetailsScreen';
import { CGMarineConditionsScreen } from './CGMarineConditionsScreen';
import { CGMarineMapScreen } from './CGMarineMapScreen';
import { CGProfileScreen } from './CGProfileScreen';
import { coastalGuardService, SOSAlertItem } from '../../services/coastalGuardService';
import { getCGOfficerSession, CGOfficerUser } from '../../storage/storage';
import { CoastalGuardOfficer } from '../../types';

import { speakNativeText, playEmergencyBuzzerSound } from '../../utils/speech';

const { width } = Dimensions.get('window');
const DRAWER_WIDTH = width * 0.82;

interface CoastalGuardHomeScreenProps {
  onLogout: () => void;
  onSwitchToFishermanView?: () => void;
}

export const CoastalGuardHomeScreen: React.FC<CoastalGuardHomeScreenProps> = ({
  onLogout,
  onSwitchToFishermanView,
}) => {
  const [activeTab, setActiveTab] = useState<CGTab>('dashboard');
  const [activeSubScreen, setActiveSubScreen] = useState<'main' | 'sos_detail' | 'create_mission' | 'mission_detail' | 'marine_map'>('main');
  const [selectedSOSId, setSelectedSOSId] = useState<number | null>(null);
  const [targetSOSForMission, setTargetSOSForMission] = useState<SOSAlertItem | null>(null);
  const [selectedMissionId, setSelectedMissionId] = useState<number | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false);
  const [officer, setOfficer] = useState<any | null>(null);
  const [latestEmergency, setLatestEmergency] = useState<SOSAlertItem | null>(null);
  const [activeSOSCount, setActiveSOSCount] = useState<number>(0);
  const announcedSOSIdsRef = useRef<Set<number>>(new Set());

  const drawerAnim = useRef(new Animated.Value(DRAWER_WIDTH)).current;

  React.useEffect(() => {
    loadOfficer();
    const interval = setInterval(pollSOSAlerts, 3000);
    pollSOSAlerts();

    const unsubscribe = coastalGuardService.subscribeToSOS(() => {
      pollSOSAlerts();
    });

    return () => {
      clearInterval(interval);
      unsubscribe();
    };
  }, []);

  const loadOfficer = async () => {
    const session = await getCGOfficerSession();
    if (session) {
      setOfficer(session);
    }
  };

  const pollSOSAlerts = async () => {
    try {
      const allAlerts = await coastalGuardService.getSOSAlerts();
      const activeAlerts = allAlerts.filter(a => a.status !== 'RESOLVED' && a.status !== 'CANCELLED');
      setActiveSOSCount(activeAlerts.length);

      // An unassigned emergency is an active SOS without an assigned rescue mission
      const unassignedEmergency = activeAlerts.find(
        a => !a.rescue_mission && a.status !== 'RESCUE_ASSIGNED' && a.status !== 'RESCUE_IN_PROGRESS'
      );

      if (unassignedEmergency) {
        setLatestEmergency(unassignedEmergency);
        // Play loud emergency siren buzzer sound + voice alert for active emergency if not announced yet
        if (!announcedSOSIdsRef.current.has(unassignedEmergency.id)) {
          announcedSOSIdsRef.current.add(unassignedEmergency.id);
          playEmergencyBuzzerSound();
          setTimeout(() => {
            const alertMessage = `Emergency SOS Alert! ${unassignedEmergency.emergency_type} distress signal received from ${unassignedEmergency.fisherman?.name || 'Fisherman'}. Vessel ${unassignedEmergency.boat?.name || 'Sea King'}. Immediate rescue mission required.`;
            speakNativeText(alertMessage, 'en');
          }, 1400);
        }
      } else {
        // Dismiss notification banner once rescue mission has been assigned or all alerts resolved
        setLatestEmergency(null);
      }
    } catch (e) {}
  };

  const openMenuDrawer = () => {
    setIsDrawerOpen(true);
    loadOfficer();
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

  const handleOpenSOSDetail = (id: number) => {
    setSelectedSOSId(id);
    setActiveSubScreen('sos_detail');
  };

  const handleOpenCreateMission = (sos: SOSAlertItem) => {
    setTargetSOSForMission(sos);
    setActiveSubScreen('create_mission');
  };

  const handleOpenMissionDetail = (missionId: number) => {
    setSelectedMissionId(missionId);
    setActiveSubScreen('mission_detail');
  };

  const handleMissionCreated = () => {
    setActiveTab('missions');
    setActiveSubScreen('main');
  };

  const [navTick, setNavTick] = useState<number>(0);

  const handleTabChange = (tab: CGTab) => {
    loadOfficer();
    setActiveTab(tab);
    setActiveSubScreen('main');
    setNavTick((t) => t + 1);
  };

  const isMainScreen = activeSubScreen === 'main';
  const officerDisplayName = officer
    ? `${officer.rank ? officer.rank + ' ' : ''}${officer.name}`
    : 'Officer';

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.cgPrimaryDark} translucent={false} />

      {/* Top Header Banner matching Fisherman HomeScreen layout */}
      {isMainScreen && (
        <View style={styles.header}>
          <View style={styles.headerTopRow}>
            <View style={styles.titleContainer}>
              <Text style={styles.appTitle}>SAMUDRA KURAL</Text>
              <Text style={styles.welcomeText}>
                Welcome, {officerDisplayName}!
              </Text>
              <Text style={styles.appSubtitle}>
                {officer?.station || 'Coastal Guard Emergency Command HQ'}
              </Text>
            </View>

            <TouchableOpacity
              activeOpacity={0.8}
              onPress={openMenuDrawer}
              style={styles.hamburgerButton}
            >
              <Text style={styles.hamburgerIcon}>☰</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
      {isMainScreen && (
        <HeaderWaveBottom color={Colors.cgPrimary} bgColor={Colors.cgBackground} height={42} />
      )}

      {/* Real-time Emergency Broadcast Notification Banner with Siren Sound Button */}
      {isMainScreen && latestEmergency && (
        <TouchableOpacity
          activeOpacity={0.9}
          style={styles.sosNotificationBanner}
          onPress={() => handleOpenSOSDetail(latestEmergency.id)}
        >
          <Text style={styles.sosNotificationIcon}>🚨</Text>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <Text style={styles.sosNotificationTitle}>
                DISTRESS ALERT: {latestEmergency.emergency_type}
              </Text>
              <View style={styles.unassignedBadge}>
                <Text style={styles.unassignedBadgeTxt}>MISSION PENDING</Text>
              </View>
            </View>
            <Text style={styles.sosNotificationSub}>
              Fisherman: {latestEmergency.fisherman?.name || 'Fisherman User'} • Vessel: {latestEmergency.boat?.name || 'Sea King IX'}
            </Text>
            <Text style={styles.sosNotificationCoords}>
              📍 {latestEmergency.latitude.toFixed(4)}° N, {latestEmergency.longitude.toFixed(4)}° E
            </Text>
          </View>
          <TouchableOpacity
            style={styles.sirenSoundBtn}
            activeOpacity={0.7}
            onPress={(e) => {
              e.stopPropagation();
              playEmergencyBuzzerSound();
              setTimeout(() => {
                const alertMsg = `Emergency Alert: ${latestEmergency.emergency_type} signal from ${latestEmergency.fisherman?.name || 'Fisherman'}.`;
                speakNativeText(alertMsg, 'en');
              }, 1200);
            }}
          >
            <Text style={styles.sirenSoundBtnTxt}>🔊 SIREN</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.assignNowBtn}
            activeOpacity={0.8}
            onPress={(e) => {
              e.stopPropagation();
              handleOpenCreateMission(latestEmergency);
            }}
          >
            <Text style={styles.assignNowBtnTxt}>ASSIGN ➔</Text>
          </TouchableOpacity>
        </TouchableOpacity>
      )}

      {/* Main Content View Container */}
      <View style={styles.mainContainer}>
        {/* 1. SUB SCREENS (STACK) */}
        {activeSubScreen === 'sos_detail' && selectedSOSId && (
          <CGSOSDetailsScreen
            sosId={selectedSOSId}
            onBack={() => setActiveSubScreen('main')}
            onAssignMission={handleOpenCreateMission}
          />
        )}

        {activeSubScreen === 'create_mission' && targetSOSForMission && (
          <CGCreateMissionScreen
            targetSOS={targetSOSForMission}
            onBack={() => setActiveSubScreen('sos_detail')}
            onMissionCreated={handleMissionCreated}
          />
        )}

        {activeSubScreen === 'mission_detail' && selectedMissionId && (
          <CGMissionDetailsScreen
            missionId={selectedMissionId}
            onBack={() => setActiveSubScreen('main')}
          />
        )}

        {activeSubScreen === 'marine_map' && (
          <CGMarineMapScreen
            onBack={() => setActiveSubScreen('main')}
          />
        )}

        {/* 2. MAIN TAB SCREENS with Instant Auto-Reload Navigation Keys */}
        {isMainScreen && activeTab === 'dashboard' && (
          <CGDashboardScreen
            key={`dashboard_tab_${navTick}`}
            hideTopHeader={true}
            onNavigateToSOSList={() => handleTabChange('alerts')}
            onNavigateToSOSDetail={handleOpenSOSDetail}
            onNavigateToMissions={() => handleTabChange('missions')}
            onNavigateToMarineMap={() => setActiveSubScreen('marine_map')}
            onNavigateToMarineData={() => handleTabChange('marine')}
            onOpenProfile={() => handleTabChange('profile')}
          />
        )}

        {isMainScreen && activeTab === 'alerts' && (
          <CGSOSAlertsScreen
            key={`alerts_tab_${navTick}`}
            hideTopHeader={true}
            onSelectAlert={handleOpenSOSDetail}
          />
        )}

        {isMainScreen && activeTab === 'missions' && (
          <CGRescueMissionsScreen
            key={`missions_tab_${navTick}`}
            hideTopHeader={true}
            onSelectMission={handleOpenMissionDetail}
          />
        )}

        {isMainScreen && activeTab === 'marine' && (
          <CGMarineConditionsScreen
            key={`marine_tab_${navTick}`}
            hideTopHeader={true}
          />
        )}

        {isMainScreen && activeTab === 'profile' && (
          <CGProfileScreen
            key={`profile_tab_${navTick}`}
            hideTopHeader={true}
            onLogout={onLogout}
            onSwitchToFishermanView={onSwitchToFishermanView}
            onProfileUpdate={(updatedOfficer) => {
              setOfficer(updatedOfficer);
            }}
          />
        )}
      </View>

      {/* FLOATING BOTTOM TAB NAVBAR */}
      {isMainScreen && (
        <CoastalGuardNavBar
          activeTab={activeTab}
          onTabPress={handleTabChange}
          activeSOSCount={activeSOSCount}
        />
      )}

      {/* Side Menu Drawer Slide Overlay matching Fisherman HomeScreen */}
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
              {/* Drawer Header matching screenshot */}
              <View style={styles.drawerHeader}>
                <Text style={styles.drawerHeaderTitle}>Menu & Profile</Text>
                <TouchableOpacity
                  onPress={closeMenuDrawer}
                  style={styles.closeButton}
                >
                  <Text style={styles.closeIcon}>✕</Text>
                </TouchableOpacity>
              </View>

              <ScrollView contentContainerStyle={styles.drawerBody} showsVerticalScrollIndicator={false}>
                {/* Pale Blue Bordered Profile Info Card matching screenshot */}
                <View style={styles.profileSection}>
                  {/* Avatar Container with Settings Gear */}
                  <View style={styles.avatarRowWrapper}>
                    <View style={styles.profileAvatar}>
                      <Text style={styles.avatarText}>👤</Text>
                    </View>
                    <TouchableOpacity
                      style={styles.settingsGearBtn}
                      activeOpacity={0.7}
                      onPress={() => {
                        closeMenuDrawer();
                        setActiveTab('profile');
                      }}
                    >
                      <Text style={styles.settingsGearIcon}>⚙️</Text>
                    </TouchableOpacity>
                  </View>

                  <View style={styles.verifiedBadgeDrawer}>
                    <Text style={styles.verifiedBadgeDrawerTxt}>✓ VERIFIED COASTAL GUARD</Text>
                  </View>

                  <Text style={styles.profileName}>{officer?.name || officer?.rank || 'Coastal Guard Officer'}</Text>
                  <Text style={styles.profilePhone}>{officer?.phone || officer?.serviceId || ''}</Text>

                  <TouchableOpacity
                    style={styles.fullProfileDrawerBtn}
                    onPress={() => {
                      closeMenuDrawer();
                      setActiveTab('profile');
                    }}
                  >
                    <Text style={styles.fullProfileDrawerBtnTxt}>
                      👤 View & Edit Officer Profile
                    </Text>
                  </TouchableOpacity>

                  {/* Official Specs List with registered officer data */}
                  <View style={{ width: '100%', marginTop: 12 }}>
                    <View style={styles.infoBox}>
                      <Text style={styles.infoBoxLabel}>Emergency Contact:</Text>
                      <Text style={styles.infoBoxValueHighlight}>{officer?.emergencyContact || officer?.phone || '+91 94440 99999'}</Text>
                    </View>

                    <View style={styles.infoBox}>
                      <Text style={styles.infoBoxLabel}>Vessel / Boat:</Text>
                      <Text style={styles.infoBoxValue}>{officer?.vessel || officer?.station || 'ICGS Patrol Craft'}</Text>
                    </View>

                    <View style={styles.infoBox}>
                      <Text style={styles.infoBoxLabel}>Registration Number:</Text>
                      <Text style={styles.infoBoxValueBadge}>{officer?.serviceId || officer?.badgeNumber || 'CG-OFFICER'}</Text>
                    </View>

                    <View style={styles.infoBox}>
                      <Text style={styles.infoBoxLabel}>Home Port / Base:</Text>
                      <Text style={styles.infoBoxValue}>{officer?.station || 'Coast Guard HQ'}</Text>
                    </View>

                    <View style={styles.infoBox}>
                      <Text style={styles.infoBoxLabel}>License Number:</Text>
                      <Text style={styles.infoBoxValue}>{officer?.licenseNumber || 'ICG-SERVICE'}</Text>
                    </View>

                    <View style={styles.infoBox}>
                      <Text style={styles.infoBoxLabel}>Aadhaar / ID:</Text>
                      <Text style={styles.infoBoxValue}>{officer?.aadhaarNumber || 'XXXX-XXXX-8492'}</Text>
                    </View>

                    <View style={styles.infoBox}>
                      <Text style={styles.infoBoxLabel}>Address:</Text>
                      <Text style={styles.infoBoxValue}>{officer?.address || 'Coast Guard HQ'}</Text>
                    </View>

                    <View style={styles.infoBox}>
                      <Text style={styles.infoBoxLabel}>Pincode:</Text>
                      <Text style={styles.infoBoxValue}>{officer?.pincode || '600013'}</Text>
                    </View>
                  </View>
                </View>

                {/* APP SETTINGS Section matching screenshot */}
                <View style={styles.menuSection}>
                  <Text style={styles.menuSectionTitle}>APP SETTINGS</Text>

                  <TouchableOpacity
                    style={styles.settingsRowCard}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.settingsRowLabel}>Language</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={styles.settingsRowValue}>English (English)</Text>
                      <Text style={{ color: Colors.cgPrimary, fontSize: 16, fontWeight: '900' }}>›</Text>
                    </View>
                  </TouchableOpacity>
                </View>
              </ScrollView>

              {/* Sidebar Pinned Bottom Logout Footer */}
              <View style={styles.sidebarLogoutFooter}>
                <PrimaryButton
                  title="Logout"
                  variant="danger"
                  onPress={() => {
                    closeMenuDrawer();
                    onLogout();
                  }}
                />
              </View>
            </SafeAreaView>
          </Animated.View>
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.cgBackground,
  },
  header: {
    backgroundColor: Colors.cgPrimary,
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 24) + 6 : 10,
    paddingBottom: 6,
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
    color: '#FFFFFF',
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  welcomeText: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.cgSecondary,
    marginBottom: 1,
  },
  appSubtitle: {
    fontSize: 12,
    color: '#BAE6FD',
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
    color: '#FFFFFF',
    fontWeight: '900',
  },
  mainContainer: {
    flex: 1,
    backgroundColor: Colors.cgBackground,
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
    backgroundColor: '#F0F9FF',
    padding: 16,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: '#7DD3FC',
    marginBottom: 16,
    position: 'relative',
  },
  avatarRowWrapper: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    position: 'relative',
  },
  profileAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#0284C7',
  },
  settingsGearBtn: {
    position: 'absolute',
    right: 0,
    top: 0,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingsGearIcon: {
    fontSize: 18,
  },
  avatarText: {
    fontSize: 32,
  },
  verifiedBadgeDrawer: {
    backgroundColor: '#E0F2FE',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  verifiedBadgeDrawerTxt: {
    color: '#0284C7',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  profileName: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 2,
  },
  profilePhone: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '600',
    marginBottom: 8,
  },
  fullProfileDrawerBtn: {
    backgroundColor: '#E0F2FE',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginTop: 6,
    width: '100%',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  fullProfileDrawerBtnTxt: {
    color: '#0369A1',
    fontWeight: 'bold',
    fontSize: 13,
  },
  infoBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  infoBoxLabel: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
  },
  infoBoxValue: {
    fontSize: 12,
    color: '#0F172A',
    fontWeight: '700',
  },
  infoBoxValueBadge: {
    fontSize: 11,
    color: '#0284C7',
    backgroundColor: '#E0F2FE',
    fontWeight: 'bold',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  infoBoxValueHighlight: {
    fontSize: 12,
    color: '#DC2626',
    fontWeight: 'bold',
  },
  menuSection: {
    marginTop: 8,
    marginBottom: 16,
  },
  menuSectionTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.8,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  settingsRowCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F0F9FF',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#7DD3FC',
  },
  settingsRowLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  settingsRowValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0284C7',
  },
  drawerActions: {
    gap: 10,
  },
  drawerActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  drawerActionIcon: {
    fontSize: 18,
    marginRight: 12,
  },
  drawerActionTxt: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
  },
  logoutWrapper: {
    marginTop: 8,
    marginBottom: 16,
  },
  sidebarLogoutFooter: {
    paddingVertical: 14,
    paddingHorizontal: 4,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  sosNotificationBanner: {
    backgroundColor: '#DC2626',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginHorizontal: 12,
    marginTop: 8,
    borderRadius: 12,
    shadowColor: '#DC2626',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 6,
  },
  sosNotificationIcon: {
    fontSize: 24,
    marginRight: 10,
  },
  sosNotificationTitle: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 13,
    letterSpacing: 0.5,
  },
  sosNotificationSub: {
    color: '#FEE2E2',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  sosNotificationCoords: {
    color: '#FEF08A',
    fontSize: 10,
    fontWeight: 'bold',
    marginTop: 2,
  },
  sosNotificationActionBtn: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    marginLeft: 8,
  },
  sosNotificationActionTxt: {
    color: '#DC2626',
    fontWeight: 'bold',
    fontSize: 11,
  },
  sirenSoundBtn: {
    backgroundColor: '#FEF08A',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 8,
    marginLeft: 6,
    borderWidth: 1,
    borderColor: '#EAB308',
  },
  sirenSoundBtnTxt: {
    color: '#854D0E',
    fontWeight: '900',
    fontSize: 10,
  },
  assignNowBtn: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    marginLeft: 6,
    borderWidth: 1,
    borderColor: '#FEE2E2',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  assignNowBtnTxt: {
    color: '#DC2626',
    fontWeight: '900',
    fontSize: 10,
    letterSpacing: 0.3,
  },
  unassignedBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.5)',
  },
  unassignedBadgeTxt: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
});
