import type { ButtonHTMLAttributes } from 'react'

type ButtonVariant = 'primary' | 'secondary' | 'ghost'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
}

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: 'bg-jokenia-gold text-jokenia-dark hover:brightness-95',
  secondary: 'bg-jokenia-dark2 text-jokenia-cream hover:brightness-110',
  ghost: 'bg-transparent text-jokenia-dark2 hover:bg-jokenia-cream2'
}

function Button({ variant = 'primary', className = '', ...props }: ButtonProps): React.JSX.Element {
  return (
    <button
      type="button"
      className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${VARIANT_CLASSES[variant]} ${className}`}
      {...props}
    />
  )
}

export default Button
