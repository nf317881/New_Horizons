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
                const cz = currentChunkZ + z; // We map World Z to ChunkZ directly here
                newChunks.push({
                    key: `${cx},${cz}`,
                    x: cx,
                    z: cz
                });
            }
        }

        // React state update only if keys changed to avoid thrashing?
        // Actually, let's just do a naive check for now, React is fast enough for 25 items?
        // To prevent infinite loop, we should only set if key list is different.

        setChunks(prev => {
            const prevKeys = prev.map(c => c.key).sort().join('|');
            const newKeys = newChunks.map(c => c.key).sort().join('|');
            if (prevKeys === newKeys) return prev;

            console.log(`[ChunkManager] GlobalPos: (${camera.position.x.toFixed(1)}, ${camera.position.z.toFixed(1)}) -> Chunk: (${currentChunkX}, ${currentChunkZ}) -> Updating ${newChunks.length} chunks.`);
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
                    // This makes the Plane lie flat.
                    // Inside Terrain, we use (chunkX * size) for noise X.
                    // And (chunkZ * size) for noise Y.
                    // Ideally: Noise X -> World X. Noise Y -> World -Z.

                    // Let's verify our Scene coords.
                    // Z is "Depth/Forward".
                    // In Terrain.tsx we did:
                    // noise = noise(noiseX, noiseY)
                    // This maps to Plane X, Plane Y.
                    // Plane is Rotated -90 X.
                    // Plane X -> World X.
                    // Plane Y -> World -Z.
                    // So noiseY corresponds to World -Z.

                    // If we pass chunkZ here (which corresponds to Camera Z / World Z),
                    // Then inside Terrain, noiseY = chunkZ * size.
                    // If ChunkZ increases (World Z increases, moving "back"), noiseY increases.
                    // But Plane Y points "Forward" (negative Z).
                    // So increasing World Z corresponds to Decreasing Plane Y.

                    // We should pass chunkZ as -chunk.z to align noise continuity?
                    // Let's stick with chunkZ as passed. We can just invert in Terrain if needed, 
                    // or just accept that the noise mirror is consistent. 
                    // As long as edges match:
                    // Chunk (0,0) ends at WorldZ=50 (PlaneY=-50).
                    // Chunk (0,1) starts at WorldZ=50?
                    // If center is at Z=100. Local -50 = World 50.
                    // So visual continuity should work if we just tile them.
                    />
                </group>
            ))}
        </group>
    );
});
