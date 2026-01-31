import type { BiomeData } from '../types/biome';
import { v4 as uuidv4 } from 'uuid';

export const generateMockBiome = (): BiomeData => {
    const styles = [
        {
            name: "Neon Tundra",
            description: "A frozen wasteland illuminated by radioactive flora.",
            terrain: {
                heightScale: 12,
                noiseScale: 0.04,
                roughness: 0.6,
                waterLevel: 0,
                baseColor: '#2b0057',
                highColor: '#00ffcc',
            },
            atmosphere: {
                skyColor: '#0b001a',
                fogColor: '#4d0099',
                fogDensity: 0.04,
                sunIntensity: 0.2
            }
        },
        {
            name: "Crimson Wastes",
            description: "A scorched desert with jagged iron peaks.",
            terrain: {
                heightScale: 8,
                noiseScale: 0.03,
                roughness: 0.4,
                waterLevel: -10,
                baseColor: '#590a0a',
                highColor: '#ff8800',
            },
            atmosphere: {
                skyColor: '#330000',
                fogColor: '#993333',
                fogDensity: 0.025,
                sunIntensity: 2.0
            }
        },
        {
            name: "Mossy Archipelago",
            description: "Floating islands covered in alien moss.",
            terrain: {
                heightScale: 20,
                noiseScale: 0.02,
                roughness: 0.2,
                waterLevel: 5,
                baseColor: '#004d00',
                highColor: '#88ff00',
            },
            atmosphere: {
                skyColor: '#87CEEB',
                fogColor: '#E0F7FA',
                fogDensity: 0.015,
                sunIntensity: 1.0
            }
        }
    ];

    const style = styles[Math.floor(Math.random() * styles.length)];

    return {
        id: uuidv4(),
        ...style
    };
};
