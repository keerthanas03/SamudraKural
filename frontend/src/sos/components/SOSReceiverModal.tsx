import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { playEmergencyBuzzerSound } from '../../utils/speech';

export interface IncomingDistressAlert {
  public_sos_id: string;
  emergency_type: string;
  priority?: string;
  latitude?: number | null;
  longitude?: number | null;
  delivery_status?: string;
  origin_fisherman_name?: string;
  origin_fisherman_phone?: string;
  created_at?: string;
  distance_km?: number | null;
  hop_count?: number;
}

interface SOSReceiverModalProps {
  visible: boolean;
  alert: IncomingDistressAlert | null;
  onRespond: (response: 'YES_HELP' | 'RELAY_ONLY' | 'NO') => Promise<void> | void;
  onDismiss?: () => void;
}

export const SOSReceiverModal: React.FC<SOSReceiverModalProps> = ({
  visible,
  alert,
  onRespond,
  onDismiss,
}) => {
  const [submitting, setSubmitting] = useState<'YES_HELP' | 'RELAY_ONLY' | 'NO' | null>(null);

  useEffect(() => {
    if (visible && alert) {
      // Play high-decibel emergency siren buzzer
      playEmergencyBuzzerSound();
    } else {
      setSubmitting(null);
    }
  }, [visible, alert]);

  if (!alert) return null;

  const handleAction = async (decision: 'YES_HELP' | 'RELAY_ONLY' | 'NO') => {
    setSubmitting(decision);
    try {
      await onRespond(decision);
    } finally {
      setSubmitting(null);
    }
  };

  const formattedDistance =
    alert.distance_km !== undefined && alert.distance_km !== null
      ? `${alert.distance_km.toFixed(1)} km (${(alert.distance_km * 0.539957).toFixed(1)} NM)`
      : 'Distance calculating...';

  const isOffline =
    alert.delivery_status === 'OFFLINE_ORIGIN' ||
    alert.delivery_status === 'OFFLINE_RELAYED' ||
    alert.delivery_status === 'RELAYING' ||
    alert.delivery_status === 'SEARCHING_FOR_PEER' ||
    alert.delivery_status === 'P2P_DELIVERED';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={() => {
        if (onDismiss) onDismiss();
      }}
    >
      <View style={styles.overlay}>
        <View style={styles.card}>
          {/* Emergency Alert Header */}
          <View style={styles.header}>
            <View style={styles.pulseDot} />
            <Text style={styles.headerTitle}>DISTRESS ALERT RECEIVED</Text>
          </View>

          <View style={styles.body}>
            {/* Delivery Channel Badge */}
            <View
              style={[
                styles.channelBadge,
                isOffline ? styles.channelBadgeOffline : styles.channelBadgeOnline,
              ]}
            >
              <Text style={styles.channelBadgeText}>
                {isOffline
                  ? `OFFLINE P2P MESH (HOP ${alert.hop_count || 1})`
                  : 'ONLINE CLOUD / WEBSOCKET'}
              </Text>
            </View>

            {/* Emergency Type */}
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>EMERGENCY</Text>
              <Text style={styles.emergencyTypeValue}>
                {alert.emergency_type || 'General Distress'}
              </Text>
            </View>

            {/* Distance */}
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>APPROX DISTANCE</Text>
              <Text style={styles.distanceValue}>{formattedDistance}</Text>
            </View>

            {/* Coordinates */}
            {alert.latitude !== undefined &&
              alert.latitude !== null &&
              alert.longitude !== undefined &&
              alert.longitude !== null && (
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>LOCATION</Text>
                  <Text style={styles.coordValue}>
                    {alert.latitude.toFixed(4)}° N, {alert.longitude.toFixed(4)}° E
                  </Text>
                </View>
              )}

            {/* Origin Fisherman Name */}
            {alert.origin_fisherman_name ? (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>CALLER</Text>
                <Text style={styles.callerValue}>{alert.origin_fisherman_name}</Text>
              </View>
            ) : null}

            {/* Prompt text */}
            <Text style={styles.promptText}>
              A fellow fisherman nearby is in distress. Select your response:
            </Text>

            {/* Action Buttons: 3 Choices */}
            <View style={styles.actionContainer}>
              {/* 1. I CAN HELP (YES_HELP) */}
              <TouchableOpacity
                style={[styles.button, styles.buttonYes]}
                onPress={() => handleAction('YES_HELP')}
                disabled={submitting !== null}
                activeOpacity={0.8}
              >
                {submitting === 'YES_HELP' ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.buttonYesText}>I CAN HELP</Text>
                )}
              </TouchableOpacity>

              {/* 2. RELAY SOS (RELAY_ONLY) */}
              <TouchableOpacity
                style={[styles.button, styles.buttonRelay]}
                onPress={() => handleAction('RELAY_ONLY')}
                disabled={submitting !== null}
                activeOpacity={0.8}
              >
                {submitting === 'RELAY_ONLY' ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.buttonRelayText}>RELAY SOS (FORWARD)</Text>
                )}
              </TouchableOpacity>

              {/* 3. CANNOT HELP (NO) */}
              <TouchableOpacity
                style={[styles.button, styles.buttonNo]}
                onPress={() => handleAction('NO')}
                disabled={submitting !== null}
                activeOpacity={0.8}
              >
                {submitting === 'NO' ? (
                  <ActivityIndicator color="#64748B" />
                ) : (
                  <Text style={styles.buttonNoText}>CANNOT HELP</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 440,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    overflow: 'hidden',
    elevation: 8,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
  },
  header: {
    backgroundColor: '#DC2626',
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pulseDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#FFFFFF',
    marginRight: 8,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  body: {
    padding: 20,
  },
  channelBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    marginBottom: 16,
  },
  channelBadgeOnline: {
    backgroundColor: '#E0F2FE',
  },
  channelBadgeOffline: {
    backgroundColor: '#FEF3C7',
  },
  channelBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0369A1',
    letterSpacing: 0.6,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  infoLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
    letterSpacing: 0.5,
  },
  emergencyTypeValue: {
    fontSize: 15,
    fontWeight: '800',
    color: '#DC2626',
  },
  distanceValue: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  coordValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
  },
  callerValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  promptText: {
    fontSize: 13,
    color: '#475569',
    lineHeight: 18,
    marginVertical: 16,
    textAlign: 'center',
  },
  actionContainer: {
    gap: 10,
  },
  button: {
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonYes: {
    backgroundColor: '#16A34A',
  },
  buttonYesText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  buttonRelay: {
    backgroundColor: '#0284C7',
  },
  buttonRelayText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  buttonNo: {
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  buttonNoText: {
    color: '#475569',
    fontSize: 14,
    fontWeight: '700',
  },
});
