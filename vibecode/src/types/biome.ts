export interface TerrainRules {
  heightScale: number;
  noiseScale: number;
  roughness: number;
  waterLevel: number;
  baseColor: string;
  highColor: string;
  seed: number; // Added seed for consistent noise generation
}

export interface AtmosphereRules {
  skyColor: string;
  fogColor: string;
  fogDensity: number;
  sunIntensity: number;
}

export interface BiomeData {
  id: string;
  name: string;
  description: string;
  terrain: TerrainRules;
  atmosphere: AtmosphereRules;
}

export const DEFAULT_BIOME_ID = "default";
