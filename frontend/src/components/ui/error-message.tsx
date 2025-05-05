import React from 'react';

interface ErrorMessageProps {
  title: string;
  message: string;
}

export function ErrorMessage({ title, message }: ErrorMessageProps) {
  return (
    <div className="rounded-lg bg-red-50 p-4 text-center">
      <h3 className="text-lg font-medium text-red-800 mb-2">{title}</h3>
      <p className="text-red-600">{message}</p>
    </div>
  );
} 