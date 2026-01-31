import { useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, Stars } from '@react-three/drei'
import { Leva, useControls, button } from 'leva'
import { Terrain } from './components/Terrain'
import { generateMockBiome } from './utils/mockGenerator'
import type { BiomeData } from './types/biome'

function Scene({ biome }: { biome: BiomeData }) {
  // We use the primitive fogExp2 for realistic distance falloff
  return (
    <>
      <color attach="background" args={[biome.atmosphere.skyColor]} />
      <fogExp2 attach="fog" args={[biome.atmosphere.fogColor, biome.atmosphere.fogDensity]} />

      <ambientLight intensity={0.2} />
      <directionalLight
        position={[50, 50, 25]}
        intensity={biome.atmosphere.sunIntensity}
        castShadow
        shadow-mapSize={[2048, 2048]}
      />

      <Terrain data={biome.terrain} />

      {/* Debug Box to confirm scene renders */}
      <mesh position={[0, 10, 0]}>
        <boxGeometry args={[5, 5, 5]} />
        <meshBasicMaterial color="red" wireframe />
      </mesh>

      <Stars radius={150} depth={50} count={7000} factor={4} saturation={0} fade speed={0.5} />
      <OrbitControls makeDefault minDistance={10} maxDistance={100} />
    </>
  )
}

function App() {
  console.log("App Rendering...");
  // Initial biome
  const [biome, setBiome] = useState<BiomeData>(() => generateMockBiome())

  // Leva controls for quick regeneration
  useControls({
    'Regenerate World': button(() => {
      setBiome(generateMockBiome())
    }),
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
          HEIGHT: {biome.terrain.heightScale.toFixed(1)} | ROUGHNESS: {biome.terrain.roughness.toFixed(2)}
        </div>
      </div>

      <Leva theme={{ colors: { highlight1: '#ff00ff', highlight2: '#00ffff' } }} />

      <Canvas shadows camera={{ position: [0, 30, 60], fov: 45 }}>
        <Scene biome={biome} />
      </Canvas>
    </div>
  )
}

export default App
