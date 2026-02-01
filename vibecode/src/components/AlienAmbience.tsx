import React, { useEffect, useRef, useState } from 'react';
import { getAlienAmbienceV9 } from '../services/elevenLabsV9';
import type { BiomeData } from '../types/biome';

/**
 * AlienAmbience - Version 6
 * Renamed to force browser to dump stale 'BackgroundMusic' cache.
 */
const AlienAmbience: React.FC<{ biome: BiomeData }> = ({ biome }) => {
    console.log("AlienAmbience(V9): Rendering for", biome?.name);

    const audioRef = useRef<HTMLAudioElement | null>(null);
    const [audioUrl, setAudioUrl] = useState<string | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const initRef = useRef(false);

    useEffect(() => {
        if (initRef.current) return;
        initRef.current = true;

        console.log("AlienAmbience(V9): Component Mounted");

        const load = async () => {
            try {
                setIsGenerating(true);
                const prompt = biome.musicPrompt || "Deep space ambient drone, alien atmosphere, mysterious synthesizers, instrumental";
                console.log("AlienAmbience(V9): Requesting V9 Ambience...");
                const url = await getAlienAmbienceV9(prompt);
                console.log("AlienAmbience(V9): Audio URL ready:", url);
                setAudioUrl(url);
            } catch (err: any) {
                console.error("AlienAmbience(V9) Failure:", err);
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
                console.warn("AlienAmbience(V9): Autoplay blocked:", e);
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
