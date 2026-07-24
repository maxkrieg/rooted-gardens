'use client'

import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { useCurrentEmployee } from '@/hooks/crew/useCurrentEmployee'
import { createClient } from '@/lib/supabase/client'

export default function ProfilePage() {
  const router = useRouter()
  const { data: employee } = useCurrentEmployee()

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  const roleLabel = employee?.role
    ? employee.role.charAt(0).toUpperCase() + employee.role.slice(1)
    : null

  return (
    <div className="p-4 space-y-6">
      {/* Header */}
      <div className="space-y-1">
        <h1 className="font-display text-2xl font-semibold text-foreground">
          {employee?.name ?? '…'}
        </h1>
        {roleLabel && (
          <span className="inline-block text-xs font-semibold uppercase tracking-wide px-2.5 py-0.5 rounded-full bg-secondary text-secondary-foreground">
            {roleLabel}
          </span>
        )}
      </div>

      {/* Sign out */}
      <Button
        variant="ghost"
        className="w-full text-muted-foreground hover:text-destructive hover:bg-destructive/10"
        onClick={handleSignOut}
      >
        Sign Out
      </Button>
    </div>
  )
}
