import { Outlet } from 'react-router'

export function RootLayout() {
  return (
    <div className="bg-background text-foreground min-h-dvh">
      <main className="mx-auto max-w-3xl p-6">
        <Outlet />
      </main>
    </div>
  )
}
