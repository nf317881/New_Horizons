import { createNoise2D } from 'simplex-noise';
import type { TerrainRules } from '../types/biome';

// Simple Linear Congruential Generator for seeding
export const createRandom = (seed: number) => {
    let s = seed;
    return () => {
        s = (s * 1664525 + 1013904223) % 4294967296;
        return (s >>> 0) / 4294967296;
    };
};

export class TerrainMath {
    private noise2D: (x: number, y: number) => number;
    private rules: TerrainRules;

    constructor(rules: TerrainRules) {
        this.rules = rules;
        const rng = createRandom(rules.seed);
        this.noise2D = createNoise2D(rng);
    }

    // Calculate height at specific X, Y coordinate
    getHeight(x: number, y: number): number {
        let totalHeight = 0;

        for (const layer of this.rules.layers) {
            const { noiseScale, roughness, heightScale, offsetX, offsetZ } = layer;
            const lx = x + offsetX;
            const ly = y + offsetZ;

            // Base Noise
            let noise = this.noise2D(lx * noiseScale, ly * noiseScale);

            // Detailed Noise (Roughness)
            noise += 0.5 * roughness * this.noise2D(lx * noiseScale * 4, ly * noiseScale * 4);
            noise += 0.25 * roughness * this.noise2D(lx * noiseScale * 8, ly * noiseScale * 8);

            totalHeight += noise * heightScale;
        }

        return totalHeight;
    }
}
