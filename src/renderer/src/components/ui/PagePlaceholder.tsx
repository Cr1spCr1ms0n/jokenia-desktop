interface PagePlaceholderProps {
  text: string
}

function PagePlaceholder({ text }: PagePlaceholderProps): React.JSX.Element {
  return (
    <div className="flex h-full items-center justify-center">
      <p className="text-sm text-jokenia-tan">{text}</p>
    </div>
  )
}

export default PagePlaceholder
