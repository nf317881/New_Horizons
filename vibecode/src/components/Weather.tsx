import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { WeatherParams } from '../types/biome';

export const Weather = ({ params, active }: { params: WeatherParams, active: boolean }) => {
    const pointsRef = useRef<THREE.Points>(null);
    const particleCount = 15000;
    const boxSize = 100;

    // Gradual transition for intensity
    const intensityValue = useRef(0);
    const targetIntensity = active ? params.intensity : 0;

    const { positions, velocities, randomOffsets } = useMemo(() => {
        const positions = new Float32Array(particleCount * 3);
        const velocities = new Float32Array(particleCount * 3);
        const randomOffsets = new Float32Array(particleCount); // For spore "wobble"

        for (let i = 0; i < particleCount; i++) {
            positions[i * 3] = (Math.random() - 0.5) * boxSize;
            positions[i * 3 + 1] = (Math.random() - 0.5) * boxSize;
            positions[i * 3 + 2] = (Math.random() - 0.5) * boxSize;

            // X and Z wind
            const windX = params.type === 'sandstorm' ? (Math.random() * 2 - 1) * params.speed : (Math.random() - 0.5) * 0.2;
            const windZ = params.type === 'sandstorm' ? (Math.random() * 2 - 1) * params.speed : (Math.random() - 0.5) * 0.2;
            const fallSpeed = params.type === 'spores' ? -Math.random() * 0.2 - 0.1 : -Math.random() * params.speed - 0.5;

            velocities[i * 3] = windX;
            velocities[i * 3 + 1] = fallSpeed;
            velocities[i * 3 + 2] = windZ;
            randomOffsets[i] = Math.random() * Math.PI * 2;
        }
        return { positions, velocities, randomOffsets };
    }, [params.type, params.speed, active]);

    useFrame((state, delta) => {
        if (!pointsRef.current) return;

        // Smoothly transition intensity
        const transitionSpeed = 0.5;
        if (intensityValue.current < targetIntensity) {
            intensityValue.current = Math.min(targetIntensity, intensityValue.current + delta * transitionSpeed);
        } else if (intensityValue.current > targetIntensity) {
            intensityValue.current = Math.max(targetIntensity, intensityValue.current - delta * transitionSpeed);
        }

        if (intensityValue.current <= 0 && !active) {
            pointsRef.current.visible = false;
            return;
        } else {
            pointsRef.current.visible = true;
        }

        const posAttr = pointsRef.current.geometry.attributes.position as THREE.BufferAttribute;
        const playerPos = state.camera.position;
        const time = state.clock.getElapsedTime();

        for (let i = 0; i < particleCount; i++) {
            let x = posAttr.getX(i);
            let y = posAttr.getY(i);
            let z = posAttr.getZ(i);

            let vx = velocities[i * 3];
            let vy = velocities[i * 3 + 1];
            let vz = velocities[i * 3 + 2];

            if (params.type === 'spores') {
                vx += Math.sin(time + randomOffsets[i]) * 0.05;
                vz += Math.cos(time + randomOffsets[i]) * 0.05;
            }

            x += vx * delta * 15;
            y += vy * delta * 15;
            z += vz * delta * 15;

            const relativeX = x - playerPos.x;
            const relativeY = y - playerPos.y;
            const relativeZ = z - playerPos.z;
            const half = boxSize / 2;

            if (relativeX > half) x -= boxSize;
            if (relativeX < -half) x += boxSize;
            if (relativeY > half) y -= boxSize;
            if (relativeY < -half) y += boxSize;
            if (relativeZ > half) z -= boxSize;
            if (relativeZ < -half) z += boxSize;

            posAttr.setXYZ(i, x, y, z);
        }
        posAttr.needsUpdate = true;

        if (pointsRef.current.material instanceof THREE.PointsMaterial) {
            pointsRef.current.material.opacity = intensityValue.current * 0.6;
        }
    });

    const size = useMemo(() => {
        switch (params.type) {
            case 'spores': return 1.2;
            case 'snow': return 0.5;
            case 'rain': return 0.15;
            case 'sandstorm': return 0.3;
            default: return 0.2;
        }
    }, [params.type]);

    return (
        <points ref={pointsRef} frustumCulled={false}>
            <bufferGeometry>
                <bufferAttribute
                    attach="attributes-position"
                    count={particleCount}
                    array={positions}
                    itemSize={3}
                    args={[positions, 3]}
                />
            </bufferGeometry>
            <pointsMaterial
                size={size}
                color={params.color}
                transparent
                opacity={0}
                sizeAttenuation
                blending={params.type === 'spores' ? THREE.NormalBlending : THREE.AdditiveBlending}
                depthWrite={false}
            />
        </points>
    );
};
