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
 * The outermost net. Next's `error.tsx` only covers render errors inside a route
 * segment; `/crew/*` is client-first, so an exception in a React Query consumer
 * would otherwise blank the tree. The caught error is logged, never rendered.
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
