import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../theme/colors';
import { supportedLanguages, t, useLanguage } from '../i18n';
import { SupportedLanguage, LanguageOption } from '../types';
import { PrimaryButton } from '../components/PrimaryButton';
import { saveLanguagePreference } from '../storage/storage';

interface LanguageScreenProps {
  initialLanguage?: SupportedLanguage;
  onLanguageSelected: (lang: SupportedLanguage) => void;
  onCancel?: () => void;
}

export const LanguageScreen: React.FC<LanguageScreenProps> = ({
  initialLanguage = 'ta',
  onLanguageSelected,
  onCancel,
}) => {
  const { setLanguage } = useLanguage();
  const [selectedLang, setSelectedLang] = useState<SupportedLanguage>(initialLanguage);

  const handleContinue = async () => {
    await setLanguage(selectedLang);
    onLanguageSelected(selectedLang);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.background} />
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>{t('selectLanguageTitle', selectedLang)}</Text>
          <Text style={styles.subtitle}>{t('selectLanguageSub', selectedLang)}</Text>
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollList}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.grid}>
            {supportedLanguages.map((item: LanguageOption) => {
              const isSelected = selectedLang === item.code;
              return (
                <TouchableOpacity
                  key={item.code}
                  activeOpacity={0.8}
                  onPress={() => setSelectedLang(item.code)}
                  style={[
                    styles.langCard,
                    isSelected && styles.langCardSelected,
                  ]}
                >
                  <Text style={[styles.nativeText, isSelected && styles.textSelected]}>
                    {item.nativeName}
                  </Text>
                  <Text style={[styles.englishText, isSelected && styles.textSelectedSub]}>
                    {item.englishName}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <PrimaryButton
            title={t('continue', selectedLang)}
            onPress={handleContinue}
          />
          {onCancel && (
            <TouchableOpacity
              onPress={onCancel}
              style={styles.cancelBtn}
            >
              <Text style={styles.cancelBtnText}>{t('cancel', selectedLang)}</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  container: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 24) + 16 : 24,
  },
  header: {
    marginBottom: 20,
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: Colors.text,
    textAlign: 'center',
    marginBottom: 8,
    lineHeight: 32,
  },
  subtitle: {
    fontSize: 16,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  scrollList: {
    paddingBottom: 20,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  langCard: {
    width: '48%',
    backgroundColor: Colors.surface,
    borderColor: Colors.border,
    borderWidth: 2,
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 12,
    marginBottom: 14,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 84,
  },
  langCardSelected: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primaryDark,
  },
  nativeText: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 4,
  },
  englishText: {
    fontSize: 14,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  textSelected: {
    color: Colors.textLight,
  },
  textSelectedSub: {
    color: '#D4F2F0',
  },
  footer: {
    paddingVertical: 16,
    backgroundColor: Colors.background,
  },
  cancelBtn: {
    marginTop: 12,
    alignItems: 'center',
    paddingVertical: 10,
  },
  cancelBtnText: {
    fontSize: 16,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
});
