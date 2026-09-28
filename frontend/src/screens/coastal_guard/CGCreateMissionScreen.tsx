import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../../theme/colors';
import { coastalGuardService, SOSAlertItem } from '../../services/coastalGuardService';
import { getCGOfficerSession } from '../../storage/storage';

interface CGCreateMissionScreenProps {
  targetSOS: SOSAlertItem;
  onBack: () => void;
  onMissionCreated: () => void;
}

export const CGCreateMissionScreen: React.FC<CGCreateMissionScreenProps> = ({
  targetSOS,
  onBack,
  onMissionCreated,
}) => {
  const [officerName, setOfficerName] = useState<string>('Officer Command HQ');
  const [rescueTeam, setRescueTeam] = useState<string>('ICG Tactical Rescue Unit 04');
  const [rescueVessel, setRescueVessel] = useState<string>('ICGS C-438 Fast Patrol Boat');
  const [etaMinutes, setEtaMinutes] = useState<string>('20');
  const [notes, setNotes] = useState<string>('Deploying fast patrol vessel with medical paramedic team & tow rig.');
  const [submitting, setSubmitting] = useState<boolean>(false);

  useEffect(() => {
    loadOfficerName();
  }, []);

  const loadOfficerName = async () => {
    const session = await getCGOfficerSession();
    if (session?.name) {
      setOfficerName(`${session.rank ? session.rank + ' ' : ''}${session.name} (ICG)`);
    }
  };

  const handleCreateMission = async () => {
    if (!rescueTeam.trim() || !rescueVessel.trim() || !officerName.trim()) {
      Alert.alert('Required Fields Missing', 'Please fill in all officer, rescue team, and vessel assignment fields.');
      return;
    }

    setSubmitting(true);
    try {
      await coastalGuardService.createMission({
        sos_alert_id: targetSOS.id,
        officer_name: officerName.trim(),
        rescue_team: rescueTeam.trim(),
        rescue_vessel: rescueVessel.trim(),
        eta_minutes: parseInt(etaMinutes.trim() || '25', 10),
        notes: notes.trim(),
      });

      Alert.alert(
        'Rescue Mission Launched 🛥️',
        `Mission dispatched successfully for SOS #${targetSOS.id}. Status updated to RESCUE_ASSIGNED.`
      );
      onMissionCreated();
    } catch (e) {
      Alert.alert('Creation Failed', 'Could not dispatch rescue mission at this time.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.cgPrimaryDark} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack}>
          <Text style={styles.backTxt}>← Cancel</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Create Rescue Mission</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Target SOS Alert Summary Card */}
        <View style={styles.sosSummaryCard}>
          <Text style={styles.summaryHeading}>🚨 Target SOS Incident #{targetSOS.id}</Text>
          <View style={styles.summaryGrid}>
            <View style={styles.summaryRow}>
              <Text style={styles.sumLabel}>Emergency Type:</Text>
              <Text style={styles.sumVal}>{targetSOS.emergency_type}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.sumLabel}>Vessel Name:</Text>
              <Text style={styles.sumVal}>{targetSOS.boat?.name || 'Sea Vessel'}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.sumLabel}>GPS Coordinates:</Text>
              <Text style={styles.sumVal}>
                {targetSOS.latitude.toFixed(4)}° N, {targetSOS.longitude.toFixed(4)}° E
              </Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.sumLabel}>People Affected:</Text>
              <Text style={[styles.sumVal, { color: '#DC2626', fontWeight: '900' }]}>
                {targetSOS.people_affected} Persons
              </Text>
            </View>
          </View>
        </View>

        {/* Mission Input Form */}
        <View style={styles.formCard}>
          <Text style={styles.formHeading}>📋 Mission Assignment & Deployment</Text>

          {/* Assigned Officer */}
          <Text style={styles.fieldLabel}>Assigned Officer in Command</Text>
          <TextInput
            style={styles.input}
            value={officerName}
            onChangeText={setOfficerName}
            placeholder="Officer Name & Rank..."
            placeholderTextColor="#94A3B8"
          />

          {/* Rescue Team */}
          <Text style={styles.fieldLabel}>Rescue Squadron / Team</Text>
          <View style={styles.presetChipsRow}>
            {['ICG Tactical Rescue Unit 04', 'Chennai Coast Guard Unit B', 'Kattupalli Rapid Response'].map((team) => (
              <TouchableOpacity
                key={team}
                style={[styles.presetChip, rescueTeam === team && styles.presetChipActive]}
                onPress={() => setRescueTeam(team)}
              >
                <Text style={[styles.presetTxt, rescueTeam === team && styles.presetTxtActive]}>{team}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TextInput
            style={styles.input}
            value={rescueTeam}
            onChangeText={setRescueTeam}
            placeholder="Custom Rescue Team Name..."
            placeholderTextColor="#94A3B8"
          />

          {/* Rescue Vessel */}
          <Text style={styles.fieldLabel}>Rescue Vessel / Patrol Craft</Text>
          <View style={styles.presetChipsRow}>
            {['ICGS C-438 Fast Patrol Boat', 'ICGS Varad Offshore Vessel', 'ICG Hovercraft H-191'].map((vessel) => (
              <TouchableOpacity
                key={vessel}
                style={[styles.presetChip, rescueVessel === vessel && styles.presetChipActive]}
                onPress={() => setRescueVessel(vessel)}
              >
                <Text style={[styles.presetTxt, rescueVessel === vessel && styles.presetTxtActive]}>{vessel}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TextInput
            style={styles.input}
            value={rescueVessel}
            onChangeText={setRescueVessel}
            placeholder="Rescue Vessel Name..."
            placeholderTextColor="#94A3B8"
          />

          {/* Estimated Departure / Travel Time (Minutes) */}
          <Text style={styles.fieldLabel}>Estimated Travel Time (ETA in minutes)</Text>
          <TextInput
            style={styles.input}
            value={etaMinutes}
            onChangeText={setEtaMinutes}
            keyboardType="numeric"
            placeholder="ETA Minutes..."
            placeholderTextColor="#94A3B8"
          />

          {/* Operational Notes */}
          <Text style={styles.fieldLabel}>Operational Dispatch Notes</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={3}
            placeholder="Notes regarding equipment, paramedic crew, weather..."
            placeholderTextColor="#94A3B8"
          />
        </View>

        {/* Submit Button */}
        <TouchableOpacity
          style={styles.submitBtn}
          disabled={submitting}
          onPress={handleCreateMission}
        >
          {submitting ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.submitBtnTxt}>🚀 Launch & Dispatch Rescue Mission</Text>
          )}
        </TouchableOpacity>
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.cgPrimary,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  backBtn: {
    paddingVertical: 4,
  },
  backTxt: {
    color: '#BAE6FD',
    fontSize: 14,
    fontWeight: '700',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 100,
  },
  sosSummaryCard: {
    backgroundColor: '#FEF2F2',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1.5,
    borderColor: '#FCA5A5',
  },
  summaryHeading: {
    fontSize: 15,
    fontWeight: '900',
    color: '#991B1B',
    marginBottom: 10,
  },
  summaryGrid: {
    gap: 6,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  sumLabel: {
    fontSize: 12,
    color: '#7F1D1D',
    fontWeight: '600',
  },
  sumVal: {
    fontSize: 12,
    fontWeight: '800',
    color: '#991B1B',
  },
  formCard: {
    backgroundColor: Colors.cgSurface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1.5,
    borderColor: Colors.cgBorder,
  },
  formHeading: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.cgPrimary,
    marginBottom: 14,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.cgText,
    marginBottom: 6,
    marginTop: 10,
  },
  input: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 13,
    color: Colors.cgText,
    borderWidth: 1,
    borderColor: Colors.cgBorder,
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  presetChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 6,
  },
  presetChip: {
    backgroundColor: Colors.surface,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.cgBorder,
  },
  presetChipActive: {
    backgroundColor: Colors.cgPrimary,
    borderColor: Colors.cgPrimaryDark,
  },
  presetTxt: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.cgTextSecondary,
  },
  presetTxtActive: {
    color: '#FFFFFF',
  },
  submitBtn: {
    backgroundColor: Colors.cgPrimary,
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    shadowColor: Colors.cgPrimary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  submitBtnTxt: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
  },
});
