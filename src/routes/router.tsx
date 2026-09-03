import { wrapCreateBrowserRouterV7 } from '@sentry/react'
import { createBrowserRouter } from 'react-router'
import { AuditPanel, GymsPanel, UsersPanel } from '@/features/admin'
import { RequireAuth } from '@/features/auth'
import { ChatPage } from '@/features/chat'
import { DailyLogPage } from '@/features/daily-log'
import { EventsPage } from '@/features/events'
import {
  ChecklistRunsPage,
  ChecklistTemplateEditorPage,
  ChecklistTemplatesPage,
} from '@/features/checklists'
import { GymProvider } from '@/features/gyms'
import { IncidentDetailPage, IncidentFormPage, IncidentsPage } from '@/features/incidents'
import { AcceptInvitePage } from '@/routes/accept-invite-page'
import { AccountPage } from '@/routes/account-page'
import { AdminPage, RequireSuperadmin } from '@/routes/admin-page'
import { AuthCallbackPage } from '@/routes/auth-callback-page'
import { AppShell } from '@/routes/app-shell'
import { ForgotPasswordPage } from '@/routes/forgot-password-page'
import { HomePage } from '@/routes/home-page'
import { InstallPage } from '@/routes/install-page'
import { LoginPage } from '@/routes/login-page'
import { GuideDetailPage, GuideEditorPage, GuidesPage } from '@/features/guides'
import { NewsFeed, PostDetailPage, PostEditorPage } from '@/features/news'
import { InboxPage, NotificationPreferencesPage } from '@/features/notifications'
import { ModulePlaceholder } from '@/routes/module-placeholder'
import { navEntries } from '@/routes/nav'
import { NotFoundPage } from '@/routes/not-found-page'
import { RouteError } from '@/routes/route-error'
import { ResetPasswordPage } from '@/routes/reset-password-page'
import { RootLayout } from '@/routes/root-layout'

// Names navigation spans after the matched route, `/incidents/:incidentId`
// rather than one id per span (P7-05). Inert without a DSN.
const createRouter = wrapCreateBrowserRouterV7(createBrowserRouter)

/**
 * Route table. Everything below `/` requires a session and renders inside the
 * app shell; modules whose phase has not landed render a
 * placeholder, so a nav entry without a `phase` must have a route here.
 */
export const router = createRouter([
  {
    // A pathless layout route, so anything thrown while rendering any screen
    // below renders `RouteError` instead of an empty document. It is also
    // where the desktop app listens for deep links (P7-02).
    element: <RootLayout />,
    errorElement: <RouteError />,
    children: [
      { path: '/login', element: <LoginPage /> },
      { path: '/forgot-password', element: <ForgotPasswordPage /> },
      { path: '/reset-password', element: <ResetPasswordPage /> },
      { path: '/accept-invite', element: <AcceptInvitePage /> },
      { path: '/auth/callback', element: <AuthCallbackPage /> },
      {
        path: '/',
        element: (
          <RequireAuth>
            <GymProvider>
              <AppShell />
            </GymProvider>
          </RequireAuth>
        ),
        children: [
          { index: true, element: <HomePage /> },
          { path: 'news', element: <NewsFeed /> },
          { path: 'news/new', element: <PostEditorPage /> },
          { path: 'news/:postId', element: <PostDetailPage /> },
          { path: 'news/:postId/edit', element: <PostEditorPage /> },
          { path: 'events', element: <EventsPage /> },
          { path: 'checklists', element: <ChecklistRunsPage /> },
          { path: 'checklists/templates', element: <ChecklistTemplatesPage /> },
          { path: 'checklists/templates/new', element: <ChecklistTemplateEditorPage /> },
          {
            path: 'checklists/templates/:templateId/edit',
            element: <ChecklistTemplateEditorPage />,
          },
          { path: 'daily-log', element: <DailyLogPage /> },
          // Both render the same screen; `fullBleedRoutes` in nav.ts is what
          // tells the shell to drop its page padding and max width for them.
          { path: 'chat', element: <ChatPage /> },
          { path: 'chat/:channelId', element: <ChatPage /> },
          { path: 'notifications', element: <InboxPage /> },
          { path: 'install', element: <InstallPage /> },
          { path: 'account', element: <AccountPage /> },
          {
            path: 'notifications/preferences',
            element: <NotificationPreferencesPage />,
          },
          { path: 'incidents', element: <IncidentsPage /> },
          { path: 'incidents/new', element: <IncidentFormPage /> },
          { path: 'incidents/:incidentId', element: <IncidentDetailPage /> },
          { path: 'guides', element: <GuidesPage /> },
          { path: 'guides/new', element: <GuideEditorPage /> },
          { path: 'guides/:guideId', element: <GuideDetailPage /> },
          { path: 'guides/:guideId/edit', element: <GuideEditorPage /> },
          {
            path: 'admin',
            element: <AdminPage />,
            children: [
              { path: 'users', element: <UsersPanel /> },
              {
                path: 'gyms',
                element: (
                  <RequireSuperadmin>
                    <GymsPanel />
                  </RequireSuperadmin>
                ),
              },
              {
                path: 'audit',
                element: (
                  <RequireSuperadmin>
                    <AuditPanel />
                  </RequireSuperadmin>
                ),
              },
            ],
          },
          ...navEntries
            .filter((entry) => entry.phase)
            .map((entry) => ({
              path: entry.to.slice(1),
              element: <ModulePlaceholder entry={entry} />,
            })),
          { path: '*', element: <NotFoundPage /> },
        ],
      },
    ],
  },
])
