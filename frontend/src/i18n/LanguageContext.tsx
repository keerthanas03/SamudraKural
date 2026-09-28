import React, { createContext, useContext, useState, useEffect } from 'react';
import { SupportedLanguage } from '../types';
import { getLanguagePreference, saveLanguagePreference } from '../storage/storage';
import { t as translate, TranslationKeys } from './translate';

interface LanguageContextType {
  language: SupportedLanguage;
  setLanguage: (lang: SupportedLanguage) => Promise<void>;
  t: (key: TranslationKeys, params?: Record<string, string | number>) => string;
  tDirection: (direction: string) => string;
  tSeaState: (seaState: string) => string;
  tNetType: (netType: string) => string;
}

const LanguageContext = createContext<LanguageContextType>({
  language: 'ta',
  setLanguage: async () => {},
  t: (key: TranslationKeys) => key,
  tDirection: (d: string) => d,
  tSeaState: (s: string) => s,
  tNetType: (n: string) => n,
});

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<SupportedLanguage>('ta');

  useEffect(() => {
    (async () => {
      try {
        const saved = await getLanguagePreference();
        if (saved) {
          setLanguageState(saved);
        }
      } catch (e) {
        // default to 'ta'
      }
    })();
  }, []);

  const setLanguage = async (newLang: SupportedLanguage) => {
    setLanguageState(newLang);
    await saveLanguagePreference(newLang);
  };

  const t = (key: TranslationKeys, params?: Record<string, string | number>): string => {
    let text = translate(key, language);
    if (params) {
      Object.keys(params).forEach((paramKey) => {
        text = text.replace(new RegExp(`{${paramKey}}`, 'g'), String(params[paramKey]));
      });
    }
    return text;
  };

  const tDirection = (direction: string): string => {
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
      return translate(key, language);
    }
    return direction;
  };

  const tSeaState = (state: string): string => {
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
      return translate(key, language);
    }
    return state;
  };

  const tNetType = (type: string): string => {
    if (!type) return '';
    const clean = type.trim().toLowerCase();
    if (clean.includes('gill')) return translate('floatingGillNet', language);
    if (clean.includes('drift')) return translate('driftingNet', language);
    if (clean.includes('surface')) return translate('surfaceNet', language);
    if (clean.includes('float') || clean.includes('other')) return translate('otherFloatingNet', language);
    return type;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, tDirection, tSeaState, tNetType }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => useContext(LanguageContext);
