import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

type Language = 'ar' | 'en';

interface LanguageContextType {
  lang: Language;
  toggleLanguage: () => void;
}

const LanguageContext = createContext<LanguageContextType>({
  lang: 'en',
  toggleLanguage: () => { },
});

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // 1. تغيير اللغة الافتراضية لتكون الإنجليزية 'en'
  const [lang, setLang] = useState<Language>('en');

  useEffect(() => {
    async function loadLang() {
      try {
        const saved = await AsyncStorage.getItem('@app_language');
        if (saved === 'ar' || saved === 'en') {
          setLang(saved);
        }
      } catch (e) {
        console.error('Error loading language', e);
      }
    }
    void loadLang();
  }, []);

  const toggleLanguage = useCallback(async () => {
    setLang((prev) => {
      const nextLang = prev === 'en' ? 'ar' : 'en';
      AsyncStorage.setItem('@app_language', nextLang).catch((e) =>
        console.error('Error saving language', e)
      );
      return nextLang;
    });
  }, []);

  const value = useMemo(() => ({ lang, toggleLanguage }), [lang, toggleLanguage]);

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => useContext(LanguageContext);