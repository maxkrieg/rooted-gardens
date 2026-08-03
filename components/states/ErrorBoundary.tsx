'use client'

import { Component, type ErrorInfo, type ReactNode } from 'react'
import { ErrorState } from '@/components/states/ErrorState'

interface Props {
  children: ReactNode
  /** Replaces the default ErrorState. Receives a reset callback to re-mount children. */
  fallback?: (reset: () => void) => ReactNode
  /** Label for the console entry, e.g. 'crew'. */
  context?: string
}

interface State {
  error: Error | null
}

/**
 * App-wide React error boundary (task 8.5).
 *
 * Next's `error.tsx` files cover render errors inside a *route segment*, but not
 * errors thrown from the providers or from client components that live above the
 * segment — and `/crew/*` is client-first, so an exception in a React Query
 * consumer would otherwise unmount the whole tree to a blank screen. This is the
 * outermost net.
 *
 * The caught error is logged and never rendered.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`[ErrorBoundary${this.props.context ? ` ${this.props.context}` : ''}]`, error, info.componentStack)
  }

  reset = () => this.setState({ error: null })

  render() {
    if (!this.state.error) return this.props.children
    if (this.props.fallback) return this.props.fallback(this.reset)

    return (
      <div className="flex min-h-[60vh] items-center justify-center p-4">
        <ErrorState
          title="This screen stopped responding."
          hint="Reloading usually clears it. Your saved work is safe."
          onRetry={this.reset}
          retryLabel="Reload this screen"
        />
      </div>
    )
  }
}
