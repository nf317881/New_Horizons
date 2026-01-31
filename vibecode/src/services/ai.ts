import type { BiomeData, BiomeParameters } from '../types/biome';
import { v4 as uuidv4 } from 'uuid';

const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";

// Helper to get key (assuming user defines VITE_OPENROUTER_GEMINI_KEY, but we check variances)
const getApiKey = () => {
    return import.meta.env.VITE_OPENROUTER_GEMINI_KEY || import.meta.env.OPENROUTER_GEMINI_KEY || "";
};

interface OpenRouterResponse {
    choices: {
        message: {
            content: string;
        };
    }[];
}

// 1. Randomize "Scientific" Parameters
export const generateRandomParameters = (): BiomeParameters => {
    return {
        temperature: Math.floor(Math.random() * 150) - 50, // -50 to 100
        gravity: parseFloat((Math.random() * 1.9 + 0.1).toFixed(2)), // 0.1 to 2.0
        atmosphereDensity: ["Thin", "Standard", "Thick", "Soupy"][Math.floor(Math.random() * 4)],
        description: "", // Filled by AI
    };
};

// 2. Call "Gemini Pro" (using OpenRouter ID) for Creative Description
export const generateBiomeDescription = async (params: BiomeParameters): Promise<string> => {
    const apiKey = getApiKey();
    if (!apiKey) throw new Error("Missing API Key. Please set VITE_OPENROUTER_GEMINI_KEY in .env");

    const prompt = `
    You are a Xenobiologist. Describe an alien biome based on these parameters:
    - Temperature: ${params.temperature}°C
    - Gravity: ${params.gravity}G
    - Atmosphere: ${params.atmosphereDensity}
    
    Describe the terrain, colors, flora, and general "vibe". Be creative but scientific. Keep it under 50 words.
    `;

    const response = await fetch(OPENROUTER_API_URL, {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${apiKey}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            model: "google/gemini-3-flash-preview",
            messages: [{ role: "user", content: prompt }]
        })
    });

    if (!response.ok) throw new Error(`AI Request Failed: ${response.statusText}`);
    const data: OpenRouterResponse = await response.json();
    return data.choices[0].message.content;
};

// 3. Call "Gemini Flash" for Structured Data Generation
export const generateBiomeData = async (description: string, params: BiomeParameters): Promise<BiomeData> => {
    const apiKey = getApiKey();

    // We want JSON output.
    const prompt = `
    You are a Procedural Generation Engineer. Convert this alien biome description into structured JSON parameters for a terrain engine.

    Description: "${description}"
    Parameters: Temp ${params.temperature}C, Gravity ${params.gravity}G.

    Output MUST be valid JSON matching this schema:
    {
        "name": "Short Cool Name",
        "terrain": {
            "baseColor": "hex",
            "highColor": "hex",
            "waterLevel": number (-10 to 10),
            "layers": [
                {
                    "name": "Base Layer",
                    "noiseScale": number (0.005 to 0.03),
                    "heightScale": number (5 to 50),
                    "roughness": number (0 to 1),
                    "offsetX": 0,
                    "offsetZ": 0
                },
                {
                    "name": "Detail Layer",
                    "noiseScale": number (0.04 to 0.1),
                    "heightScale": number (1 to 5),
                    "roughness": number (0 to 1),
                    "offsetX": 0,
                    "offsetZ": 0
                }
            ]
        },
        "atmosphere": {
            "skyColor": "hex",
            "fogColor": "hex",
            "fogDensity": number (0.001 to 0.05),
            "sunIntensity": number (0.1 to 2.0)
        }
    }
    
    Return ONLY JSON. No formatting blocks.
    `;

    const response = await fetch(OPENROUTER_API_URL, {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${apiKey}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            model: "google/gemini-3-flash-preview",
            messages: [{ role: "user", content: prompt }]
        })
    });

    const data: OpenRouterResponse = await response.json();
    let jsonStr = data.choices[0].message.content;

    // Clean markdown code blocks if present
    jsonStr = jsonStr.replace(/```json/g, '').replace(/```/g, '');

    const parsedContext = JSON.parse(jsonStr);

    return {
        id: uuidv4(),
        name: parsedContext.name,
        description: description,
        parameters: params,
        terrain: parsedContext.terrain,
        atmosphere: parsedContext.atmosphere
    };
};
