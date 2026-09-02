import React from 'react';
import { InvoiceRecord, PaymentRecord } from '../../2_backend/services/storageService';
import { formatCurrency } from '../../1_core/utils/formatters';

interface PaymentsLedgerPanelProps {
  invoices: InvoiceRecord[];
  payments: PaymentRecord[];
}

const STATUS_STYLE: Record<string, { bg: string; text: string }> = {
  paid: { bg: 'bg-neutral-800', text: 'text-white' },
  partial: { bg: 'bg-neutral-400', text: 'text-black' },
  pending: { bg: 'bg-neutral-200', text: 'text-neutral-700' },
  push_initiated: { bg: 'bg-neutral-300', text: 'text-black' },
};

export const PaymentsLedgerPanel: React.FC<PaymentsLedgerPanelProps> = ({ invoices, payments }) => {
  const underpaidInvoices = invoices.filter((inv) => inv.status === 'partial');
  const sortedInvoices = [...invoices].sort((a, b) => b.month.localeCompare(a.month));

  return (
    <div className="space-y-6">
      {underpaidInvoices.length > 0 && (
        <div className="bg-neutral-100 border-3 border-black rounded-2xl p-4 sm:p-5">
          <h3 className="font-serif font-black text-lg text-black mb-2">
            Underpayment Alerts ({underpaidInvoices.length})
          </h3>
          <div className="space-y-2">
            {underpaidInvoices.map((inv) => (
              <div
                key={inv.id}
                className="bg-white border-2 border-black rounded-xl p-3 font-mono text-xs flex flex-wrap items-center justify-between gap-2"
              >
                <span className="font-bold">
                  Room {inv.roomNumber} &bull; {inv.month} &bull; Ref {inv.referenceCode}
                </span>
                <span>
                  Paid {formatCurrency(inv.amountPaid || 0)} / {formatCurrency(inv.amount)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white border-3 border-black rounded-2xl p-4 sm:p-6">
        <h3 className="font-serif font-black text-xl text-black mb-4">Invoices</h3>
        <div className="overflow-x-auto border-2 border-black rounded-xl">
          <table className="w-full text-left font-mono text-xs border-collapse">
            <thead>
              <tr className="bg-neutral-200 border-b-2 border-black text-black font-bold uppercase">
                <th className="p-3 border-r-2 border-black">Room</th>
                <th className="p-3 border-r-2 border-black">Month</th>
                <th className="p-3 border-r-2 border-black">Reference</th>
                <th className="p-3 border-r-2 border-black">Amount</th>
                <th className="p-3 border-r-2 border-black">Paid</th>
                <th className="p-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody>
              {sortedInvoices.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-neutral-500 font-bold">
                    No invoices generated yet.
                  </td>
                </tr>
              ) : (
                sortedInvoices.map((inv, idx) => {
                  const style = STATUS_STYLE[inv.status] || STATUS_STYLE.pending;
                  return (
                    <tr
                      key={inv.id}
                      className={`border-b border-black ${idx % 2 === 0 ? 'bg-white' : 'bg-neutral-50'}`}
                    >
                      <td className="p-3 border-r-2 border-black font-bold">{inv.roomNumber}</td>
                      <td className="p-3 border-r-2 border-black">{inv.month}</td>
                      <td className="p-3 border-r-2 border-black">{inv.referenceCode}</td>
                      <td className="p-3 border-r-2 border-black">{formatCurrency(inv.amount)}</td>
                      <td className="p-3 border-r-2 border-black">{formatCurrency(inv.amountPaid || 0)}</td>
                      <td className="p-3 text-center">
                        <span className={`px-2 py-1 rounded text-[10px] font-bold ${style.bg} ${style.text}`}>
                          {inv.status}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white border-3 border-black rounded-2xl p-4 sm:p-6">
        <h3 className="font-serif font-black text-xl text-black mb-4">Verified Payments</h3>
        <div className="overflow-x-auto border-2 border-black rounded-xl">
          <table className="w-full text-left font-mono text-xs border-collapse">
            <thead>
              <tr className="bg-neutral-200 border-b-2 border-black text-black font-bold uppercase">
                <th className="p-3 border-r-2 border-black">Transaction</th>
                <th className="p-3 border-r-2 border-black">Provider</th>
                <th className="p-3 border-r-2 border-black">Amount</th>
                <th className="p-3">Received</th>
              </tr>
            </thead>
            <tbody>
              {payments.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-6 text-center text-neutral-500 font-bold">
                    No verified payments recorded yet.
                  </td>
                </tr>
              ) : (
                payments.map((p, idx) => (
                  <tr key={p.id} className={`border-b border-black ${idx % 2 === 0 ? 'bg-white' : 'bg-neutral-50'}`}>
                    <td className="p-3 border-r-2 border-black">{p.transactionId}</td>
                    <td className="p-3 border-r-2 border-black capitalize">{p.provider}</td>
                    <td className="p-3 border-r-2 border-black font-bold">{formatCurrency(p.amount)}</td>
                    <td className="p-3">{p.receivedAt ? new Date(p.receivedAt).toLocaleString() : '-'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
