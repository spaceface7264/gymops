import i18next from 'i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import { initReactI18next } from 'react-i18next'
import daCommon from '@/locales/da/common.json'
import enCommon from '@/locales/en/common.json'

export const supportedLocales = ['en', 'da'] as const
export type Locale = (typeof supportedLocales)[number]

export const defaultNS = 'common'

/**
 * One namespace per feature (PROJECT_SPEC.md §3.2). Namespaces are bundled
 * rather than fetched: the desktop shell loads from the filesystem, and both
 * languages together are a few kilobytes.
 */
export const resources = {
  en: { common: enCommon },
  da: { common: daCommon },
} as const

void i18next
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    defaultNS,
    fallbackLng: 'en',
    supportedLngs: supportedLocales,
    detection: {
      // `profiles.locale` takes over once the app shell reads it (P1-08).
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: 'gymops.locale',
      caches: ['localStorage'],
    },
    interpolation: { escapeValue: false },
  })

export { i18next }
