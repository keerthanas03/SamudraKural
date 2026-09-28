import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity } from 'react-native';
import { Colors } from '../../theme/colors';

interface SOSConfirmationModalProps {
  visible: boolean;
  onConfirmCancel: () => void;
  onKeepActive: () => void;
}

export const SOSConfirmationModal: React.FC<SOSConfirmationModalProps> = ({
  visible,
  onConfirmCancel,
  onKeepActive,
}) => {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onKeepActive}
    >
      <View style={styles.backdrop}>
        <View style={styles.modalCard}>
          <View style={styles.iconCircle}>
            <Text style={styles.warningEmoji}>❓</Text>
          </View>

          <Text style={styles.modalTitle}>Cancel SOS Alert?</Text>

          <View style={styles.safetyBox}>
            <Text style={styles.safetyQuestion}>Are you safe now?</Text>
            <Text style={styles.safetySubtext}>
              Only cancel if your emergency is resolved or you are in a safe position.
            </Text>
          </View>

          <View style={styles.buttonColumn}>
            {/* Primary Action: KEEP SOS ACTIVE */}
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={onKeepActive}
              style={styles.keepActiveButton}
            >
              <Text style={styles.keepActiveButtonText}>🛡️ KEEP SOS ACTIVE</Text>
            </TouchableOpacity>

            {/* Secondary Action: CONFIRM CANCEL */}
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={onConfirmCancel}
              style={styles.cancelConfirmButton}
            >
              <Text style={styles.cancelConfirmButtonText}>Yes, Cancel SOS</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(13, 37, 38, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: Colors.surface,
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 10,
    borderWidth: 2,
    borderColor: Colors.border,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FEF5E7',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    borderWidth: 2,
    borderColor: '#F5C6CB',
  },
  warningEmoji: {
    fontSize: 32,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: Colors.text,
    textAlign: 'center',
    marginBottom: 12,
  },
  safetyBox: {
    backgroundColor: Colors.background,
    padding: 14,
    borderRadius: 14,
    width: '100%',
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: Colors.secondaryDark,
  },
  safetyQuestion: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.primaryDark,
    marginBottom: 4,
    textAlign: 'center',
  },
  safetySubtext: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
  },
  buttonColumn: {
    width: '100%',
  },
  keepActiveButton: {
    backgroundColor: Colors.primary,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    marginBottom: 10,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  keepActiveButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  cancelConfirmButton: {
    backgroundColor: 'transparent',
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#C0392B',
  },
  cancelConfirmButtonText: {
    color: '#C0392B',
    fontSize: 14,
    fontWeight: '800',
  },
});
