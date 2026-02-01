import type { BiomeData } from '../types/biome';

export const generateMockBiome = (): BiomeData => {
    return {
        name: "MOSSY ARCHIPELAGO",
        description: "Floating islands covered in alien moss.",
        parameters: {
            temperature: 20,
            gravity: 1,
            atmosphereDensity: "Standard",
            description: "Mock data",
            groundDescription: "rocky moss",
            skyDescription: "clear blue sky"
        },
        terrain: {
            baseColor: '#2d4c1e',
            highColor: '#4a852c',
            waterLevel: 0,
            layers: [
                {
                    name: "Base Hills",
                    noiseScale: 0.01,
                    heightScale: 15,
                    roughness: 0.5,
                    offsetX: 0,
                    offsetZ: 0
                },
                {
                    name: "Detail Bumps",
                    noiseScale: 0.05,
                    heightScale: 2,
                    roughness: 0.8,
                    offsetX: 1000,
                    offsetZ: 1000
                }
            ],
            seed: 12345
        },
        atmosphere: {
            skyColor: '#87CEEB',
            fogColor: '#87CEEB',
            fogDensity: 0.02,
            sunIntensity: 1.0
        },
        musicPrompt: "Deep space ambient drone, Mossy alien archipelago, mysterious synthesizers, instrumental",
        weather: {
            type: 'spores',
            intensity: 1.5,
            color: '#ffaa44', // Warm orange spores
            speed: 1.0
        }
    };
};
