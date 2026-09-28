import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Colors } from '../../theme/colors';
import { CommunicationStatus } from '../../types/sos';

interface DemoControlsCardProps {
  communicationStatus: CommunicationStatus;
  gpsAvailable: boolean;
  onToggleCommunication: (status: CommunicationStatus) => void;
  onToggleGps: (available: boolean) => void;
}

export const DemoControlsCard: React.FC<DemoControlsCardProps> = ({
  communicationStatus,
  gpsAvailable,
  onToggleCommunication,
  onToggleGps,
}) => {
  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.badge}>HACKATHON DEMO</Text>
        <Text style={styles.title}>Demo Simulation Controls</Text>
      </View>

      <Text style={styles.subtitle}>
        Simulate real-world hardware & signal conditions for testing:
      </Text>

      <View style={styles.controlGroup}>
        <Text style={styles.controlLabel}>Communication Link:</Text>
        <View style={styles.buttonRow}>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => onToggleCommunication('online')}
            style={[
              styles.toggleBtn,
              communicationStatus === 'online' && styles.toggleBtnActiveOnline,
            ]}
          >
            <Text
              style={[
                styles.toggleBtnText,
                communicationStatus === 'online' && styles.toggleBtnTextActive,
              ]}
            >
              ONLINE
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => onToggleCommunication('offline')}
            style={[
              styles.toggleBtn,
              communicationStatus === 'offline' && styles.toggleBtnActiveOffline,
            ]}
          >
            <Text
              style={[
                styles.toggleBtnText,
                communicationStatus === 'offline' && styles.toggleBtnTextActive,
              ]}
            >
              OFFLINE
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.controlGroup}>
        <Text style={styles.controlLabel}>GPS Signal:</Text>
        <View style={styles.buttonRow}>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => onToggleGps(true)}
            style={[
              styles.toggleBtn,
              gpsAvailable && styles.toggleBtnActiveOnline,
            ]}
          >
            <Text
              style={[
                styles.toggleBtnText,
                gpsAvailable && styles.toggleBtnTextActive,
              ]}
            >
              AVAILABLE
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => onToggleGps(false)}
            style={[
              styles.toggleBtn,
              !gpsAvailable && styles.toggleBtnActiveOffline,
            ]}
          >
            <Text
              style={[
                styles.toggleBtnText,
                !gpsAvailable && styles.toggleBtnTextActive,
              ]}
            >
              UNAVAILABLE
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#F4F6F6',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1.5,
    borderColor: '#B2CBE5',
    marginBottom: 20,
    borderStyle: 'dashed',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  badge: {
    fontSize: 9,
    fontWeight: '900',
    color: '#1B4F72',
    backgroundColor: '#D4E6F1',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginRight: 8,
  },
  title: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.text,
  },
  subtitle: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginBottom: 10,
  },
  controlGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  controlLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.text,
  },
  buttonRow: {
    flexDirection: 'row',
  },
  toggleBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    marginLeft: 6,
  },
  toggleBtnActiveOnline: {
    backgroundColor: '#27AE60',
    borderColor: '#1E824C',
  },
  toggleBtnActiveOffline: {
    backgroundColor: '#E74C3C',
    borderColor: '#C0392B',
  },
  toggleBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.textSecondary,
  },
  toggleBtnTextActive: {
    color: '#FFFFFF',
  },
});
