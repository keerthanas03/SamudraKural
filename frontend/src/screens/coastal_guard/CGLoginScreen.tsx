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
import { getCGRegisteredAccounts, saveCGOfficerSession } from '../../storage/storage';
import { CoastalGuardOfficer } from '../../types';

interface CGLoginScreenProps {
  onLoginSuccess: (officerData?: any) => void;
  onNavigateToFishermanLogin: () => void;
  onNavigateToRegister?: () => void;
}

export const CGLoginScreen: React.FC<CGLoginScreenProps> = ({
  onLoginSuccess,
  onNavigateToFishermanLogin,
  onNavigateToRegister,
}) => {
  const [officerId, setOfficerId] = useState<string>('');
  const [securityPin, setSecurityPin] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleOfficerLogin = async () => {
    setErrorMsg(null);
    const cleanId = officerId.trim().toUpperCase();
    const cleanPin = securityPin.trim();

    if (!cleanId) {
      setErrorMsg('Please enter your Officer Service ID or registered Mobile Number.');
      return;
    }
    if (!cleanPin || cleanPin.length < 4) {
      setErrorMsg('Please enter your valid 6-digit Security PIN.');
      return;
    }

    setLoading(true);

    try {
      const registeredAccounts = await getCGRegisteredAccounts();
      
      // Match against registered officer accounts
      const matchedAccount = registeredAccounts.find(
        (acc: any) =>
          acc.serviceId?.toUpperCase() === cleanId || acc.phone === cleanId || acc.email?.toLowerCase() === cleanId.toLowerCase()
      );

      if (!matchedAccount) {
        setLoading(false);
        setErrorMsg(`Officer Account Not Registered! Service ID or Mobile ${cleanId} is not registered. Please complete registration first.`);
        return;
      }

      if (matchedAccount.pin && matchedAccount.pin !== cleanPin) {
        setLoading(false);
        setErrorMsg('Incorrect Security PIN! Please enter your valid 6-digit PIN.');
        return;
      }

      const matchedOfficer = matchedAccount;
      await saveCGOfficerSession(matchedOfficer);

      setTimeout(() => {
        setLoading(false);
        Alert.alert(
          'Officer Authenticated 🛡️',
          `Welcome, ${matchedOfficer.rank} ${matchedOfficer.name} (${matchedOfficer.serviceId}). Command HQ Access Granted.`
        );
        onLoginSuccess(matchedOfficer);
      }, 500);
    } catch (err: any) {
      setLoading(false);
      setErrorMsg(err?.message || 'Authentication error. Please try again.');
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.background} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header section matching Fisherman Login */}
          <View style={styles.header}>
            <Text style={styles.title}>Coastal Guard Login</Text>
            <Text style={styles.subtitle}>Enter officer service ID and 6-digit PIN</Text>
          </View>

          {errorMsg && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{errorMsg}</Text>
            </View>
          )}

          <View style={styles.form}>
            {/* Officer Service ID / Mobile Field */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Officer Service ID / Mobile Number</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter Service ID or Mobile Number"
                placeholderTextColor={Colors.disabled}
                autoCapitalize="characters"
                value={officerId}
                onChangeText={setOfficerId}
              />
            </View>

            {/* 6-Digit Security PIN Field */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>6-Digit Security PIN</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter 6-digit PIN"
                placeholderTextColor={Colors.disabled}
                keyboardType="numeric"
                secureTextEntry
                maxLength={6}
                value={securityPin}
                onChangeText={(text) => setSecurityPin(text.replace(/[^0-9]/g, ''))}
              />
            </View>

            {/* Submit Login Button */}
            <PrimaryButton
              title="LOGIN"
              onPress={handleOfficerLogin}
              loading={loading}
              style={styles.loginButton}
            />

            {/* Switch to Fisherman Login Direct Access Button */}
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={onNavigateToFishermanLogin}
              style={styles.fishermanLoginBtn}
            >
              <Text style={styles.fishermanLoginBtnTxt}>
                Samudra Kural — Fisherman Login
              </Text>
            </TouchableOpacity>

            {/* Navigation to Register */}
            {onNavigateToRegister && (
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={onNavigateToRegister}
                style={styles.registerLink}
              >
                <Text style={styles.registerText}>
                  New officer? Register Command Account
                </Text>
              </TouchableOpacity>
            )}
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
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 24) + 20 : 40,
    paddingBottom: 24,
    justifyContent: 'center',
  },
  header: {
    marginBottom: 28,
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
    marginBottom: 20,
  },
  label: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.cgText,
    marginBottom: 8,
  },
  input: {
    backgroundColor: Colors.surface,
    borderWidth: 2,
    borderColor: Colors.cgBorder,
    borderRadius: 14,
    height: 58,
    paddingHorizontal: 14,
    fontSize: 15,
    color: Colors.cgText,
    fontWeight: '600',
  },
  loginButton: {
    marginTop: 10,
    backgroundColor: '#1D4E89', // Coastal Guard Command Blue
    borderColor: '#1D4E89',
  },
  registerLink: {
    alignItems: 'center',
    paddingVertical: 16,
    marginTop: 8,
  },
  registerText: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.cgPrimary,
    textDecorationLine: 'underline',
  },
  fishermanLoginBtn: {
    backgroundColor: '#E6F4F1',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 16,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    elevation: 1,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  fishermanLoginBtnTxt: {
    color: Colors.primaryDark,
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
});
