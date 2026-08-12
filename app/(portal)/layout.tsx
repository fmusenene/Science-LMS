import { AuthGate } from '@/components/lms/auth-gate'

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return <AuthGate>{children}</AuthGate>
}
