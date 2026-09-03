import * as Sentry from '@sentry/react'
import { useEffect } from 'react'
import {
  createRoutesFromChildren,
  matchRoutes,
  useLocation,
  useNavigationType,
} from 'react-router'
import { isDesktop } from '@/lib/platform'

/**
 * P7-05 — Sentry. Imported first in `main.tsx`, so the SDK is up before
 * anything can throw. A build without `VITE_SENTRY_DSN` runs without it, the
 * way one without a VAPID key runs without push.
 *
 * One project for the web and the desktop: the same bundle renders in both,
 * and the `client` tag tells them apart (`platform` is Sentry's own field). The Rust shell has no code of its
 * own to speak of and is not instrumented.
 */
const dsn = import.meta.env.VITE_SENTRY_DSN ?? ''

if (dsn) {
  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    release: `gymops@${__APP_VERSION__}`,
    integrations: [
      Sentry.reactRouterV7BrowserTracingIntegration({
        useEffect,
        useLocation,
        useNavigationType,
        createRoutesFromChildren,
        matchRoutes,
      }),
    ],
    // A performance sample, not a census; 200 people on a handful of screens.
    tracesSampleRate: 0.2,
    // The chat and the incident form carry personal data; nothing about the
    // request body is of use for a failure we can reproduce from the trace.
    sendDefaultPii: false,
  })
  Sentry.setTag('client', isDesktop() ? 'desktop' : 'web')
}

export const sentryEnabled = dsn !== ''
