import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { WeatherParams } from '../types/biome';

// Helper to generate weather-specific textures
const createWeatherTexture = (type: string) => {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.clearRect(0, 0, 64, 64);
    ctx.fillStyle = 'white';

    switch (type) {
        case 'rain':
            // Thin vertical line
            ctx.fillRect(30, 0, 4, 64);
            break;
        case 'snow':
            // Simple flake/star shape
            ctx.beginPath();
            ctx.moveTo(32, 0); ctx.lineTo(32, 64);
            ctx.moveTo(0, 32); ctx.lineTo(64, 32);
            ctx.moveTo(10, 10); ctx.lineTo(54, 54);
            ctx.moveTo(54, 10); ctx.lineTo(10, 54);
            ctx.strokeStyle = 'white';
            ctx.lineWidth = 4;
            ctx.stroke();
            break;
        case 'sandstorm':
            // Thin horizontal-ish smear
            ctx.fillRect(0, 30, 64, 4);
            break;
        case 'spores':
            // Simple soft circle
            const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
            gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
            gradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.5)');
            gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, 64, 64);
            break;
        default:
            ctx.beginPath();
            ctx.arc(32, 32, 16, 0, Math.PI * 2);
            ctx.fill();
    }

    const texture = new THREE.CanvasTexture(canvas);
    return texture;
};

export const Weather = ({ params, active }: { params: WeatherParams, active: boolean }) => {
    const pointsRef = useRef<THREE.Points>(null);
    const particleCount = 7500;
    const boxSize = 100;

    const intensityValue = useRef(0);
    const targetIntensity = active ? params.intensity : 0;

    // Weather textures
    const texture = useMemo(() => createWeatherTexture(params.type), [params.type]);

    const { positions, velocities, randomOffsets, colors } = useMemo(() => {
        const positions = new Float32Array(particleCount * 3);
        const velocities = new Float32Array(particleCount * 3);
        const randomOffsets = new Float32Array(particleCount);
        const colors = new Float32Array(particleCount * 3);

        const baseColor = new THREE.Color(params.color);

        for (let i = 0; i < particleCount; i++) {
            positions[i * 3] = (Math.random() - 0.5) * boxSize;
            positions[i * 3 + 1] = (Math.random() - 0.5) * boxSize;
            positions[i * 3 + 2] = (Math.random() - 0.5) * boxSize;

            const windX = params.type === 'sandstorm' ? (Math.random() * 2 - 1) * params.speed : (Math.random() - 0.5) * 0.2;
            const windZ = params.type === 'sandstorm' ? (Math.random() * 2 - 1) * params.speed : (Math.random() - 0.5) * 0.2;
            const fallSpeed = params.type === 'spores' ? -Math.random() * 0.2 - 0.1 : -Math.random() * params.speed - 0.5;

            velocities[i * 3] = windX;
            velocities[i * 3 + 1] = fallSpeed;
            velocities[i * 3 + 2] = windZ;
            randomOffsets[i] = Math.random() * Math.PI * 2;

            // Color noise: randomly vary lightness/saturation slightly
            const noise = (Math.random() - 0.5) * 0.2;
            const c = baseColor.clone().offsetHSL(0, 0, noise);
            colors[i * 3] = c.r;
            colors[i * 3 + 1] = c.g;
            colors[i * 3 + 2] = c.b;
        }
        return { positions, velocities, randomOffsets, colors };
    }, [params.type, params.speed, params.color, active]);

    useFrame((state, delta) => {
        if (!pointsRef.current) return;

        const transitionSpeed = 0.5;
        if (intensityValue.current < targetIntensity) {
            intensityValue.current = Math.min(targetIntensity, intensityValue.current + delta * transitionSpeed);
        } else if (intensityValue.current > targetIntensity) {
            intensityValue.current = Math.max(targetIntensity, intensityValue.current - delta * transitionSpeed);
        }

        if (intensityValue.current <= 0.01 && !active) {
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
            case 'spores': return 2.0;
            case 'snow': return 0.8;
            case 'rain': return 0.6;
            case 'sandstorm': return 0.6;
            default: return 0.4;
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
                <bufferAttribute
                    attach="attributes-color"
                    count={particleCount}
                    array={colors}
                    itemSize={3}
                    args={[colors, 3]}
                />
            </bufferGeometry>
            <pointsMaterial
                size={size}
                vertexColors
                map={texture}
                transparent
                opacity={0}
                sizeAttenuation
                blending={params.type === 'spores' ? THREE.NormalBlending : THREE.AdditiveBlending}
                depthWrite={false}
                alphaTest={0.01}
            />
        </points>
    );
};
