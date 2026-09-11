import React from 'react';
import { Bill, SERVICE_LABELS } from '../../1_core/domain/types';
import { isOverdue } from '../../1_core/billing/calculate';
import {
  formatCurrency, formatDate, daysUntil, getStatusLabel, statusTone, TONE_CLASSES,
} from '../../1_core/utils/formatters';
import { Card, Button } from './ui';

interface BillCardProps {
  bill: Bill;
  showRoom?: boolean;
  onPay?: (bill: Bill) => void;
  onReview?: (bill: Bill) => void;
  onDownloadProof?: (bill: Bill) => void;
  children?: React.ReactNode;
}

export const BillCard: React.FC<BillCardProps> = ({
  bill, showRoom, onPay, onReview, onDownloadProof, children,
}) => {
  const overdue = isOverdue(bill.dueDate, bill.status);
  const tone = statusTone(bill.status, overdue);
  const outstanding = Math.max(0, (bill.amountDue || 0) - (bill.amountPaid || 0));
  const left = daysUntil(bill.dueDate);

  return (
    <Card className={overdue ? 'border-alert' : ''}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <div className="font-black text-sm">
            {showRoom ? `Room ${bill.roomNumber} · ` : ''}
            {SERVICE_LABELS[bill.serviceType]}
          </div>
          <div className="text-[10px] uppercase tracking-wider text-bone/50">
            Issued {formatDate(bill.issuedAt)} · due {formatDate(bill.dueDate)}
          </div>
        </div>
        <span
          className={`shrink-0 px-2 py-1 rounded-lg border text-[9px] font-black uppercase ${TONE_CLASSES[tone]}`}
        >
          {getStatusLabel(bill.status, overdue)}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-3">
        <div className="bg-emerald-dark rounded-xl p-2">
          <div className="text-[9px] uppercase text-bone/50">Units</div>
          <div className="font-black text-sm">{bill.unitsUsed}</div>
        </div>
        <div className="bg-emerald-dark rounded-xl p-2">
          <div className="text-[9px] uppercase text-bone/50">Rate</div>
          <div className="font-black text-sm">{formatCurrency(bill.unitPrice)}</div>
        </div>
        <div className="bg-emerald-dark rounded-xl p-2">
          <div className="text-[9px] uppercase text-bone/50">To pay</div>
          <div className="font-black text-sm">{formatCurrency(outstanding)}</div>
        </div>
      </div>

      {bill.serviceType !== 'rent' && (
        <p className="text-[10px] text-bone/60 mb-2">
          Meter {bill.previousReading} → {bill.currentReading}
        </p>
      )}

      {bill.status !== 'paid' && left !== null && (
        <p className={`text-[11px] mb-2 ${overdue ? 'text-alert-soft font-bold' : 'text-gold-soft'}`}>
          {overdue
            ? `${Math.abs(left)} day${Math.abs(left) === 1 ? '' : 's'} past the 5 day limit`
            : `${left} day${left === 1 ? '' : 's'} left to pay`}
        </p>
      )}

      {bill.amountPaid > 0 && (
        <p className="text-[11px] text-bone/70 mb-2">
          Paid so far {formatCurrency(bill.amountPaid)} of {formatCurrency(bill.amountDue)}
        </p>
      )}

      {bill.note && <p className="text-[11px] text-bone/60 mb-2">Technician: {bill.note}</p>}
      {bill.proofNote && <p className="text-[11px] text-bone/60 mb-2">Client: {bill.proofNote}</p>}
      {bill.recoveryNote && (
        <p className="text-[11px] text-bone/60 mb-2">Recovery: {bill.recoveryNote}</p>
      )}

      {children}

      <div className="flex flex-wrap gap-2 mt-3">
        {onPay && bill.status !== 'paid' && (
          <Button onClick={() => onPay(bill)}>
            {bill.status === 'awaiting_review' ? 'Send new proof' : 'Pay & send proof'}
          </Button>
        )}
        {onDownloadProof && bill.proofPath && !bill.proofDeleted && (
          <Button variant="ghost" onClick={() => onDownloadProof(bill)}>
            {bill.proofDownloadedAt ? 'Download again' : 'Download photo'}
          </Button>
        )}
        {onReview && (
          <Button variant="gold" onClick={() => onReview(bill)}>
            {bill.status === 'awaiting_review' ? 'Check & mark paid' : 'Edit'}
          </Button>
        )}
      </div>

      {bill.proofDeleted && (
        <p className="text-[10px] text-bone/45 mt-2">
          Photo deleted after 7 days. The payment record stays.
        </p>
      )}
      {bill.proofPath && !bill.proofDeleted && !bill.proofDownloadedAt && (
        <p className="text-[10px] text-gold-soft mt-2">
          Photo not downloaded yet · deletes {formatDate(bill.proofExpiresAt)}
        </p>
      )}
    </Card>
  );
};
