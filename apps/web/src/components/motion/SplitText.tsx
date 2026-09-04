'use client';

import { ReactNode } from 'react';

interface SplitTextProps {
  text: string;
  className?: string;
  wordClassName?: string;
  lineClassName?: string;
}

export function SplitText({ text, className = '', wordClassName = '', lineClassName = '' }: SplitTextProps) {
  // Simple word splitting
  const words = text.split(' ');

  return (
    <div className={`flex flex-wrap ${className}`}>
      {words.map((word, i) => (
        <span
          key={i}
          className={`overflow-hidden inline-flex ${lineClassName}`}
          style={{ paddingRight: '0.25em' }} // space between words
        >
          <span className={`inline-block ${wordClassName}`}>{word}</span>
        </span>
      ))}
    </div>
  );
}
