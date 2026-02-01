import React, { useRef, useState, useEffect, useMemo } from 'react'
import { Canvas, useThree, useFrame } from '@react-three/fiber'
import { Stars, useTexture } from '@react-three/drei'
import { Leva, useControls, button, folder } from 'leva'
import { ChunkManager } from './components/ChunkManager'
import AlienAmbience from './components/AlienAmbience'
import { generateMockBiome } from './utils/mockGenerator'
import type { BiomeData } from './types/biome'
import { PlayerControls } from './components/PlayerControls'
import { Group } from 'three'
import * as THREE from 'three'
import { generateRandomParameters, generateBiomeDescription, generateBiomeData, generateBiomeTexture, generateSkyboxTexture } from './services/ai'
import { Weather } from './components/Weather'
import { GalaxyGallery } from './components/GalaxyGallery'
import { saveBiomeToGallery, type SavedBiome } from './services/gallery'
import { uploadTextureFromUrl, uploadAudio } from './services/ThreeDStorage'
import { getStoredV13Audio } from './services/elevenLabsV13'
import { createNoise2D } from 'simplex-noise'


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

function DynamicFog({ biome, weatherActive }: { biome: BiomeData, weatherActive: boolean }) {
  const { scene } = useThree();
  const fogDensityRef = useRef(biome.atmosphere.fogDensity);

  useFrame((_, delta) => {
    if (scene.fog && scene.fog instanceof THREE.FogExp2) {
      // Base fog is reduced if we have a skybox to see the sky better
      const baseMult = biome.atmosphere.skyboxUrl ? 0.3 : 0.8;
      // Weather significantly increases fog density
      const weatherMult = weatherActive ? (1.0 + biome.weather.intensity) : 1.0;

      const targetDensity = biome.atmosphere.fogDensity * baseMult * weatherMult;

      // Smooth lerp
      fogDensityRef.current = THREE.MathUtils.lerp(fogDensityRef.current, targetDensity, delta * 0.5);
      scene.fog.density = fogDensityRef.current;
    }
  });

  return null;
}

function Scene({ biome, mode, onToggleMode, weatherActive, noise2D }: {
  biome: BiomeData,
  mode: 'fly' | 'walk',
  onToggleMode: () => void,
  weatherActive: boolean,
  noise2D: any
}) {
  const terrainRef = useRef<Group>(null);
  const lightRef = useRef<THREE.DirectionalLight>(null);
  const { camera } = useThree();

  useFrame(() => {
    if (lightRef.current) {
      // Keep light offset from camera
      lightRef.current.position.set(
        camera.position.x + 40,
        camera.position.y + 60,
        camera.position.z + 20
      );
      // Target the area in front of the camera
      lightRef.current.target.position.set(camera.position.x, 0, camera.position.z);
      lightRef.current.target.updateMatrixWorld();
    }
  });

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

      {/* Fog - dynamic density based on weather */}
      <fogExp2 attach="fog" args={[biome.atmosphere.fogColor, biome.atmosphere.fogDensity]} />
      <DynamicFog biome={biome} weatherActive={weatherActive} />

      <ambientLight intensity={0.5} />
      <directionalLight
        ref={lightRef}
        intensity={biome.atmosphere.sunIntensity}
        castShadow
        shadow-bias={-0.0005}
        shadow-mapSize={[2048, 2048]}
      >
        <orthographicCamera attach="shadow-camera" args={[-100, 100, 100, -100, 0.5, 500]} />
      </directionalLight>

      {/* Dynamic Chunks */}
      <ChunkManager ref={terrainRef} biome={biome} noise2D={noise2D} />

      {/* Unified Controls for both modes */}
      <PlayerControls
        mode={mode}
        onToggleMode={onToggleMode}
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
  const noise2D = useMemo(() => createNoise2D(), [biome.id]);
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
      const newBiomeData = await generateBiomeData(detailedDesc, params);

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

  const handleSaveCurrent = async () => {
    setIsGenerating(true);
    setLoadingStep("Archiving Planetary Data...");
    try {
      const assets = {
        skyboxUrl: "",
        groundTextureUrl: "",
        audioUrl: "",
        models: []
      };

      // 1. Upload Skybox
      if (biome.atmosphere.skyboxUrl) {
        setLoadingStep("Uploading Sky Data...");
        assets.skyboxUrl = await uploadTextureFromUrl(biome.atmosphere.skyboxUrl, biome.id || "unknown_biome", "skybox");
      }

      // 2. Upload Terrain Texture
      if (biome.terrain.textureUrl) {
        setLoadingStep("Uploading Surface Scans...");
        assets.groundTextureUrl = await uploadTextureFromUrl(biome.terrain.textureUrl, biome.id || "unknown_biome", "ground");
      }

      // 3. Upload Audio
      setLoadingStep("Encoding Ambient Frequency...");
      const audioBase64 = await getStoredV13Audio(biome.musicPrompt || "");
      if (audioBase64) {
        assets.audioUrl = await uploadAudio(audioBase64, biome.id || "unknown_biome");
      }

      // 4. Save Metadata
      setLoadingStep("Finalizing Database Entry...");
      await saveBiomeToGallery(biome, assets);
      alert("System Saved to Interplanetary Database.");

    } catch (e: any) {
      console.error("Save failed", e);
      alert("Save Failed: " + (e.message || e));
    } finally {
      setIsGenerating(false);
      setLoadingStep("");
    }
  };

  const handleLoadBiome = (b: SavedBiome) => {
    // Reconstruct the full biome object with asset URLs overriding the ephemeral ones
    const loadedBiome: BiomeData = {
      ...b,
      terrain: {
        ...b.terrain,
        textureUrl: b.assets.groundTextureUrl || b.terrain.textureUrl
      },
      atmosphere: {
        ...b.atmosphere,
        skyboxUrl: b.assets.skyboxUrl || b.atmosphere.skyboxUrl
      }
    };

    // Attach the direct audio URL to the biome object (breaking type safety slightly or we update type)
    (loadedBiome as any).audioOverrideUrl = b.assets.audioUrl;

    setBiome(loadedBiome);
  };

  // Leva controls for quick regeneration
  const [{ mode }, set] = useControls(() => ({
    'Regenerate World': button(() => {
      handleRegenerate();
    }),
    'mode': {
      options: { 'Fly Mode': 'fly', 'Walk Mode': 'walk' },
      value: 'fly',
    },
    'Gravity': {
      value: biome.parameters.gravity,
      min: 0.1,
      max: 3.0,
      onChange: (v: number) => {
        setBiome(prev => ({
          ...prev,
          parameters: { ...prev.parameters, gravity: v }
        }));
      }
    },
    'Weather System': {
      label: 'Auto Weather',
      value: weatherEnabled,
      onChange: (v: boolean) => setWeatherEnabled(v)
    },
    'Terrain Controls': folder({
      'Base Color': {
        value: biome.terrain.baseColor,
        onChange: (v: string) => {
          setBiome(prev => ({
            ...prev,
            terrain: { ...prev.terrain, baseColor: v }
          }));
        }
      },
      'High Color': {
        value: biome.terrain.highColor,
        onChange: (v: string) => {
          setBiome(prev => ({
            ...prev,
            terrain: { ...prev.terrain, highColor: v }
          }));
        }
      },
      'Layers': folder(
        biome.terrain.layers.reduce((acc, layer, index) => {
          const noiseScaleKey = `layer_${index}_noiseScale`;
          const heightScaleKey = `layer_${index}_heightScale`;
          const roughnessKey = `layer_${index}_roughness`;

          acc[layer.name || `Layer ${index + 1}`] = folder({
            [noiseScaleKey]: {
              label: 'Noise Scale',
              value: layer.noiseScale,
              min: 0.001,
              max: 0.2,
              step: 0.001,
              onChange: (v: number) => {
                setBiome(prev => {
                  const nextLayers = [...prev.terrain.layers];
                  if (nextLayers[index]) {
                    nextLayers[index] = { ...nextLayers[index], noiseScale: v };
                  }
                  return { ...prev, terrain: { ...prev.terrain, layers: nextLayers } };
                });
              }
            },
            [heightScaleKey]: {
              label: 'Height Scale',
              value: layer.heightScale,
              min: 0,
              max: 100,
              step: 0.5,
              onChange: (v: number) => {
                setBiome(prev => {
                  const nextLayers = [...prev.terrain.layers];
                  if (nextLayers[index]) {
                    nextLayers[index] = { ...nextLayers[index], heightScale: v };
                  }
                  return { ...prev, terrain: { ...prev.terrain, layers: nextLayers } };
                });
              }
            },
            [roughnessKey]: {
              label: 'Roughness',
              value: layer.roughness,
              min: 0,
              max: 5,
              step: 0.1,
              onChange: (v: number) => {
                setBiome(prev => {
                  const nextLayers = [...prev.terrain.layers];
                  if (nextLayers[index]) {
                    nextLayers[index] = { ...nextLayers[index], roughness: v };
                  }
                  return { ...prev, terrain: { ...prev.terrain, layers: nextLayers } };
                });
              }
            }
          }, { collapsed: true });
          return acc;
        }, {} as any),
        { collapsed: true }
      )
    }, { collapsed: true }),
    'Prop Controls': folder(
      biome.props.reduce((acc, prop, index) => {
        // Use a unique key for each input but keep the visible label simple
        const densityKey = `prop_${index}_density`;
        const scaleKey = `prop_${index}_scale`;

        acc[prop.name] = folder({
          [densityKey]: {
            label: 'Density',
            value: prop.density,
            min: 0,
            max: 0.5,
            step: 0.01,
            onChange: (v: number) => {
              setBiome(prev => {
                const nextProps = [...prev.props];
                if (nextProps[index]) {
                  nextProps[index] = { ...nextProps[index], density: v };
                }
                return { ...prev, props: nextProps };
              });
            }
          },
          [scaleKey]: {
            label: 'Scale',
            value: prop.baseScale,
            min: 0.5,
            max: 15,
            step: 0.1,
            onChange: (v: number) => {
              setBiome(prev => {
                const nextProps = [...prev.props];
                if (nextProps[index]) {
                  nextProps[index] = { ...nextProps[index], baseScale: v };
                }
                return { ...prev, props: nextProps };
              });
            }
          }
        }, { collapsed: true });
        return acc;
      }, {} as any),
      { collapsed: true }
    )
  }), [biome.id, weatherEnabled]) as any;

  const toggleMode = React.useCallback(() => {
    set({ mode: mode === 'fly' ? 'walk' : 'fly' });
  }, [mode, set]);



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
        <div
          onMouseDown={e => e.stopPropagation()}
          onPointerDown={e => e.stopPropagation()}
          onMouseUp={e => e.stopPropagation()}
          onClick={e => e.stopPropagation()}
          style={{
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
            pointerEvents: 'auto',
          }}>
          <h2 style={{ textTransform: 'uppercase', letterSpacing: '2px' }}>Generating New World</h2>
          <p>{loadingStep}</p>
        </div>
      )}

      <div
        onMouseDown={e => e.stopPropagation()}
        onPointerDown={e => e.stopPropagation()}
        onMouseUp={e => e.stopPropagation()}
        onPointerUp={e => e.stopPropagation()}
        onClick={e => e.stopPropagation()}
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          zIndex: 1000,
          pointerEvents: 'auto'
        }}
      >
        <Leva theme={{ colors: { highlight1: '#ff00ff', highlight2: '#00ffff' } }} />
      </div>

      <Canvas shadows camera={{ position: [0, 5, 10], fov: 60 }} onPointerDown={(e) => {
        if (e.target === e.currentTarget) {
          (e.target as HTMLCanvasElement).requestPointerLock();
        }
      }}>
        <Scene
          biome={biome}
          mode={mode}
          onToggleMode={toggleMode}
          weatherActive={weatherActive}
          noise2D={noise2D}
        />
      </Canvas>

      <AlienAmbience biome={biome} audioOverrideUrl={(biome as any).audioOverrideUrl} />

      <GalaxyGallery onLoadBiome={handleLoadBiome} onSaveCurrent={handleSaveCurrent} />
    </div>
  )
}



export default App;
