import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../../theme/colors';
import { getCGOfficerSession, saveCGOfficerSession, getCGRegisteredAccounts, saveCGRegisteredAccounts } from '../../storage/storage';
import { CoastalGuardOfficer } from '../../types';
import { PrimaryButton } from '../../components/PrimaryButton';

interface CGProfileScreenProps {
  onLogout: () => void;
  onSwitchToFishermanView?: () => void;
  onProfileUpdate?: (officer: CoastalGuardOfficer) => void;
  hideTopHeader?: boolean;
}

export const CGProfileScreen: React.FC<CGProfileScreenProps> = ({
  onLogout,
  onSwitchToFishermanView,
  onProfileUpdate,
  hideTopHeader = false,
}) => {
  const [officer, setOfficer] = useState<CoastalGuardOfficer | null>(null);
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);

  // Edit Form Fields State
  const [name, setName] = useState<string>('');
  const [rank, setRank] = useState<string>('');
  const [serviceId, setServiceId] = useState<string>('');
  const [station, setStation] = useState<string>('');
  const [phone, setPhone] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [jurisdiction, setJurisdiction] = useState<string>('');

  useEffect(() => {
    loadOfficerProfile();
  }, []);

  const loadOfficerProfile = async () => {
    const session = await getCGOfficerSession();
    if (session) {
      setOfficer(session);
      populateEditForm(session);
    }
  };

  const populateEditForm = (data: CoastalGuardOfficer) => {
    setName(data.name || '');
    setRank(data.rank || 'Commandant (ICG)');
    setServiceId(data.serviceId || 'CG-8841-TN');
    setStation(data.station || 'Chennai Command Base HQ');
    setPhone(data.phone || '+91 94440 99999');
    setEmail(data.email || 'officer@indiancoastguard.gov.in');
    setJurisdiction(data.jurisdiction || 'Tamil Nadu Coastal Zone - District 13');
  };

  const handleStartEdit = () => {
    if (officer) {
      populateEditForm(officer);
    }
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    if (officer) {
      populateEditForm(officer);
    }
    setIsEditing(false);
  };

  const handleSaveProfile = async () => {
    if (!name.trim()) {
      Alert.alert('Validation Error', 'Please enter your Officer Full Name.');
      return;
    }
    if (!serviceId.trim()) {
      Alert.alert('Validation Error', 'Please enter your Officer Service ID.');
      return;
    }
    if (!station.trim()) {
      Alert.alert('Validation Error', 'Please enter your Command Base Station.');
      return;
    }

    setSaving(true);

    try {
      const updatedOfficer: CoastalGuardOfficer = {
        id: officer?.id || `CG-OFFICER-${Date.now()}`,
        name: name.trim(),
        rank: rank.trim(),
        serviceId: serviceId.trim().toUpperCase(),
        station: station.trim(),
        phone: phone.trim(),
        email: email.trim(),
        jurisdiction: jurisdiction.trim(),
        pin: officer?.pin || '123456',
        badgeNumber: serviceId.trim().toUpperCase(),
      };

      // 1. Save updated session
      await saveCGOfficerSession(updatedOfficer);

      // 2. Update registered accounts list if exists
      const accounts = await getCGRegisteredAccounts();
      const existingIdx = accounts.findIndex(
        (a: CoastalGuardOfficer) =>
          a.serviceId === officer?.serviceId || a.phone === officer?.phone
      );
      if (existingIdx >= 0) {
        accounts[existingIdx] = updatedOfficer;
      } else {
        accounts.push(updatedOfficer);
      }
      await saveCGRegisteredAccounts(accounts);

      setOfficer(updatedOfficer);
      if (onProfileUpdate) {
        onProfileUpdate(updatedOfficer);
      }
      setIsEditing(false);

      Alert.alert(
        'Profile Updated 🛡️',
        'Your official Coastal Guard officer details have been saved successfully.'
      );
    } catch (e: any) {
      Alert.alert('Save Error', 'Failed to update profile details. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.cgPrimaryDark} />

      {/* Header */}
      {!hideTopHeader && (
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Officer Profile & Settings</Text>
          <Text style={styles.headerSub}>Samudra Kural Coastal Guard Command</Text>
        </View>
      )}

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Officer Credentials Summary Header Card */}
        <View style={styles.profileCard}>
          <View style={styles.avatarBox}>
            <Text style={styles.avatarIcon}>👮</Text>
          </View>
          <Text style={styles.officerName}>{officer?.name || 'Officer'}</Text>
          <Text style={styles.officerRank}>{officer?.rank || 'Indian Coast Guard Command Officer'}</Text>
          
          <View style={styles.badgeRow}>
            <View style={styles.idBadge}>
              <Text style={styles.idBadgeTxt}>ID: {officer?.serviceId || 'CG-8841-TN'}</Text>
            </View>
            <View style={styles.stationBadge}>
              <Text style={styles.stationBadgeTxt}>{officer?.station || 'Chennai HQ Base'}</Text>
            </View>
          </View>
        </View>

        {/* Dynamic Details Card (View Mode OR Edit Mode) */}
        <View style={styles.detailsCard}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.sectionHeading}>
              {isEditing ? '✏️ Edit Officer Specifications' : '📋 Official Officer Details'}
            </Text>
            {!isEditing ? (
              <TouchableOpacity style={styles.editBtn} activeOpacity={0.8} onPress={handleStartEdit}>
                <Text style={styles.editBtnTxt}>✏️ Edit Profile</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={styles.cancelBtn} activeOpacity={0.8} onPress={handleCancelEdit}>
                <Text style={styles.cancelBtnTxt}>Cancel</Text>
              </TouchableOpacity>
            )}
          </View>

          {!isEditing ? (
            /* VIEW MODE */
            <View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Officer Full Name:</Text>
                <Text style={styles.detailValue}>{officer?.name || 'Officer'}</Text>
              </View>

              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Officer Rank:</Text>
                <Text style={styles.detailValue}>{officer?.rank || 'Commandant (ICG)'}</Text>
              </View>

              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Service Badge ID:</Text>
                <Text style={styles.detailValueBadge}>{officer?.serviceId || 'CG-8841-TN'}</Text>
              </View>

              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Command Base HQ:</Text>
                <Text style={styles.detailValue}>{officer?.station || 'Chennai Command Base HQ'}</Text>
              </View>

              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Official Mobile/Duty Phone:</Text>
                <Text style={styles.detailValueHighlight}>{officer?.phone || '+91 94440 99999'}</Text>
              </View>

              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Government Email:</Text>
                <Text style={styles.detailValue}>{officer?.email || 'officer@indiancoastguard.gov.in'}</Text>
              </View>

              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Patrol Jurisdiction Zone:</Text>
                <Text style={styles.detailValue}>{officer?.jurisdiction || 'Tamil Nadu Coastal Zone - District 13'}</Text>
              </View>

              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Clearance Level:</Text>
                <Text style={styles.detailValue}>Level 5 Master Maritime Command</Text>
              </View>
            </View>
          ) : (
            /* EDIT FORM MODE */
            <View style={styles.editForm}>
              {/* 1. Full Name */}
              <View style={styles.editFieldGroup}>
                <Text style={styles.fieldLabel}>Officer Full Name</Text>
                <TextInput
                  style={styles.fieldInput}
                  value={name}
                  onChangeText={setName}
                  placeholder="Enter Officer Full Name"
                  placeholderTextColor={Colors.disabled}
                />
              </View>

              {/* 2. Officer Rank */}
              <View style={styles.editFieldGroup}>
                <Text style={styles.fieldLabel}>Officer Rank / Designation</Text>
                <TextInput
                  style={styles.fieldInput}
                  value={rank}
                  onChangeText={setRank}
                  placeholder="e.g. Commandant (ICG)"
                  placeholderTextColor={Colors.disabled}
                />
              </View>

              {/* 3. Service ID */}
              <View style={styles.editFieldGroup}>
                <Text style={styles.fieldLabel}>Service / Badge ID No.</Text>
                <TextInput
                  style={styles.fieldInput}
                  value={serviceId}
                  onChangeText={setServiceId}
                  autoCapitalize="characters"
                  placeholder="e.g. ICG-8841-TN"
                  placeholderTextColor={Colors.disabled}
                />
              </View>

              {/* 4. Base HQ Station */}
              <View style={styles.editFieldGroup}>
                <Text style={styles.fieldLabel}>Command Base Station</Text>
                <TextInput
                  style={styles.fieldInput}
                  value={station}
                  onChangeText={setStation}
                  placeholder="e.g. Chennai Command Base HQ"
                  placeholderTextColor={Colors.disabled}
                />
              </View>

              {/* 5. Official Mobile Phone */}
              <View style={styles.editFieldGroup}>
                <Text style={styles.fieldLabel}>Official Mobile/Duty Phone</Text>
                <TextInput
                  style={styles.fieldInput}
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                  placeholder="e.g. +91 94440 99999"
                  placeholderTextColor={Colors.disabled}
                />
              </View>

              {/* 6. Government Email */}
              <View style={styles.editFieldGroup}>
                <Text style={styles.fieldLabel}>Government Email Address</Text>
                <TextInput
                  style={styles.fieldInput}
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  placeholder="e.g. officer@indiancoastguard.gov.in"
                  placeholderTextColor={Colors.disabled}
                />
              </View>

              {/* 7. Patrol Jurisdiction Zone */}
              <View style={styles.editFieldGroup}>
                <Text style={styles.fieldLabel}>Patrol Jurisdiction Zone</Text>
                <TextInput
                  style={styles.fieldInput}
                  value={jurisdiction}
                  onChangeText={setJurisdiction}
                  placeholder="e.g. Tamil Nadu Coastal Zone"
                  placeholderTextColor={Colors.disabled}
                />
              </View>

              {/* Save & Cancel Buttons */}
              <View style={styles.editActionRow}>
                <PrimaryButton
                  title={saving ? "SAVING..." : "💾 SAVE CHANGES"}
                  onPress={handleSaveProfile}
                  loading={saving}
                  style={styles.saveBtn}
                />
                <TouchableOpacity style={styles.cancelActionBtn} onPress={handleCancelEdit}>
                  <Text style={styles.cancelActionTxt}>Discard Changes</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>

        {/* LOGOUT BUTTON - Placed at bottom of page matching Fisherman view */}
        <View style={styles.logoutSection}>
          <PrimaryButton
            title="Logout"
            variant="danger"
            onPress={onLogout}
          />
        </View>

        <View style={styles.bottomSpacer} />
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
    backgroundColor: Colors.cgPrimary,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  headerSub: {
    fontSize: 12,
    color: '#BAE6FD',
    marginTop: 2,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 100,
  },
  profileCard: {
    backgroundColor: Colors.cgSurface,
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1.5,
    borderColor: Colors.cgBorder,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  avatarBox: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: Colors.cgSecondary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
    borderWidth: 2,
    borderColor: Colors.cgPrimary,
  },
  avatarIcon: {
    fontSize: 36,
  },
  officerName: {
    fontSize: 18,
    fontWeight: '900',
    color: Colors.cgPrimary,
  },
  officerRank: {
    fontSize: 12,
    color: Colors.cgTextSecondary,
    marginTop: 2,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  idBadge: {
    backgroundColor: '#EBF4FC',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.cgBorder,
  },
  idBadgeTxt: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.cgPrimary,
  },
  stationBadge: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  stationBadgeTxt: {
    fontSize: 11,
    fontWeight: '800',
    color: '#059669',
  },
  detailsCard: {
    backgroundColor: Colors.cgSurface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1.5,
    borderColor: Colors.cgBorder,
    marginBottom: 16,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  sectionHeading: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.cgPrimary,
  },
  editBtn: {
    backgroundColor: '#E0F2FE',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#38BDF8',
  },
  editBtnTxt: {
    color: Colors.cgPrimary,
    fontSize: 12,
    fontWeight: '800',
  },
  cancelBtn: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  cancelBtnTxt: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '800',
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  detailLabel: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
  },
  detailValue: {
    fontSize: 12,
    color: '#0F172A',
    fontWeight: '700',
    maxWidth: '60%',
    textAlign: 'right',
  },
  detailValueBadge: {
    fontSize: 11,
    color: '#0284C7',
    backgroundColor: '#E0F2FE',
    fontWeight: 'bold',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  detailValueHighlight: {
    fontSize: 12,
    color: Colors.cgCritical,
    fontWeight: 'bold',
  },
  editForm: {
    marginTop: 4,
  },
  editFieldGroup: {
    marginBottom: 14,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 6,
  },
  fieldInput: {
    backgroundColor: Colors.surface,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 48,
    fontSize: 14,
    color: Colors.text,
    fontWeight: '600',
  },
  editActionRow: {
    marginTop: 10,
  },
  saveBtn: {
    marginTop: 4,
  },
  cancelActionBtn: {
    alignItems: 'center',
    paddingVertical: 12,
    marginTop: 6,
  },
  cancelActionTxt: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748B',
  },
  optionsCard: {
    backgroundColor: Colors.cgSurface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(15, 58, 93, 0.12)',
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  optionIcon: {
    fontSize: 18,
    marginRight: 12,
  },
  optionTxt: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    color: '#1E293B',
  },
  arrow: {
    fontSize: 12,
    color: '#94A3B8',
  },
  logoutSection: {
    marginTop: 20,
    marginBottom: 16,
  },
  bottomSpacer: {
    height: 80,
  },
});
