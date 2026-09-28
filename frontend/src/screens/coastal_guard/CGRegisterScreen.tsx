import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../../theme/colors';
import { PrimaryButton } from '../../components/PrimaryButton';
import { CoastalGuardOfficer } from '../../types';
import { getCGRegisteredAccounts, saveCGRegisteredAccounts, saveCGOfficerSession } from '../../storage/storage';

interface CGRegisterScreenProps {
  onRegisterSuccess: (officerData: CoastalGuardOfficer) => void;
  onNavigateToLogin: () => void;
}

export const CGRegisterScreen: React.FC<CGRegisterScreenProps> = ({
  onRegisterSuccess,
  onNavigateToLogin,
}) => {
  const [fullName, setFullName] = useState<string>('');
  const [serviceId, setServiceId] = useState<string>('');
  const [rank, setRank] = useState<string>('Commandant (ICG)');
  const [station, setStation] = useState<string>('Kasimedu Coast Guard Station, Chennai');
  const [phone, setPhone] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [jurisdiction, setJurisdiction] = useState<string>('Tamil Nadu Coastal Zone - District 13');
  const [pin, setPin] = useState<string>('');
  const [confirmPin, setConfirmPin] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const validateForm = (): boolean => {
    setErrorMessage(null);

    if (!fullName.trim()) {
      setErrorMessage('Please enter Officer Full Name.');
      return false;
    }

    if (!serviceId.trim()) {
      setErrorMessage('Please enter Official Service / Badge ID Number.');
      return false;
    }

    if (!station.trim()) {
      setErrorMessage('Please enter Command Base Station name.');
      return false;
    }

    // 10-digit mobile validation
    if (!/^[6-9]\d{9}$/.test(phone.trim())) {
      setErrorMessage('Please enter a valid 10-digit Official Mobile/Duty Phone Number.');
      return false;
    }

    // Email validation
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setErrorMessage('Please enter a valid Government / Official Email Address.');
      return false;
    }

    if (!jurisdiction.trim()) {
      setErrorMessage('Please specify Patrol Jurisdiction Zone.');
      return false;
    }

    // 6-digit PIN validation
    if (!/^\d{6}$/.test(pin.trim())) {
      setErrorMessage('Please enter a 6-digit Security PIN.');
      return false;
    }

    if (pin.trim() !== confirmPin.trim()) {
      setErrorMessage('Security PINs do not match. Please re-enter.');
      return false;
    }

    return true;
  };

  const handleRegisterOfficer = async () => {
    if (!validateForm()) return;

    setLoading(true);
    setErrorMessage(null);

    try {
      const existingAccounts = await getCGRegisteredAccounts();
      
      const cleanServiceId = serviceId.trim().toUpperCase();
      const cleanPhone = phone.trim();

      // Check if service ID or phone already registered
      const duplicate = existingAccounts.find(
        (acc) => acc.serviceId === cleanServiceId || acc.phone === cleanPhone
      );

      if (duplicate) {
        setErrorMessage(`An Officer account with Service ID (${cleanServiceId}) or Phone is already registered.`);
        setLoading(false);
        return;
      }

      const newOfficer: CoastalGuardOfficer = {
        id: `CG-OFFICER-${Date.now()}`,
        name: fullName.trim(),
        serviceId: cleanServiceId,
        rank: rank.trim(),
        station: station.trim(),
        phone: cleanPhone,
        email: email.trim(),
        jurisdiction: jurisdiction.trim(),
        pin: pin.trim(),
        badgeNumber: cleanServiceId,
      };

      const updatedAccounts = [...existingAccounts, newOfficer];
      await saveCGRegisteredAccounts(updatedAccounts);
      await saveCGOfficerSession(newOfficer);

      setTimeout(() => {
        setLoading(false);
        Alert.alert(
          'Officer Account Registered 🛡️',
          `Welcome, ${newOfficer.rank} ${newOfficer.name}.\nService ID: ${newOfficer.serviceId}\nCommand Base: ${newOfficer.station}`,
          [
            {
              text: 'PROCEED TO LOGIN',
              onPress: () => onRegisterSuccess(newOfficer),
            },
          ]
        );
      }, 500);
    } catch (err: any) {
      setLoading(false);
      setErrorMessage(err?.message || 'Failed to register officer account. Please try again.');
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.background} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <Text style={styles.title}>Coastal Guard Registration</Text>
            <Text style={styles.subtitle}>Create official command & emergency response account</Text>
          </View>

          {errorMessage && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{errorMessage}</Text>
            </View>
          )}

          <View style={styles.form}>
            {/* 1. Official Mobile / Duty Phone */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Official Mobile Number</Text>
              <View style={styles.inputWrapper}>
                <Text style={styles.prefix}>+91</Text>
                <TextInput
                  style={styles.inputWithPrefix}
                  placeholder="Enter 10-digit mobile number"
                  placeholderTextColor={Colors.disabled}
                  keyboardType="numeric"
                  maxLength={10}
                  value={phone}
                  onChangeText={(txt) => setPhone(txt.replace(/[^0-9]/g, ''))}
                />
              </View>
            </View>

            {/* 2. Create 6-Digit PIN */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Create 6-Digit Security PIN</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter 6-digit PIN"
                placeholderTextColor={Colors.disabled}
                keyboardType="numeric"
                secureTextEntry
                maxLength={6}
                value={pin}
                onChangeText={(txt) => setPin(txt.replace(/[^0-9]/g, ''))}
              />
            </View>

            {/* 3. Confirm 6-Digit PIN */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Confirm 6-Digit Security PIN</Text>
              <TextInput
                style={styles.input}
                placeholder="Re-enter 6-digit PIN"
                placeholderTextColor={Colors.disabled}
                keyboardType="numeric"
                secureTextEntry
                maxLength={6}
                value={confirmPin}
                onChangeText={(txt) => setConfirmPin(txt.replace(/[^0-9]/g, ''))}
              />
            </View>

            {/* 4. Officer Full Name */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Officer Full Name</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Commandant Rajesh Sharma"
                placeholderTextColor={Colors.disabled}
                value={fullName}
                onChangeText={setFullName}
              />
            </View>

            {/* 5. Official Service / Badge ID */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Official Service / Badge ID No.</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. ICG-84920-B"
                placeholderTextColor={Colors.disabled}
                value={serviceId}
                onChangeText={setServiceId}
                autoCapitalize="characters"
              />
            </View>

            {/* 6. Officer Rank / Designation Chips */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Officer Rank / Designation</Text>
              <View style={styles.rankChipsRow}>
                {['Commandant (ICG)', 'Assistant Commandant', 'Station Chief', 'Inspector'].map((r) => (
                  <TouchableOpacity
                    key={r}
                    activeOpacity={0.8}
                    style={[styles.rankChip, rank === r && styles.rankChipActive]}
                    onPress={() => setRank(r)}
                  >
                    <Text style={[styles.rankTxt, rank === r && styles.rankTxtActive]}>{r}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* 7. Command Base Station */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Command Base Station</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Kasimedu Coast Guard Station, Chennai"
                placeholderTextColor={Colors.disabled}
                value={station}
                onChangeText={setStation}
              />
            </View>

            {/* 8. Government Email Address */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Government Email Address</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. officer@indiancoastguard.gov.in"
                placeholderTextColor={Colors.disabled}
                keyboardType="email-address"
                autoCapitalize="none"
                value={email}
                onChangeText={setEmail}
              />
            </View>

            {/* 9. Patrol Jurisdiction Zone */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Patrol Jurisdiction Zone</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Tamil Nadu Coastal Zone - District 13"
                placeholderTextColor={Colors.disabled}
                value={jurisdiction}
                onChangeText={setJurisdiction}
              />
            </View>

            {/* Submit Button */}
            <PrimaryButton
              title="CREATE OFFICER ACCOUNT"
              onPress={handleRegisterOfficer}
              loading={loading}
              style={styles.submitBtn}
            />

            {/* Already registered link */}
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={onNavigateToLogin}
              style={styles.loginLink}
            >
              <Text style={styles.loginText}>
                Already registered? Log In to Command Center
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.cgBackground,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 24) + 20 : 30,
    paddingBottom: 30,
  },
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: Colors.cgText,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: Colors.cgTextSecondary,
    lineHeight: 22,
  },
  errorContainer: {
    backgroundColor: Colors.errorBackground,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.error,
    marginBottom: 20,
  },
  errorText: {
    color: Colors.error,
    fontSize: 15,
    fontWeight: '600',
  },
  form: {
    width: '100%',
  },
  inputGroup: {
    marginBottom: 18,
  },
  label: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.cgText,
    marginBottom: 8,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderWidth: 2,
    borderColor: Colors.cgBorder,
    borderRadius: 14,
    height: 56,
    paddingHorizontal: 16,
  },
  prefix: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.cgPrimaryDark,
    marginRight: 10,
  },
  inputWithPrefix: {
    flex: 1,
    fontSize: 18,
    color: Colors.cgText,
    fontWeight: '600',
  },
  input: {
    backgroundColor: Colors.surface,
    borderWidth: 2,
    borderColor: Colors.cgBorder,
    borderRadius: 14,
    height: 56,
    paddingHorizontal: 16,
    fontSize: 18,
    color: Colors.cgText,
    fontWeight: '600',
  },
  rankChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  rankChip: {
    backgroundColor: Colors.surface,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Colors.cgBorder,
  },
  rankChipActive: {
    backgroundColor: Colors.cgPrimary,
    borderColor: Colors.cgPrimaryDark,
  },
  rankTxt: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.cgText,
  },
  rankTxtActive: {
    color: '#FFFFFF',
  },
  submitBtn: {
    marginTop: 10,
  },
  loginLink: {
    alignItems: 'center',
    paddingVertical: 16,
    marginTop: 4,
  },
  loginText: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.cgPrimary,
    textDecorationLine: 'underline',
  },
});
