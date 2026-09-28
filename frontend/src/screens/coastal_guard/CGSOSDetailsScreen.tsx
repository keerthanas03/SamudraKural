import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Linking,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../../theme/colors';
import { coastalGuardService, SOSAlertItem } from '../../services/coastalGuardService';
import { CoastalGuardMapComponent } from '../../components/CoastalGuardMapComponent';

interface CGSOSDetailsScreenProps {
  sosId: number;
  onBack: () => void;
  onAssignMission: (sos: SOSAlertItem) => void;
}

export const CGSOSDetailsScreen: React.FC<CGSOSDetailsScreenProps> = ({
  sosId,
  onBack,
  onAssignMission,
}) => {
  const [alert, setAlert] = useState<SOSAlertItem | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [actionLoading, setActionLoading] = useState<boolean>(false);

  useEffect(() => {
    fetchDetail(false);
    const timer = setInterval(() => {
      fetchDetail(true);
    }, 3000);
    return () => clearInterval(timer);
  }, [sosId]);

  const fetchDetail = async (isSilent: boolean = false) => {
    if (!isSilent) setLoading(true);
    try {
      const data = await coastalGuardService.getSOSAlertDetail(sosId);
      setAlert(data);
    } catch (e) {
      console.log('[CGSOSDetails] Fetch detail error:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleAcknowledge = async () => {
    if (!alert) return;
    setActionLoading(true);
    try {
      const updated = await coastalGuardService.acknowledgeSOS(alert.id);
      setAlert(updated);
      Alert.alert('SOS Acknowledged ✅', 'Alert status updated to ACKNOWLEDGED in Command HQ.');
    } catch (e) {
      Alert.alert('Action Failed', 'Could not acknowledge alert at this time.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleResolve = async () => {
    if (!alert) return;
    Alert.alert(
      'Resolve Emergency SOS',
      'Are you sure the vessel and crew are safely secured and resolved?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm Resolve',
          style: 'destructive',
          onPress: async () => {
            setActionLoading(true);
            try {
              const updated = await coastalGuardService.updateSOSStatus(alert.id, 'RESOLVED', 'Resolved by Command Officer');
              setAlert(updated);
              Alert.alert('SOS Resolved 🎉', 'Emergency alert has been marked as RESOLVED.');
            } catch (e) {
              Alert.alert('Action Failed', 'Could not update SOS status.');
            } finally {
              setActionLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleCall = (phoneNumber?: string) => {
    if (!phoneNumber) {
      Alert.alert('Phone Unavailable', 'No registered contact number available for this entry.');
      return;
    }
    Linking.openURL(`tel:${phoneNumber}`).catch(() => {
      Alert.alert('Call Action', `Dialing contact number: ${phoneNumber}`);
    });
  };

  if (loading || !alert) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.cgPrimary} />
          <Text style={styles.loadingTxt}>Fetching SOS Emergency Details...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const isAcknowledged = alert.status === 'ACKNOWLEDGED' || alert.status === 'RESCUE_ASSIGNED' || alert.status === 'RESOLVED';
  const isResolved = alert.status === 'RESOLVED';

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.cgPrimaryDark} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack}>
          <Text style={styles.backTxt}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>SOS Alert #{alert.id}</Text>
        <View style={styles.priorityBadge}>
          <Text style={styles.priorityTxt}>{alert.priority}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Top Emergency Highlight Box */}
        <View style={styles.alertHeaderCard}>
          <View style={styles.alertHeaderTop}>
            <Text style={styles.emergencyIcon}>🚨</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.emergencyTypeTitle}>{alert.emergency_type}</Text>
              <Text style={styles.emergencyTime}>Created at: {new Date(alert.created_at).toLocaleString()}</Text>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: isResolved ? '#D1FAE5' : '#FEE2E2' }]}>
              <Text style={[styles.statusBadgeTxt, { color: isResolved ? '#065F46' : '#991B1B' }]}>
                {alert.status}
              </Text>
            </View>
          </View>
          <Text style={styles.descriptionTxt}>{alert.description}</Text>
        </View>

        {/* 1. Fisherman & Vessel Information */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionHeading}>👤 Fisherman & Vessel Info</Text>
          <View style={styles.infoGrid}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Fisherman Name:</Text>
              <Text style={styles.infoVal}>{alert.fisherman?.name || 'Fisherman User'}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Boat Name:</Text>
              <Text style={styles.infoVal}>{alert.boat?.name || 'Sea Star'}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Registration No:</Text>
              <Text style={styles.infoVal}>{alert.boat?.registration || 'IND-TN-02-MM-4412'}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Vessel Type:</Text>
              <Text style={styles.infoVal}>{alert.boat?.vessel_type || 'Trawler'}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Home Port:</Text>
              <Text style={styles.infoVal}>{alert.fisherman?.home_port || 'Chennai Harbour'}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>People Affected:</Text>
              <Text style={[styles.infoVal, { color: '#DC2626', fontWeight: '900' }]}>
                {alert.people_affected} Crew Members
              </Text>
            </View>
          </View>

          {/* Contact Actions */}
          <View style={styles.contactBtnRow}>
            <TouchableOpacity
              style={styles.contactBtn}
              onPress={() => handleCall(alert.fisherman?.phone)}
            >
              <Text style={styles.contactBtnTxt}>📞 Call Fisherman</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.contactBtn, styles.contactBtnSecondary]}
              onPress={() => handleCall(alert.fisherman?.emergency_phone)}
            >
              <Text style={styles.contactBtnTxtSecondary}>📞 Emergency Contact</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* 2. Emergency GPS Location & Map */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionHeading}>📍 Emergency GPS Location</Text>
          <View style={styles.locationDetailsRow}>
            <View style={styles.locItem}>
              <Text style={styles.locLabel}>Latitude</Text>
              <Text style={styles.locVal}>{alert.latitude.toFixed(4)}° N</Text>
            </View>
            <View style={styles.locItem}>
              <Text style={styles.locLabel}>Longitude</Text>
              <Text style={styles.locVal}>{alert.longitude.toFixed(4)}° E</Text>
            </View>
            <View style={styles.locItem}>
              <Text style={styles.locLabel}>Distance to Port</Text>
              <Text style={styles.locVal}>{alert.distance_to_nearest_port_km || 14.2} km</Text>
            </View>
          </View>

          <View style={{ marginTop: 12 }}>
            <CoastalGuardMapComponent
              height={480}
              sosAlerts={[alert]}
              center={{ lat: alert.latitude, lon: alert.longitude }}
            />
          </View>
        </View>

        {/* 3. Audit Timeline History */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionHeading}>⏱️ Incident Audit Timeline</Text>

          <View style={styles.timelineList}>
            <View style={styles.timelineItem}>
              <Text style={styles.timelineIcon}>🟢</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.timelineTitle}>SOS Triggered by Mobile GPS</Text>
                <Text style={styles.timelineTime}>{new Date(alert.created_at).toLocaleString()}</Text>
              </View>
            </View>

            {alert.acknowledged_at && (
              <View style={styles.timelineItem}>
                <Text style={styles.timelineIcon}>🔵</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.timelineTitle}>Acknowledged by Command HQ</Text>
                  <Text style={styles.timelineTime}>{new Date(alert.acknowledged_at).toLocaleString()}</Text>
                </View>
              </View>
            )}

            {alert.rescue_mission && (
              <View style={styles.timelineItem}>
                <Text style={styles.timelineIcon}>🛥️</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.timelineTitle}>
                    Rescue Mission Dispatched ({alert.rescue_mission.rescue_vessel})
                  </Text>
                  <Text style={styles.timelineTime}>ETA: {alert.rescue_mission.eta_minutes} mins</Text>
                </View>
              </View>
            )}

            {alert.resolved_at && (
              <View style={styles.timelineItem}>
                <Text style={styles.timelineIcon}>✅</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.timelineTitle}>Emergency Resolved & Vessel Secured</Text>
                  <Text style={styles.timelineTime}>{new Date(alert.resolved_at).toLocaleString()}</Text>
                </View>
              </View>
            )}
          </View>
        </View>

        {/* Operational Action Buttons Bar */}
        {!isResolved && (
          <View style={styles.actionsBar}>
            {!isAcknowledged && (
              <TouchableOpacity
                style={styles.ackBtn}
                disabled={actionLoading}
                onPress={handleAcknowledge}
              >
                <Text style={styles.ackBtnTxt}>
                  {actionLoading ? 'Processing...' : '✓ Acknowledge Alert'}
                </Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={styles.missionBtn}
              onPress={() => onAssignMission(alert)}
            >
              <Text style={styles.missionBtnTxt}>🛥️ Assign Rescue Mission</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.resolveBtn}
              disabled={actionLoading}
              onPress={handleResolve}
            >
              <Text style={styles.resolveBtnTxt}>✅ Mark as Resolved</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.cgBackground,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingTxt: {
    marginTop: 12,
    fontSize: 14,
    color: Colors.cgPrimary,
    fontWeight: '600',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.cgPrimaryDark,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  backBtn: {
    paddingVertical: 4,
    paddingRight: 10,
  },
  backTxt: {
    color: '#38BDF8',
    fontSize: 14,
    fontWeight: '700',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  priorityBadge: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  priorityTxt: {
    color: '#DC2626',
    fontSize: 10,
    fontWeight: '900',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 100,
  },
  alertHeaderCard: {
    backgroundColor: Colors.cgSurface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1.5,
    borderColor: '#FCA5A5',
  },
  alertHeaderTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  emergencyIcon: {
    fontSize: 28,
  },
  emergencyTypeTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: Colors.cgPrimary,
  },
  emergencyTime: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusBadgeTxt: {
    fontSize: 11,
    fontWeight: '800',
  },
  descriptionTxt: {
    fontSize: 13,
    color: '#334155',
    lineHeight: 20,
    fontWeight: '500',
  },
  sectionCard: {
    backgroundColor: Colors.cgSurface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1.5,
    borderColor: Colors.cgBorder,
  },
  sectionHeading: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.cgPrimary,
    marginBottom: 12,
  },
  infoGrid: {
    gap: 8,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#EBF4FC',
  },
  infoLabel: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
  },
  infoVal: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1E293B',
  },
  contactBtnRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  contactBtn: {
    flex: 1,
    backgroundColor: Colors.cgPrimary,
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
  },
  contactBtnTxt: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  contactBtnSecondary: {
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  contactBtnTxtSecondary: {
    color: Colors.cgPrimary,
    fontSize: 12,
    fontWeight: '800',
  },
  locationDetailsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: '#F8FAFC',
    padding: 12,
    borderRadius: 12,
  },
  locItem: {
    alignItems: 'center',
  },
  locLabel: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '700',
  },
  locVal: {
    fontSize: 16,
    fontWeight: '900',
    color: Colors.cgPrimary,
    marginTop: 2,
  },
  timelineList: {
    gap: 12,
  },
  timelineItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  timelineIcon: {
    fontSize: 14,
  },
  timelineTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E293B',
  },
  timelineTime: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  actionsBar: {
    gap: 10,
    marginTop: 10,
  },
  ackBtn: {
    backgroundColor: '#0284C7',
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: 'center',
  },
  ackBtnTxt: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  missionBtn: {
    backgroundColor: Colors.cgPrimary,
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: 'center',
  },
  missionBtnTxt: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  resolveBtn: {
    backgroundColor: '#10B981',
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: 'center',
  },
  resolveBtnTxt: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
});
