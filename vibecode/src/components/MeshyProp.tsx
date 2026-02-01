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

// Global cache to avoid re-generating the same prompt in the same session
const modelCache: Record<string, string> = {};

export const MeshyProp: React.FC<MeshyPropProps> = ({ prop, position, normal, seed }) => {
    const [glbUrl, setGlbUrl] = useState<string | null>(modelCache[prop.prompt] || null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const generationStarted = useRef(false);

    useEffect(() => {
        if (glbUrl || isGenerating || generationStarted.current) return;

        console.log(`MeshyProp: Starting generation for [${prop.name}]`);
        generationStarted.current = true;
        setIsGenerating(true);

        generate3DModel(prop.prompt)
            .then(url => {
                // Apply Vite CORS proxy
                const proxiedUrl = url.replace('https://assets.meshy.ai', '/meshy-assets');
                modelCache[prop.prompt] = proxiedUrl;
                setGlbUrl(proxiedUrl);
                setIsGenerating(false);
            })
            .catch(err => {
                console.error(`MeshyProp [${prop.name}] Error:`, err);
                setError(err.message);
                setIsGenerating(false);
            });
    }, [prop.prompt, glbUrl, isGenerating]);

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
