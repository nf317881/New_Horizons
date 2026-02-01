import React, { useEffect, useRef, useState } from 'react';
import { getAlienAmbienceV13 } from '../services/elevenLabsV13';
import type { BiomeData } from '../types/biome';

interface AlienAmbienceProps {
    biome: BiomeData;
    audioOverrideUrl?: string;
}

/**
 * AlienAmbience - Version 13
 * Fixes credit consumption with music_length_ms.
 */
const AlienAmbience: React.FC<AlienAmbienceProps> = ({ biome, audioOverrideUrl }) => {
    console.log("AlienAmbience(V13): Rendering for", biome?.name);

    const audioRef = useRef<HTMLAudioElement | null>(null);
    const [audioUrl, setAudioUrl] = useState<string | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const initRef = useRef(false);

    useEffect(() => {
        if (!biome?.musicPrompt && !audioOverrideUrl) return; // Ensure there's a prompt or override URL

        // If a direct URL is provided (from Gallery), use it directly
        if (audioOverrideUrl) {
            console.log("AlienAmbience: Using Override URL", audioOverrideUrl);
            setAudioUrl(audioOverrideUrl); // Set the audio URL directly
            setIsGenerating(false);
            // The play logic will be handled by the audioUrl useEffect
            return;
        }

        if (initRef.current) return;
        initRef.current = true;

        // Otherwise generate/load from cache


        console.log("AlienAmbience(V13): Component Mounted");

        const load = async () => {
            try {
                setIsGenerating(true);
                const prompt = biome.musicPrompt || "Deep space ambient drone, alien atmosphere, mysterious synthesizers, instrumental";
                console.log("AlienAmbience(V13): Requesting V13 Ambience (30000ms)...");
                const url = await getAlienAmbienceV13(prompt);
                console.log("AlienAmbience(V13): Audio URL ready:", url);
                setAudioUrl(url);
            } catch (err: any) {
                console.error("AlienAmbience(V13) Failure:", err);
                setError(err.message);
            } finally {
                setIsGenerating(false);
            }
        };

        load();
    }, []);

    const toggle = () => {
        if (!audioRef.current || isGenerating) return;
        if (isPlaying) {
            audioRef.current.pause();
        } else {
            audioRef.current.play().catch(e => {
                console.warn("AlienAmbience(V13): Autoplay blocked:", e);
                setError("Interaction Required");
            });
        }
        setIsPlaying(!isPlaying);
    };

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
        <div style={{
            position: 'absolute',
            bottom: 20,
            right: 20,
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            background: isGenerating ? 'rgba(255, 235, 0, 0.3)' : 'rgba(0,0,0,0.8)',
            padding: '10px 15px',
            borderRadius: '5px',
            color: '#fff',
            fontFamily: 'monospace',
            border: '1px solid ' + (isGenerating ? '#ff0' : '#0ff'),
            cursor: 'pointer',
            pointerEvents: 'auto'
        }} onClick={toggle}>
            {audioUrl && <audio ref={audioRef} src={audioUrl} loop />}
            <div style={{
                width: 10, height: 10, borderRadius: '50%',
                background: isGenerating ? '#ff0' : isPlaying ? '#0ff' : '#f0f',
                boxShadow: isPlaying ? '0 0 10px #0ff' : 'none'
            }} />
            <span>
                {isGenerating ? 'GEN_AUDIO...' : isPlaying ? 'SOUND_ON' : 'SOUND_OFF'}
            </span>
            {error && <span style={{ fontSize: 9, color: '#f55' }}>ERR:{error.slice(0, 10)}</span>}
        </div>
    );
};

export default AlienAmbience;
