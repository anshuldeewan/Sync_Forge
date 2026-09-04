'use client';

import { useRef } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';

export function Preloader() {
  const container = useRef<HTMLDivElement>(null);
  const bar = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
      gsap.set(container.current, { display: 'none' });
      return;
    }

    const tl = gsap.timeline({
      defaults: { ease: 'power3.out' },
    });

    tl.fromTo(bar.current, 
      { scaleX: 0, transformOrigin: 'left' }, 
      { scaleX: 1, duration: 1.1 }
    )
    .to(container.current, { 
      yPercent: -100, 
      duration: 0.9, 
      ease: 'power4.inOut' 
    }, '+=0.15');

  }, { scope: container });

  return (
    <div 
      ref={container} 
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[#050505] text-white"
    >
      <div className="text-sm font-mono tracking-[0.2em] mb-4 text-zinc-500">SYNCFORGE OS</div>
      <div className="h-[1px] w-64 bg-zinc-900 overflow-hidden relative">
        <div ref={bar} className="absolute inset-0 bg-white origin-left" />
      </div>
    </div>
  );
}
