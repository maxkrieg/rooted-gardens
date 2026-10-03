import { redirect } from 'next/navigation'

/** The console has one screen so far. */
export default function AdminPage() {
  redirect('/admin/impersonate')
}
