import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import type { AppLanguage } from '@pipiclaw/shared/rpc/settings'
import { APP_LANGUAGES, DEFAULT_APP_LANGUAGE, resources } from './resources'

function normalizeLanguage(language: string): AppLanguage {
  if (APP_LANGUAGES.includes(language as AppLanguage)) {
    return language as AppLanguage
  }

  if (language.toLowerCase().startsWith('en')) return 'en-US'
  return DEFAULT_APP_LANGUAGE
}

void i18n.use(initReactI18next).init({
  resources,
  lng: DEFAULT_APP_LANGUAGE,
  fallbackLng: DEFAULT_APP_LANGUAGE,
  defaultNS: 'navigation',
  interpolation: {
    escapeValue: false
  }
})

export function setI18nLanguage(language: AppLanguage): void {
  const nextLanguage = normalizeLanguage(language)
  if (i18n.language === nextLanguage) return
  void i18n.changeLanguage(nextLanguage)
}

export { i18n }
