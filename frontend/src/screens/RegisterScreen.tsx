import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../theme/colors';
import { t } from '../i18n';
import { SupportedLanguage } from '../types';
import { PrimaryButton } from '../components/PrimaryButton';
import { authService } from '../services/authService';

interface RegisterScreenProps {
  currentLanguage: SupportedLanguage;
  onRegisterSuccess: () => void;
  onNavigateToLogin: () => void;
}

export const RegisterScreen: React.FC<RegisterScreenProps> = ({
  currentLanguage,
  onRegisterSuccess,
  onNavigateToLogin,
}) => {
  const [mobile, setMobile] = useState('');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [fullName, setFullName] = useState('');
  const [address, setAddress] = useState('');
  const [pincode, setPincode] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const validateForm = (): boolean => {
    setErrorMessage(null);

    // Mobile Number validation
    if (!/^[6-9]\d{9}$/.test(mobile.trim())) {
      setErrorMessage(t('invalidMobile', currentLanguage));
      return false;
    }

    // 6-digit PIN validation
    if (!/^\d{6}$/.test(pin)) {
      setErrorMessage(t('invalidPin', currentLanguage));
      return false;
    }

    // PIN match check
    if (pin !== confirmPin) {
      setErrorMessage(t('pinMismatch', currentLanguage));
      return false;
    }

    // Full Name check
    if (!fullName.trim()) {
      setErrorMessage(t('missingName', currentLanguage));
      return false;
    }

    // Address check
    if (!address.trim()) {
      setErrorMessage(t('missingAddress', currentLanguage));
      return false;
    }

    // 6-digit Pincode check
    if (!/^\d{6}$/.test(pincode.trim())) {
      setErrorMessage(t('invalidPincode', currentLanguage));
      return false;
    }

    return true;
  };

  const handleRegister = async () => {
    if (!validateForm()) return;

    setLoading(true);
    setErrorMessage(null);

    try {
      await authService.register({
        name: fullName.trim(),
        phone: mobile.trim(),
        pin: pin.trim(),
        address: address.trim(),
        pincode: pincode.trim(),
      });
      onRegisterSuccess();
    } catch (error: any) {
      if (error?.data?.isMismatch || error.status === 422) {
        Alert.alert(
          t('mismatchNoticeTitle', currentLanguage),
          t('mismatchNoticeText', currentLanguage),
          [
            {
              text: 'OK',
              onPress: () => {
                onRegisterSuccess();
              },
            },
          ]
        );
      } else {
        setErrorMessage(error.message || t('genericError', currentLanguage));
      }
    } finally {
      setLoading(false);
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
          <View style={styles.header}>
            <Text style={styles.title}>{t('registerTitle', currentLanguage)}</Text>
            <Text style={styles.subtitle}>{t('registerSub', currentLanguage)}</Text>
          </View>

          {errorMessage && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{errorMessage}</Text>
            </View>
          )}

          <View style={styles.form}>
            {/* Mobile Number */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>{t('mobileNumber', currentLanguage)}</Text>
              <View style={styles.inputWrapper}>
                <Text style={styles.prefix}>+91</Text>
                <TextInput
                  style={styles.inputWithPrefix}
                  placeholder={t('mobilePlaceholder', currentLanguage)}
                  placeholderTextColor={Colors.disabled}
                  keyboardType="numeric"
                  maxLength={10}
                  value={mobile}
                  onChangeText={(text) => setMobile(text.replace(/[^0-9]/g, ''))}
                />
              </View>
            </View>

            {/* Create 6-Digit PIN */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>{t('createPin', currentLanguage)}</Text>
              <TextInput
                style={styles.input}
                placeholder={t('pinPlaceholder', currentLanguage)}
                placeholderTextColor={Colors.disabled}
                keyboardType="numeric"
                secureTextEntry
                maxLength={6}
                value={pin}
                onChangeText={(text) => setPin(text.replace(/[^0-9]/g, ''))}
              />
            </View>

            {/* Confirm 6-Digit PIN */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>{t('confirmPin', currentLanguage)}</Text>
              <TextInput
                style={styles.input}
                placeholder={t('pinPlaceholder', currentLanguage)}
                placeholderTextColor={Colors.disabled}
                keyboardType="numeric"
                secureTextEntry
                maxLength={6}
                value={confirmPin}
                onChangeText={(text) => setConfirmPin(text.replace(/[^0-9]/g, ''))}
              />
            </View>

            {/* Full Name */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>{t('fullName', currentLanguage)}</Text>
              <TextInput
                style={styles.input}
                placeholder={t('namePlaceholder', currentLanguage)}
                placeholderTextColor={Colors.disabled}
                value={fullName}
                onChangeText={setFullName}
              />
            </View>

            {/* Address */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>{t('address', currentLanguage)}</Text>
              <TextInput
                style={styles.input}
                placeholder={t('addressPlaceholder', currentLanguage)}
                placeholderTextColor={Colors.disabled}
                value={address}
                onChangeText={setAddress}
              />
            </View>

            {/* Pincode */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>{t('pincode', currentLanguage)}</Text>
              <TextInput
                style={styles.input}
                placeholder={t('pincodePlaceholder', currentLanguage)}
                placeholderTextColor={Colors.disabled}
                keyboardType="numeric"
                maxLength={6}
                value={pincode}
                onChangeText={(text) => setPincode(text.replace(/[^0-9]/g, ''))}
              />
            </View>

            {/* Submit Button */}
            <PrimaryButton
              title={t('createAccountBtn', currentLanguage)}
              onPress={handleRegister}
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
                {t('alreadyHaveAccount', currentLanguage)}
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
    backgroundColor: Colors.background,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 24) + 20 : 30,
    paddingBottom: 24,
  },
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: Colors.text,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: Colors.textSecondary,
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
    color: Colors.text,
    marginBottom: 8,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderWidth: 2,
    borderColor: Colors.border,
    borderRadius: 14,
    height: 56,
    paddingHorizontal: 16,
  },
  prefix: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.primaryDark,
    marginRight: 10,
  },
  inputWithPrefix: {
    flex: 1,
    fontSize: 18,
    color: Colors.text,
    fontWeight: '600',
  },
  input: {
    backgroundColor: Colors.surface,
    borderWidth: 2,
    borderColor: Colors.border,
    borderRadius: 14,
    height: 56,
    paddingHorizontal: 16,
    fontSize: 18,
    color: Colors.text,
    fontWeight: '600',
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
    color: Colors.primary,
    textDecorationLine: 'underline',
  },
});
