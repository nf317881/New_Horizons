export interface TerrainRules {
  heightScale: number;
  noiseScale: number;
  roughness: number;
  waterLevel: number;
  baseColor: string;
  highColor: string;
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

// Add a runtime export to ensure the module is not empty
export const DEFAULT_BIOME_ID = "default";
