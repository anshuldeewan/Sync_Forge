'use client';

import { useRef, useEffect, ReactNode, ElementType } from 'react';
import gsap from 'gsap';
import Link from 'next/link';

interface MagneticButtonProps {
  children: ReactNode;
  className?: string;
  href?: string;
  as?: ElementType;
  strength?: number;
}

export function MagneticButton({ 
  children, 
  className = '', 
  href, 
  as: Component = 'button',
  strength = 0.18
}: MagneticButtonProps) {
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = container.current;
    if (!el) return;
    
    // Disable on touch devices
    if (window.matchMedia('(pointer: coarse)').matches) return;
    
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) return;

    const xTo = gsap.quickTo(el, "x", { duration: 0.45, ease: "power3.out" });
    const yTo = gsap.quickTo(el, "y", { duration: 0.45, ease: "power3.out" });

    const handlePointerMove = (e: PointerEvent) => {
      const rect = el.getBoundingClientRect();
      const x = (e.clientX - rect.left - rect.width / 2) * strength;
      const y = (e.clientY - rect.top - rect.height / 2) * strength;
      xTo(x);
      yTo(y);
    };

    const handlePointerLeave = () => {
      xTo(0);
      yTo(0);
    };

    el.addEventListener('pointermove', handlePointerMove);
    el.addEventListener('pointerleave', handlePointerLeave);

    return () => {
      el.removeEventListener('pointermove', handlePointerMove);
      el.removeEventListener('pointerleave', handlePointerLeave);
    };
  }, [strength]);

  const inner = (
    <div ref={container} className="inline-block">
      {children}
    </div>
  );

  if (href) {
    return (
      <Link href={href} className={className}>
        {inner}
      </Link>
    );
  }

  const Tag = Component as any;
  return (
    <Tag className={className}>
      {inner}
    </Tag>
  );
}
