'use client';

import { FormEvent, useState } from 'react';

interface SubscribeFormProps {
  mode?: 'subscribe' | 'unsubscribe';
  className?: string;
  placeholder?: string;
  buttonLabelOverride?: string;
}

export function SubscribeForm({
  mode = 'subscribe',
  className,
  placeholder = 'Email Address',
  buttonLabelOverride
}: SubscribeFormProps) {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const endpoint = mode === 'subscribe' ? '/api/subscribe' : '/api/unsubscribe';
  const buttonLabel = buttonLabelOverride || (mode === 'subscribe' ? 'Subscribe' : 'Unsubscribe');

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      const data = (await response.json()) as { success?: boolean; error?: string };

      if (!response.ok || !data.success) {
        setMessage(data.error || 'Request failed.');
      } else {
        setMessage(mode === 'subscribe' ? 'Subscribed successfully.' : 'Unsubscribed successfully.');
        setEmail('');
      }
    } catch {
      setMessage('Unable to complete request.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form className={\\\.trim()} onSubmit={onSubmit}>
      <input
        type="email"
        required
        placeholder={placeholder}
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        className="flex-1 bg-transparent text-white px-6 py-2 focus:outline-none placeholder-gray-500 w-full"
      />
      <button 
        type="submit" 
        disabled={loading}
        className="bg-[#111] hover:bg-black text-white px-6 py-3 rounded-full font-bold flex items-center justify-center gap-2 transition ml-2 border border-gray-800 shadow-md text-sm shrink-0"
      >
        {loading ? 'Wait...' : (
          <>
            {buttonLabel}
            {mode === 'subscribe' && (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
            )}
          </>
        )}
      </button>
      {message && <p className="absolute -bottom-8 left-0 text-sm text-brand-pink w-full text-center">{message}</p>}
    </form>
  );
}
