import { db } from '../firebaseConfig';
import { collection, addDoc, getDocs, doc, getDoc, query, orderBy, limit } from 'firebase/firestore';
import type { BiomeData } from '../types/biome';

export interface SavedBiome extends BiomeData {
    firestoreId?: string; // ID of the document itself
    authorId: string;
    timestamp: number;
    // We override specific fields with permanent URLs
    assets: {
        skyboxUrl: string;
        groundTextureUrl: string;
        audioUrl: string;
        models: {
            type: string;
            url: string;
        }[];
    };
}

const COLLECTION_NAME = "biomes";

export const saveBiomeToGallery = async (biome: BiomeData, assets: SavedBiome['assets'], authorId: string = "owner") => {
    // STRICT SANITIZATION
    // Firestore rejects nested arrays (arrays inside arrays) and custom prototypes.
    // We manually reconstruct the object to guarantee it's a plain JSON structure matching our schema.

    const safeLayers = (biome.terrain.layers || []).map(l => ({
        name: String(l.name || "Layer"),
        noiseScale: Number(l.noiseScale) || 0.01,
        heightScale: Number(l.heightScale) || 1,
        roughness: Number(l.roughness) || 0.5,
        offsetX: Number(l.offsetX) || 0,
        offsetZ: Number(l.offsetZ) || 0
    }));

    const safeTerrain = {
        baseColor: String(biome.terrain.baseColor || "#000000"),
        highColor: String(biome.terrain.highColor || "#ffffff"),
        waterLevel: Number(biome.terrain.waterLevel) || 0,
        // WORKAROUND: Firestore is flagging "invalid nested entity" in terrain.
        // We serialize layers to a string to guarantee no nested array issues.
        layers: JSON.stringify(safeLayers),
        seed: Number(biome.terrain.seed) || 0,
        // CRITICAL FIX: Prefer the uploaded asset URL. The original biome.terrain.textureUrl
        // might be a massive Base64 string that exceeds Firestore's 1MB limit.
        textureUrl: assets.groundTextureUrl || (biome.terrain.textureUrl ? String(biome.terrain.textureUrl).substring(0, 500) : null)
    };

    const safeAtmosphere = {
        skyColor: String(biome.atmosphere.skyColor || "#000000"),
        fogColor: String(biome.atmosphere.fogColor || "#000000"),
        fogDensity: Number(biome.atmosphere.fogDensity) || 0.01,
        sunIntensity: Number(biome.atmosphere.sunIntensity) || 1.0,
        // CRITICAL FIX: Prefer the uploaded asset URL.
        skyboxUrl: assets.skyboxUrl || (biome.atmosphere.skyboxUrl ? String(biome.atmosphere.skyboxUrl).substring(0, 500) : null)
    };

    const safeWeather = {
        type: String(biome.weather.type || 'none'),
        intensity: Number(biome.weather.intensity) || 0,
        color: String(biome.weather.color || '#ffffff'),
        speed: Number(biome.weather.speed) || 1
    };

    const safeParams = {
        temperature: Number(biome.parameters.temperature) || 0,
        gravity: Number(biome.parameters.gravity) || 1,
        atmosphereDensity: String(biome.parameters.atmosphereDensity || "Standard"),
        description: String(biome.parameters.description || ""),
        groundDescription: String(biome.parameters.groundDescription || ""),
        skyDescription: String(biome.parameters.skyDescription || "")
    };

    const cleanBiome = {
        name: String(biome.name || "Unnamed Biome"),
        description: String(biome.description || ""),
        musicPrompt: biome.musicPrompt ? String(biome.musicPrompt) : null,
        parameters: safeParams,
        // NUCLEAR OPTION: Firestore keeps rejecting 'terrain' as an invalid nested entity.
        // We are serializing the ENTIRE terrain object to a string.
        terrain: JSON.stringify(safeTerrain),
        atmosphere: safeAtmosphere,
        weather: safeWeather,
        assets: JSON.parse(JSON.stringify(assets)), // Ensure assets are also plain objects
        authorId: String(authorId),
        timestamp: Date.now()
    };

    console.log("Saving Biome to Firestore:", cleanBiome);

    // Remove nulls if Firestore complains (though null is usually fine, undefined is not)
    // JSON stringify/parse is a final safety net for prototypes
    const finalPayload = JSON.parse(JSON.stringify(cleanBiome));

    const docRef = await addDoc(collection(db, COLLECTION_NAME), finalPayload);
    return docRef.id;
};

export const fetchGalleryBiomes = async (): Promise<SavedBiome[]> => {
    const q = query(collection(db, COLLECTION_NAME), orderBy("timestamp", "desc"), limit(20));
    const snapshot = await getDocs(q);

    return snapshot.docs.map((doc: any) => {
        const data = doc.data();
        let parsedTerrain = data.terrain;

        // NUCLEAR OPTION: Handle stringified terrain
        if (typeof parsedTerrain === 'string') {
            try {
                parsedTerrain = JSON.parse(parsedTerrain);
                // Handle double-encoded layers if present from previous attempts
                if (typeof parsedTerrain.layers === 'string') {
                    parsedTerrain.layers = JSON.parse(parsedTerrain.layers);
                }
            } catch (e) {
                console.error("Error parsing terrain:", e);
                parsedTerrain = { ...data.terrain };
            }
        }
        // Handle legacy "stringified layers only"
        else if (data.terrain && typeof data.terrain.layers === 'string') {
            try {
                parsedTerrain = {
                    ...data.terrain,
                    layers: JSON.parse(data.terrain.layers)
                };
            } catch (e) { }
        }

        return {
            ...data,
            terrain: parsedTerrain || data.terrain, // Fallback
            firestoreId: doc.id
        } as SavedBiome;
    });
};

export const loadBiomeById = async (id: string): Promise<SavedBiome | null> => {
    const docRef = doc(db, COLLECTION_NAME, id);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
        const data = snap.data();
        let parsedTerrain = data.terrain;

        if (typeof parsedTerrain === 'string') {
            try {
                parsedTerrain = JSON.parse(parsedTerrain);
                if (typeof parsedTerrain.layers === 'string') {
                    parsedTerrain.layers = JSON.parse(parsedTerrain.layers);
                }
            } catch (e) { }
        } else if (data.terrain && typeof data.terrain.layers === 'string') {
            try {
                parsedTerrain = {
                    ...data.terrain,
                    layers: JSON.parse(data.terrain.layers)
                };
            } catch (e) { }
        }

        return {
            ...data,
            terrain: parsedTerrain || data.terrain,
            firestoreId: snap.id
        } as SavedBiome;
    }
    return null;
};
