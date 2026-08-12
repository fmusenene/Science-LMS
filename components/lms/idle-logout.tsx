'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { useLms } from '@/lib/lms-store'

/** Auto sign-out after 5 minutes without user interaction. */
const IDLE_MS = 5 * 60 * 1000
const ACTIVITY_EVENTS = [
  'mousedown',
  'mousemove',
  'keydown',
  'scroll',
  'touchstart',
  'pointerdown',
  'wheel',
] as const

export function IdleLogout() {
  const { currentUser, signOut } = useLms()
  const router = useRouter()
  const timerRef = useRef<number | null>(null)
  const lastMoveRef = useRef(0)
  const signOutRef = useRef(signOut)
  signOutRef.current = signOut

  useEffect(() => {
    if (!currentUser) return

    const clear = () => {
      if (timerRef.current != null) {
        window.clearTimeout(timerRef.current)
        timerRef.current = null
      }
    }

    const logout = () => {
      signOutRef.current()
      toast.message('Signed out after 5 minutes of inactivity.', { id: 'idle-logout' })
      router.replace('/')
    }

    const arm = () => {
      clear()
      timerRef.current = window.setTimeout(logout, IDLE_MS)
    }

    const onActivity = (event: Event) => {
      if (event.type === 'mousemove') {
        const now = Date.now()
        if (now - lastMoveRef.current < 1000) return
        lastMoveRef.current = now
      }
      arm()
    }

    arm()
    for (const name of ACTIVITY_EVENTS) {
      window.addEventListener(name, onActivity, { passive: true })
    }
    const onVis = () => {
      if (document.visibilityState === 'visible') arm()
    }
    document.addEventListener('visibilitychange', onVis)

    return () => {
      clear()
      for (const name of ACTIVITY_EVENTS) {
        window.removeEventListener(name, onActivity)
      }
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [currentUser?.id, router])

  return null
}
