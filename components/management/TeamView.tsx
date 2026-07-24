'use client'

import { useState } from 'react'
import { Plus, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { EmployeeCard } from '@/components/management/EmployeeCard'
import { EmployeeForm } from '@/components/management/EmployeeForm'
import type { Employee } from '@/types/app'

export function TeamView({ employees }: { employees: Employee[] }) {
  const [newOpen, setNewOpen] = useState(false)

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Page header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Users className="h-5 w-5 text-primary shrink-0" />
          <h1 className="font-display text-2xl font-semibold text-foreground">Team</h1>
        </div>
        <Button className="gap-2 h-10" onClick={() => setNewOpen(true)}>
          <Plus className="h-4 w-4" />
          Add Employee
        </Button>
      </div>

      {employees.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center border border-dashed border-border rounded-2xl">
          <Users className="h-10 w-10 text-muted-foreground/30 mb-4" />
          <p className="text-sm text-muted-foreground mb-1">No employees yet.</p>
          <p className="text-xs text-muted-foreground max-w-xs">
            Add your crew, leads, and office staff to manage roles and app access.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {employees.map((e) => (
            <EmployeeCard key={e.id} employee={e} />
          ))}
        </div>
      )}

      {/* New employee sheet */}
      <Sheet open={newOpen} onOpenChange={setNewOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md bg-card flex flex-col gap-0 p-0">
          <SheetHeader className="px-6 pt-6 pb-4 border-b border-border shrink-0">
            <SheetTitle className="font-display text-xl">Add Employee</SheetTitle>
            <SheetDescription>
              Set their role now — it decides what access they get when invited.
            </SheetDescription>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto px-6 py-5">
            <EmployeeForm onSuccess={() => setNewOpen(false)} />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
