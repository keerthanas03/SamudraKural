import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../theme/colors';
import { NetType, CreateNetPayload } from '../types/net';
import { getCurrentFishermanGPS } from '../utils/location';
import { useLanguage } from '../i18n';

interface AddNetModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (payload: CreateNetPayload) => Promise<void>;
}

export const AddNetModal: React.FC<AddNetModalProps> = ({ visible, onClose, onSubmit }) => {
  const { t } = useLanguage();
  const [netName, setNetName] = useState<string>('Net 01');
  const [selectedType, setSelectedType] = useState<NetType>('FLOATING_GILL_NET');
  const [latitude, setLatitude] = useState<string>('13.0500');
  const [longitude, setLongitude] = useState<string>('80.3500');
  const [durationHours, setDurationHours] = useState<number>(4);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const NET_TYPE_OPTIONS: { type: NetType; label: string; desc: string }[] = [
    { type: 'FLOATING_GILL_NET', label: t('floatingGillNet'), desc: 'Standard floating gill net' },
    { type: 'DRIFTING_NET', label: t('driftingNet'), desc: 'Deep drifting net curtain' },
    { type: 'SURFACE_NET', label: t('surfaceNet'), desc: 'Floating surface mesh' },
    { type: 'OTHER_FLOATING_NET', label: t('otherFloatingNet'), desc: 'General floating gear' },
  ];

  const DURATION_OPTIONS = [
    { label: `2 Hours`, hours: 2 },
    { label: `4 Hours`, hours: 4 },
    { label: `6 Hours`, hours: 6 },
    { label: `12 Hours`, hours: 12 },
    { label: `24 Hours`, hours: 24 },
  ];

  React.useEffect(() => {
    if (visible) {
      handleUseCurrentLocation();
    }
  }, [visible]);

  const handleUseCurrentLocation = async () => {
    try {
      const gps = await getCurrentFishermanGPS();
      setLatitude(gps.latitude.toFixed(4));
      setLongitude(gps.longitude.toFixed(4));
    } catch (e) {
      setLatitude('13.0827');
      setLongitude('80.3050');
    }
  };

  const handleStartPrediction = async () => {
    if (!netName.trim()) {
      Alert.alert(t('genericError'), t('netName'));
      return;
    }

    const lat = parseFloat(latitude);
    const lon = parseFloat(longitude);

    if (isNaN(lat) || lat < -90 || lat > 90) {
      Alert.alert(t('genericError'), 'Please enter a valid Latitude (-90 to 90).');
      return;
    }

    if (isNaN(lon) || lon < -180 || lon > 180) {
      Alert.alert(t('genericError'), 'Please enter a valid Longitude (-180 to 180).');
      return;
    }

    const now = new Date();
    const retrieval = new Date(now.getTime() + durationHours * 60 * 60 * 1000);

    const payload: CreateNetPayload = {
      name: netName.trim(),
      net_type: selectedType,
      release_latitude: lat,
      release_longitude: lon,
      release_time: now.toISOString(),
      expected_retrieval_time: retrieval.toISOString(),
    };

    setIsSubmitting(true);
    try {
      await onSubmit(payload);
      onClose();
    } catch (err: any) {
      Alert.alert(t('genericError'), err.message || t('genericError'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <SafeAreaView style={styles.safeArea}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>{t('deployNewNet')}</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Text style={styles.closeText}>✕</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
          {/* Net Name */}
          <Text style={styles.sectionLabel}>{t('netName')}</Text>
          <TextInput
            style={styles.input}
            value={netName}
            onChangeText={setNetName}
            placeholder={t('netNamePlaceholder')}
            placeholderTextColor="#8AC4C1"
          />

          {/* Net Type Selection */}
          <Text style={styles.sectionLabel}>{t('netType')}</Text>
          <View style={styles.typeList}>
            {NET_TYPE_OPTIONS.map((item) => {
              const isSelected = selectedType === item.type;
              return (
                <TouchableOpacity
                  key={item.type}
                  style={[styles.typeCard, isSelected && styles.typeCardActive]}
                  onPress={() => setSelectedType(item.type)}
                  activeOpacity={0.8}
                >
                  <View style={styles.radioRow}>
                    <View style={[styles.radioCircle, isSelected && styles.radioCircleActive]}>
                      {isSelected && <View style={styles.radioInner} />}
                    </View>
                    <Text style={[styles.typeLabel, isSelected && styles.typeLabelActive]}>
                      {item.label}
                    </Text>
                  </View>
                  <Text style={styles.typeDesc}>{item.desc}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Release Location */}
          <View style={styles.locHeaderRow}>
            <Text style={styles.sectionLabel}>{t('releaseLocation')}</Text>
            <TouchableOpacity onPress={handleUseCurrentLocation}>
              <Text style={styles.gpsLink}>{t('useCurrentGps')}</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.coordRow}>
            <View style={styles.coordCol}>
              <Text style={styles.inputSubLabel}>{t('latitude')} (°N)</Text>
              <TextInput
                style={styles.input}
                value={latitude}
                onChangeText={setLatitude}
                keyboardType="numeric"
                placeholder="13.05"
                placeholderTextColor="#8AC4C1"
              />
            </View>

            <View style={styles.coordCol}>
              <Text style={styles.inputSubLabel}>{t('longitude')} (°E)</Text>
              <TextInput
                style={styles.input}
                value={longitude}
                onChangeText={setLongitude}
                keyboardType="numeric"
                placeholder="80.35"
                placeholderTextColor="#8AC4C1"
              />
            </View>
          </View>

          {/* Retrieval Horizon */}
          <Text style={styles.sectionLabel}>{t('retrievalTime')}</Text>
          <View style={styles.durationRow}>
            {DURATION_OPTIONS.map((opt) => {
              const isSelected = durationHours === opt.hours;
              return (
                <TouchableOpacity
                  key={opt.hours}
                  style={[styles.durationChip, isSelected && styles.durationChipActive]}
                  onPress={() => setDurationHours(opt.hours)}
                >
                  <Text style={[styles.durationChipText, isSelected && styles.durationChipTextActive]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Submit Action */}
          <TouchableOpacity
            style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
            onPress={handleStartPrediction}
            disabled={isSubmitting}
            activeOpacity={0.8}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.submitButtonText}>🌊 {t('saveDeployNet')}</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
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
    paddingVertical: 16,
    backgroundColor: Colors.primary,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: {
    fontSize: 18,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  body: {
    padding: 20,
    paddingBottom: 40,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.text,
    marginBottom: 8,
    marginTop: 14,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: Colors.text,
    fontWeight: '700',
  },
  typeList: {
    gap: 8,
  },
  typeCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 14,
    padding: 12,
  },
  typeCardActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.secondary,
  },
  radioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  radioCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  radioCircleActive: {
    borderColor: Colors.primary,
  },
  radioInner: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
    backgroundColor: Colors.primary,
  },
  typeLabel: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.text,
  },
  typeLabelActive: {
    color: Colors.primaryDark,
  },
  typeDesc: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginLeft: 28,
  },
  locHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 14,
    marginBottom: 8,
  },
  gpsLink: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.primary,
  },
  coordRow: {
    flexDirection: 'row',
    gap: 12,
  },
  coordCol: {
    flex: 1,
  },
  inputSubLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  durationRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 20,
  },
  durationChip: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: Colors.border,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  durationChipActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primary,
  },
  durationChipText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.text,
  },
  durationChipTextActive: {
    color: '#FFFFFF',
  },
  submitButton: {
    backgroundColor: Colors.primary,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 10,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.6,
  },
});
