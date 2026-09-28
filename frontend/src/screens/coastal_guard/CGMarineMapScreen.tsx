import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../../theme/colors';
import {
  coastalGuardService,
  SOSAlertItem,
  RiskZoneItem,
  RescueMissionItem,
} from '../../services/coastalGuardService';
import { CoastalGuardMapComponent } from '../../components/CoastalGuardMapComponent';

interface CGMarineMapScreenProps {
  onBack: () => void;
}

export const CGMarineMapScreen: React.FC<CGMarineMapScreenProps> = ({ onBack }) => {
  const [sosAlerts, setSosAlerts] = useState<SOSAlertItem[]>([]);
  const [riskZones, setRiskZones] = useState<RiskZoneItem[]>([]);
  const [missions, setMissions] = useState<RescueMissionItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    fetchMapData(false);
    const timer = setInterval(() => {
      fetchMapData(true);
    }, 4000);
    return () => clearInterval(timer);
  }, []);

  const fetchMapData = async (isSilent: boolean = false) => {
    if (!isSilent) setLoading(true);
    try {
      const [alerts, zones, mList] = await Promise.all([
        coastalGuardService.getSOSAlerts('ALL'),
        coastalGuardService.getRiskZones(),
        coastalGuardService.getMissions('ALL'),
      ]);
      setSosAlerts(alerts);
      setRiskZones(zones);
      setMissions(mList);
    } catch (e) {
      console.log('[CGMarineMap] Fetch error:', e);
    } finally {
      setLoading(false);
    }
  };

  const activeSosCount = sosAlerts.filter(a => a.status === 'NEW' || a.status === 'ACKNOWLEDGED' || a.status === 'RESCUE_IN_PROGRESS').length;
  const activeMissionCount = missions.filter(m => m.status === 'ASSIGNED' || m.status === 'DEPARTED' || m.status === 'APPROACHING').length;

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.cgPrimaryDark} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack}>
          <Text style={styles.backTxt}>← Back</Text>
        </TouchableOpacity>
        <View style={styles.titleContainer}>
          <Text style={styles.headerTitle}>Tactical Marine Radar</Text>
          <Text style={styles.headerSubtitle}>
            {activeSosCount > 0 ? `${activeSosCount} Active SOS Alerts` : 'Perimeter Normal'} • {activeMissionCount} Patrols Deployed
          </Text>
        </View>
        <TouchableOpacity style={styles.refreshBtn} onPress={() => fetchMapData(false)}>
          <Text style={styles.refreshTxt}>Refresh</Text>
        </TouchableOpacity>
      </View>

      {/* Map Content */}
      <View style={styles.mapContainer}>
        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color={Colors.cgPrimary} />
            <Text style={styles.loadingTxt}>Loading Satellite Coordinates...</Text>
          </View>
        ) : (
          <CoastalGuardMapComponent
            height="100%"
            sosAlerts={sosAlerts}
            riskZones={riskZones}
            missions={missions}
          />
        )}
      </View>

      {/* Map Legend */}
      <View style={styles.legendBar}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#EF4444', shadowColor: '#EF4444' }]} />
          <Text style={styles.legendTxt}>SOS Alert</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#0284C7', shadowColor: '#38BDF8' }]} />
          <Text style={styles.legendTxt}>Patrol Boat</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#10B981', shadowColor: '#34D399' }]} />
          <Text style={styles.legendTxt}>Command HQ</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#F59E0B', shadowColor: '#F59E0B' }]} />
          <Text style={styles.legendTxt}>Risk Zone</Text>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.cgBackground || '#F0F6FB',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.cgPrimary || '#1D4E89',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.15)',
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  backBtn: {
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
  },
  backTxt: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  titleContainer: {
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.4,
  },
  headerSubtitle: {
    fontSize: 11,
    color: '#DCEBFA',
    fontWeight: '600',
    marginTop: 2,
  },
  refreshBtn: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
  refreshTxt: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  mapContainer: {
    flex: 1,
    margin: 10,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: Colors.cgBorder || '#B2D5F5',
    backgroundColor: '#020C17',
    elevation: 4,
    shadowColor: '#1D4E89',
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  loadingBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#020C17',
  },
  loadingTxt: {
    marginTop: 12,
    fontSize: 13,
    color: '#93C5FD',
    fontWeight: '600',
  },
  legendBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: '#FFFFFF',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    marginHorizontal: 10,
    marginBottom: 8,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    elevation: 2,
    shadowOpacity: 0.6,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 0 },
  },
  legendTxt: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1E293B',
  },
});

