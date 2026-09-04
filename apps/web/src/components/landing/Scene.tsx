'use client';

import { Canvas } from '@react-three/fiber';
import { CoreParticles } from './CoreParticles';
import { Environment } from '@react-three/drei';

export function Scene() {
  return (
    <div className="fixed inset-0 z-0 pointer-events-none">
      <Canvas camera={{ position: [0, 0, 8], fov: 45 }}>
        <ambientLight intensity={0.5} />
        <CoreParticles />
      </Canvas>
    </div>
  );
}
