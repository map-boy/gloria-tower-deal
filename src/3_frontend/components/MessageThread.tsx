import React, { useState } from 'react';
import { Message, ROLE_LABELS } from '../../1_core/domain/types';
import { formatDateTime } from '../../1_core/utils/formatters';
import { Button, Empty, inputClass } from './ui';

interface MessageThreadProps {
  messages: Message[];
  onSend: (text: string) => Promise<void>;
  placeholder?: string;
  emptyText: string;
}

export const MessageThread: React.FC<MessageThreadProps> = ({
  messages, onSend, placeholder, emptyText,
}) => {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    setSending(true);
    setError('');
    try {
      await onSend(text.trim());
      setText('');
    } catch (e: any) {
      setError(e?.message || 'Could not send.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-3">
      {messages.length === 0 ? (
        <Empty>{emptyText}</Empty>
      ) : (
        <div className="space-y-2">
          {messages.map((m) => {
            const fromClient = m.authorRole === 'client';
            return (
              <div
                key={m.id}
                className={`rounded-2xl p-3 ${
                  fromClient
                    ? 'bg-emerald-deep border border-bone/15'
                    : 'bg-emerald-mid border border-bone/20'
                }`}
              >
                <div className="text-[9px] uppercase tracking-wider text-bone/55 mb-1">
                  {ROLE_LABELS[m.authorRole]} · {m.authorLabel} · {formatDateTime(m.createdAt)}
                </div>
                <div className="text-xs whitespace-pre-wrap break-words">{m.text}</div>
              </div>
            );
          })}
        </div>
      )}

      <form onSubmit={send} className="flex gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={placeholder || 'Type your message'}
          className={inputClass}
        />
        <Button type="submit" disabled={sending}>{sending ? '...' : 'Send'}</Button>
      </form>
      {error && <p className="text-[11px] text-alert-soft">{error}</p>}
    </div>
  );
};
