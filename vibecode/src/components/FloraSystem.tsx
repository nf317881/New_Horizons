import React, { useRef, useLayoutEffect, useMemo } from 'react';
import * as THREE from 'three';
import type { NoiseFunction2D } from 'simplex-noise';
import type { BiomeData, BiomeParameters } from '../types/biome';
import { getTerrainHeight } from '../utils/terrainUtils';

interface FloraSystemProps {
    terrainData: BiomeData['terrain'];
    parameters: BiomeParameters;
    noise2D: NoiseFunction2D;
    chunkX?: number;
    chunkZ?: number;
}

const COUNT = 1000;
const tempObject = new THREE.Object3D();
const tempColor = new THREE.Color();

export const FloraSystem: React.FC<FloraSystemProps> = ({ terrainData, parameters, noise2D, chunkX = 0, chunkZ = 0 }) => {
    const meshRef1 = useRef<THREE.InstancedMesh>(null);
    const meshRef2 = useRef<THREE.InstancedMesh>(null);
    const meshRef3 = useRef<THREE.InstancedMesh>(null);

    // Geometries
    const geometries = useMemo(() => {
        // 1. Generic Tree/Tall Plant (Cone)
        const treeGeo = new THREE.ConeGeometry(0.4, 1, 6);
        treeGeo.translate(0, 0.5, 0); // Anchor base at 0

        // 2. Spikes/Grass (Cylinder tapered)
        // Cylinder(radiusTop, radiusBottom, height...)
        const spikeGeo = new THREE.CylinderGeometry(0.0, 0.05, 1, 4);
        spikeGeo.translate(0, 0.5, 0); // Anchor base at 0

        // 3. Bush/Rock-like (Dodecahedron)
        const bushGeo = new THREE.DodecahedronGeometry(0.4, 0);
        bushGeo.translate(0, 0.4, 0); // Anchor base roughly at 0

        return {
            main: treeGeo,
            spikes: spikeGeo,
            ground: bushGeo
        };
    }, []);

    useLayoutEffect(() => {
        if (!meshRef1.current || !meshRef2.current || !meshRef3.current) return;

        meshRef1.current.count = 0;
        meshRef2.current.count = 0;
        meshRef3.current.count = 0;

        let idx1 = 0;
        let idx2 = 0;
        let idx3 = 0;

        const size = 100;
        const noiseOffsetX = chunkX * size;
        const noiseOffsetY = chunkZ * size;

        let densityVal = 0.5;
        if (parameters.atmosphereDensity === 'Thick') densityVal = 0.9;
        if (parameters.atmosphereDensity === 'Thin') densityVal = 0.1;

        const gravityEffect = THREE.MathUtils.clamp(parameters.gravity, 0.5, 2.0);
        const tempEffect = THREE.MathUtils.clamp(parameters.temperature, -50, 100);

        const coldColor = new THREE.Color('#2a4b55');
        const hotColor = new THREE.Color('#d15e38');
        const lushColor = new THREE.Color('#4caf50');

        const tempNorm = (tempEffect + 50) / 150;
        const baseFloraColor = new THREE.Color().lerpColors(coldColor, hotColor, tempNorm);
        baseFloraColor.lerp(lushColor, densityVal * 0.5);

        for (let i = 0; i < COUNT; i++) {
            const rX = Math.random() * size - size / 2;
            const rZ = Math.random() * size - size / 2;

            // Global Coordinates for Noise
            const globalX = noiseOffsetX + rX;
            // CORRECTED: Terrain uses (noiseOffsetY - localY). LocalY maps to -WorldZ.
            // So globalY = noiseOffsetY - (-rZ) = noiseOffsetY + rZ.
            const globalY = noiseOffsetY + rZ;

            // Get Height
            const y = getTerrainHeight(globalX, globalY, terrainData.layers, noise2D);

            // Slope Calculation
            const d = 0.5;
            const hL = getTerrainHeight(globalX - d, globalY, terrainData.layers, noise2D);
            const hR = getTerrainHeight(globalX + d, globalY, terrainData.layers, noise2D);
            const hD = getTerrainHeight(globalX, globalY - d, terrainData.layers, noise2D);
            const hU = getTerrainHeight(globalX, globalY + d, terrainData.layers, noise2D);

            const v1 = new THREE.Vector3(2 * d, hR - hL, 0);
            const v2 = new THREE.Vector3(0, hU - hD, -2 * d);
            const normal = new THREE.Vector3().crossVectors(v2, v1).normalize();

            // Filter
            if (y < terrainData.waterLevel - 1) continue;

            // --- MORPHOLOGY ---
            const rand = Math.random();
            let targetMesh: THREE.InstancedMesh | null = meshRef1.current;
            let currentIndex = idx1;

            // Decision Logic
            if (tempNorm < 0.3 && rand > 0.4) {
                targetMesh = meshRef2.current; // Spikes (Cold)
                currentIndex = idx2;
            } else if (tempNorm > 0.7 && rand > 0.4) {
                targetMesh = meshRef3.current; // Bushes (Hot/Dry)
                currentIndex = idx3;
            } else {
                targetMesh = meshRef1.current; // Trees (Moderate)
                currentIndex = idx1;
            }

            if (currentIndex >= COUNT) continue;

            // SCALE
            const gFactor = 1.0 / gravityEffect;
            const varScale = 0.8 + Math.random() * 1.5;

            // Base scale
            tempObject.scale.set(varScale, varScale, varScale);

            // Morphology Mods
            // High Gravity -> Squat
            if (gravityEffect > 1.2) {
                tempObject.scale.y *= 0.5;
                tempObject.scale.x *= 1.5;
                tempObject.scale.z *= 1.5;
            } else if (gravityEffect < 0.8) {
                // Low Gravity -> Tall/Thin
                tempObject.scale.y *= 2.0;
                tempObject.scale.x *= 0.7;
                tempObject.scale.z *= 0.7;
            }

            // Apply Overall Parameter Scaling
            if (targetMesh === meshRef1.current) {
                tempObject.scale.multiplyScalar(1.5 * gFactor);
            }

            // ROTATION/POSITION
            // Position: (rX, -rZ, y) in Local Group Space puts it at World (rX, y, rZ).
            tempObject.position.set(rX, -rZ, y);

            // Alignment
            const localNormal = new THREE.Vector3(normal.x, -normal.z, normal.y);
            const localWorldUp = new THREE.Vector3(0, 0, 1);

            const alignMix = (gravityEffect - 0.5) / 1.5;
            const targetUp = new THREE.Vector3().copy(localWorldUp).lerp(localNormal, alignMix).normalize();

            // Default object up is +Y
            tempObject.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), targetUp);

            // Random Yaw
            const randomYaw = new THREE.Quaternion().setFromAxisAngle(targetUp, Math.random() * Math.PI * 2);
            tempObject.quaternion.multiply(randomYaw);

            tempObject.updateMatrix();
            targetMesh.setMatrixAt(currentIndex, tempObject.matrix);

            // COLOR
            const hueShift = (Math.random() - 0.5) * 0.1;
            tempColor.copy(baseFloraColor).offsetHSL(hueShift, 0, 0);

            if (targetMesh === meshRef2.current) {
                tempColor.multiplyScalar(0.7);
            } else if (targetMesh === meshRef3.current) {
                tempColor.offsetHSL(0.05, 0, 0);
            }

            if (densityVal > 0.8) {
                tempColor.addScalar(0.2);
            }

            targetMesh.setColorAt(currentIndex, tempColor);

            // Increment
            if (targetMesh === meshRef1.current) idx1++;
            else if (targetMesh === meshRef2.current) idx2++;
            else idx3++;
        }

        meshRef1.current.count = idx1;
        meshRef2.current.count = idx2;
        meshRef3.current.count = idx3;

        meshRef1.current.instanceMatrix.needsUpdate = true;
        meshRef2.current.instanceMatrix.needsUpdate = true;
        meshRef3.current.instanceMatrix.needsUpdate = true;
        if (meshRef1.current.instanceColor) meshRef1.current.instanceColor.needsUpdate = true;
        if (meshRef2.current.instanceColor) meshRef2.current.instanceColor.needsUpdate = true;
        if (meshRef3.current.instanceColor) meshRef3.current.instanceColor.needsUpdate = true;

    }, [terrainData, parameters, chunkX, chunkZ, noise2D]);

    return (
        <group rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
            <instancedMesh ref={meshRef1} args={[geometries.main, undefined, COUNT]} castShadow receiveShadow>
                <meshStandardMaterial vertexColors roughness={0.8} />
            </instancedMesh>
            <instancedMesh ref={meshRef2} args={[geometries.spikes, undefined, COUNT]} castShadow receiveShadow>
                <meshStandardMaterial vertexColors roughness={0.6} metalness={0.1} />
            </instancedMesh>
            <instancedMesh ref={meshRef3} args={[geometries.ground, undefined, COUNT]} castShadow receiveShadow>
                <meshStandardMaterial vertexColors roughness={0.9} />
            </instancedMesh>

        </group>
    );
};
