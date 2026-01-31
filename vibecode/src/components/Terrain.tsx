import React, { useMemo, forwardRef } from 'react';
import * as THREE from 'three';
import type { BiomeData } from '../types/biome';

import type { NoiseFunction2D } from 'simplex-noise';
import { getTerrainHeight } from '../utils/terrainUtils';

interface TerrainProps {
    data: BiomeData['terrain'];
    chunkX?: number;
    chunkZ?: number;
    noise2D: NoiseFunction2D;
}

export const Terrain = forwardRef<THREE.Mesh, TerrainProps>(({ data, chunkX = 0, chunkZ = 0, noise2D }, ref) => {

    const geometry = useMemo(() => {
        const size = 100;
        const segments = 64;
        const geo = new THREE.PlaneGeometry(size, size, segments, segments);
        const posAttribute = geo.attributes.position;
        const count = posAttribute.count;

        const colors = new Float32Array(count * 3);
        const colorBase = new THREE.Color(data.baseColor);
        const colorHigh = new THREE.Color(data.highColor);

        // Calculate World Offset for Noise
        const noiseOffsetX = chunkX * size;
        const noiseOffsetY = chunkZ * size;

        for (let i = 0; i < count; i++) {
            const localX = posAttribute.getX(i);
            const localY = posAttribute.getY(i);

            const globalX = noiseOffsetX + localX;
            // IMPORTANT: Plane was rotated -90deg on X.
            // +LocalY points to World -Z.
            // So WorldZ = ChunkZ - LocalY.
            // We want continuous noise, so we map NoiseY to WorldZ.
            const globalY = noiseOffsetY - localY;

            // Base layer noise
            const totalNoise = getTerrainHeight(globalX, globalY, data.layers, noise2D);

            // Apply Height
            // Normalize slightly to prevent extreme spikes if many layers add up?
            // For now, trust the AI settings.
            const z = totalNoise;
            posAttribute.setZ(i, z);

            // Color
            // Determine alpha based on relative height. 
            // We need a heuristic for "Max Height" to normalize color.
            // Let's assume a standard max height of ~20-30 for coloring.
            const alpha = (z / 20 + 0.5);
            const clampedAlpha = Math.max(0, Math.min(1, alpha));

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
    }, [data, noise2D, chunkX, chunkZ]);

    return (
        <mesh ref={ref} geometry={geometry} rotation={[-Math.PI / 2, 0, 0]} receiveShadow castShadow>
            <meshStandardMaterial vertexColors roughness={0.8} metalness={0.2} side={THREE.DoubleSide} />
        </mesh>
    );
});
