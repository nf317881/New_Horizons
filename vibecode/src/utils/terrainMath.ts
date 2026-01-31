import { createNoise2D } from 'simplex-noise';
import type { TerrainRules } from '../types/biome';

// Simple Linear Congruential Generator for seeding
const createRandom = (seed: number) => {
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
        const { noiseScale, roughness, heightScale } = this.rules;

        // Base Noise
        let noise = this.noise2D(x * noiseScale, y * noiseScale);

        // Detailed Noise (Roughness) - Matching the Terrain.tsx logic
        noise += 0.5 * roughness * this.noise2D(x * noiseScale * 4, y * noiseScale * 4);
        noise += 0.25 * roughness * this.noise2D(x * noiseScale * 8, y * noiseScale * 8);

        return noise * heightScale;
    }
}
