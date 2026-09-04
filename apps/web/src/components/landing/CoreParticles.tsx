'use client';

import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import gsap from 'gsap';

export function CoreParticles() {
  const points = useRef<THREE.Points>(null);
  
  // Create a sphere of particles
  const particlesCount = 2000;
  const positions = useMemo(() => {
    const pos = new Float32Array(particlesCount * 3);
    for (let i = 0; i < particlesCount; i++) {
      const radius = 3 + Math.random() * 0.5;
      const theta = 2 * Math.PI * Math.random();
      const phi = Math.acos(2 * Math.random() - 1);
      
      const x = radius * Math.sin(phi) * Math.cos(theta);
      const y = radius * Math.sin(phi) * Math.sin(theta);
      const z = radius * Math.cos(phi);
      
      pos[i * 3] = x;
      pos[i * 3 + 1] = y;
      pos[i * 3 + 2] = z;
    }
    return pos;
  }, []);

  // Store initial positions for GSAP animations
  const originalPositions = useMemo(() => new Float32Array(positions), [positions]);

  useFrame((state) => {
    if (!points.current) return;
    
    // Slow rotation
    points.current.rotation.y += 0.001;
    points.current.rotation.x += 0.0005;

    // Mouse interaction (slight tilt)
    const targetX = (state.pointer.x * Math.PI) / 10;
    const targetY = (state.pointer.y * Math.PI) / 10;
    points.current.rotation.x += (targetY - points.current.rotation.x) * 0.02;
    points.current.rotation.y += (targetX - points.current.rotation.y) * 0.02;
  });

  // Setup GSAP ScrollTrigger to mutate particles
  useMemo(() => {
    // Wait for next tick so DOM is ready for ScrollTrigger
    setTimeout(() => {
      if (!points.current) return;

      const geometry = points.current.geometry;
      const posAttribute = geometry.attributes.position;
      
      // We animate a proxy object and update positions in onUpdate
      const proxy = { progress: 0 };
      
      gsap.to(proxy, {
        progress: 1,
        scrollTrigger: {
          trigger: '.chaos-section',
          start: 'top bottom',
          end: 'bottom top',
          scrub: true,
        },
        onUpdate: () => {
          const p = proxy.progress;
          for (let i = 0; i < particlesCount; i++) {
            const ix = i * 3;
            const iy = ix + 1;
            const iz = ix + 2;
            
            // In chaos section, push particles out randomly
            const chaosFactor = p * 10 * (Math.random() - 0.5);
            posAttribute.array[ix] = originalPositions[ix] + chaosFactor;
            posAttribute.array[iy] = originalPositions[iy] + chaosFactor;
            posAttribute.array[iz] = originalPositions[iz] + chaosFactor;
          }
          posAttribute.needsUpdate = true;
        }
      });
      
      // Re-organize in capabilities section
      const proxy2 = { progress: 0 };
      gsap.to(proxy2, {
        progress: 1,
        scrollTrigger: {
          trigger: '.story-container',
          start: 'top bottom',
          end: 'top top',
          scrub: true,
        },
        onUpdate: () => {
          const p = proxy2.progress;
          for (let i = 0; i < particlesCount; i++) {
            const ix = i * 3;
            const iy = ix + 1;
            const iz = ix + 2;
            
            // Line up in a grid
            const gridSpacing = 0.5;
            const gridX = (i % 20) * gridSpacing - 5;
            const gridY = Math.floor((i % 400) / 20) * gridSpacing - 5;
            const gridZ = Math.floor(i / 400) * gridSpacing - 2;
            
            // Lerp from chaos to grid
            const currentX = posAttribute.array[ix];
            const currentY = posAttribute.array[iy];
            const currentZ = posAttribute.array[iz];
            
            posAttribute.array[ix] = currentX + (gridX - currentX) * p;
            posAttribute.array[iy] = currentY + (gridY - currentY) * p;
            posAttribute.array[iz] = currentZ + (gridZ - currentZ) * p;
          }
          posAttribute.needsUpdate = true;
        }
      });

    }, 100);
  }, [particlesCount, originalPositions]);

  return (
    <points ref={points}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[positions, 3]}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.03}
        color="#3b82f6"
        transparent
        opacity={0.8}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}
