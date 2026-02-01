import React, { useRef, useState, useEffect } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { Stars, useTexture } from '@react-three/drei'
import { Leva, useControls, button } from 'leva'
import { ChunkManager } from './components/ChunkManager'
import { generateMockBiome } from './utils/mockGenerator'
import type { BiomeData } from './types/biome'
import { PlayerControls } from './components/PlayerControls'
import { Group } from 'three'
import * as THREE from 'three'
import { generateRandomParameters, generateBiomeDescription, generateBiomeData, generateBiomeTexture, generateSkyboxTexture } from './services/ai'
import { Weather } from './components/Weather'

function Skybox({ url }: { url: string }) {
  const { scene } = useThree();
  const texture = useTexture(url);

  useEffect(() => {
    // Apply texture to background
    const oldBg = scene.background;
    texture.mapping = THREE.EquirectangularReflectionMapping;
    scene.background = texture;

    return () => {
      scene.background = oldBg;
    }
  }, [texture, scene]);

  return null; // The texture is applied to the scene background, no mesh needed if we assume it's a skybox
}

function Scene({ biome, mode, setMode, weatherActive }: {
  biome: BiomeData,
  mode: 'fly' | 'walk',
  setMode: React.Dispatch<React.SetStateAction<'fly' | 'walk'>>,
  weatherActive: boolean
}) {
  const terrainRef = useRef<Group>(null);

  return (
    <>
      {/* Weather System */}
      <Weather params={biome.weather} active={weatherActive} />

      {/* Fallback Stars if no skybox */}
      {!biome.atmosphere.skyboxUrl && (
        <>
          <color attach="background" args={[biome.atmosphere.skyColor]} />
          <Stars radius={150} depth={50} count={7000} factor={4} saturation={0} fade speed={0.5} />
        </>
      )}

      {/* Skybox if URL exists */}
      {biome.atmosphere.skyboxUrl && (
        <React.Suspense fallback={<Stars radius={150} depth={50} count={7000} factor={4} saturation={0} fade speed={0.5} />}>
          <Skybox url={biome.atmosphere.skyboxUrl} />
        </React.Suspense>
      )}

      {/* Fog - reduce density if we have a skybox to see it? */}
      <fogExp2 attach="fog" args={[biome.atmosphere.fogColor, biome.atmosphere.fogDensity * (biome.atmosphere.skyboxUrl ? 0.2 : 0.5)]} />

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

      {/* Unified Controls for both modes */}
      <PlayerControls
        mode={mode}
        onToggleMode={() => setMode(prev => prev === 'fly' ? 'walk' : 'fly')}
        gravityMult={biome.parameters.gravity}
        terrainMesh={terrainRef}
      />
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

  // Weather dynamics
  const [weatherEnabled, setWeatherEnabled] = useState(true);
  const [weatherActive, setWeatherActive] = useState(false);

  useEffect(() => {
    if (!weatherEnabled) {
      setWeatherActive(false);
      return;
    }

    const toggleWeather = () => {
      setWeatherActive(prev => !prev);
      const nextToggle = Math.random() * 20000 + 10000;
      return window.setTimeout(() => {
        if (isGeneratingRef.current) return; // Don't toggle during gen
        toggleWeather();
      }, nextToggle);
    };

    const timer = toggleWeather();
    return () => clearTimeout(timer);
  }, [weatherEnabled]);

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
      // 2. Description (Gemini Pro)
      setLoadingStep("Consulting Xenobiologist (Gemini 3 Pro)...");
      const detailedDesc = await generateBiomeDescription(params);

      // Update params with detailed info
      params.description = detailedDesc.summary;
      params.groundDescription = detailedDesc.ground;
      params.skyDescription = detailedDesc.sky;

      // 3. Data (Gemini Flash)
      setLoadingStep("Simulating Terrain Physics (Gemini 3 Flash)...");
      const newBiomeData = await generateBiomeData(detailedDesc.summary, params);

      // 4. Texture (Flux)
      setLoadingStep("Synthesizing Nano-Textures...");
      try {
        const textureUrl = await generateBiomeTexture(detailedDesc.ground || detailedDesc.summary);
        if (textureUrl) {
          newBiomeData.terrain.textureUrl = textureUrl;
        }
      } catch (err) {
        console.warn("Texture gen failed, continuing", err);
      }

      // 5. Skybox (Flux)
      setLoadingStep("Painting The Heavens...");
      try {
        const skyUrl = await generateSkyboxTexture(detailedDesc.sky || detailedDesc.summary);
        if (skyUrl) {
          newBiomeData.atmosphere.skyboxUrl = skyUrl;
        }
      } catch (err) {
        console.warn("Skybox gen failed", err);
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
  const [, setLeva] = useControls(() => ({
    'Regenerate World': button(() => {
      handleRegenerate();
    }),
    'Mode': {
      options: { 'Fly Mode': 'fly', 'Walk Mode': 'walk' },
      value: mode,
      onChange: (v: string) => setMode(v as 'fly' | 'walk')
    },
    'Weather System': {
      label: 'Auto Weather',
      value: weatherEnabled,
      onChange: (v: boolean) => setWeatherEnabled(v)
    }
  }));

  // Sync state -> Leva UI
  useEffect(() => {
    setLeva({ 'Mode': mode, 'Weather System': weatherEnabled });
  }, [mode, weatherEnabled, setLeva]);

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
        <h1 style={{ margin: 0, textTransform: 'uppercase', fontSize: '2rem' }}>{biome.name}</h1>
        <p style={{ margin: '0.5rem 0', opacity: 0.8, maxWidth: '400px' }}>{biome.description}</p>
        <div style={{ marginTop: '1rem', fontSize: '0.8rem', opacity: 0.6 }}>
          LAYERS: {biome.terrain.layers.length} | GRAVITY: {biome.parameters.gravity}G | WEATHER: {weatherActive ? (biome.weather.type.toUpperCase()) : "CLEAR"}
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

      <div onPointerDown={e => e.stopPropagation()} onMouseDown={e => e.stopPropagation()}>
        <Leva theme={{ colors: { highlight1: '#ff00ff', highlight2: '#00ffff' } }} />
      </div>

      <Canvas shadows camera={{ position: [0, 5, 10], fov: 60 }}>
        <Scene biome={biome} mode={mode} setMode={setMode} weatherActive={weatherActive} />
      </Canvas>
    </div>
  )
}

export default App

