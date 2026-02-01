import React, { useMemo, useState, useEffect, useRef } from 'react';
import { useGLTF } from '@react-three/drei';
import type { PropDefinition } from '../types/biome';
import { generate3DModel } from '../services/meshy';
import * as THREE from 'three';

interface MeshyPropProps {
    prop: PropDefinition;
    position: [number, number, number];
    normal: [number, number, number];
    seed: number;
}

// Global cache of original CDN URLs
export const modelCache: Record<string, string> = {};

const getDisplayUrl = (url: string | null) => {
    if (!url) return null;
    if (url.includes('assets.meshy.ai') && import.meta.env.DEV) {
        return url.replace('https://assets.meshy.ai', '/meshy-assets');
    }
    return url;
};

export const MeshyProp: React.FC<MeshyPropProps> = ({ prop, position, normal, seed }) => {
    // Priority: 1. prop.url (loaded from database), 2. modelCache (cached in session)
    const [glbUrl, setGlbUrl] = useState<string | null>(getDisplayUrl(prop.url || modelCache[prop.prompt] || null));
    const [isGenerating, setIsGenerating] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const generationStarted = useRef(false);

    useEffect(() => {
        // 1. Immediate guards
        if (glbUrl || isGenerating || generationStarted.current) return;

        generate3DModel(prop.prompt)
            .then(url => {
                modelCache[prop.prompt] = url;
                setGlbUrl(getDisplayUrl(url));
                setIsGenerating(false);
            })
            .catch(err => {
                console.error(`[MeshyProp] ${prop.name} failed:`, err);
                setError(err.message);
                setIsGenerating(false);
            });
    }, [prop.prompt, glbUrl]);

    // Update glbUrl if the prop or cache changes externally (e.g. after a save)
    useEffect(() => {
        const url = prop.url || modelCache[prop.prompt];
        if (url) {
            const display = getDisplayUrl(url);
            if (display !== glbUrl) {
                setGlbUrl(display);
            }
        }
    }, [prop.url, prop.prompt]);

    return (
        <group position={position}>
            {glbUrl && <PropModel url={glbUrl} scale={prop.baseScale} normal={normal} seed={seed} />}
            {isGenerating && (
                <mesh position={[0, prop.baseScale / 2, 0]}>
                    <sphereGeometry args={[prop.baseScale / 4, 16, 16]} />
                    <meshStandardMaterial color="cyan" emissive="cyan" emissiveIntensity={2} wireframe />
                </mesh>
            )}
            {error && (
                <mesh position={[0, prop.baseScale / 2, 0]}>
                    <boxGeometry args={[0.5, 0.5, 0.5]} />
                    <meshStandardMaterial color="red" />
                </mesh>
            )}
        </group>
    );
};

function PropModel({ url, scale, normal, seed }: { url: string; scale: number; normal: [number, number, number]; seed: number }) {
    const { scene } = useGLTF(url);

    const processedScene = useMemo(() => {
        const s = scene.clone();

        // 1. Calculate Bounding Box to find the base
        const box = new THREE.Box3().setFromObject(s);
        const center = new THREE.Vector3();
        box.getCenter(center);

        // Offset so the lowest point of the model is at local origin (0,0,0)
        // Add a tiny sink (-0.05) to ensure it clips into the ground slightly
        s.position.y -= (box.min.y + 0.05);

        // 2. Wrap in a sub-group so we can rotate the sub-group without affecting position offset
        const pivot = new THREE.Group();
        pivot.add(s);

        // 3. Apply random Y rotation for variety
        const randomY = (Math.sin(seed * 43758.5453123) % 1) * Math.PI * 2;
        pivot.rotation.y = randomY;

        // 4. Align pivot to terrain normal
        const normalVec = new THREE.Vector3(...normal).normalize();
        const up = new THREE.Vector3(0, 1, 0);
        const quaternion = new THREE.Quaternion().setFromUnitVectors(up, normalVec);
        pivot.quaternion.premultiply(quaternion);

        // 5. Setup shadows and disable raycasting (hitbox)
        s.traverse((obj) => {
            if (obj instanceof THREE.Mesh) {
                obj.castShadow = true;
                obj.receiveShadow = true;
                // Disable raycasting so the player doesn't "teleport" on top of the prop
                obj.raycast = () => { };
            }
        });

        return pivot;
    }, [scene, normal, seed]);

    return <primitive object={processedScene} scale={[scale, scale, scale]} />;
}
