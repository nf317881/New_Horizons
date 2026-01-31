import { useRef, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { Stars } from '@react-three/drei'
import { Leva, useControls, button } from 'leva'
import { ChunkManager } from './components/ChunkManager'
import { generateMockBiome } from './utils/mockGenerator'
import type { BiomeData } from './types/biome'
import { PlayerControls } from './components/PlayerControls'
import { Group } from 'three'
import { generateRandomParameters, generateBiomeDescription, generateBiomeData, generateBiomeTexture } from './services/ai'

function Scene({ biome, mode }: { biome: BiomeData, mode: 'fly' | 'walk' }) {
  const terrainRef = useRef<Group>(null);

  // We use the primitive fogExp2 for realistic distance falloff
  return (
    <>
      <color attach="background" args={[biome.atmosphere.skyColor]} />
      {/* Reduced fog density for longer view distance */}
      <fogExp2 attach="fog" args={[biome.atmosphere.fogColor, biome.atmosphere.fogDensity * 0.5]} />

      <ambientLight intensity={0.2} />
      <directionalLight
        position={[50, 50, 25]}
        intensity={biome.atmosphere.sunIntensity}
        castShadow
        shadow-mapSize={[2048, 2048]}
      />

      {/* Dynamic Chunks */}
      <ChunkManager ref={terrainRef} biome={biome} />

      {/* Debug Box to confirm scene renders */}
      <mesh position={[0, 10, 0]}>
        <boxGeometry args={[5, 5, 5]} />
        <meshBasicMaterial color="red" wireframe />
      </mesh>

      <Stars radius={150} depth={50} count={7000} factor={4} saturation={0} fade speed={0.5} />

      {/* Unified Controls for both modes */}
      <PlayerControls mode={mode} terrainMesh={terrainRef} />
    </>
  )
}

function App() {
  console.log("App Rendering...");
  // Initial biome
  const [biome, setBiome] = useState<BiomeData>(() => generateMockBiome())
  const [mode, setMode] = useState<'fly' | 'walk'>('fly')
  const [isGenerating, setIsGenerating] = useState(false);
  const isGeneratingRef = useRef(false);
  const [loadingStep, setLoadingStep] = useState("");

  const handleRegenerate = async () => {
    if (isGeneratingRef.current) return;
    isGeneratingRef.current = true;
    setIsGenerating(true);

    try {
      // 1. Params
      setLoadingStep("Calculating Orbital Parameters...");
      const params = generateRandomParameters();

      // 2. Description (Gemini Pro)
      setLoadingStep("Consulting Xenobiologist (Gemini 3 Pro)...");
      const description = await generateBiomeDescription(params);

      // 3. Data (Gemini Flash)
      setLoadingStep("Simulating Terrain Physics (Gemini 3 Flash)...");
      const newBiomeData = await generateBiomeData(description, params);

      // 4. Texture (Nano Banana)
      setLoadingStep("Synthesizing Nano-Textures...");
      try {
        // We don't want to crash if texture fails, just warn
        const textureUrl = await generateBiomeTexture(description);
        if (textureUrl) {
          newBiomeData.terrain.textureUrl = textureUrl;
        }
      } catch (err) {
        console.warn("Texture gen failed, continuing", err);
      }

      setBiome(newBiomeData);
    } catch (e) {
      console.error(e);
      alert("Failed to generate biome. Check console and API Key.");
    } finally {
      setIsGenerating(false);
      isGeneratingRef.current = false;
      setLoadingStep("");
    }
  };

  // Leva controls for quick regeneration
  useControls({
    'Regenerate World': button(() => {
      handleRegenerate();
    }),
    'Mode': {
      options: { 'Fly Mode': 'fly', 'Walk Mode': 'walk' },
      onChange: (v: string) => setMode(v as 'fly' | 'walk')
    }
  })

  return (
    <div style={{ width: '100vw', height: '100vh', background: '#000' }}>
      {/* UI Overlay */}
      <div style={{
        position: 'absolute',
        top: 20,
        left: 20,
        zIndex: 10,
        color: 'white',
        fontFamily: "'Courier New', Courier, monospace",
        pointerEvents: 'none',
        textShadow: '0px 0px 4px rgba(0,0,0,0.8)'
      }}>
        <h1 style={{ margin: 0, textTransform: 'uppercase', fontSize: '2rem' }}>VIBECODE // {biome.name}</h1>
        <p style={{ margin: '0.5rem 0', opacity: 0.8, maxWidth: '400px' }}>{biome.description}</p>
        <div style={{ marginTop: '1rem', fontSize: '0.8rem', opacity: 0.6 }}>
          LAYERS: {biome.terrain.layers.length} | GRAVITY: {biome.parameters.gravity}G
        </div>
      </div>

      {/* Loading Overlay */}
      {isGenerating && (
        <div style={{
          position: 'absolute',
          top: 0, left: 0, width: '100%', height: '100%',
          background: 'rgba(0,0,0,0.8)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100,
          color: '#00ffff',
          fontFamily: "'Courier New', Courier, monospace",
        }}>
          <h2 style={{ textTransform: 'uppercase', letterSpacing: '2px' }}>Generating New World</h2>
          <p>{loadingStep}</p>
        </div>
      )}

      <Leva theme={{ colors: { highlight1: '#ff00ff', highlight2: '#00ffff' } }} />

      <Canvas shadows camera={{ position: [0, 5, 10], fov: 60 }}>
        <Scene biome={biome} mode={mode} />
      </Canvas>
    </div>
  )
}

export default App

