'use client'

import { useEffect } from 'react'

/**
 * Last resort: an error thrown by the root layout itself, before fonts, theme
 * tokens, or providers are mounted. It replaces the entire document, so it must
 * ship its own <html>/<body> and cannot rely on globals.css or any component
 * that imports it.
 *
 * Styles are inlined with the Field & Foliage light values hard-coded, because
 * the CSS variables that normally carry them may not have loaded.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[global-error]', error)
  }, [error])

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1.5rem',
          backgroundColor: '#f6f3ea',
          color: '#2b2a24',
          fontFamily: 'ui-sans-serif, system-ui, sans-serif',
          textAlign: 'center',
        }}
      >
        <div style={{ maxWidth: '22rem' }}>
          <p style={{ fontSize: '1.125rem', fontWeight: 600, margin: 0 }}>
            Rooted Gardens couldn&rsquo;t start.
          </p>
          <p style={{ marginTop: '0.5rem', fontSize: '0.875rem', color: '#6e665a' }}>
            Reload the page. If it keeps happening, tell an owner.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: '1.25rem',
              minHeight: '44px',
              padding: '0.625rem 1.25rem',
              borderRadius: '0.5rem',
              border: 'none',
              backgroundColor: '#4a7c59',
              color: '#f4f1e8',
              fontSize: '0.875rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Reload
          </button>
        </div>
      </body>
    </html>
  )
}
