import React, { useMemo } from 'react';
import * as THREE from 'three';
import { createNoise2D } from 'simplex-noise';
import type { BiomeData } from '../types/biome';

interface TerrainProps {
    data: BiomeData['terrain'];
}

export const Terrain: React.FC<TerrainProps> = ({ data }) => {
    const noise2D = useMemo(() => createNoise2D(), [data]); // Re-seed on data change if we wanted consistent seed, but here random is fine

    const geometry = useMemo(() => {
        // 100x100 size, 128 segments for detail
        const geo = new THREE.PlaneGeometry(100, 100, 128, 128);
        const posAttribute = geo.attributes.position;
        const count = posAttribute.count;

        // Create color attribute buffer
        const colors = new Float32Array(count * 3);
        const colorBase = new THREE.Color(data.baseColor);
        const colorHigh = new THREE.Color(data.highColor);

        // We'll calculate min/max height just to normalize color better if needed
        // But simple lerp is fine for now

        for (let i = 0; i < count; i++) {
            const x = posAttribute.getX(i);
            const y = posAttribute.getY(i); // Plane is XY currently

            // Base Noise
            let noise = noise2D(x * data.noiseScale, y * data.noiseScale);

            // Detailed Noise (Roughness)
            noise += 0.5 * data.roughness * noise2D(x * data.noiseScale * 4, y * data.noiseScale * 4);
            noise += 0.25 * data.roughness * noise2D(x * data.noiseScale * 8, y * data.noiseScale * 8);

            // Apply Height Scale
            const z = noise * data.heightScale;
            posAttribute.setZ(i, z);

            // Color Blending based on height
            // Map z approx from -Height to +Height -> 0..1
            // Simplex ranges -1 to 1 roughly.
            // With octaves it can go higher.
            const alpha = (z / data.heightScale + 1) / 2;
            const clampedAlpha = Math.max(0, Math.min(1, alpha));

            // Lerp color
            const r = THREE.MathUtils.lerp(colorBase.r, colorHigh.r, clampedAlpha);
            const g = THREE.MathUtils.lerp(colorBase.g, colorHigh.g, clampedAlpha);
            const b = THREE.MathUtils.lerp(colorBase.b, colorHigh.b, clampedAlpha);

            colors[i * 3] = r;
            colors[i * 3 + 1] = g;
            colors[i * 3 + 2] = b;
        }

        geo.computeVertexNormals();
        geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

        return geo;
    }, [data, noise2D]);

    return (
        <mesh geometry={geometry} rotation={[-Math.PI / 2, 0, 0]} receiveShadow castShadow>
            {/* vertexColors: true uses the attribute we added */}
            <meshStandardMaterial vertexColors roughness={0.8} metalness={0.2} side={THREE.DoubleSide} />
        </mesh>
    );
};
