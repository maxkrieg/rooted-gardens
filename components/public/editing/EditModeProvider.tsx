'use client'

import { createContext, useContext, useState } from 'react'

interface EditModeContextValue {
  /** Resolved server-side in app/(public)/layout.tsx: is this visitor a
   *  signed-in owner? Fixed for the lifetime of the page load. */
  canEdit: boolean
  /** Whether the owner has toggled editing on. Defaults to false even for an
   *  owner — browsing the live site doesn't imply editing it. */
  editing: boolean
  setEditing: (editing: boolean) => void
}

const EditModeContext = createContext<EditModeContextValue | null>(null)

export function EditModeProvider({
  canEdit,
  children,
}: {
  canEdit: boolean
  children: React.ReactNode
}) {
  const [editing, setEditing] = useState(false)

  return (
    <EditModeContext.Provider value={{ canEdit, editing: canEdit && editing, setEditing }}>
      {children}
    </EditModeContext.Provider>
  )
}

/** Every Editable* component and the header's Edit toggle read from this —
 *  never from a prop drilled down separately, so wiring a new editable field
 *  into a page never means threading canEdit/editing through it by hand. */
export function useEditMode(): EditModeContextValue {
  const ctx = useContext(EditModeContext)
  if (!ctx) {
    throw new Error('useEditMode must be used within EditModeProvider')
  }
  return ctx
}
