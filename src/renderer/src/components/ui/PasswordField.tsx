const inputClass =
  'w-full rounded-md border border-jokenia-tan/30 bg-white px-3 py-2 text-sm text-jokenia-dark focus:outline-none focus:ring-2 focus:ring-jokenia-gold'
const labelClass = 'mb-1 block text-[10px] font-bold uppercase tracking-wide text-jokenia-tan'

interface PasswordFieldProps {
  label: string
  value: string
  onChange: (value: string) => void
  visible: boolean
  onToggleVisible: () => void
  placeholder?: string
}

function PasswordField({
  label,
  value,
  onChange,
  visible,
  onToggleVisible,
  placeholder
}: PasswordFieldProps): React.JSX.Element {
  return (
    <div>
      <label className={labelClass}>{label}</label>
      <div className="relative">
        <input
          className={`${inputClass} pr-9`}
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
        />
        <button
          type="button"
          onClick={onToggleVisible}
          aria-label={visible ? 'Hide password' : 'Show password'}
          className="absolute right-2 top-1/2 -translate-y-1/2 border-none bg-transparent p-0 cursor-pointer"
          style={{ color: 'rgba(61,61,46,0.45)' }}
        >
          {visible ? (
            <svg
              width={16}
              height={16}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
              <line x1="1" y1="1" x2="23" y2="23" />
            </svg>
          ) : (
            <svg
              width={16}
              height={16}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          )}
        </button>
      </div>
    </div>
  )
}

export default PasswordField
