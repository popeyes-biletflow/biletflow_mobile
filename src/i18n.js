import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { DEFAULT_LANG, LANGUAGES, formatDateTimeShort, formatEventDate, formatKZT, translate } from "./strings.js";

// Not under the user cache prefix: the language choice survives sign-out, like the web's localStorage "lang".
const LANG_KEY = "biletflow:lang";

function build(lang, setLang) {
  return {
    lang,
    setLang,
    t: (key, params) => translate(lang, key, params),
    formatDate: (iso, tz, style = "card") => formatEventDate(lang, iso, tz, style),
    formatKZT: (amount) => formatKZT(lang, amount),
    formatStamp: (iso) => formatDateTimeShort(lang, iso)
  };
}

const I18nContext = createContext(build(DEFAULT_LANG, () => {}));

export function I18nProvider({ children }) {
  const [lang, setLangState] = useState(DEFAULT_LANG);

  useEffect(() => {
    AsyncStorage.getItem(LANG_KEY)
      .then((stored) => { if (LANGUAGES.includes(stored)) setLangState(stored); })
      .catch(() => {});
  }, []);

  const setLang = useCallback((next) => {
    if (!LANGUAGES.includes(next)) return;
    setLangState(next);
    AsyncStorage.setItem(LANG_KEY, next).catch(() => {});
  }, []);

  const value = useMemo(() => build(lang, setLang), [lang, setLang]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  return useContext(I18nContext);
}
