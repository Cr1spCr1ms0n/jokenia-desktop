export function pickField<T>(row: Record<string, unknown>, keys: string[], fallback: T): T {
  for (const key of keys) {
    const value = row[key]
    if (value !== undefined && value !== null) return value as T
  }
  return fallback
}
