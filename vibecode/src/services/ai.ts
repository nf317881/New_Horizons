import type { BiomeData, BiomeParameters, WeatherParams } from '../types/biome';
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
        description: "",
        groundDescription: "",
        skyDescription: "",
    };
};

export interface DetailedDescription {
    summary: string;
    ground: string;
    sky: string;
}

// 2. Call "Gemini Pro" (using OpenRouter ID) for Creative Description
export const generateBiomeDescription = async (params: BiomeParameters): Promise<DetailedDescription> => {
    const apiKey = getApiKey();
    if (!apiKey) throw new Error("Missing API Key. Please set VITE_OPENROUTER_GEMINI_KEY in .env");

    const prompt = `
    You are a Xenobiologist. Describe an alien biome based on these parameters:
    - Temperature: ${params.temperature}°C
    - Gravity: ${params.gravity}G
    - Atmosphere: ${params.atmosphereDensity}
    
    Output MUST be valid JSON with these fields:
    - summary: A creative narrative description (max 50 words).
    - ground: A short prompt for the ground texture. BE SPECIFIC about material (rock, sand, crystal). NO PLANTS.
    - sky: A short prompt for the skybox. Mention colors, moons, or clouds. NO PLANTS.

    Example: {"summary": "A frozen wasteland...", "ground": "cracked blue ice with silver veins", "sky": "black sky with two green moons"}
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
    let content = data.choices[0].message.content;
    content = content.replace(/```json/g, '').replace(/```/g, '');
    return JSON.parse(content) as DetailedDescription;
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
                    "name": "Base Layer (Large features)",
                    "noiseScale": number (0.002 to 0.01),
                    "heightScale": number (5 to 40),
                    "roughness": number (0 to 0.5),
                    "offsetX": 0,
                    "offsetZ": 0
                },
                {
                    "name": "Detail Layer (Small bumps)",
                    "noiseScale": number (0.02 to 0.05),
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
        },
        "musicPrompt": "An ambient space song for the biome; do not include vocals.",
        "weather": {
            "type": "rain" | "snow" | "sandstorm" | "spores",
            "intensity": number (0 to 3),
            "color": "hex, consider using a color that is significantly different from white",
            "speed": number (0.5 to 5.0)
        }
    }
    
    CRITICAL PHYSICS RULES:
    1. TRAVERSABILITY: The terrain MUST be walkable. Avoid combinations of high noiseScale (>0.02) and high heightScale (>10) which create impenetrable spikes.
    2. COHERENCE: If you want big mountains, use low noiseScale (<0.005). If you want rocky detail, use low heightScale (<3).
    3. WEATHER: Match weather to environment (Snow for cold, Sandstorm for dry/hot, Spores for thick atmosphere).
    4. Return ONLY JSON. No formatting blocks.
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
        atmosphere: parsedContext.atmosphere,
        musicPrompt: parsedContext.musicPrompt,
        weather: {
            type: parsedContext.weather?.type || 'none',
            intensity: parsedContext.weather?.intensity ?? 0,
            color: parsedContext.weather?.color || '#ffffff',
            speed: parsedContext.weather?.speed ?? 1.0
        } as WeatherParams
    };
};
// 4. Generate Texture using "Nano Banana" (Gemini 2.5 Flash Image via OpenRouter)
export const generateBiomeTexture = async (description: string): Promise<string> => {
    const apiKey = getApiKey();
    const model = "black-forest-labs/flux.2-klein-4b";
    const isGemini = model.includes("gemini");
    const prompt = `Seamless repeatable top-down texture of ${description}. NO PLANTS, NO TREES, NO GRASS. Only raw ground material (e.g. ${description}). High resolution, detailed, photorealistic, PBR style.`;

    // Updated based on OpenRouter Docs: Use /chat/completions for multimodal generation
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${apiKey}`,
            "Content-Type": "application/json",
            "HTTP-Referer": "http://localhost:5173",
            "X-Title": "Vibecode"
        },
        body: JSON.stringify({
            model: model,
            messages: [{ role: "user", content: prompt }],
            // Gemini requires explicit modalities. Others (like Flux) might strict fail if "text" is requested but not supported.
            ...(isGemini ? { modalities: ["image", "text"] } : {}),
        })
    });

    if (!response.ok) {
        const errorText = await response.text();
        console.warn("Texture Generation Failed:", response.status, errorText);
        return "";
    }

    const data = await response.json();

    // Detailed logging for debugging
    console.log("[AI] Texture Gen Response Choices:", JSON.stringify(data.choices, null, 2));

    const message = data.choices?.[0]?.message;

    if (message) {
        // 1. Try OpenRouter/OpenAI "images" array (non-standard but possible)
        if (message.images && message.images.length > 0) {
            const imgObj = message.images[0];
            const url = imgObj.image_url?.url || imgObj.url || "";
            console.log("[AI] Found URL in message.images:", url);
            return url;
        }

        // 2. Try parsing Markdown image from content: ![alt](url)
        if (message.content) {
            const mdMatch = message.content.match(/!\[.*?\]\((.*?)\)/);
            if (mdMatch) {
                console.log("[AI] Found URL in message.content (Markdown):", mdMatch[1]);
                return mdMatch[1];
            }

            // 3. Try finding a raw URL in the content
            // We ignore parentheses at the end to avoid matching markdown closing parens if regex failed
            const urlMatch = message.content.match(/https?:\/\/[^\s)]+/);
            if (urlMatch) {
                console.log("[AI] Found URL in message.content (Raw):", urlMatch[0]);
                return urlMatch[0];
            }
        }
    }

    console.warn("Texture Generation: No image found in response", data);
    return "";
};

// 5. Generate Skybox using Flux
export const generateSkyboxTexture = async (description: string): Promise<string> => {
    const apiKey = getApiKey();
    const model = "black-forest-labs/flux.2-klein-4b";
    const isGemini = model.includes("gemini");
    // To minimize seams, we explicitly ask for equirectangular 360 panorama and mention no foreground objects.
    const prompt = `Seamless 360-degree equirectangular panoramic skybox of ${description}. SKY ONLY. Panoramic view, no ground, no plants, no foreground objects. Perfect horizontal tiling. High resolution, cosmic, realistic.`;

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${apiKey}`,
            "Content-Type": "application/json",
            "HTTP-Referer": "http://localhost:5173",
            "X-Title": "Vibecode"
        },
        body: JSON.stringify({
            model: model,
            messages: [{ role: "user", content: prompt }],
            ...(isGemini ? { modalities: ["image", "text"] } : {}),
        })
    });

    if (!response.ok) {
        const errorText = await response.text();
        console.warn("Skybox Generation Failed:", response.status, errorText);
        return "";
    }

    const data = await response.json();
    const message = data.choices?.[0]?.message;

    if (message) {
        if (message.images && message.images.length > 0) {
            return message.images[0].image_url?.url || message.images[0].url || "";
        }
        if (message.content) {
            const mdMatch = message.content.match(/!\[.*?\]\((.*?)\)/);
            if (mdMatch) return mdMatch[1];
            const urlMatch = message.content.match(/https?:\/\/[^\s)]+/);
            if (urlMatch) return urlMatch[0];
        }
    }

    return "";
};
