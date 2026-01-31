export interface TerrainLayer {
  name: string;
  noiseScale: number; // Frequency
  heightScale: number; // Amplitude
  roughness: number; // Detail / Octaves contribution
  offsetX: number;
  offsetZ: number;
}

export interface TerrainRules {
  baseColor: string;
  highColor: string;
  layers: TerrainLayer[];
  waterLevel: number;
}

export interface AtmosphereParams {
  skyColor: string;
  fogColor: string;
  fogDensity: number;
  sunIntensity: number;
}

// The "Scientific" parameters that feed the AI
export interface BiomeParameters {
  temperature: number; // -50 to 100 Celsius
  gravity: number; // 0.1 to 2.0 G relative to Earth
  atmosphereDensity: string; // "Thin", "Standard", "Thick"
  description: string; // Short generated prompt
}

export interface BiomeData {
  id?: string; // Optional for now
  name: string;
  description: string;
  parameters: BiomeParameters;
  terrain: TerrainRules;
  atmosphere: AtmosphereParams;
}
