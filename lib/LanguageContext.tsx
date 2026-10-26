import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

type Language = 'ar' | 'en';

interface LanguageContextType {
  lang: Language;
  toggleLanguage: () => void;
}

const LanguageContext = createContext<LanguageContextType>({
  lang: 'ar',
  toggleLanguage: () => {},
});

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [lang, setLang] = useState<Language>('ar');

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
    const nextLang = lang === 'ar' ? 'en' : 'ar';
    setLang(nextLang);
    try {
      await AsyncStorage.setItem('@app_language', nextLang);
    } catch (e) {
      console.error('Error saving language', e);
    }
  }, [lang]);

  const value = useMemo(() => ({ lang, toggleLanguage }), [lang, toggleLanguage]);

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => useContext(LanguageContext);