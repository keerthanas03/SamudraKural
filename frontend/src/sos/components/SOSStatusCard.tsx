import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '../../theme/colors';
import { CommunicationStatus } from '../../types/sos';

interface SOSStatusCardProps {
  gpsAvailable: boolean;
  communicationStatus: CommunicationStatus;
  batteryLevel?: number;
  sosId?: string;
  isPending?: boolean;
}

export const SOSStatusCard: React.FC<SOSStatusCardProps> = ({
  gpsAvailable,
  communicationStatus,
  batteryLevel = 100,
  sosId,
  isPending = false,
}) => {
  const isLowBattery = batteryLevel < 20;

  return (
    <View style={styles.cardContainer}>
      <Text style={styles.cardHeaderTitle}>SYSTEM STATUS</Text>

      <View style={styles.gridRow}>
        {/* GPS Status */}
        <View style={styles.statusBox}>
          <Text style={styles.label}>GPS</Text>
          <View style={styles.valueRow}>
            <Text style={[styles.dot, gpsAvailable ? styles.dotGreen : styles.dotRed]}>
              ●
            </Text>
            <Text style={[styles.statusText, gpsAvailable ? styles.textGreen : styles.textRed]}>
              {gpsAvailable ? 'Available' : 'Unavailable'}
            </Text>
          </View>
        </View>

        {/* Communication Status */}
        <View style={styles.statusBox}>
          <Text style={styles.label} numberOfLines={1} adjustsFontSizeToFit={true}>
            Communication
          </Text>
          <View style={styles.valueRow}>
            <Text
              style={[
                styles.dot,
                communicationStatus === 'online' ? styles.dotGreen : styles.dotOrange,
              ]}
            >
              ●
            </Text>
            <Text
              style={[
                styles.statusText,
                communicationStatus === 'online' ? styles.textGreen : styles.textOrange,
              ]}
              numberOfLines={1}
              adjustsFontSizeToFit={true}
            >
              {communicationStatus === 'online' ? 'Online' : 'Offline'}
            </Text>
          </View>
        </View>

        {/* Battery Level */}
        <View style={styles.statusBox}>
          <Text style={styles.label}>Battery</Text>
          <View style={styles.valueRow}>
            <Text style={styles.batteryIcon}>{isLowBattery ? '🪫' : '🔋'}</Text>
            <Text style={[styles.batteryText, isLowBattery && { color: '#E53E3E' }]}>
              {batteryLevel}%
            </Text>
          </View>
        </View>
      </View>

      {/* SOS Reference ID Banner if present */}
      {sosId && (
        <View style={[styles.refBanner, isPending ? styles.pendingRefBanner : styles.activeRefBanner]}>
          <Text style={styles.refLabel}>
            {isPending ? 'PENDING SOS REFERENCE' : 'ACTIVE SOS REFERENCE'}
          </Text>
          <Text style={styles.refValue}>{sosId}</Text>
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
  cardHeaderTitle: {
    fontSize: 13,
    fontWeight: '900',
    color: Colors.textSecondary,
    letterSpacing: 1,
    marginBottom: 12,
    textTransform: 'uppercase',
  },
  gridRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusBox: {
    flex: 1,
    backgroundColor: Colors.background,
    borderRadius: 12,
    padding: 10,
    marginHorizontal: 3,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E0ECEC',
  },
  label: {
    fontSize: 10.5,
    fontWeight: '700',
    color: Colors.textSecondary,
    marginBottom: 4,
    textAlign: 'center',
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dot: {
    fontSize: 14,
    marginRight: 4,
  },
  dotGreen: {
    color: '#27AE60',
  },
  dotRed: {
    color: '#E74C3C',
  },
  dotOrange: {
    color: '#E67E22',
  },
  statusText: {
    fontSize: 13,
    fontWeight: '800',
  },
  textGreen: {
    color: '#1E824C',
  },
  textRed: {
    color: '#C0392B',
  },
  textOrange: {
    color: '#D35400',
  },
  batteryIcon: {
    fontSize: 14,
    marginRight: 4,
  },
  batteryText: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.text,
  },
  refBanner: {
    marginTop: 12,
    padding: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  activeRefBanner: {
    backgroundColor: '#E8F8F5',
    borderWidth: 1.5,
    borderColor: '#1E824C',
  },
  pendingRefBanner: {
    backgroundColor: '#FEF9E7',
    borderWidth: 1.5,
    borderColor: '#F39C12',
  },
  refLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.textSecondary,
    letterSpacing: 0.8,
  },
  refValue: {
    fontSize: 16,
    fontWeight: '900',
    color: Colors.primaryDark,
    marginTop: 2,
    letterSpacing: 1.1,
  },
});
