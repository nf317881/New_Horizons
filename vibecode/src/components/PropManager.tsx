import React, { useMemo } from 'react';
import type { BiomeData, PropDefinition } from '../types/biome';
import type { NoiseFunction2D } from 'simplex-noise';
import { getTerrainHeight } from '../utils/terrainUtils';
import { MeshyProp } from './MeshyProp';
import * as THREE from 'three';

interface PropManagerProps {
    biome: BiomeData;
    noise2D: NoiseFunction2D;
    chunkX: number;
    chunkZ: number;
    chunkSize: number;
}

// Simple deterministic pseudo-random generator
const seededRandom = (seed: number) => {
    const x = Math.sin(seed++) * 10000;
    return x - Math.floor(x);
};

export const PropManager: React.FC<PropManagerProps> = ({ biome, noise2D, chunkX, chunkZ, chunkSize }) => {

    const spawnedProps = useMemo(() => {
        const props: { prop: PropDefinition; pos: [number, number, number]; normal: [number, number, number]; seed: number; key: string }[] = [];

        const startX = chunkX * chunkSize;
        const startZ = chunkZ * chunkSize;

        biome.props.forEach((prop, propIndex) => {
            // Multiply propIndex by a large number to prevent overlap in seed sequences between different prop types
            let seedValue = hashString(biome.name) + (propIndex * 1000) + chunkX * 31 + chunkZ * 17;
            const count = Math.floor(prop.density * 20);

            for (let i = 0; i < count; i++) {
                const innerSeed = seedValue++;
                const lx = (seededRandom(innerSeed) - 0.5) * chunkSize;
                const lz = (seededRandom(innerSeed + 100) - 0.5) * chunkSize;

                const gx = startX + lx;
                const gz = startZ + lz;

                const gy = getTerrainHeight(gx, gz, biome.terrain.layers, noise2D);

                // Central Difference Normal
                const h = 0.2;
                const hL = getTerrainHeight(gx - h, gz, biome.terrain.layers, noise2D);
                const hR = getTerrainHeight(gx + h, gz, biome.terrain.layers, noise2D);
                const hD = getTerrainHeight(gx, gz - h, biome.terrain.layers, noise2D);
                const hU = getTerrainHeight(gx, gz + h, biome.terrain.layers, noise2D);

                const normalVec = new THREE.Vector3(hL - hR, 2 * h, hD - hU).normalize();
                const normal: [number, number, number] = [normalVec.x, normalVec.y, normalVec.z];

                if (gy > biome.terrain.waterLevel) {
                    props.push({
                        prop,
                        pos: [lx, gy, lz],
                        normal,
                        seed: innerSeed,
                        key: `${prop.id}-${chunkX}-${chunkZ}-${innerSeed}`
                    });
                }
            }
        });

        if (chunkX === 0 && chunkZ === 0 && props.length > 0) {
            console.log(`PropManager Debug [0,0]: First Prop sample at lx:${props[0].pos[0].toFixed(2)} lz:${props[0].pos[2].toFixed(2)} -> gy:${props[0].pos[1].toFixed(2)}`);
        }

        return props;
    }, [biome, noise2D, chunkX, chunkZ, chunkSize]);

    return (
        <group>
            {spawnedProps.map(p => (
                <MeshyProp key={p.key} prop={p.prop} position={p.pos} normal={p.normal} seed={p.seed} />
            ))}
        </group>
    );
};

function hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = (hash << 5) - hash + str.charCodeAt(i);
        hash |= 0;
    }
    return Math.abs(hash);
}
