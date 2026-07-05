interface ToggleRowProps {
  label: string
  description?: string
  checked: boolean
  disabled?: boolean
  onChange: (value: boolean) => void
}

function ToggleRow({
  label,
  description,
  checked,
  disabled,
  onChange
}: ToggleRowProps): React.JSX.Element {
  return (
    <label
      className={`flex items-center justify-between gap-4 rounded-md border border-jokenia-tan/20 bg-white/60 px-3 py-2.5 ${
        disabled ? 'opacity-50' : ''
      }`}
    >
      <span>
        <span className="block text-sm text-jokenia-dark">{label}</span>
        {description && <span className="block text-xs text-jokenia-tan">{description}</span>}
      </span>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        className="h-4 w-4 shrink-0 accent-jokenia-gold"
      />
    </label>
  )
}

export default ToggleRow
