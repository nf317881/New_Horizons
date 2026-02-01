const ELEVENLABS_BASE_URL = "https://api.elevenlabs.io/v1";

const getApiKey = () => {
    const key = import.meta.env.VITE_ELEVENLABS_API_KEY || "";
    console.log("elevenLabsV9: API Key detected length:", key.length);
    return key;
};

interface MusicTaskResponse {
    task_id: string;
}

interface MusicStatusResponse {
    status: "queued" | "processing" | "completed" | "failed";
    audio_url?: string;
    result?: {
        audio_url?: string;
    };
    error?: string;
}

const _internalV9AudioWorker = async (prompt: string, duration: number): Promise<string> => {
    const apiKey = getApiKey();
    if (!apiKey) throw new Error("Missing ElevenLabs API Key");

    const endpoint = `${ELEVENLABS_BASE_URL}/music`;
    console.log("elevenLabsV9: Requesting generation via /v1/music:", prompt);

    const createResponse = await fetch(endpoint, {
        method: "POST",
        headers: {
            "xi-api-key": apiKey,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            prompt: prompt,
            duration_seconds: duration
        })
    });

    if (!createResponse.ok) {
        const err = await createResponse.text();
        console.error("elevenLabsV9: POST Error:", createResponse.status, err);
        throw new Error(`API Error ${createResponse.status}: ${err}`);
    }

    const contentType = createResponse.headers.get("Content-Type") || "";
    console.log("elevenLabsV9: Response Content-Type:", contentType);

    // Case 1: Direct Binary Audio (Detected by ID3 or Content-Type)
    if (contentType.includes("audio/") || contentType.includes("application/octet-stream")) {
        console.log("elevenLabsV9: Binary audio detected, creating blob...");
        const blob = await createResponse.blob();
        return URL.createObjectURL(blob);
    }

    // Case 2: Asynchronous Task ID (JSON)
    const data = await createResponse.json();
    const task_id = data.task_id;

    if (!task_id) {
        // Fallback: If it's not JSON but we tried to parse it, and we somehow missed binary
        console.error("elevenLabsV9: Invalid response format", data);
        throw new Error("Invalid API Response");
    }

    console.log("elevenLabsV9: Async Task ID detected:", task_id);

    const pollInterval = 3000;
    const maxAttempts = 40;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        await new Promise(r => setTimeout(r, pollInterval));

        const pollEndpoint = `${ELEVENLABS_BASE_URL}/audio-tasks/${task_id}`;
        const statusResponse = await fetch(pollEndpoint, {
            headers: { "xi-api-key": apiKey }
        });

        if (!statusResponse.ok) {
            console.warn(`elevenLabsV9: Poll ${attempt} status ${statusResponse.status}`);
            continue;
        }

        const pollData = await statusResponse.json() as MusicStatusResponse;
        console.log(`elevenLabsV9: [${attempt}/${maxAttempts}]`, pollData.status);

        if (pollData.status === "completed") {
            const url = pollData.result?.audio_url || pollData.audio_url;
            if (url) return url;
        }

        if (pollData.status === "failed") {
            throw new Error(pollData.error || "Generation failed");
        }
    }

    throw new Error("Timed out waiting for production.");
};

let activeV9Promise: Promise<string> | null = null;
let v9CachedUrl: string | null = localStorage.getItem('v9_planetary_audio');

export const getAlienAmbienceV9 = (prompt: string): Promise<string> => {
    if (v9CachedUrl) {
        console.log("elevenLabsV9: Using cached URL");
        return Promise.resolve(v9CachedUrl);
    }

    if (activeV9Promise) {
        console.log("elevenLabsV9: Joining existing task...");
        return activeV9Promise;
    }

    console.log("elevenLabsV9: Starting NEW generation...");
    activeV9Promise = _internalV9AudioWorker(prompt, 30)
        .then(url => {
            v9CachedUrl = url;
            localStorage.setItem('v9_planetary_audio', url);
            return url;
        })
        .catch(err => {
            activeV9Promise = null;
            throw err;
        });

    return activeV9Promise;
};
