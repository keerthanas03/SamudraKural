import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../../theme/colors';
import { coastalGuardService, SOSAlertItem } from '../../services/coastalGuardService';

interface CGSOSAlertsScreenProps {
  onSelectAlert: (id: number) => void;
  onBack?: () => void;
  hideTopHeader?: boolean;
}

export const CGSOSAlertsScreen: React.FC<CGSOSAlertsScreenProps> = ({
  onSelectAlert,
  onBack,
  hideTopHeader = false,
}) => {
  const [alerts, setAlerts] = useState<SOSAlertItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [activeFilter, setActiveFilter] = useState<string>('ACTIVE');
  const [searchQuery, setSearchQuery] = useState<string>('');

  useEffect(() => {
    fetchAlerts(false);
    const timer = setInterval(() => {
      fetchAlerts(true);
    }, 3000);
    return () => clearInterval(timer);
  }, [activeFilter, searchQuery]);

  const fetchAlerts = async (isSilent: boolean = false) => {
    if (!isSilent) setLoading(true);
    try {
      const data = await coastalGuardService.getSOSAlerts(
        activeFilter,
        undefined,
        searchQuery.trim() || undefined
      );
      setAlerts(data);
    } catch (e) {
      console.log('[CGSOSAlerts] Fetch error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchAlerts(false);
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
    <View style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.cgPrimaryDark} />

      {/* Header */}
      {!hideTopHeader && (
        <View style={styles.header}>
          <View style={styles.headerTitleGroup}>
            <Text style={styles.headerTitle}>SOS Alerts</Text>
            <Text style={styles.headerSub}>Real-time emergency alerts from fishermen</Text>
          </View>
        </View>
      )}

      {/* Search Input Bar */}
      <View style={styles.searchBarContainer}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Search by boat name, ID or location..."
          placeholderTextColor="#94A3B8"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery ? (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Text style={styles.clearSearch}>✕</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterBar}>
        {['ACTIVE', 'ALL', 'CRITICAL', 'HIGH', 'MEDIUM', 'RESOLVED'].map((filter) => {
          const isActive = activeFilter === filter;
          return (
            <TouchableOpacity
              key={filter}
              style={[styles.filterChip, isActive && styles.filterChipActive]}
              onPress={() => setActiveFilter(filter)}
            >
              <Text style={[styles.filterTxt, isActive && styles.filterTxtActive]}>
                {filter}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Alerts Content List */}
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={Colors.cgPrimary} />
        }
      >
        {loading ? (
          <ActivityIndicator size="large" color={Colors.cgPrimary} style={{ marginVertical: 40 }} />
        ) : alerts.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyIcon}>🚨</Text>
            <Text style={styles.emptyTitle}>No SOS Alerts Found</Text>
            <Text style={styles.emptySub}>
              {searchQuery ? 'No emergency alerts match your search query.' : 'There are no active SOS alerts in this category.'}
            </Text>
          </View>
        ) : (
          alerts.map((alert) => {
            const priorityTheme = getPriorityStyle(alert.priority);

            return (
              <TouchableOpacity
                key={alert.id}
                style={styles.alertCard}
                activeOpacity={0.8}
                onPress={() => onSelectAlert(alert.id)}
              >
                <View style={styles.cardTopRow}>
                  <View style={styles.typeGroup}>
                    <Text style={styles.sosIcon}>🚨</Text>
                    <View>
                      <Text style={styles.emergencyType}>{alert.emergency_type}</Text>
                      <Text style={styles.boatDetails}>
                        Boat: {alert.boat ? alert.boat.name : 'Unknown Vessel'} • {alert.people_affected} affected
                      </Text>
                    </View>
                  </View>

                  <View style={[styles.priorityBadge, { backgroundColor: priorityTheme.bg, borderColor: priorityTheme.border }]}>
                    <Text style={[styles.priorityTxt, { color: priorityTheme.text }]}>
                      {alert.priority}
                    </Text>
                  </View>
                </View>

                <Text style={styles.description} numberOfLines={2}>
                  {alert.description}
                </Text>

                <View style={styles.cardFooter}>
                  <View style={styles.gpsBadge}>
                    <Text style={styles.gpsCoordsText}>
                      📍 <Text style={styles.gpsCoordsVal}>{alert.latitude.toFixed(4)}° N, {alert.longitude.toFixed(4)}° E</Text>
                    </Text>
                  </View>
                  <View style={styles.statusGroup}>
                    <Text style={styles.statusTxt}>
                      Status: <Text style={{ fontWeight: '800', color: Colors.cgPrimary }}>{alert.status}</Text>
                    </Text>
                    <Text style={styles.chevron}>➔</Text>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>
    </View>
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
  headerTitleGroup: {
    justifyContent: 'center',
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
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.cgSurface,
    marginHorizontal: 16,
    marginTop: 12,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  searchIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 10,
    fontSize: 13,
    color: '#1E293B',
  },
  clearSearch: {
    fontSize: 14,
    color: '#94A3B8',
    padding: 4,
  },
  filterBar: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: Colors.cgSurface,
    borderWidth: 1,
    borderColor: Colors.cgBorder,
  },
  filterChipActive: {
    backgroundColor: Colors.cgPrimary,
    borderColor: Colors.cgPrimaryDark,
  },
  filterTxt: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.cgTextSecondary,
  },
  filterTxtActive: {
    color: '#FFFFFF',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 100,
  },
  alertCard: {
    backgroundColor: Colors.cgSurface,
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1.5,
    borderColor: Colors.cgBorder,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  typeGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  sosIcon: {
    fontSize: 22,
  },
  emergencyType: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.cgPrimary,
  },
  boatDetails: {
    fontSize: 12,
    color: Colors.cgTextSecondary,
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
  description: {
    fontSize: 12,
    color: Colors.cgText,
    lineHeight: 18,
    marginBottom: 10,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#EBF4FC',
    paddingTop: 8,
    gap: 8,
  },
  gpsBadge: {
    backgroundColor: '#EBF4FC',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.cgBorder,
  },
  gpsCoordsText: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.cgPrimary,
  },
  gpsCoordsVal: {
    fontSize: 14,
    fontWeight: '900',
    color: Colors.cgPrimaryDark,
  },
  statusGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusTxt: {
    fontSize: 11,
    color: Colors.cgTextSecondary,
  },
  chevron: {
    fontSize: 12,
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
    textAlign: 'center',
  },
});
