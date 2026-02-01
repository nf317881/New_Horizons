import { useMemo, forwardRef, Suspense } from 'react';
import * as THREE from 'three';
import { useTexture } from '@react-three/drei';
import type { BiomeData } from '../types/biome';
import type { NoiseFunction2D } from 'simplex-noise';
import { getTerrainHeight } from '../utils/terrainUtils';

interface TerrainProps {
    data: BiomeData['terrain'] & { textureUrl?: string };
    chunkX?: number;
    chunkZ?: number;
    noise2D: NoiseFunction2D;
}



// Component that safely wraps the material to avoid hook rules issues if we were to toggle URL on/off dynamically in same instance without remount
const MaterialWrapper = ({ data }: { data: TerrainProps['data'] }) => {
    if (data.textureUrl) {
        return (
            <Suspense fallback={<meshStandardMaterial wireframe color="gray" />}>
                <TerrainMaterialWithTexture url={data.textureUrl} />
            </Suspense>
        )
    }
    return <meshStandardMaterial vertexColors roughness={0.8} metalness={0.2} side={THREE.DoubleSide} />;
}

const TerrainMaterialWithTexture = ({ url }: { url: string }) => {
    const texture = useTexture(url);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;

    // Scale for triplanar mapping (repeats per world unit)
    const triplanarScale = 0.08;

    const onBeforeCompile = (shader: any) => {
        shader.uniforms.triplanarScale = { value: triplanarScale };

        shader.vertexShader = `
            varying vec3 vWorldPos;
            varying vec3 vWorldNormal;
            ${shader.vertexShader}
        `.replace(
            '#include <worldpos_vertex>',
            `#include <worldpos_vertex>
            vWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
            vWorldNormal = normalize(modelMatrix * vec4(normal, 0.0)).xyz;`
        );

        shader.fragmentShader = `
            varying vec3 vWorldPos;
            varying vec3 vWorldNormal;
            uniform float triplanarScale;
            ${shader.fragmentShader}
        `.replace(
            '#include <map_fragment>',
            `
            vec3 blending = abs(vWorldNormal);
            blending /= (blending.x + blending.y + blending.z);
            
            vec2 xUV = vWorldPos.yz * triplanarScale;
            vec2 yUV = vWorldPos.xz * triplanarScale;
            vec2 zUV = vWorldPos.xy * triplanarScale;

            vec4 xColor = texture2D(map, xUV);
            vec4 yColor = texture2D(map, yUV);
            vec4 zColor = texture2D(map, zUV);

            diffuseColor *= xColor * blending.x + yColor * blending.y + zColor * blending.z;
            `
        );
    };

    return (
        <meshStandardMaterial
            map={texture}
            onBeforeCompile={onBeforeCompile}
            roughness={0.8}
            metalness={0.2}
            side={THREE.DoubleSide}
        />
    );
}

export const Terrain = forwardRef<THREE.Mesh, TerrainProps>(({ data, chunkX = 0, chunkZ = 0, noise2D }, ref) => {

    const geometry = useMemo(() => {
        const size = 100;
        const segments = 64;
        const geo = new THREE.PlaneGeometry(size, size, segments, segments);
        const posAttribute = geo.attributes.position;
        const count = posAttribute.count;

        const colors = new Float32Array(count * 3);
        const colorBase = new THREE.Color(data.baseColor);
        const colorHigh = new THREE.Color(data.highColor);

        // Calculate World Offset for Noise
        const noiseOffsetX = chunkX * size;
        const noiseOffsetY = chunkZ * size;

        for (let i = 0; i < count; i++) {
            const localX = posAttribute.getX(i);
            const localY = posAttribute.getY(i);

            const globalX = noiseOffsetX + localX;
            // Plane was rotated -90deg on X.
            // +LocalY points to World -Z.
            const globalY = noiseOffsetY - localY;

            // --- Multi-Layer Noise Calculation ---
            let totalNoise = 0;

            if (data.layers && data.layers.length > 0) {
                for (const layer of data.layers) {
                    let n = noise2D(
                        (globalX + layer.offsetX) * layer.noiseScale,
                        (globalY + layer.offsetZ) * layer.noiseScale
                    );

                    if (layer.roughness > 0) {
                        n += 0.5 * layer.roughness * noise2D(
                            (globalX + layer.offsetX) * layer.noiseScale * 2,
                            (globalY + layer.offsetZ) * layer.noiseScale * 2
                        );
                    }

                    totalNoise += n * layer.heightScale;
                }
            } else {
                totalNoise = noise2D(globalX * 0.02, globalY * 0.02) * 5;
            }

            // Apply Height
            posAttribute.setZ(i, totalNoise);

            // Color
            const alpha = (totalNoise / 20 + 0.5);
            const clampedAlpha = Math.max(0, Math.min(1, alpha));

            const r = THREE.MathUtils.lerp(colorBase.r, colorHigh.r, clampedAlpha);
            const g = THREE.MathUtils.lerp(colorBase.g, colorHigh.g, clampedAlpha);
            const b = THREE.MathUtils.lerp(colorBase.b, colorHigh.b, clampedAlpha);

            colors[i * 3] = r;
            colors[i * 3 + 1] = g;
            colors[i * 3 + 2] = b;
        }

        geo.computeVertexNormals();
        geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

        return geo;
    }, [data, noise2D, chunkX, chunkZ]);

    return (
        <mesh ref={ref} geometry={geometry} rotation={[-Math.PI / 2, 0, 0]} receiveShadow castShadow>
            <MaterialWrapper data={data} />
        </mesh>
    );
});
