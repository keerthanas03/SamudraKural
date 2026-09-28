import { SupportedLanguage, LanguageOption } from '../types';
import { en, TranslationKeys } from './locales/en';
import { ta } from './locales/ta';
import { te } from './locales/te';
import { ml } from './locales/ml';
import { kn } from './locales/kn';
import { mr } from './locales/mr';
import { gu } from './locales/gu';
import { or } from './locales/or';
import { bn } from './locales/bn';
import { hi } from './locales/hi';

export const supportedLanguages: LanguageOption[] = [
  { code: 'ta', nativeName: 'தமிழ்', englishName: 'Tamil' },
  { code: 'te', nativeName: 'తెలుగు', englishName: 'Telugu' },
  { code: 'ml', nativeName: 'മലയാളം', englishName: 'Malayalam' },
  { code: 'kn', nativeName: 'ಕನ್ನಡ', englishName: 'Kannada' },
  { code: 'mr', nativeName: 'मराठी', englishName: 'Marathi' },
  { code: 'gu', nativeName: 'ગુજરાતી', englishName: 'Gujarati' },
  { code: 'or', nativeName: 'ଓଡ଼ିଆ', englishName: 'Odia' },
  { code: 'bn', nativeName: 'বাংলা', englishName: 'Bengali' },
  { code: 'hi', nativeName: 'हिन्दी', englishName: 'Hindi' },
  { code: 'en', nativeName: 'English', englishName: 'English' },
];

const dictionaries: Record<SupportedLanguage, Record<TranslationKeys, string>> = {
  en,
  ta,
  te,
  ml,
  kn,
  mr,
  gu,
  or,
  bn,
  hi,
};

/**
 * Safe translation function with guaranteed fallback to English string
 * and key string as last resort so the UI will NEVER crash.
 * Also supports parameter substitution: {paramName}
 */
export function t(
  key: TranslationKeys,
  langCode: SupportedLanguage = 'en',
  params?: Record<string, string | number>
): string {
  const dict = dictionaries[langCode] || dictionaries.en;
  let text = '';
  if (dict && dict[key]) {
    text = dict[key];
  } else if (dictionaries.en && dictionaries.en[key]) {
    text = dictionaries.en[key];
  } else {
    text = key;
  }

  if (params) {
    Object.keys(params).forEach((paramKey) => {
      text = text.replace(new RegExp(`{${paramKey}}`, 'g'), String(params[paramKey]));
    });
  }

  return text;
}

export function translateDirection(direction: string, langCode: SupportedLanguage = 'en'): string {
  if (!direction) return '';
  const clean = direction.trim().toLowerCase().replace(/[\s-_]/g, '');
  const dirMap: Record<string, TranslationKeys> = {
    n: 'north',
    north: 'north',
    nne: 'northNortheast',
    northnortheast: 'northNortheast',
    ne: 'northeast',
    northeast: 'northeast',
    ene: 'eastNortheast',
    eastnortheast: 'eastNortheast',
    e: 'east',
    east: 'east',
    ese: 'eastSoutheast',
    eastsoutheast: 'eastSoutheast',
    se: 'southeast',
    southeast: 'southeast',
    sse: 'southSoutheast',
    southsoutheast: 'southSoutheast',
    s: 'south',
    south: 'south',
    ssw: 'southSouthwest',
    southsouthwest: 'southSouthwest',
    sw: 'southwest',
    southwest: 'southwest',
    wsw: 'westSouthwest',
    westsouthwest: 'westSouthwest',
    w: 'west',
    west: 'west',
    wnw: 'westNorthwest',
    westnorthwest: 'westNorthwest',
    nw: 'northwest',
    northwest: 'northwest',
    nnw: 'northNorthwest',
    northnorthwest: 'northNorthwest',
  };

  const key = dirMap[clean];
  if (key) {
    return t(key, langCode);
  }
  return direction;
}

export function translateSeaState(state: string, langCode: SupportedLanguage = 'en'): string {
  if (!state) return '';
  const clean = state.trim().toLowerCase().replace(/[\s-_]/g, '');
  const stateMap: Record<string, TranslationKeys> = {
    calm: 'seaCalm',
    smooth: 'seaSmooth',
    slight: 'seaSlight',
    moderate: 'seaModerate',
    rough: 'seaRough',
    veryrough: 'seaVeryRough',
    high: 'seaHigh',
    phenomenal: 'seaPhenomenal',
  };
  const key = stateMap[clean];
  if (key) {
    return t(key, langCode);
  }
  return state;
}

export function translateNetType(type: string, langCode: SupportedLanguage = 'en'): string {
  if (!type) return '';
  const clean = type.trim().toLowerCase();
  if (clean.includes('gill')) return t('floatingGillNet', langCode);
  if (clean.includes('drift')) return t('driftingNet', langCode);
  if (clean.includes('surface')) return t('surfaceNet', langCode);
  if (clean.includes('float') || clean.includes('other')) return t('otherFloatingNet', langCode);
  return type;
}

export type { TranslationKeys };
