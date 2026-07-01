interface BadgeProps {
  children: React.ReactNode
}

function Badge({ children }: BadgeProps): React.JSX.Element {
  return (
    <span className="rounded-full bg-jokenia-gold px-1.5 py-0.5 text-[10px] font-semibold text-jokenia-dark">
      {children}
    </span>
  )
}

export default Badge
