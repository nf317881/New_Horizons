const ELEVENLABS_BASE_URL = "https://api.elevenlabs.io/v1";
const DB_NAME = "VibecodeAudioDS";
const STORE_NAME = "audio_cache";

// --- IndexedDB Helper ---
const openDB = (): Promise<IDBDatabase> => {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, 1);
        request.onupgradeneeded = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME);
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
};

const getFromDB = async (key: string): Promise<string | null> => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, "readonly");
        const store = transaction.objectStore(STORE_NAME);
        const request = store.get(key);
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error);
    });
};

const saveToDB = async (key: string, value: string): Promise<void> => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, "readwrite");
        const store = transaction.objectStore(STORE_NAME);
        const request = store.put(value, key);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
};

// --- Service Logic ---

const getApiKey = () => {
    return import.meta.env.VITE_ELEVENLABS_API_KEY || "";
};

interface MusicStatusResponse {
    status: "queued" | "processing" | "completed" | "failed";
    audio_url?: string;
    result?: {
        audio_url?: string;
    };
    error?: string;
}

const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
};

const base64ToBlobUrl = (base64: string): string => {
    const byteString = atob(base64.split(',')[1]);
    const mimeString = base64.split(',')[0].split(':')[1].split(';')[0];
    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);
    for (let i = 0; i < byteString.length; i++) {
        ia[i] = byteString.charCodeAt(i);
    }
    const blob = new Blob([ab], { type: mimeString });
    return URL.createObjectURL(blob);
};

const _internalV13AudioWorker = async (prompt: string, durationInMs: number): Promise<string> => {
    const apiKey = getApiKey();
    if (!apiKey) throw new Error("Missing ElevenLabs API Key");

    const endpoint = `${ELEVENLABS_BASE_URL}/music`;
    // CRITICAL: Parameter is 'music_length_ms' - confirmed via search.
    console.log(`elevenLabsV13: Requesting ${durationInMs}ms generation via /v1/music...`);

    const createResponse = await fetch(endpoint, {
        method: "POST",
        headers: {
            "xi-api-key": apiKey,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            prompt: prompt,
            music_length_ms: durationInMs
        })
    });

    if (!createResponse.ok) {
        const err = await createResponse.text();
        console.error("elevenLabsV13: POST Error:", createResponse.status, err);
        throw new Error(`API Error ${createResponse.status}: ${err}`);
    }

    const contentType = createResponse.headers.get("Content-Type") || "";

    // Case 1: Direct Binary
    if (contentType.includes("audio/") || contentType.includes("application/octet-stream")) {
        console.log("elevenLabsV13: Binary audio received.");
        const blob = await createResponse.blob();
        return await blobToBase64(blob);
    }

    // Case 2: Async task
    const data = await createResponse.json();
    const task_id = data.task_id;
    if (!task_id) throw new Error("Invalid API Response");

    console.log("elevenLabsV13: Async Task ID:", task_id);

    for (let attempt = 0; attempt < 40; attempt++) {
        await new Promise(r => setTimeout(r, 3000));
        const statusResponse = await fetch(`${ELEVENLABS_BASE_URL}/audio-tasks/${task_id}`, {
            headers: { "xi-api-key": apiKey }
        });
        if (!statusResponse.ok) continue;

        const pollData = await statusResponse.json() as MusicStatusResponse;
        console.log(`elevenLabsV13: Status [${attempt}]`, pollData.status);

        if (pollData.status === "completed") {
            const url = pollData.result?.audio_url || pollData.audio_url;
            if (url) {
                const audioRes = await fetch(url);
                const blob = await audioRes.blob();
                return await blobToBase64(blob);
            }
        }
        if (pollData.status === "failed") throw new Error(pollData.error || "Generation failed");
    }

    throw new Error("Timed out waiting for production.");
};

// Map to track active generations per biome to prevent redundant calls
const activeV13Promises: Record<string, Promise<string>> = {};

export const getAlienAmbienceV13 = async (biomeId: string, prompt: string): Promise<string> => {
    const cacheKey = `audio_v13_${biomeId}`;

    // 1. Try to get from IndexedDB (Per-biome cache)
    try {
        const cached = await getFromDB(cacheKey);
        if (cached) {
            console.log(`elevenLabsV13: Loaded audio for ${biomeId} from cache`);
            return base64ToBlobUrl(cached);
        }
    } catch (e) {
        console.warn("elevenLabsV13: DB Read failed", e);
    }

    // 2. Concurrency Lock
    if (biomeId in activeV13Promises) {
        console.log(`elevenLabsV13: Joining existing generation for ${biomeId}...`);
        const result = await activeV13Promises[biomeId];
        return base64ToBlobUrl(result);
    }

    // 3. New Generation
    console.log(`elevenLabsV13: Starting NEW generation for ${biomeId} (30s)...`);
    const task = _internalV13AudioWorker(prompt, 30000);
    activeV13Promises[biomeId] = task;

    try {
        const resultBase64 = await task;

        await saveToDB(cacheKey, resultBase64);
        console.log(`elevenLabsV13: Saved audio for ${biomeId} to IndexedDB`);

        // Cleanup active promise
        delete activeV13Promises[biomeId];

        return base64ToBlobUrl(resultBase64);
    } catch (err) {
        delete activeV13Promises[biomeId];
        throw err;
    }
};

export const getStoredV13Audio = async (biomeId: string): Promise<string | null> => {
    try {
        return await getFromDB(`audio_v13_${biomeId}`);
    } catch (e) {
        return null;
    }
};
