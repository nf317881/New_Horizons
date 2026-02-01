import { storage } from '../firebaseConfig';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

/**
 * Uploads a 3D model (GLB) to Firebase Storage
 * @param file The GLB file blob or file object
 * @param biomeId The ID of the biome this model belongs to
 * @param modelType "tree" | "bush" | "rock" etc.
 */
export const uploadModel = async (file: Blob | File, biomeId: string, modelType: string): Promise<string> => {
    const path = `biomes/${biomeId}/models/${modelType}_${Date.now()}.glb`;
    const storageRef = ref(storage, path);

    const snapshot = await uploadBytes(storageRef, file);
    const downloadURL = await getDownloadURL(snapshot.ref);

    return downloadURL;
};

/**
 * Proxies a GLB from an external URL to permanent storage
 */
export const uploadModelFromUrl = async (url: string, biomeId: string, modelName: string): Promise<string> => {
    try {
        const response = await fetch(url);
        const blob = await response.blob();
        const path = `biomes/${biomeId}/models/${modelName.replace(/\s+/g, '_')}_${Date.now()}.glb`;
        const storageRef = ref(storage, path);
        const snapshot = await uploadBytes(storageRef, blob);
        return await getDownloadURL(snapshot.ref);
    } catch (e) {
        console.error("Failed to proxy upload model:", e);
        return url;
    }
}

/**
 * Uploads a texture (PNG/JPG) to Firebase Storage
 * proxying it from a URL if needed (since OpenRouter URLs fade)
 */
export const uploadTextureFromUrl = async (url: string, biomeId: string, type: "skybox" | "ground"): Promise<string> => {
    try {
        const response = await fetch(url);
        const blob = await response.blob();

        const ext = type === "skybox" ? "jpg" : "png";
        const path = `biomes/${biomeId}/textures/${type}_${Date.now()}.${ext}`;
        const storageRef = ref(storage, path);

        const snapshot = await uploadBytes(storageRef, blob);
        return await getDownloadURL(snapshot.ref);
    } catch (e) {
        console.error("Failed to proxy upload texture:", e);
        return url; // Fallback to original URL if upload fails
    }
};

/**
 * Uploads the audio (Base64) to Firebase Storage as MP3
 */
export const uploadAudio = async (base64Audio: string, biomeId: string): Promise<string> => {
    // Convert Base64 to Blob
    const byteString = atob(base64Audio.split(',')[1]);
    const mimeString = base64Audio.split(',')[0].split(':')[1].split(';')[0];
    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);
    for (let i = 0; i < byteString.length; i++) {
        ia[i] = byteString.charCodeAt(i);
    }
    const blob = new Blob([ab], { type: mimeString });

    const path = `biomes/${biomeId}/audio/ambience_${Date.now()}.mp3`;
    const storageRef = ref(storage, path);

    const snapshot = await uploadBytes(storageRef, blob);
    return await getDownloadURL(snapshot.ref);
};
