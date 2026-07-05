import { useState } from 'react'
import SalesList from '@/components/sales/SalesList'
import SaleDetail from '@/components/sales/SaleDetail'
import InvoiceList from '@/components/sales/InvoiceList'
import InvoiceDetail from '@/components/sales/InvoiceDetail'

type View =
  | { name: 'sales' }
  | { name: 'sale-detail'; saleId: string }
  | { name: 'invoices' }
  | { name: 'invoice-detail'; invoiceId: string }

function CheckoutPage(): React.JSX.Element {
  const [view, setView] = useState<View>({ name: 'sales' })

  if (view.name === 'sale-detail') {
    return (
      <div className="h-full p-4">
        <SaleDetail
          saleId={view.saleId}
          onBack={() => setView({ name: 'sales' })}
          onViewInvoice={(invoiceId) => setView({ name: 'invoice-detail', invoiceId })}
        />
      </div>
    )
  }

  if (view.name === 'invoice-detail') {
    return (
      <div className="h-full p-4">
        <InvoiceDetail
          invoiceId={view.invoiceId}
          onBack={() => setView({ name: 'invoices' })}
          onViewSale={(saleId) => setView({ name: 'sale-detail', saleId })}
        />
      </div>
    )
  }

  const isInvoices = view.name === 'invoices'

  return (
    <div className="flex h-full flex-col p-4">
      <div className="mb-3 flex w-fit gap-1 rounded-md bg-white/50 p-1">
        <button
          type="button"
          onClick={() => setView({ name: 'sales' })}
          className={`rounded px-3 py-1.5 text-xs font-medium transition-colors ${
            !isInvoices ? 'bg-jokenia-dark text-jokenia-cream' : 'text-jokenia-dark2 hover:bg-white'
          }`}
        >
          Sales History
        </button>
        <button
          type="button"
          onClick={() => setView({ name: 'invoices' })}
          className={`rounded px-3 py-1.5 text-xs font-medium transition-colors ${
            isInvoices ? 'bg-jokenia-dark text-jokenia-cream' : 'text-jokenia-dark2 hover:bg-white'
          }`}
        >
          Invoices
        </button>
      </div>

      {isInvoices ? (
        <InvoiceList onSelect={(invoiceId) => setView({ name: 'invoice-detail', invoiceId })} />
      ) : (
        <SalesList onSelect={(saleId) => setView({ name: 'sale-detail', saleId })} />
      )}
    </div>
  )
}

export default CheckoutPage
