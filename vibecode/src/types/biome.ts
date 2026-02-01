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
  textureUrl?: string;
  seed: number;
}

export interface AtmosphereParams {
  skyColor: string;
  fogColor: string;
  fogDensity: number;
  sunIntensity: number;
  skyboxUrl?: string;
}

// The "Scientific" parameters that feed the AI
export interface BiomeParameters {
  temperature: number; // -50 to 100 Celsius
  gravity: number; // 0.1 to 2.0 G relative to Earth
  atmosphereDensity: string; // "Thin", "Standard", "Thick"
  description: string; // Master narrative
  groundDescription: string; // Specific for terrain texture
  skyDescription: string; // Specific for skybox
}

export interface PropDefinition {
  id: string;
  name: string;
  prompt: string;
  density: number; // 0 to 1
  baseScale: number;
}

export interface WeatherParams {
  type: 'none' | 'rain' | 'snow' | 'sandstorm' | 'spores';
  intensity: number; // 0 to 1
  color: string;
  speed: number;
}

export interface BiomeData {
  id?: string;
  name: string;
  description: string;
  parameters: BiomeParameters;
  terrain: TerrainRules;
  atmosphere: AtmosphereParams;
  musicPrompt?: string;
  props: PropDefinition[];
  weather: WeatherParams;
}
