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
import { coastalGuardService, RescueMissionItem } from '../../services/coastalGuardService';

interface CGRescueMissionsScreenProps {
  onSelectMission: (missionId: number) => void;
  hideTopHeader?: boolean;
}

export const CGRescueMissionsScreen: React.FC<CGRescueMissionsScreenProps> = ({
  onSelectMission,
  hideTopHeader = false,
}) => {
  const [missions, setMissions] = useState<RescueMissionItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'ACTIVE' | 'COMPLETED' | 'CANCELLED'>('ACTIVE');

  useEffect(() => {
    fetchMissions(false);
    const timer = setInterval(() => {
      fetchMissions(true);
    }, 3000);
    return () => clearInterval(timer);
  }, [activeTab]);

  const fetchMissions = async (isSilent: boolean = false) => {
    if (!isSilent) setLoading(true);
    try {
      const data = await coastalGuardService.getMissions(activeTab);
      setMissions(data);
    } catch (e) {
      console.log('[CGRescueMissions] Fetch error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchMissions();
  };

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'DEPARTED':
      case 'APPROACHING':
        return { bg: '#E0F2FE', text: '#0284C7' };
      case 'VICTIM_LOCATED':
        return { bg: '#FEF3C7', text: '#D97706' };
      case 'COMPLETED':
        return { bg: '#D1FAE5', text: '#059669' };
      default:
        return { bg: '#F1F5F9', text: '#475569' };
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.cgPrimaryDark} />

      {/* Header */}
      {!hideTopHeader && (
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Rescue Missions</Text>
          <Text style={styles.headerSub}>Coastal Guard Operational Dispatches</Text>
        </View>
      )}

      {/* Tabs Bar */}
      <View style={styles.tabBar}>
        {(['ACTIVE', 'COMPLETED', 'CANCELLED'] as const).map((tab) => {
          const isActive = activeTab === tab;
          return (
            <TouchableOpacity
              key={tab}
              style={[styles.tabChip, isActive && styles.tabChipActive]}
              onPress={() => setActiveTab(tab)}
            >
              <Text style={[styles.tabTxt, isActive && styles.tabTxtActive]}>{tab}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={Colors.cgPrimary} />
        }
      >
        {loading ? (
          <ActivityIndicator size="large" color={Colors.cgPrimary} style={{ marginVertical: 40 }} />
        ) : missions.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyIcon}>🛥️</Text>
            <Text style={styles.emptyTitle}>No Rescue Missions Found</Text>
            <Text style={styles.emptySub}>There are currently no missions in the {activeTab.toLowerCase()} state.</Text>
          </View>
        ) : (
          missions.map((mission) => {
            const statusTheme = getStatusStyle(mission.status);

            return (
              <TouchableOpacity
                key={mission.id}
                style={styles.missionCard}
                activeOpacity={0.8}
                onPress={() => onSelectMission(mission.id)}
              >
                <View style={styles.cardHeaderRow}>
                  <View style={styles.missionTitleGroup}>
                    <Text style={styles.vesselIcon}>🛥️</Text>
                    <View>
                      <Text style={styles.missionIdTxt}>Mission #{mission.id}</Text>
                      <Text style={styles.vesselNameTxt}>{mission.rescue_vessel}</Text>
                    </View>
                  </View>

                  <View style={[styles.statusBadge, { backgroundColor: statusTheme.bg }]}>
                    <Text style={[styles.statusBadgeTxt, { color: statusTheme.text }]}>
                      {mission.status}
                    </Text>
                  </View>
                </View>

                <View style={styles.missionBody}>
                  <Text style={styles.teamTxt}>Squadron: <Text style={{ fontWeight: '700', color: '#1E293B' }}>{mission.rescue_team}</Text></Text>
                  <Text style={styles.officerTxt}>Officer: <Text style={{ fontWeight: '700', color: '#1E293B' }}>{mission.officer_name}</Text></Text>
                  {mission.notes ? <Text style={styles.notesTxt} numberOfLines={2}>{mission.notes}</Text> : null}
                </View>

                <View style={styles.cardFooterRow}>
                  <Text style={styles.etaTxt}>⏱️ ETA: {mission.eta_minutes} mins</Text>
                  <Text style={styles.viewDetailTxt}>View Mission Execution ➔</Text>
                </View>
              </TouchableOpacity>
            );
          })
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
  header: {
    backgroundColor: Colors.cgPrimaryDark,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  headerSub: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
  },
  tabBar: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  tabChip: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 14,
    backgroundColor: Colors.cgSurface,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.cgBorder,
  },
  tabChipActive: {
    backgroundColor: Colors.cgPrimary,
    borderColor: Colors.cgPrimaryDark,
  },
  tabTxt: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.cgTextSecondary,
  },
  tabTxtActive: {
    color: '#FFFFFF',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 100,
  },
  missionCard: {
    backgroundColor: Colors.cgSurface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1.5,
    borderColor: Colors.cgBorder,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  missionTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  vesselIcon: {
    fontSize: 24,
  },
  missionIdTxt: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.cgAccent,
  },
  vesselNameTxt: {
    fontSize: 15,
    fontWeight: '900',
    color: Colors.cgPrimary,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  statusBadgeTxt: {
    fontSize: 10,
    fontWeight: '900',
  },
  missionBody: {
    gap: 4,
    marginBottom: 10,
  },
  teamTxt: {
    fontSize: 12,
    color: Colors.cgTextSecondary,
  },
  officerTxt: {
    fontSize: 12,
    color: Colors.cgTextSecondary,
  },
  notesTxt: {
    fontSize: 12,
    color: Colors.cgText,
    fontStyle: 'italic',
    marginTop: 4,
  },
  cardFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#EBF4FC',
    paddingTop: 8,
  },
  etaTxt: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.cgPrimary,
  },
  viewDetailTxt: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.cgAccent,
  },
  emptyCard: {
    backgroundColor: Colors.cgSurface,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: Colors.cgBorder,
    marginTop: 20,
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
    color: Colors.cgTextSecondary,
    marginTop: 4,
  },
});
