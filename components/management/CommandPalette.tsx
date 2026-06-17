'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Building2 } from 'lucide-react'
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { createClient } from '@/lib/supabase/client'
import type { AccountSearchResult } from '@/types/app'

interface CommandPaletteProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const router = useRouter()
  const [accounts, setAccounts] = useState<AccountSearchResult[]>([])
  const [query, setQuery] = useState('')

  // Fetch once on first open
  useEffect(() => {
    if (!open || accounts.length > 0) return

    const supabase = createClient()
    supabase
      .from('accounts')
      .select('id, name, contact_name, status, properties(address)')
      .then(({ data }) => {
        if (!data) return
        setAccounts(
          data.map((a) => ({
            id: a.id,
            name: a.name,
            contact_name: a.contact_name,
            status: a.status as AccountSearchResult['status'],
            addresses: (a.properties as { address: string }[]).map((p) => p.address),
          }))
        )
      })
  }, [open, accounts.length])

  function handleSelect(id: string) {
    onOpenChange(false)
    router.push(`/management/accounts/${id}`)
  }

  const q = query.toLowerCase()
  const filtered =
    q.length === 0
      ? accounts
      : accounts.filter(
          (a) =>
            a.name.toLowerCase().includes(q) ||
            (a.contact_name?.toLowerCase().includes(q) ?? false) ||
            a.addresses.some((addr) => addr.toLowerCase().includes(q))
        )

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput
        placeholder="Search accounts, contacts, addresses…"
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        <CommandEmpty>No accounts found.</CommandEmpty>
        <CommandGroup heading="Accounts">
          {filtered.map((account) => {
            const matchingAddress =
              q.length > 0
                ? account.addresses.find((a) => a.toLowerCase().includes(q))
                : null
            const subtitle = matchingAddress ?? account.contact_name ?? account.addresses[0]

            return (
              <CommandItem
                key={account.id}
                value={`${account.name} ${account.contact_name ?? ''} ${account.addresses.join(' ')}`}
                onSelect={() => handleSelect(account.id)}
                className="flex items-center gap-3 py-2"
              >
                <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="flex flex-col min-w-0">
                  <span className="font-medium truncate">{account.name}</span>
                  {subtitle && (
                    <span className="text-xs text-muted-foreground truncate">{subtitle}</span>
                  )}
                </span>
              </CommandItem>
            )
          })}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  )
}
