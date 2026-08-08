'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { AccountForm } from '@/components/management/AccountForm'
import { PropertyForm } from '@/components/management/PropertyForm'
import { convertLeadToAccount } from '@/app/management/leads/actions'
import { leadToAccountDefaults, leadToPropertyDefaults } from '@/lib/utils/leads'
import type { AccountFormValues } from '@/lib/validators/account'
import type { LeadWithConverted } from '@/types/app'

interface ConvertLeadSheetProps {
  lead: LeadWithConverted
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * Two-step "Convert to Account" wizard (task 9.9), opened from
 * LeadDetailSheet on a service_inquiry lead. Step 1 reuses AccountForm
 * (prefilled from the lead, submitting through convertLeadToAccount instead
 * of createAccount so the new id can be captured); step 2 reuses
 * PropertyForm, prefilled with the lead's address and skippable. Finishing
 * either step navigates to the new account's detail page — that's where the
 * owner's next move (real pricing, more properties, scheduling) lives.
 *
 * Once the account is created, closing the sheet also routes to the account
 * page rather than dropping the owner back in the inbox with a
 * half-finished flow and no way back to step 2.
 */
export function ConvertLeadSheet({ lead, open, onOpenChange }: ConvertLeadSheetProps) {
  const router = useRouter()
  const [step, setStep] = useState<'account' | 'property'>('account')
  const [accountId, setAccountId] = useState<string | null>(null)

  function reset() {
    setStep('account')
    setAccountId(null)
  }

  function handleOpenChange(next: boolean) {
    if (!next) {
      if (accountId) {
        router.push(`/management/accounts/${accountId}`)
      }
      reset()
    }
    onOpenChange(next)
  }

  function finish() {
    if (accountId) router.push(`/management/accounts/${accountId}`)
    reset()
    onOpenChange(false)
  }

  async function handleCreate(values: AccountFormValues): Promise<{ error?: string }> {
    const res = await convertLeadToAccount(lead.id, values)
    if (res.accountId) setAccountId(res.accountId)
    if (res.warning) toast.warning(res.warning)
    return { error: res.error }
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md bg-card flex flex-col gap-0 p-0">
        <SheetHeader className="px-6 pt-6 pb-4 border-b border-border shrink-0">
          <SheetTitle className="font-display text-xl">Convert to Account</SheetTitle>
          <SheetDescription>
            {step === 'account'
              ? 'Step 1 of 2 · Account details'
              : 'Step 2 of 2 · Add a property'}
          </SheetDescription>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {step === 'account' ? (
            <AccountForm
              defaults={leadToAccountDefaults(lead)}
              onCreate={handleCreate}
              onSuccess={() => setStep('property')}
            />
          ) : (
            <div className="space-y-4">
              <div className="flex justify-end">
                <Button type="button" variant="ghost" size="sm" onClick={finish}>
                  Skip
                </Button>
              </div>
              {accountId && (
                <PropertyForm
                  accountId={accountId}
                  defaults={leadToPropertyDefaults(lead)}
                  onSuccess={finish}
                />
              )}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
