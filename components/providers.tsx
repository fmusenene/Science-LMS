'use client'

import { ThemeProvider } from 'next-themes'
import { Toaster } from '@/components/ui/sonner'
import { LmsProvider } from '@/lib/lms-store'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="light"
      enableSystem={false}
      storageKey="lms.theme"
      disableTransitionOnChange
      // Avoid a blank frame while next-themes hydrates the class on <html>.
      enableColorScheme
    >
      <LmsProvider>{children}</LmsProvider>
      {/* Outside LmsProvider so toasts survive loading gates and stay readable */}
      <Toaster richColors closeButton position="top-right" duration={5500} />
    </ThemeProvider>
  )
}
