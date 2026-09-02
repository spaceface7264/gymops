import { createBrowserRouter, Outlet } from 'react-router'
import { AuditPanel, GymsPanel, UsersPanel } from '@/features/admin'
import { RequireAuth } from '@/features/auth'
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
import { AdminPage, RequireSuperadmin } from '@/routes/admin-page'
import { AppShell } from '@/routes/app-shell'
import { ForgotPasswordPage } from '@/routes/forgot-password-page'
import { HomePage } from '@/routes/home-page'
import { LoginPage } from '@/routes/login-page'
import { GuideDetailPage, GuideEditorPage, GuidesPage } from '@/features/guides'
import { NewsFeed, PostDetailPage, PostEditorPage } from '@/features/news'
import { InboxPage, NotificationPreferencesPage } from '@/features/notifications'
import { ModulePlaceholder } from '@/routes/module-placeholder'
import { navEntries } from '@/routes/nav'
import { NotFoundPage } from '@/routes/not-found-page'
import { RouteError } from '@/routes/route-error'
import { ResetPasswordPage } from '@/routes/reset-password-page'

/**
 * Route table. Everything below `/` requires a session and renders inside the
 * app shell; modules whose phase has not landed render a
 * placeholder, so a nav entry without a `phase` must have a route here.
 */
export const router = createBrowserRouter([
  {
    // A pathless layout route, so anything thrown while rendering any screen
    // below renders `RouteError` instead of an empty document.
    element: <Outlet />,
    errorElement: <RouteError />,
    children: [
      { path: '/login', element: <LoginPage /> },
      { path: '/forgot-password', element: <ForgotPasswordPage /> },
      { path: '/reset-password', element: <ResetPasswordPage /> },
      { path: '/accept-invite', element: <AcceptInvitePage /> },
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
          { path: 'notifications', element: <InboxPage /> },
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
