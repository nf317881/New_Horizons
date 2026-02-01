const MESHY_BASE_URL = "https://api.meshy.ai/openapi/v2";

const getApiKey = () => {
    return import.meta.env.VITE_MESHY_API_KEY || "";
};

export interface MeshyTaskResponse {
    result: string; // Task ID
}

export interface MeshyStatusResponse {
    status: "PENDING" | "IN_PROGRESS" | "SUCCEEDED" | "FAILED";
    progress: number;
    model_urls?: {
        glb: string;
        fbx?: string;
        obj?: string;
    };
    error?: {
        message: string;
    };
}

/**
 * Creates a Text-to-3D task on Meshy
 * @param prompt The description of the object to generate
 * @param negativePrompt What to exclude from the generation
 * @returns The Task ID
 */
export const createTextTo3DTask = async (prompt: string, negativePrompt = "low quality, low resolution, low poly, ugly"): Promise<string> => {
    const apiKey = getApiKey();
    if (!apiKey) throw new Error("Missing Meshy API Key. Please set VITE_MESHY_API_KEY in .env");

    const maxRetries = 5;
    let retryDelay = 2000;

    for (let i = 0; i < maxRetries; i++) {
        const response = await fetch(`${MESHY_BASE_URL}/text-to-3d`, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${apiKey}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                mode: "preview",
                prompt: prompt,
                negative_prompt: negativePrompt,
                should_remesh: true,
                ai_model: "meshy-5"
            })
        });

        if (response.status === 429) {
            console.warn(`Meshy: Queue full (Rate Limit). Retrying in ${retryDelay}ms...`);
            await new Promise(r => setTimeout(r, retryDelay));
            retryDelay *= 2;
            continue;
        }

        if (!response.ok) {
            const err = await response.text();
            throw new Error(`Meshy API Error ${response.status}: ${err}`);
        }

        const data: MeshyTaskResponse = await response.json();
        console.log("Meshy: Preview Task created", data.result);
        return data.result;
    }

    throw new Error("Meshy: Max retries exceeded due to rate limits/concurrency.");
};

/**
 * Creates a text-to-3d "refine" task based on a preview task.
 * This adds high-quality textures and geometry.
 */
export const createTextTo3DRefineTask = async (previewTaskId: string): Promise<string> => {
    const apiKey = getApiKey();
    if (!apiKey) throw new Error("Missing Meshy API Key. Please set VITE_MESHY_API_KEY in .env");

    const maxRetries = 5;
    let retryDelay = 2000;

    for (let i = 0; i < maxRetries; i++) {
        const response = await fetch(`${MESHY_BASE_URL}/text-to-3d`, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${apiKey}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                mode: "refine",
                preview_task_id: previewTaskId,
                texture_richness: "high"
            })
        });

        if (response.status === 429) {
            console.warn(`Meshy: Queue full (Rate Limit). Retrying in ${retryDelay}ms...`);
            await new Promise(r => setTimeout(r, retryDelay));
            retryDelay *= 2;
            continue;
        }

        if (!response.ok) {
            const err = await response.text();
            throw new Error(`Meshy Refine Error ${response.status}: ${err}`);
        }

        const data: MeshyTaskResponse = await response.json();
        console.log("Meshy: Refine Task created", data.result);
        return data.result;
    }

    throw new Error("Meshy Refine: Max retries exceeded.");
};

/**
 * Polls the status of a specific task
 * @param taskId The ID returned from createTextTo3DTask
 * @returns The status and results (if ready)
 */
export const getTaskStatus = async (taskId: string): Promise<MeshyStatusResponse> => {
    const apiKey = getApiKey();
    const response = await fetch(`${MESHY_BASE_URL}/text-to-3d/${taskId}`, {
        headers: {
            "Authorization": `Bearer ${apiKey}`
        }
    });

    if (!response.ok) {
        const err = await response.text();
        throw new Error(`Meshy Status Error ${response.status}: ${err}`);
    }

    return await response.json();
};

/**
 * High-level wrapper that creates a task and polls until success
 * @param prompt Prompt for model generation
 * @param onProgress Optional callback for progress updates
 * @returns The GLB URL of the generated model
 */
/**
 * Utility to poll a task until it completes
 */
async function pollTask(taskId: string, onProgress?: (progress: number) => void): Promise<string> {
    const pollInterval = 5000;
    const maxAttempts = 120;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const statusData = await getTaskStatus(taskId);
        if (onProgress) onProgress(statusData.progress);

        if (statusData.status === "SUCCEEDED") {
            if (statusData.model_urls?.glb) return statusData.model_urls.glb;
            throw new Error("Succeeded but no GLB URL found");
        }

        if (statusData.status === "FAILED") {
            throw new Error(statusData.error?.message || "Generation failed on Meshy");
        }

        await new Promise(r => setTimeout(r, pollInterval));
    }
    throw new Error("Timed out waiting for Meshy task.");
}

/**
 * High-level wrapper that creates a preview, waits, then creates a refine, waits.
 * This ensures high-quality textured models.
 * @param prompt Prompt for model generation
 * @param onProgress Optional callback for progress updates
 * @returns The final GLB URL of the textured model
 */
export const generate3DModel = async (prompt: string, onProgress?: (progress: number) => void): Promise<string> => {
    // 1. Preview Stage (0-50%)
    const previewTaskId = await createTextTo3DTask(prompt);
    await pollTask(previewTaskId, (p) => onProgress?.(Math.floor(p * 0.5)));

    // 2. Refine Stage (50-100%)
    const refineTaskId = await createTextTo3DRefineTask(previewTaskId);
    return await pollTask(refineTaskId, (p) => onProgress?.(Math.floor(50 + p * 0.5)));
};
