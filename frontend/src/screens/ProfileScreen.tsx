import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  Platform,
  Alert,
  Modal,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../theme/colors';
import { FishermanUser, SupportedLanguage } from '../types';
import { getUserSession, saveUserSession, clearSession } from '../storage/storage';
import { supportedLanguages, useLanguage } from '../i18n';
import { PrimaryButton } from '../components/PrimaryButton';

interface ProfileScreenProps {
  currentLanguage: SupportedLanguage;
  onBack: () => void;
  onLogout: () => void;
  onLanguageChange?: (lang: SupportedLanguage) => void;
  onProfileUpdate?: (user: FishermanUser) => void;
  hideTopHeader?: boolean;
}

export const ProfileScreen: React.FC<ProfileScreenProps> = ({
  currentLanguage,
  onBack,
  onLogout,
  onLanguageChange,
  onProfileUpdate,
  hideTopHeader = false,
}) => {
  const { t, language, setLanguage } = useLanguage();
  const [user, setUser] = useState<FishermanUser>({
    name: 'Fisherman User',
    phone: '+91 98401 23456',
    emergencyPhone: '+91 94440 99999',
    vesselName: 'Sea King IX',
    vesselRegistration: 'TN-01-MM-8492',
    vesselType: 'Mechanized Motorized Trawler',
    homePort: 'Kasimedu Fishing Harbour, Chennai',
    licenseNumber: 'IND-TN-2024-94021',
    aadhaarNumber: 'XXXX-XXXX-8492',
    address: 'No. 42, Harbour Main Road, Kasimedu',
    pincode: '600013',
    vhfRadioActive: true,
    lifeJacketsCount: 6,
  });

  const [isEditModalOpen, setIsEditModalOpen] = useState<boolean>(false);
  const [isLangModalOpen, setIsLangModalOpen] = useState<boolean>(false);

  // Form Fields for Editing Profile
  const [editName, setEditName] = useState<string>('');
  const [editPhone, setEditPhone] = useState<string>('');
  const [editEmergencyPhone, setEditEmergencyPhone] = useState<string>('');
  const [editVesselName, setEditVesselName] = useState<string>('');
  const [editVesselRegistration, setEditVesselRegistration] = useState<string>('');
  const [editVesselType, setEditVesselType] = useState<string>('');
  const [editHomePort, setEditHomePort] = useState<string>('');
  const [editLicenseNumber, setEditLicenseNumber] = useState<string>('');
  const [editAddress, setEditAddress] = useState<string>('');
  const [editPincode, setEditPincode] = useState<string>('');

  useEffect(() => {
    loadProfileData();
  }, []);

  const loadProfileData = async () => {
    try {
      const savedUser = await getUserSession();
      if (savedUser) {
        setUser((prev) => ({
          ...prev,
          ...savedUser,
          name: savedUser.name || prev.name,
          phone: savedUser.phone || prev.phone,
          emergencyPhone: savedUser.emergencyPhone || prev.emergencyPhone,
          address: savedUser.address || prev.address,
          pincode: savedUser.pincode || prev.pincode,
          vesselName: savedUser.vesselName || prev.vesselName,
          vesselRegistration: savedUser.vesselRegistration || prev.vesselRegistration,
          vesselType: savedUser.vesselType || prev.vesselType,
          homePort: savedUser.homePort || prev.homePort,
          licenseNumber: savedUser.licenseNumber || prev.licenseNumber,
          aadhaarNumber: savedUser.aadhaarNumber || prev.aadhaarNumber,
        }));
      }
    } catch (err) {}
  };

  const openEditModal = () => {
    setEditName(user.name);
    setEditPhone(user.phone);
    setEditEmergencyPhone(user.emergencyPhone || '');
    setEditVesselName(user.vesselName || '');
    setEditVesselRegistration(user.vesselRegistration || '');
    setEditVesselType(user.vesselType || '');
    setEditHomePort(user.homePort || '');
    setEditLicenseNumber(user.licenseNumber || '');
    setEditAddress(user.address || '');
    setEditPincode(user.pincode || '');
    setIsEditModalOpen(true);
  };

  const handleSaveProfile = async () => {
    if (!editName.trim()) {
      Alert.alert(t('genericError'), t('missingName'));
      return;
    }

    const updatedUser: FishermanUser = {
      ...user,
      name: editName.trim(),
      phone: editPhone.trim() || user.phone,
      emergencyPhone: editEmergencyPhone.trim() || user.emergencyPhone,
      vesselName: editVesselName.trim() || user.vesselName,
      vesselRegistration: editVesselRegistration.trim() || user.vesselRegistration,
      vesselType: editVesselType.trim() || user.vesselType,
      homePort: editHomePort.trim() || user.homePort,
      licenseNumber: editLicenseNumber.trim() || user.licenseNumber,
      address: editAddress.trim() || user.address,
      pincode: editPincode.trim() || user.pincode,
    };

    setUser(updatedUser);
    await saveUserSession(updatedUser);
    if (onProfileUpdate) {
      onProfileUpdate(updatedUser);
    }
    setIsEditModalOpen(false);
    Alert.alert(t('profileTitle'), t('profileUpdated'));
  };

  const handleLogoutPress = async () => {
    Alert.alert(
      t('logout'),
      t('logoutConfirm'),
      [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('logout'),
          style: 'destructive',
          onPress: async () => {
            await clearSession();
            onLogout();
          },
        },
      ]
    );
  };

  const activeLang = language || currentLanguage;
  const currentLangObj = supportedLanguages.find((l) => l.code === activeLang);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.primaryDark} />

      {/* Header Bar */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>{t('profileTitle')}</Text>
          <Text style={styles.headerSubtitle}>{t('appSubtitle')}</Text>
        </View>
        <TouchableOpacity style={styles.editHeaderBtn} onPress={openEditModal}>
          <Text style={styles.editHeaderBtnText}>✏️</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        {/* 1. HERO FISHERMAN IDENTITY CARD */}
        <View style={styles.profileHeroCard}>
          <View style={styles.avatarContainer}>
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarIcon}>👤</Text>
            </View>
            <View style={styles.verifiedBadge}>
              <Text style={styles.verifiedBadgeText}>✓ {t('verifiedFisherman')}</Text>
            </View>
          </View>

          <Text style={styles.fishermanName}>{user.name}</Text>
          <Text style={styles.fishermanPhone}>{user.phone}</Text>

          <View style={styles.quickGrid}>
            <View style={styles.quickGridBox}>
              <Text style={styles.quickGridLabel}>{t('emergencyContact')}</Text>
              <Text style={styles.quickGridValue}>{user.emergencyPhone || '+91 94440 99999'}</Text>
            </View>

            <View style={styles.quickGridBox}>
              <Text style={styles.quickGridLabel}>{t('boatRegistration')}</Text>
              <Text style={styles.quickGridValue}>{user.vesselRegistration || 'TN-01-MM-8492'}</Text>
            </View>
          </View>
        </View>

        {/* 2. VESSEL & FLEET SPECIFICATIONS CARD */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>{t('vesselDetails')}</Text>
            <TouchableOpacity onPress={openEditModal}>
              <Text style={styles.sectionEditLink}>✏️</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>{t('vesselBoat')}:</Text>
            <Text style={styles.detailValue}>{user.vesselName || 'Sea King IX'}</Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>{t('registrationNumber')}:</Text>
            <Text style={styles.detailValueBadge}>{user.vesselRegistration || 'TN-01-MM-8492'}</Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>{t('boatType')}:</Text>
            <Text style={styles.detailValue}>{user.vesselType || 'Mechanized Trawler'}</Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>{t('homeHarbor')}:</Text>
            <Text style={styles.detailValue}>{user.homePort || 'Kasimedu Harbour, Chennai'}</Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>{t('licenseNumber')}:</Text>
            <Text style={styles.detailValue}>{user.licenseNumber || 'IND-TN-2024-94021'}</Text>
          </View>
        </View>

        {/* 4. RESIDENTIAL ADDRESS & PORT LOCATION CARD */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>{t('address')}</Text>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>{t('address')}:</Text>
            <Text style={styles.detailValue}>{user.address || 'Kasimedu Harbour Road'}</Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>{t('pincode')}:</Text>
            <Text style={styles.detailValue}>{user.pincode || '600013'}</Text>
          </View>
        </View>

        {/* 4. APP SETTINGS & LANGUAGE */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>{t('appSettings')}</Text>

          <TouchableOpacity
            style={styles.detailRow}
            activeOpacity={0.7}
            onPress={() => setIsLangModalOpen(true)}
          >
            <Text style={styles.detailLabel}>{t('language')}:</Text>
            <Text style={styles.detailValueHighlight}>
              {currentLangObj ? `${currentLangObj.nativeName} (${currentLangObj.englishName})` : 'Tamil'} ›
            </Text>
          </TouchableOpacity>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>INCOIS Marine Advisories:</Text>
            <Text style={styles.detailValueActive}>Live Regional Alerts Enabled</Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Emergency SOS Broadcast:</Text>
            <Text style={styles.detailValueActive}>Auto-Beacon Transmit Enabled</Text>
          </View>
        </View>

        {/* 5. LOGOUT BUTTON */}
        <View style={styles.logoutSection}>
          <PrimaryButton
            title={t('logout')}
            variant="danger"
            onPress={handleLogoutPress}
          />
        </View>

        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* Language Selection Modal */}
      <Modal
        visible={isLangModalOpen}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsLangModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Select App Language</Text>
                <Text style={styles.modalSubtitle}>Choose your preferred marine portal language</Text>
              </View>
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => setIsLangModalOpen(false)}
              >
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.formScroll} showsVerticalScrollIndicator={false}>
              {supportedLanguages.map((langOption) => {
                const isSelected = langOption.code === currentLanguage;
                return (
                  <TouchableOpacity
                    key={langOption.code}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      backgroundColor: isSelected ? 'rgba(0, 95, 96, 0.1)' : Colors.background,
                      borderColor: isSelected ? Colors.primary : Colors.border,
                      borderWidth: isSelected ? 2 : 1.5,
                      borderRadius: 14,
                      paddingHorizontal: 16,
                      paddingVertical: 14,
                      marginBottom: 10,
                    }}
                    activeOpacity={0.8}
                    onPress={async () => {
                      setIsLangModalOpen(false);
                      await setLanguage(langOption.code);
                      if (onLanguageChange) {
                        onLanguageChange(langOption.code);
                      }
                      Alert.alert(
                        'Language Updated',
                        `Samudra Kural app language set to ${langOption.nativeName} (${langOption.englishName}).`
                      );
                    }}
                  >
                    <View>
                      <Text style={{ fontSize: 18, fontWeight: '900', color: isSelected ? Colors.primaryDark : Colors.text, marginBottom: 2 }}>
                        {langOption.nativeName}
                      </Text>
                      <Text style={{ fontSize: 14, fontWeight: '700', color: isSelected ? Colors.primary : Colors.textSecondary }}>
                        {langOption.englishName}
                      </Text>
                    </View>

                    {isSelected && (
                      <View style={{ backgroundColor: Colors.primary, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 }}>
                        <Text style={{ color: '#FFFFFF', fontSize: 11, fontWeight: '900' }}>✓ ACTIVE</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* EDIT PROFILE MODAL */}
      <Modal
        visible={isEditModalOpen}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsEditModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>{t('profileTitle')}</Text>
              </View>
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => setIsEditModalOpen(false)}
              >
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.formScroll} showsVerticalScrollIndicator={false}>
              <Text style={styles.formSectionTitle}>{t('personalDetails')}</Text>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>{t('fullName')}*</Text>
                <TextInput
                  style={styles.textInput}
                  value={editName}
                  onChangeText={setEditName}
                  placeholder={t('namePlaceholder')}
                />
              </View>

              <View style={styles.inputRow}>
                <View style={[styles.inputGroup, { flex: 1, marginRight: 6 }]}>
                  <Text style={styles.inputLabel}>{t('mobileNumber')}*</Text>
                  <TextInput
                    style={styles.textInput}
                    value={editPhone}
                    onChangeText={setEditPhone}
                    keyboardType="phone-pad"
                  />
                </View>

                <View style={[styles.inputGroup, { flex: 1, marginLeft: 6 }]}>
                  <Text style={styles.inputLabel}>{t('contactPhone')}*</Text>
                  <TextInput
                    style={styles.textInput}
                    value={editEmergencyPhone}
                    onChangeText={setEditEmergencyPhone}
                    keyboardType="phone-pad"
                  />
                </View>
              </View>

              <Text style={[styles.formSectionTitle, { marginTop: 14 }]}>{t('vesselDetails')}</Text>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>{t('vesselBoat')}</Text>
                <TextInput
                  style={styles.textInput}
                  value={editVesselName}
                  onChangeText={setEditVesselName}
                  placeholder="e.g. Sea King IX"
                />
              </View>

              <View style={styles.inputRow}>
                <View style={[styles.inputGroup, { flex: 1, marginRight: 6 }]}>
                  <Text style={styles.inputLabel}>{t('registrationNumber')}</Text>
                  <TextInput
                    style={styles.textInput}
                    value={editVesselRegistration}
                    onChangeText={setEditVesselRegistration}
                    placeholder="e.g. TN-01-MM-8492"
                  />
                </View>

                <View style={[styles.inputGroup, { flex: 1, marginLeft: 6 }]}>
                  <Text style={styles.inputLabel}>{t('boatType')}</Text>
                  <TextInput
                    style={styles.textInput}
                    value={editVesselType}
                    onChangeText={setEditVesselType}
                    placeholder="e.g. Motorized Trawler"
                  />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>{t('homeHarbor')}</Text>
                <TextInput
                  style={styles.textInput}
                  value={editHomePort}
                  onChangeText={setEditHomePort}
                  placeholder="e.g. Kasimedu Fishing Harbour, Chennai"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>{t('licenseNumber')}</Text>
                <TextInput
                  style={styles.textInput}
                  value={editLicenseNumber}
                  onChangeText={setEditLicenseNumber}
                  placeholder="e.g. IND-TN-2024-94021"
                />
              </View>

              <Text style={[styles.formSectionTitle, { marginTop: 14 }]}>{t('address')}</Text>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>{t('address')}</Text>
                <TextInput
                  style={styles.textInput}
                  value={editAddress}
                  onChangeText={setEditAddress}
                  placeholder={t('addressPlaceholder')}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>{t('pincode')}</Text>
                <TextInput
                  style={styles.textInput}
                  value={editPincode}
                  onChangeText={setEditPincode}
                  keyboardType="numeric"
                  placeholder={t('pincodePlaceholder')}
                />
              </View>

              <TouchableOpacity style={styles.saveProfileBtn} onPress={handleSaveProfile}>
                <Text style={styles.saveProfileBtnText}>💾 {t('saveProfile')}</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    backgroundColor: Colors.primaryDark,
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 24) + 8 : 12,
    paddingBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 18,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButtonText: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '900',
  },
  headerTitleContainer: {
    flex: 1,
    marginLeft: 12,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
  },
  headerSubtitle: {
    color: '#B0ECE8',
    fontSize: 12,
    fontWeight: '600',
  },
  editHeaderBtn: {
    backgroundColor: Colors.secondary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.secondaryDark,
  },
  editHeaderBtnText: {
    color: Colors.primaryDark,
    fontSize: 13,
    fontWeight: '900',
  },
  container: {
    padding: 16,
    paddingBottom: 90,
  },
  profileHeroCard: {
    backgroundColor: Colors.surface,
    borderRadius: 18,
    padding: 20,
    borderWidth: 2,
    borderColor: Colors.primary,
    marginBottom: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 4,
  },
  avatarContainer: {
    alignItems: 'center',
    marginBottom: 10,
  },
  avatarCircle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: Colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2.5,
    borderColor: Colors.primary,
    marginBottom: 6,
  },
  avatarIcon: {
    fontSize: 38,
  },
  verifiedBadge: {
    backgroundColor: 'rgba(0, 168, 150, 0.15)',
    borderColor: Colors.primary,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 8,
  },
  verifiedBadgeText: {
    color: Colors.primaryDark,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  fishermanName: {
    color: Colors.text,
    fontSize: 24,
    fontWeight: '900',
    marginBottom: 2,
    textAlign: 'center',
  },
  fishermanPhone: {
    color: Colors.textSecondary,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 14,
  },
  quickGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    gap: 8,
  },
  quickGridBox: {
    flex: 1,
    backgroundColor: Colors.background,
    padding: 10,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  quickGridLabel: {
    color: Colors.textSecondary,
    fontSize: 11,
    fontWeight: '800',
    marginBottom: 2,
  },
  quickGridValue: {
    color: Colors.primaryDark,
    fontSize: 13,
    fontWeight: '900',
  },
  sectionCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1.5,
    borderColor: Colors.border,
    marginBottom: 14,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    color: Colors.text,
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  sectionEditLink: {
    color: Colors.primary,
    fontSize: 13,
    fontWeight: '800',
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F0ECEC',
  },
  detailLabel: {
    color: Colors.textSecondary,
    fontSize: 13,
    fontWeight: '700',
    flex: 1,
  },
  detailValue: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'right',
    flex: 1.2,
  },
  detailValueBadge: {
    color: Colors.primaryDark,
    fontSize: 14,
    fontWeight: '900',
    backgroundColor: Colors.secondary,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.secondaryDark,
  },
  detailValueHighlight: {
    color: Colors.primary,
    fontSize: 14,
    fontWeight: '900',
  },
  detailValueActive: {
    color: Colors.success,
    fontSize: 13,
    fontWeight: '800',
  },
  logoutSection: {
    marginTop: 8,
    marginBottom: 20,
  },
  logoutButtonOverride: {
    borderColor: '#C0392B',
    borderWidth: 2,
  },
  bottomSpacer: {
    height: 40,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 30, 40, 0.65)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 18,
    paddingTop: 20,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
    maxHeight: '88%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 12,
    borderBottomWidth: 1.5,
    borderBottomColor: Colors.border,
    marginBottom: 12,
  },
  modalTitle: {
    color: Colors.primaryDark,
    fontSize: 20,
    fontWeight: '900',
  },
  modalSubtitle: {
    color: Colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
    marginTop: 2,
  },
  modalCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  modalCloseText: {
    color: Colors.textSecondary,
    fontSize: 18,
    fontWeight: '900',
  },
  formScroll: {
    marginTop: 4,
  },
  formSectionTitle: {
    color: Colors.primary,
    fontSize: 13,
    fontWeight: '900',
    marginBottom: 8,
    letterSpacing: 0.6,
  },
  inputGroup: {
    marginBottom: 10,
  },
  inputRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  inputLabel: {
    color: Colors.text,
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 4,
  },
  textInput: {
    backgroundColor: Colors.background,
    borderColor: Colors.border,
    borderWidth: 1.5,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: Colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  saveProfileBtn: {
    backgroundColor: Colors.primary,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 14,
    marginBottom: 30,
  },
  saveProfileBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
  },
});
