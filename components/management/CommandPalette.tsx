'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Building2, CircleHelp } from 'lucide-react'
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { createClient } from '@/lib/supabase/client'
import { helpFor } from '@/lib/help/topics'
import type { AccountSearchResult, EmployeeRole } from '@/types/app'

interface CommandPaletteProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  role: EmployeeRole | null
  /** Off for roles that can't open an account, so every result would bounce off the proxy. */
  searchAccounts: boolean
}

export function CommandPalette({ open, onOpenChange, role, searchAccounts }: CommandPaletteProps) {
  const router = useRouter()
  const [accounts, setAccounts] = useState<AccountSearchResult[]>([])
  const [query, setQuery] = useState('')
  // Static data, so Help works offline.
  const helpTopics = useMemo(() => helpFor(role).topics, [role])

  // Fetch once on first open
  useEffect(() => {
    if (!open || !searchAccounts || accounts.length > 0) return

    const supabase = createClient()
    supabase
      .from('accounts')
      .select('id, name, contact_name, status, properties(address)')
      .eq('is_archived', false)
      .eq('properties.is_archived', false)
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
  }, [open, searchAccounts, accounts.length])

  function handleSelect(href: string) {
    onOpenChange(false)
    router.push(href)
  }

  // On the Help page a pushed hash fires no hashchange, so HelpView wouldn't open the topic.
  function openHelpTopic(key: string) {
    if (window.location.pathname !== '/app/help') return handleSelect(`/app/help#${key}`)
    onOpenChange(false)
    window.location.assign(`#${key}`)
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
        placeholder={searchAccounts ? 'Search accounts, addresses, help…' : 'Search help…'}
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        <CommandEmpty>Nothing found.</CommandEmpty>
        {searchAccounts && (
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
                  onSelect={() => handleSelect(`/app/accounts/${account.id}`)}
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
        )}
        <CommandGroup heading="Help">
          {helpTopics.map((topic) => (
            <CommandItem
              key={topic.key}
              value={`help ${topic.title} ${topic.summary}`}
              onSelect={() => openHelpTopic(topic.key)}
              className="flex items-center gap-3 py-2"
            >
              <CircleHelp className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="flex flex-col min-w-0">
                <span className="font-medium truncate">{topic.title}</span>
                <span className="text-xs text-muted-foreground truncate">{topic.summary}</span>
              </span>
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  )
}
