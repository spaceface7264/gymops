import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { supportedLocales, type Locale } from '@/lib/i18n'
import { useProfile } from './queries'

/**
 * Makes `profiles.locale` win over the browser's language once the profile is
 * known. Until then i18next keeps whatever it detected, so the signed-out
 * screens still speak the visitor's language.
 */
export function useLocaleSync() {
  const { data: profile } = useProfile()
  const { i18n } = useTranslation()
  const locale = profile?.locale

  useEffect(() => {
    if (!locale || !supportedLocales.includes(locale as Locale)) return
    if (i18n.language === locale) return
    void i18n.changeLanguage(locale)
  }, [locale, i18n])
}
