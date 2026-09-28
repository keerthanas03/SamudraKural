import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../theme/colors';
import { FishingNet, TrajectoryResponse, EnvironmentalState } from '../types/net';
import { FishermanGPS } from '../utils/location';
import { DriftMap } from './DriftMap';
import { EnvironmentCard } from './EnvironmentCard';
import { fetchNetDetails, regeneratePrediction } from '../services/netService';
import { useLanguage } from '../i18n';

interface NetDriftDetailModalProps {
  net: FishingNet | null;
  fishermanGPS?: FishermanGPS | null;
  visible: boolean;
  onClose: () => void;
  onNetUpdated?: () => void;
}

export const NetDriftDetailModal: React.FC<NetDriftDetailModalProps> = ({
  net,
  fishermanGPS,
  visible,
  onClose,
  onNetUpdated,
}) => {
  const { t, tDirection, tNetType } = useLanguage();
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [trajectory, setTrajectory] = useState<TrajectoryResponse | null>(null);
  const [environment, setEnvironment] = useState<EnvironmentalState | null>(null);

  useEffect(() => {
    if (visible && net) {
      loadDetails();
    }
  }, [visible, net]);

  const loadDetails = async () => {
    if (!net) return;
    setLoading(true);
    try {
      const data = await fetchNetDetails(net.id);
      setTrajectory(data.trajectory);
      setEnvironment(data.current_environment);
    } catch (err: any) {
      Alert.alert(t('genericError'), err.message || t('networkError'));
    } finally {
      setLoading(false);
    }
  };

  const handleRefreshPrediction = async () => {
    if (!net) return;
    setRefreshing(true);
    try {
      const updatedTraj = await regeneratePrediction(net.id);
      setTrajectory(updatedTraj);
      if (onNetUpdated) onNetUpdated();
    } catch (err: any) {
      Alert.alert(t('genericError'), err.message || t('networkError'));
    } finally {
      setRefreshing(false);
    }
  };

  if (!net) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <SafeAreaView style={styles.safeArea}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.titleArea}>
            <Text style={styles.headerTitle}>{net.name}</Text>
            <Text style={styles.headerSubtitle}>{tNetType(net.net_type_display || net.net_type)}</Text>
          </View>

          <View style={styles.headerActions}>
            <TouchableOpacity
              style={styles.refreshBtn}
              onPress={handleRefreshPrediction}
              disabled={refreshing}
            >
              <Text style={styles.refreshText}>{refreshing ? '⏳' : `🔄 ${t('refreshPrediction')}`}</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Text style={styles.closeText}>✕</Text>
            </TouchableOpacity>
          </View>
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={styles.loadingText}>{t('loading')}</Text>
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.scrollBody} showsVerticalScrollIndicator={false}>
            {/* Safety Disclaimer Banner */}
            <View style={styles.warningCard}>
              <Text style={styles.warningIcon}>⚠️</Text>
              <Text style={styles.warningText}>
                {t('predictedDriftDisclaimer')}
              </Text>
            </View>

            {/* Quick Status Highlights */}
            <View style={styles.statusGrid}>
              <View style={styles.statusTile}>
                <Text style={styles.tileLabel}>{t('deployment')}</Text>
                <Text style={styles.tileValue}>{net.elapsed_time_formatted}</Text>
              </View>

              <View style={styles.statusTile}>
                <Text style={styles.tileLabel}>{t('estimatedMovement')}</Text>
                <Text style={styles.tileValue}>
                  {trajectory ? `~${trajectory.latest_predicted_point.cumulative_distance_km} km` : '--'}
                </Text>
              </View>

              <View style={styles.statusTile}>
                <Text style={styles.tileLabel}>{t('likelyDirection')}</Text>
                <Text style={styles.tileValue}>
                  {trajectory ? tDirection(trajectory.latest_predicted_point.drift_direction_cardinal) : tDirection('Northeast')}
                </Text>
              </View>
            </View>

            {/* Probable Search Area Callout */}
            {trajectory && (
              <View style={styles.searchCallout}>
                <Text style={styles.searchCalloutTitle}>🎯 {t('probableSearchArea')}</Text>
                <Text style={styles.searchCalloutSector}>
                  {trajectory.search_area.sector_description}
                </Text>
                <Text style={styles.searchCalloutRadius}>
                  {t('uncertaintyRadius')}: ±{trajectory.search_area.uncertainty_radius_km} km ({t('aroundPredictedCenter')})
                </Text>
              </View>
            )}

            {/* Interactive Drift Map */}
            {trajectory && (
              <DriftMap
                points={trajectory.points}
                searchArea={trajectory.search_area}
                releaseLat={net.release_latitude}
                releaseLon={net.release_longitude}
                fishermanLat={fishermanGPS?.latitude}
                fishermanLon={fishermanGPS?.longitude}
              />
            )}

            {/* Ocean Conditions Card */}
            <EnvironmentCard environment={environment} />

            {/* Checkpoint Timeline */}
            {trajectory && trajectory.points.length > 0 && (
              <View style={styles.timelineCard}>
                <Text style={styles.timelineHeader}>⏱️ {t('trajectory')}</Text>
                {trajectory.points.map((pt, idx) => (
                  <View key={pt.step_number} style={styles.timelineItem}>
                    <View style={styles.timelineBullet}>
                      <View style={[styles.bulletInner, idx === trajectory.points.length - 1 && styles.bulletActive]} />
                    </View>
                    <View style={styles.timelineContent}>
                      <View style={styles.timelineRowTop}>
                        <Text style={styles.timelineTime}>{pt.prediction_time_ist}</Text>
                        <Text style={styles.timelineDist}>
                          {idx === 0 ? t('releasePoint') : `+${pt.cumulative_distance_km} km`}
                        </Text>
                      </View>
                      <Text style={styles.timelineSub}>
                        {tDirection(pt.drift_direction_cardinal)} @ {pt.drift_speed_mps.toFixed(2)} m/s ({pt.drift_speed_kmh.toFixed(1)} km/h)
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            )}

            {/* Bottom spacing */}
            <View style={{ height: 32 }} />
          </ScrollView>
        )}
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: Colors.primary,
  },
  titleArea: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  headerSubtitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#B0ECE8',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  refreshBtn: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  refreshText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: {
    fontSize: 16,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  loadingText: {
    marginTop: 14,
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  scrollBody: {
    padding: 16,
  },
  warningCard: {
    flexDirection: 'row',
    backgroundColor: '#FEF9E7',
    borderWidth: 1.5,
    borderColor: '#F39C12',
    borderRadius: 14,
    padding: 12,
    marginBottom: 14,
    alignItems: 'center',
  },
  warningIcon: {
    fontSize: 20,
    marginRight: 8,
  },
  warningText: {
    flex: 1,
    fontSize: 12,
    color: '#7D6608',
    fontWeight: '700',
    lineHeight: 16,
  },
  statusGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },
  statusTile: {
    flex: 1,
    minWidth: 100,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  tileLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textSecondary,
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  tileValue: {
    fontSize: 15,
    fontWeight: '900',
    color: Colors.text,
  },
  searchCallout: {
    backgroundColor: Colors.secondary,
    borderRadius: 16,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1.5,
    borderColor: Colors.secondaryDark,
  },
  searchCalloutTitle: {
    fontSize: 13,
    fontWeight: '900',
    color: Colors.primaryDark,
    marginBottom: 4,
  },
  searchCalloutSector: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.text,
    marginBottom: 4,
  },
  searchCalloutRadius: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  timelineCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginTop: 14,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  timelineHeader: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.text,
    marginBottom: 12,
  },
  timelineItem: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  timelineBullet: {
    width: 16,
    alignItems: 'center',
    marginRight: 8,
  },
  bulletInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.border,
    marginTop: 4,
  },
  bulletActive: {
    backgroundColor: Colors.primary,
  },
  timelineContent: {
    flex: 1,
  },
  timelineRowTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  timelineTime: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.text,
  },
  timelineDist: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.primaryDark,
  },
  timelineSub: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: '600',
    marginTop: 2,
  },
});
