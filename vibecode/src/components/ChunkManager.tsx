import { createNoise2D } from 'simplex-noise';
import React, { useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Terrain } from './Terrain';
import { FloraSystem } from './FloraSystem';
import type { BiomeData } from '../types/biome';
import { Mesh } from 'three';
import * as THREE from 'three';
import { createRandom } from '../utils/terrainMath';

interface ChunkManagerProps {
    biome: BiomeData;
    terrainRef?: React.Ref<Mesh>; // Pass this appropriately if needed for raycasting
}

// We'll export a Group Ref that contains all chunks
export const ChunkManager = React.forwardRef<THREE.Group, ChunkManagerProps>(({ biome }, ref) => {
    const { camera } = useThree();
    const [chunks, setChunks] = useState<{ key: string, x: number, z: number }[]>([]);

    // Config
    const CHUNK_SIZE = 100;
    const RENDER_DISTANCE = 2; // Radius in chunks (2 = 5x5 grid)

    const noise2D = React.useMemo(() => {
        return createNoise2D(createRandom(biome.terrain.seed));
    }, [biome.terrain.seed]);

    useFrame(() => {
        // Simple grid logic
        const currentChunkX = Math.round(camera.position.x / CHUNK_SIZE);
        const currentChunkZ = Math.round(camera.position.z / CHUNK_SIZE); // Using Z as world Z

        // Check if we need to update
        // optimization: store last position?

        const newChunks: { key: string, x: number, z: number }[] = [];
        for (let x = -RENDER_DISTANCE; x <= RENDER_DISTANCE; x++) {
            for (let z = -RENDER_DISTANCE; z <= RENDER_DISTANCE; z++) {
                const cx = currentChunkX + x;
                const cz = currentChunkZ + z;

                newChunks.push({
                    key: `${cx},${cz}`,
                    x: cx,
                    z: cz
                });
            }
        }

        setChunks(prev => {
            const prevKeys = prev.map(c => c.key).sort().join('|');
            const newKeys = newChunks.map(c => c.key).sort().join('|');
            if (prevKeys === newKeys) return prev;
            return newChunks;
        });
    });

    return (
        <group ref={ref}>
            {chunks.map(chunk => (
                <group key={chunk.key} position={[chunk.x * CHUNK_SIZE, 0, chunk.z * CHUNK_SIZE]}>
                    <Terrain
                        data={biome.terrain}
                        chunkX={chunk.x}
                        chunkZ={chunk.z}
                        noise2D={noise2D}
                    />
                    <FloraSystem
                        terrainData={biome.terrain}
                        parameters={biome.parameters}
                        noise2D={noise2D}
                        chunkX={chunk.x}
                        chunkZ={chunk.z}
                    />
                </group>
            ))}
        </group>
    );
});
