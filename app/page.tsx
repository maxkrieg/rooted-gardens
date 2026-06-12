import Link from 'next/link'

export default function Home() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center px-6">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">
          Rooted Gardens · Internal
        </p>
        <h1 className="font-display text-5xl font-semibold text-foreground mb-4 tracking-tight">
          Field &amp; Foliage
        </h1>
        <p className="text-muted-foreground mb-8 max-w-sm mx-auto leading-relaxed">
          Business management for Rooted Gardens eco-landscaping, Norwich, VT.
        </p>
        <Link
          href="/login"
          className="inline-flex items-center justify-center rounded-lg bg-primary text-primary-foreground px-6 py-3 font-semibold text-sm hover:opacity-90 transition-opacity"
        >
          Sign In
        </Link>
      </div>
    </main>
  )
}
