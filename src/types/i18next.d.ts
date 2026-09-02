import type { defaultNS, resources } from '@/lib/i18n'

// Makes t() key-checked against the English namespaces: a typo or a key that
// exists in only one locale is a type error, not a string rendered raw.
declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: typeof defaultNS
    resources: (typeof resources)['en']
  }
}
