import React from 'react';
import { View, Text, StyleSheet, Platform, TouchableOpacity } from 'react-native';
import { Colors } from '../../theme/colors';

interface SOSLocationCardProps {
  latitude: number | null;
  longitude: number | null;
  accuracy?: number | null;
  timestamp?: string;
  isUnavailable?: boolean;
  onRefreshLocation?: () => void;
}

export const SOSLocationCard: React.FC<SOSLocationCardProps> = ({
  latitude,
  longitude,
  accuracy,
  timestamp,
  isUnavailable = false,
  onRefreshLocation,
}) => {
  const hasValidLocation = !isUnavailable && latitude !== null && longitude !== null;

  const formatDisplayTime = (ts?: string) => {
    if (!ts) {
      return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
    }
    try {
      const parsed = new Date(ts);
      if (isNaN(parsed.getTime())) {
        return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
      }
      return parsed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
    } catch (e) {
      return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
    }
  };

  return (
    <View style={[styles.cardContainer, !hasValidLocation && styles.cardUnavailable]}>
      <View style={styles.headerRow}>
        <Text style={styles.cardHeaderTitle}>GPS POSITION</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          {onRefreshLocation && (
            <TouchableOpacity onPress={onRefreshLocation} style={styles.refreshBadge}>
              <Text style={styles.refreshBadgeText}>🔄 REFRESH</Text>
            </TouchableOpacity>
          )}
          <Text style={styles.timeBadge}>
            {formatDisplayTime(timestamp)}
          </Text>
        </View>
      </View>

      {hasValidLocation ? (
        <View style={styles.locationGrid}>
          <View style={styles.coordBox}>
            <Text style={styles.coordLabel}>LATITUDE</Text>
            <Text style={styles.coordValue}>{latitude?.toFixed(6)}° N</Text>
          </View>

          <View style={styles.coordBox}>
            <Text style={styles.coordLabel}>LONGITUDE</Text>
            <Text style={styles.coordValue}>{longitude?.toFixed(6)}° E</Text>
          </View>

          {accuracy && (
            <View style={styles.accuracyBanner}>
              <Text style={styles.accuracyText}>Accuracy: ±{accuracy} meters</Text>
            </View>
          )}
        </View>
      ) : (
        <View style={styles.unavailableContainer}>
          <Text style={styles.warningIcon}>⚠️</Text>
          <View style={styles.warningContent}>
            <Text style={styles.unavailableTitle}>Location Unavailable</Text>
            <Text style={styles.unavailableText}>
              Your device could not determine your current GPS coordinates.
            </Text>
            <View style={styles.warningPill}>
              <Text style={styles.warningPillText}>
                Emergency SOS will still be transmitted with Base Port fallback
              </Text>
            </View>
            {onRefreshLocation && (
              <TouchableOpacity onPress={onRefreshLocation} style={styles.retryGpsBtn}>
                <Text style={styles.retryGpsBtnText}>🔄 ACQUIRE REAL-TIME GPS</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  cardContainer: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 2,
    borderColor: Colors.border,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  cardUnavailable: {
    borderColor: '#E67E22',
    backgroundColor: '#FFFDF9',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardHeaderTitle: {
    fontSize: 13,
    fontWeight: '900',
    color: Colors.textSecondary,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  timeBadge: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.primary,
    backgroundColor: Colors.secondary,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  locationGrid: {
    width: '100%',
  },
  coordBox: {
    backgroundColor: Colors.background,
    padding: 12,
    borderRadius: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: Colors.secondaryDark,
  },
  coordLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.textSecondary,
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  coordValue: {
    fontSize: 22,
    fontWeight: '900',
    color: Colors.text,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  accuracyBanner: {
    alignItems: 'center',
    marginTop: 4,
  },
  accuracyText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.primaryDark,
  },
  unavailableContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FEF5E7',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F5C6CB',
  },
  warningIcon: {
    fontSize: 24,
    marginRight: 10,
    marginTop: 2,
  },
  warningContent: {
    flex: 1,
  },
  unavailableTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#C0392B',
    marginBottom: 4,
  },
  unavailableText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#7F8C8D',
    lineHeight: 18,
    marginBottom: 8,
  },
  warningPill: {
    backgroundColor: '#FDEDEC',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#F5B7B1',
  },
  warningPillText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#902B20',
  },
  refreshBadge: {
    backgroundColor: '#E0F2FE',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  refreshBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0284C7',
  },
  retryGpsBtn: {
    marginTop: 10,
    backgroundColor: Colors.primary,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  retryGpsBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
});
