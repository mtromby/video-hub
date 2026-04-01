import { lazy, Suspense } from 'react'
import { Route, Routes } from 'react-router-dom'

import { MainApp } from '@/pages/MainApp'

const LoginPage = lazy(() => import('@/pages/LoginPage').then((m) => ({ default: m.LoginPage })))

function LoginFallback() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-background text-muted-foreground">
      <div className="flex flex-col items-center gap-3">
        <div className="size-10 animate-pulse rounded-full bg-primary/25" aria-hidden />
        <p className="text-sm font-medium tracking-wide">Loading…</p>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <Routes>
      <Route
        path="/login"
        element={
          <Suspense fallback={<LoginFallback />}>
            <LoginPage />
          </Suspense>
        }
      />
      <Route path="/*" element={<MainApp />} />
    </Routes>
  )
}
