import React, { useEffect, useRef, useState } from 'react';
import { getAlienAmbienceV13 } from '../services/elevenLabsV13';
import type { BiomeData } from '../types/biome';

interface AlienAmbienceProps {
    biome: BiomeData;
    audioOverrideUrl?: string; // Legacy support, though biome.audioOverrideUrl is preferred
}

const AlienAmbience: React.FC<AlienAmbienceProps> = ({ biome, audioOverrideUrl }) => {
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const [audioUrl, setAudioUrl] = useState<string | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Track the current biome ID to reset audioUrl immediately on change
    const [currentBiomeId, setCurrentBiomeId] = useState<string | undefined>(biome.id);

    // Prefer the URL from the biome object, fall back to prop
    const activeOverrideUrl = biome.audioOverrideUrl || audioOverrideUrl;

    useEffect(() => {
        // Reset state when the biome changes to stop the old audio and show loading
        if (biome.id !== currentBiomeId) {
            setAudioUrl(null);
            setIsPlaying(false);
            setError(null);
            setCurrentBiomeId(biome.id);
        }

        if (!biome?.musicPrompt && !activeOverrideUrl) return;

        const load = async () => {
            // STEP 1: Check for explicit permanent override (e.g. from Database)
            if (activeOverrideUrl) {
                console.log(`[AlienAmbience] Using permanent storage: ${activeOverrideUrl.substring(0, 50)}...`);
                setAudioUrl(activeOverrideUrl);
                setIsGenerating(false);
                return;
            }

            // STEP 2: Handle procedural generation
            if (!biome.id) {
                console.warn("[AlienAmbience] Cannot generate audio: missing biome.id");
                return;
            }

            try {
                setIsGenerating(true);
                const prompt = biome.musicPrompt || "Deep space ambient drone, mysterious synthesizers";
                console.log(`[AlienAmbience] Initiating generation for world: ${biome.id}`);

                // getAlienAmbienceV13 now handles internal IndexedDB caching and concurrency locking
                const url = await getAlienAmbienceV13(biome.id, prompt);

                setAudioUrl(url);
                setError(null);
            } catch (err: any) {
                console.error("[AlienAmbience] Generation failure:", err);
                setError(err.message);
            } finally {
                setIsGenerating(false);
            }
        };

        load();
    }, [biome.id, activeOverrideUrl, biome.musicPrompt]);

    const toggle = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!audioRef.current || isGenerating) return;
        if (isPlaying) {
            audioRef.current.pause();
        } else {
            audioRef.current.play().catch(e => {
                console.warn("[AlienAmbience] Autoplay blocked:", e);
                setError("Click to Play");
            });
        }
        setIsPlaying(!isPlaying);
    };

    // Auto-play when audio URL is ready
    useEffect(() => {
        if (audioUrl && audioRef.current) {
            const play = () => {
                audioRef.current?.play().then(() => setIsPlaying(true)).catch(() => { });
            };
            play();
            document.addEventListener('click', play, { once: true });
            return () => document.removeEventListener('click', play);
        }
    }, [audioUrl]);

    return (
        <div
            onMouseDown={e => e.stopPropagation()}
            onPointerDown={e => e.stopPropagation()}
            onMouseUp={e => e.stopPropagation()}
            style={{
                position: 'absolute', bottom: 20, right: 20, zIndex: 9999,
                display: 'flex', alignItems: 'center', gap: '10px',
                background: isGenerating ? 'rgba(255, 235, 0, 0.3)' : 'rgba(0,0,0,0.8)',
                padding: '10px 15px', borderRadius: '5px', color: '#fff',
                fontFamily: 'monospace', border: '1px solid ' + (isGenerating ? '#ff0' : '#0ff'),
                cursor: 'pointer', pointerEvents: 'auto'
            }} onClick={toggle}>
            {audioUrl && <audio ref={audioRef} src={audioUrl} loop />}
            <div style={{
                width: 10, height: 10, borderRadius: '50%',
                background: isGenerating ? '#ff0' : isPlaying ? '#0ff' : '#f0f',
                boxShadow: isPlaying ? '0 0 10px #0ff' : 'none'
            }} />
            <span>
                {isGenerating ? 'SYNCING_ATMOSPHERE...' : isPlaying ? 'SOUND_ON' : 'SOUND_OFF'}
            </span>
            {error && <span style={{ fontSize: 9, color: '#f55', marginLeft: 5 }}>[{error.slice(0, 10)}]</span>}
        </div>
    );
};

export default AlienAmbience;
