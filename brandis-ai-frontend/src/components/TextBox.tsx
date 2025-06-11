'use client';

import { useState } from 'react';

interface TextBoxProps {
  onSendMessage: (message: string) => void;
  isLoading: boolean;
}

export default function TextBox({ onSendMessage, isLoading }: TextBoxProps) {
  const [message, setMessage] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;
    
    onSendMessage(message);
    setMessage('');
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-[80%] w-full">
      <div className="relative">
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSubmit(e);
            }
          }}
          className="w-full min-h-[60px] max-h-[200px] p-4 pr-12 rounded-lg bg-blue-500 text-white placeholder-blue-200 resize-none focus:outline-none focus:ring-2 focus:ring-blue-400"
          placeholder="Type your message here..."
          rows={1}
          disabled={isLoading}
        />
        <button
          type="submit"
          className="absolute right-2 bottom-2 p-2 text-white hover:text-blue-100 disabled:text-blue-300"
          disabled={!message.trim() || isLoading}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
            className="w-6 h-6"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5"
            />
          </svg>
        </button>
      </div>
    </form>
  );
}
