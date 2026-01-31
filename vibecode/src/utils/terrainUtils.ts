import type { NoiseFunction2D } from 'simplex-noise';
import type { TerrainLayer } from '../types/biome';

export const getTerrainHeight = (
    globalX: number,
    globalY: number,
    layers: TerrainLayer[],
    noise2D: NoiseFunction2D
): number => {
    let totalNoise = 0;

    if (layers && layers.length > 0) {
        for (const layer of layers) {
            // Base layer noise
            let n = noise2D(
                (globalX + layer.offsetX) * layer.noiseScale,
                (globalY + layer.offsetZ) * layer.noiseScale
            );

            // Add roughness
            if (layer.roughness > 0) {
                n += 0.5 * layer.roughness * noise2D(
                    (globalX + layer.offsetX) * layer.noiseScale * 2,
                    (globalY + layer.offsetZ) * layer.noiseScale * 2
                );
            }

            totalNoise += n * layer.heightScale;
        }
    } else {
        // Fallback
        totalNoise = noise2D(globalX * 0.02, globalY * 0.02) * 5;
    }

    return totalNoise;
};
