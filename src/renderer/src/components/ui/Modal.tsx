interface ModalProps {
  title: string
  isOpen: boolean
  onClose: () => void
  children: React.ReactNode
  maxWidthClassName?: string
}

function Modal({
  title,
  isOpen,
  onClose,
  children,
  maxWidthClassName = 'max-w-sm'
}: ModalProps): React.JSX.Element | null {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className={`w-full ${maxWidthClassName} rounded-lg bg-jokenia-cream2 p-4 shadow-lg`}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-heading text-base font-semibold text-jokenia-dark">{title}</h2>
          <button type="button" onClick={onClose} className="text-jokenia-tan hover:text-jokenia-dark">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

export default Modal
