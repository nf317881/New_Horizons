import { createNoise2D } from 'simplex-noise';
import React, { useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Terrain } from './Terrain';
import type { BiomeData } from '../types/biome';
import { Mesh, Group } from 'three';
import * as THREE from 'three';

interface ChunkManagerProps {
    biome: BiomeData;
    terrainRef?: React.Ref<Mesh>; // Pass this appropriately if needed for raycasting
    // Note: Raycasting against multiple dynamic chunks is tricky. 
    // We will update logic to only raycast against the center chunk or nearby chunks?
    // For now, let's keep it simple: The PlayerControls raycaster is robust enough to hit whatever mesh provided? 
    // Actually, passing a RefObject<Mesh> that only points to ONE chunk will break collisions when crossing borders.
    // We need a solution. 
    // Solution: We won't forward a single ref. We will assume the PlayerControls handles its own height logic via TerrainMath,
    // OR we group all chunks in a group and raycast the group.
}

// We'll export a Group Ref that contains all chunks
export const ChunkManager = React.forwardRef<THREE.Group, ChunkManagerProps>(({ biome }, ref) => {
    const { camera } = useThree();
    const [chunks, setChunks] = useState<{ key: string, x: number, z: number }[]>([]);

    // Config
    const CHUNK_SIZE = 100;
    const RENDER_DISTANCE = 2; // Radius in chunks (2 = 5x5 grid)

    const noise2D = React.useMemo(() => createNoise2D(), [biome.terrain]);

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
                </group>
            ))}
        </group>
    );
});
