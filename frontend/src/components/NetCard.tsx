import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Colors } from '../theme/colors';
import { FishingNet } from '../types/net';
import { useLanguage } from '../i18n';

interface NetCardProps {
  net: FishingNet;
  onViewDrift: (net: FishingNet) => void;
}

export const NetCard: React.FC<NetCardProps> = ({ net, onViewDrift }) => {
  const { t, tNetType } = useLanguage();

  const movementText =
    net.estimated_movement_km !== undefined && net.estimated_movement_km !== null
      ? `~${net.estimated_movement_km} km`
      : t('loading');

  const searchAreaText = net.search_area_description || t('loading');

  const statusKey =
    net.status === 'ACTIVE'
      ? 'active'
      : net.status === 'RETRIEVED'
      ? 'retrieved'
      : net.status === 'LOST'
      ? 'lost'
      : 'archived';

  return (
    <View style={styles.card}>
      {/* Top Header Row */}
      <View style={styles.topRow}>
        <View style={styles.titleArea}>
          <Text style={styles.netName} numberOfLines={1}>{net.name}</Text>
          <Text style={styles.netType} numberOfLines={1}>{tNetType(net.net_type_display || net.net_type)}</Text>
        </View>

        <View style={[styles.statusBadge, net.status === 'ACTIVE' ? styles.activeBadge : styles.inactiveBadge]}>
          <Text style={[styles.statusText, net.status === 'ACTIVE' ? styles.activeStatusText : styles.inactiveStatusText]}>
            {t(statusKey)}
          </Text>
        </View>
      </View>

      {/* Info Grid */}
      <View style={styles.bodyGrid}>
        <View style={styles.infoCol}>
          <Text style={styles.label}>{t('deployment')}</Text>
          <Text style={styles.valueHighlight} numberOfLines={1}>{net.elapsed_time_formatted}</Text>
        </View>

        <View style={styles.infoCol}>
          <Text style={styles.label}>{t('estimatedMovement')}</Text>
          <Text style={styles.valueHighlight} numberOfLines={1}>{movementText}</Text>
        </View>
      </View>

      {/* Probable Search Area & Likely Direction Action */}
      <View style={styles.bottomSection}>
        <View style={styles.searchAreaBox}>
          <Text style={styles.searchAreaLabel}>{t('probableSearchArea')}</Text>
          <Text style={styles.searchAreaValue}>{searchAreaText}</Text>
        </View>

        <TouchableOpacity
          activeOpacity={0.8}
          style={styles.viewDriftButton}
          onPress={() => onViewDrift(net)}
        >
          <Text style={styles.viewDriftText}>🌊 {t('likelyDirection')} ➔</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    marginVertical: 6,
    borderWidth: 1.5,
    borderColor: Colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#EEF6F6',
    paddingBottom: 10,
  },
  titleArea: {
    flex: 1,
    marginRight: 8,
  },
  netName: {
    fontSize: 17,
    fontWeight: '900',
    color: Colors.text,
  },
  netType: {
    fontSize: 12.5,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginTop: 1,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  activeBadge: {
    backgroundColor: '#E8F8F5',
  },
  inactiveBadge: {
    backgroundColor: '#EAECEE',
  },
  statusText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  activeStatusText: {
    color: '#1E824C',
  },
  inactiveStatusText: {
    color: '#7F8C8D',
  },
  bodyGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
    gap: 8,
  },
  infoCol: {
    flex: 1,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textSecondary,
    marginBottom: 2,
  },
  valueHighlight: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.primaryDark,
  },
  bottomSection: {
    gap: 10,
    marginTop: 2,
  },
  searchAreaBox: {
    width: '100%',
    backgroundColor: Colors.secondary,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.secondaryDark,
  },
  searchAreaLabel: {
    fontSize: 10.5,
    fontWeight: '800',
    color: Colors.primaryDark,
    marginBottom: 3,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  searchAreaValue: {
    fontSize: 13.5,
    fontWeight: '800',
    color: Colors.text,
    lineHeight: 18,
  },
  viewDriftButton: {
    backgroundColor: Colors.primary,
    paddingVertical: 13,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
  viewDriftText: {
    fontSize: 13.5,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.4,
  },
});
