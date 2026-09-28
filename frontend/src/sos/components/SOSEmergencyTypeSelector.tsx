import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Colors } from '../../theme/colors';
import { EmergencyType } from '../../types/sos';

interface SOSEmergencyTypeSelectorProps {
  selectedType: EmergencyType;
  onSelectType: (type: EmergencyType) => void;
}

const EMERGENCY_TYPES: { type: EmergencyType; icon: string }[] = [
  { type: 'General Emergency', icon: '🚨' },
  { type: 'Boat problem', icon: '🚤' },
  { type: 'Medical emergency', icon: '🩺' },
  { type: 'Bad weather', icon: '⛈️' },
  { type: 'Navigation problem', icon: '🧭' },
  { type: 'Net / fishing gear problem', icon: '🕸️' },
  { type: 'Other', icon: '⚠️' },
];

export const SOSEmergencyTypeSelector: React.FC<SOSEmergencyTypeSelectorProps> = ({
  selectedType,
  onSelectType,
}) => {
  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>SELECT EMERGENCY REASON (OPTIONAL)</Text>
      <Text style={styles.subtitleText}>
        Select emergency category to help rescue teams prepare appropriate equipment.
      </Text>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContainer}
      >
        {EMERGENCY_TYPES.map((item) => {
          const isSelected = selectedType === item.type;
          return (
            <TouchableOpacity
              key={item.type}
              activeOpacity={0.8}
              onPress={() => onSelectType(item.type)}
              style={[
                styles.chip,
                isSelected && styles.chipSelected,
              ]}
            >
              <Text style={styles.chipIcon}>{item.icon}</Text>
              <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>
                {item.type}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 2,
    borderColor: Colors.border,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '900',
    color: Colors.textSecondary,
    letterSpacing: 1,
    marginBottom: 4,
  },
  subtitleText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginBottom: 12,
  },
  scrollContainer: {
    paddingRight: 10,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: Colors.border,
    marginRight: 8,
  },
  chipSelected: {
    backgroundColor: '#C0392B',
    borderColor: '#902B20',
  },
  chipIcon: {
    fontSize: 16,
    marginRight: 6,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.text,
  },
  chipTextSelected: {
    color: '#FFFFFF',
    fontWeight: '900',
  },
});
