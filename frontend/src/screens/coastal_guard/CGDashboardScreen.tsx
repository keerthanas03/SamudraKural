import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../../theme/colors';
import {
  coastalGuardService,
  CoastalGuardDashboardData,
  SOSAlertItem,
  RiskZoneItem,
  RescueMissionItem,
} from '../../services/coastalGuardService';
import { CoastalGuardMapComponent } from '../../components/CoastalGuardMapComponent';

interface CGDashboardScreenProps {
  onNavigateToSOSList: () => void;
  onNavigateToSOSDetail: (id: number) => void;
  onNavigateToMissions: () => void;
  onNavigateToMarineMap: () => void;
  onNavigateToMarineData: () => void;
  onOpenProfile: () => void;
  hideTopHeader?: boolean;
}

export const CGDashboardScreen: React.FC<CGDashboardScreenProps> = ({
  onNavigateToSOSList,
  onNavigateToSOSDetail,
  onNavigateToMissions,
  onNavigateToMarineMap,
  onNavigateToMarineData,
  onOpenProfile,
  hideTopHeader = false,
}) => {
  const [dashboardData, setDashboardData] = useState<CoastalGuardDashboardData | null>(null);
  const [latestAlerts, setLatestAlerts] = useState<SOSAlertItem[]>([]);
  const [riskZones, setRiskZones] = useState<RiskZoneItem[]>([]);
  const [missions, setMissions] = useState<RescueMissionItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [lastUpdatedTime, setLastUpdatedTime] = useState<string>('');
  const [newSOSNotification, setNewSOSNotification] = useState<SOSAlertItem | null>(null);

  useEffect(() => {
    fetchData();

    // Subscribe to instant SOS alert transmissions and status updates
    const unsubscribe = coastalGuardService.subscribeToSOS((updatedAlert) => {
      if (updatedAlert.status === 'NEW') {
        setNewSOSNotification(updatedAlert);
      }
      fetchData(true);
    });

    // 20-second automatic polling for live SOS emergency monitoring
    const timer = setInterval(() => {
      fetchData(true);
    }, 20000);

    return () => {
      unsubscribe();
      clearInterval(timer);
    };
  }, []);

  const fetchData = async (isSilent: boolean = false) => {
    if (!isSilent) setLoading(true);
    try {
      const [dash, alerts, zones, mList] = await Promise.all([
        coastalGuardService.getDashboard(),
        coastalGuardService.getSOSAlerts('ALL'),
        coastalGuardService.getRiskZones().catch(() => []),
        coastalGuardService.getMissions('ALL').catch(() => []),
      ]);
      setDashboardData(dash);
      setLatestAlerts(alerts);
      setRiskZones(zones);
      setMissions(mList);
      setLastUpdatedTime(new Date().toLocaleTimeString());
    } catch (e) {
      console.log('[CG Dashboard] Fetch failed:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const getPriorityStyle = (priority: string) => {
    switch (priority) {
      case 'CRITICAL':
        return { bg: '#FEE2E2', border: '#DC2626', text: '#DC2626' };
      case 'HIGH':
        return { bg: '#FFEDD5', border: '#EA580C', text: '#EA580C' };
      case 'MEDIUM':
        return { bg: '#FEF3C7', border: '#F59E0B', text: '#D97706' };
      default:
        return { bg: '#E0F2FE', border: '#0284C7', text: '#0284C7' };
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.cgPrimaryDark} />

      {/* Top Header Banner */}
      {!hideTopHeader && (
        <View style={styles.header}>
          <View>
            <Text style={styles.brandingApp}>SAMUDRA KURAL</Text>
            <Text style={styles.brandingSub}>Coastal Guard Command Center</Text>
            <Text style={styles.brandingTagline}>Safer Seas, Stronger Communities</Text>
          </View>

          <TouchableOpacity style={styles.profileBtn} onPress={onOpenProfile}>
            <Text style={styles.profileIcon}>👮</Text>
          </TouchableOpacity>
        </View>
      )}

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={Colors.cgPrimary} />
        }
      >
        {/* Instant SOS Distress Alert Notification Banner */}
        {newSOSNotification && (
          <View style={styles.emergencyNotifCard}>
            <View style={styles.emergencyNotifHeader}>
              <View style={styles.emergencyNotifTitleGroup}>
                <Text style={styles.emergencyNotifIcon}>🚨</Text>
                <Text style={styles.emergencyNotifTitle}>CRITICAL SOS DISTRESS ALERT RECEIVED!</Text>
              </View>
              <TouchableOpacity onPress={() => setNewSOSNotification(null)}>
                <Text style={styles.emergencyNotifClose}>✕</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.emergencyNotifBody}>
              Vessel <Text style={{ fontWeight: 'bold' }}>{newSOSNotification.boat?.name || 'Fisherman Unit'}</Text> transmitted <Text style={{ fontWeight: 'bold', color: '#EF4444' }}>{newSOSNotification.emergency_type}</Text> at {newSOSNotification.latitude.toFixed(4)}°N, {newSOSNotification.longitude.toFixed(4)}°E.
            </Text>

            <TouchableOpacity
              style={styles.dispatchActionBtn}
              activeOpacity={0.85}
              onPress={() => {
                const alertId = newSOSNotification.id;
                setNewSOSNotification(null);
                onNavigateToSOSDetail(alertId);
              }}
            >
              <Text style={styles.dispatchActionTxt}>Dispatch Rescue Team & View Incident ➔</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* 1. GLASSMORPHIC COASTAL COMMAND HERO RADAR CARD */}
        <View style={styles.heroGpsCard}>
          <View style={styles.heroCardHeaderRow}>
            <View style={styles.compassHeaderGroup}>
              <Text style={styles.compassIcon}>📡</Text>
              <Text style={styles.heroGpsTitle}>COASTAL COMMAND RADAR</Text>
            </View>

            <View style={styles.heroGpsBadge}>
              <View style={styles.heroGpsDot} />
              <Text style={styles.heroGpsBadgeText}>RADAR ACTIVE 🟢</Text>
            </View>
          </View>

          <View style={styles.heroGpsValueBox}>
            <View style={styles.coordColumn}>
              <Text style={styles.coordLabel}>SECTOR LAT</Text>
              <Text style={styles.coordValue} numberOfLines={1} adjustsFontSizeToFit={true}>
                13.0827° N
              </Text>
            </View>

            <View style={styles.coordDivider} />

            <View style={styles.coordColumn}>
              <Text style={styles.coordLabel}>SECTOR LON</Text>
              <Text style={styles.coordValue} numberOfLines={1} adjustsFontSizeToFit={true}>
                80.2707° E
              </Text>
            </View>
          </View>

          <View style={styles.gpsLocationRow}>
            <Text style={styles.gpsLocationIcon}>📍</Text>
            <Text style={styles.heroGpsSubText} numberOfLines={1}>
              Bay of Bengal Coastal Sector HQ (Tamil Nadu Coast)
            </Text>
          </View>
        </View>

        {/* 2. COMMAND TELEMETRY METRICS GRID */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>COMMAND & RESCUE TELEMETRY</Text>
          <View style={styles.telemetryLiveBadge}>
            <Text style={styles.telemetryLiveBadgeText}>LIVE TELEMETRY</Text>
          </View>
        </View>

        <View style={styles.telemetryGrid}>
          {/* Card 1: Active SOS Alerts */}
          <TouchableOpacity
            style={[styles.telemetryCard, (dashboardData?.active_sos_count ?? 0) > 0 && styles.cardCriticalAlert]}
            activeOpacity={0.8}
            onPress={onNavigateToSOSList}
          >
            <View style={styles.telemetryCardTop}>
              <View style={[styles.telemetryIconCircle, { backgroundColor: '#FEE2E2' }]}>
                <Text style={styles.telemetryIcon}>🚨</Text>
              </View>
            </View>
            <Text style={[styles.telemetryValue, { color: Colors.cgCritical }]}>
              {dashboardData?.active_sos_count ?? 0}
            </Text>
            <Text style={styles.telemetryLabel}>Active SOS Alerts</Text>
            <Text style={styles.telemetrySub}>
              {dashboardData?.critical_alerts_count ?? 0} Critical Distress
            </Text>
          </TouchableOpacity>

          {/* Card 2: Rescue Missions */}
          <TouchableOpacity
            style={styles.telemetryCard}
            activeOpacity={0.8}
            onPress={onNavigateToMissions}
          >
            <View style={styles.telemetryCardTop}>
              <View style={[styles.telemetryIconCircle, { backgroundColor: Colors.cgSecondary }]}>
                <Text style={styles.telemetryIcon}>🛥️</Text>
              </View>
            </View>
            <Text style={styles.telemetryValue}>
              {dashboardData?.active_rescue_missions_count ?? 0}
            </Text>
            <Text style={styles.telemetryLabel}>Active Missions</Text>
            <Text style={styles.telemetrySub}>Vessels Deployed</Text>
          </TouchableOpacity>

          {/* Card 3: Resolved Today */}
          <TouchableOpacity
            style={styles.telemetryCard}
            activeOpacity={0.8}
            onPress={onNavigateToSOSList}
          >
            <View style={styles.telemetryCardTop}>
              <View style={[styles.telemetryIconCircle, { backgroundColor: '#DCFCE7' }]}>
                <Text style={styles.telemetryIcon}>✅</Text>
              </View>
            </View>
            <Text style={[styles.telemetryValue, { color: Colors.cgSuccess }]}>
              {dashboardData?.resolved_today_count ?? 0}
            </Text>
            <Text style={styles.telemetryLabel}>Resolved Today</Text>
            <Text style={styles.telemetrySub}>Safely Rescued</Text>
          </TouchableOpacity>

          {/* Card 4: High-Risk Zones */}
          <TouchableOpacity
            style={styles.telemetryCard}
            activeOpacity={0.8}
            onPress={onNavigateToMarineData}
          >
            <View style={styles.telemetryCardTop}>
              <View style={[styles.telemetryIconCircle, { backgroundColor: '#FEF3C7' }]}>
                <Text style={styles.telemetryIcon}>⚠️</Text>
              </View>
            </View>
            <Text style={[styles.telemetryValue, { color: Colors.cgHigh }]}>
              {dashboardData?.high_risk_zones_count ?? 0}
            </Text>
            <Text style={styles.telemetryLabel}>High-Risk Zones</Text>
            <Text style={styles.telemetrySub}>Sea Swell Hazards</Text>
          </TouchableOpacity>
        </View>

        {/* 3. LIVE COASTAL SATELLITE RADAR MAP */}
        <View style={styles.mapCardSection}>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.sectionHeaderTitleGroup}>
              <Text style={styles.sectionTitle}>🗺️ LIVE COASTAL SATELLITE RADAR</Text>
            </View>
            <TouchableOpacity style={styles.viewMapBtn} onPress={onNavigateToMarineMap}>
              <Text style={styles.viewMapTxt}>Full Screen ➔</Text>
            </TouchableOpacity>
          </View>

          <CoastalGuardMapComponent
            height={520}
            sosAlerts={latestAlerts}
            riskZones={riskZones}
            missions={missions}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.cgBackground,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.cgPrimaryDark,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  brandingApp: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  brandingSub: {
    color: '#38BDF8',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 1,
  },
  brandingTagline: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '500',
  },
  profileBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#38BDF8',
  },
  profileIcon: {
    fontSize: 20,
  },
  statusBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#0F2942',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  livePulseContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10B981',
  },
  statusTxt: {
    color: '#10B981',
    fontSize: 11,
    fontWeight: '700',
  },
  timeTxt: {
    color: '#94A3B8',
    fontSize: 10,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 100,
  },
  /* Emergency Notification Card Styles */
  emergencyNotifCard: {
    backgroundColor: '#FEF2F2',
    borderColor: '#EF4444',
    borderWidth: 2,
    borderRadius: 18,
    padding: 16,
    marginBottom: 20,
    shadowColor: '#DC2626',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5,
  },
  emergencyNotifHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  emergencyNotifTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  emergencyNotifIcon: {
    fontSize: 22,
  },
  emergencyNotifTitle: {
    fontSize: 13,
    fontWeight: '900',
    color: '#991B1B',
    letterSpacing: 0.3,
  },
  emergencyNotifClose: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#991B1B',
    padding: 4,
  },
  emergencyNotifBody: {
    fontSize: 13,
    color: '#1E293B',
    lineHeight: 18,
    marginBottom: 14,
  },
  dispatchActionBtn: {
    backgroundColor: '#DC2626',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  dispatchActionTxt: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
  },
  /* 1. Hero Radar Card (Light Navy Glassmorphism) */
  heroGpsCard: {
    backgroundColor: '#EBF4FC',
    borderRadius: 24,
    padding: 18,
    borderWidth: 2,
    borderColor: Colors.cgPrimary,
    marginBottom: 16,
    shadowColor: Colors.cgPrimary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 4,
  },
  heroCardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  compassHeaderGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  compassIcon: {
    fontSize: 18,
  },
  heroGpsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.cgSurface,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 6,
    borderWidth: 1,
    borderColor: Colors.cgPrimary,
  },
  heroGpsDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10B981',
  },
  heroGpsBadgeText: {
    color: Colors.cgPrimaryDark,
    fontSize: 10.5,
    fontWeight: '900',
    letterSpacing: 0.4,
  },
  heroGpsTitle: {
    color: Colors.cgPrimaryDark,
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  heroGpsValueBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.cgSurface,
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 10,
    width: '100%',
    borderWidth: 1.5,
    borderColor: Colors.cgBorder,
    marginBottom: 12,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
  },
  coordColumn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  coordLabel: {
    color: Colors.cgPrimary,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.6,
    marginBottom: 2,
    textAlign: 'center',
  },
  coordValue: {
    color: Colors.cgPrimaryDark,
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: 0.4,
    textAlign: 'center',
  },
  coordDivider: {
    width: 1.5,
    height: 36,
    backgroundColor: Colors.cgBorder,
    marginHorizontal: 4,
  },
  gpsLocationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.cgSurface,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    width: '100%',
    borderWidth: 1,
    borderColor: Colors.cgBorder,
  },
  gpsLocationIcon: {
    fontSize: 14,
    marginRight: 6,
  },
  heroGpsSubText: {
    color: Colors.cgPrimaryDark,
    fontSize: 12.5,
    fontWeight: '800',
    textAlign: 'center',
  },
  /* 2. Command Telemetry Grid */
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
    marginBottom: 10,
  },
  sectionHeaderTitleGroup: {
    justifyContent: 'center',
  },
  sectionTitle: {
    color: Colors.cgText,
    fontSize: 14.5,
    fontWeight: '900',
    letterSpacing: 0.4,
  },
  telemetryLiveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EBF4FC',
    borderColor: Colors.cgPrimary,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  telemetryLiveBadgeText: {
    color: Colors.cgPrimaryDark,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.4,
  },
  telemetryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  telemetryCard: {
    width: '48.5%',
    backgroundColor: Colors.cgSurface,
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1.5,
    borderColor: Colors.cgBorder,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  cardCriticalAlert: {
    borderColor: Colors.cgCritical,
    backgroundColor: '#FFF5F5',
  },
  telemetryCardTop: {
    marginBottom: 8,
  },
  telemetryIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.cgSecondary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.cgBorder,
  },
  telemetryIcon: {
    fontSize: 18,
  },
  telemetryValue: {
    fontSize: 22,
    fontWeight: '900',
    color: Colors.cgPrimary,
    marginBottom: 2,
  },
  telemetryLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.cgText,
    marginBottom: 2,
  },
  telemetrySub: {
    fontSize: 11,
    color: Colors.cgTextSecondary,
    fontWeight: '600',
  },
  mapCardSection: {
    marginBottom: 20,
  },
  viewMapBtn: {
    backgroundColor: Colors.cgPrimary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  viewMapTxt: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  alertsSection: {
    marginBottom: 20,
  },
  viewAllTxt: {
    color: Colors.cgAccent,
    fontSize: 13,
    fontWeight: '700',
  },
  sosCard: {
    backgroundColor: Colors.cgSurface,
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(15, 58, 93, 0.15)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  sosTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  sosTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  sosTypeIcon: {
    fontSize: 22,
  },
  sosEmergencyTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.cgPrimary,
  },
  sosBoatName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
    marginTop: 1,
  },
  priorityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
  },
  priorityTxt: {
    fontSize: 10,
    fontWeight: '900',
  },
  sosDesc: {
    fontSize: 12,
    color: '#334155',
    lineHeight: 18,
    marginBottom: 10,
  },
  sosFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 8,
  },
  sosGpsTxt: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '500',
  },
  sosStatusTxt: {
    fontSize: 11,
    color: '#64748B',
  },
  emptyCard: {
    backgroundColor: Colors.cgSurface,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  emptyIcon: {
    fontSize: 36,
    marginBottom: 8,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.cgPrimary,
  },
  emptySub: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 4,
  },
});
