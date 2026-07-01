import Button from '@/components/ui/Button'

interface QueryStateProps {
  isLoading: boolean
  error: Error | null
  isEmpty: boolean
  emptyText: string
  onRetry: () => void
  children: React.ReactNode
}

function QueryState({
  isLoading,
  error,
  isEmpty,
  emptyText,
  onRetry,
  children
}: QueryStateProps): React.JSX.Element {
  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-jokenia-tan">Loading…</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3">
        <p className="text-sm text-jokenia-tan">{error.message}</p>
        <Button variant="secondary" onClick={onRetry}>
          Retry
        </Button>
      </div>
    )
  }

  if (isEmpty) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-jokenia-tan">{emptyText}</p>
      </div>
    )
  }

  return <>{children}</>
}

export default QueryState
