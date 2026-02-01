import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { fetchGalleryBiomes, type SavedBiome } from '../services/gallery';

interface GalaxyGalleryProps {
    onLoadBiome: (biome: SavedBiome) => void;
    onSaveCurrent: () => void;
}

export const GalaxyGallery: React.FC<GalaxyGalleryProps> = ({ onLoadBiome, onSaveCurrent }) => {
    const { isOwner, verifyPasscode, user } = useAuth();
    const [isOpen, setIsOpen] = useState(false);
    const [biomes, setBiomes] = useState<SavedBiome[]>([]);
    const [loading, setLoading] = useState(false);

    // Auth State
    const [showAuth, setShowAuth] = useState(false);
    const [passcode, setPasscode] = useState("");
    const [authError, setAuthError] = useState("");

    // Fetch biomes when opening gallery
    useEffect(() => {
        if (isOpen) {
            setLoading(true);
            fetchGalleryBiomes()
                .then(data => setBiomes(data))
                .catch(err => console.error("Failed to fetch gallery:", err))
                .finally(() => setLoading(false));
        }
    }, [isOpen]);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setAuthError("");
        const success = await verifyPasscode(passcode);
        if (success) {
            setShowAuth(false);
            setPasscode("");
        } else {
            setAuthError("Authorization Failed");
        }
    };

    return (
        <>
            {/* Main Control Bar (Bottom Left) */}
            <div style={{
                position: 'absolute',
                bottom: 20,
                left: 20,
                zIndex: 200,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                gap: '10px',
                fontFamily: "'Courier New', Courier, monospace"
            }}>
                {/* Admin Button */}
                {!user && (
                    <button
                        onClick={() => setShowAuth(true)}
                        style={{
                            background: 'rgba(0, 0, 0, 0.6)',
                            border: '1px solid #ff0055',
                            color: '#ff0055',
                            padding: '8px 12px',
                            cursor: 'pointer',
                            textTransform: 'uppercase',
                            letterSpacing: '1px',
                            backdropFilter: 'blur(5px)',
                            alignSelf: 'flex-start',
                            marginBottom: '5px',
                            fontWeight: 'bold',
                            fontSize: '0.8rem'
                        }}
                    >
                        ADMIN
                    </button>
                )}

                <div style={{ display: 'flex', gap: '10px' }}>
                    <button
                        onClick={() => setIsOpen(true)}
                        style={{
                            background: 'rgba(0, 255, 255, 0.1)',
                            border: '1px solid #00ffff',
                            color: '#00ffff',
                            padding: '10px 20px',
                            cursor: 'pointer',
                            textTransform: 'uppercase',
                            letterSpacing: '1px',
                            backdropFilter: 'blur(5px)'
                        }}
                    >
                        Interplanetary Database
                    </button>

                    {isOwner && (
                        <button
                            onClick={onSaveCurrent}
                            style={{
                                background: 'rgba(255, 0, 255, 0.1)',
                                border: '1px solid #ff00ff',
                                color: '#ff00ff',
                                padding: '10px 20px',
                                cursor: 'pointer',
                                textTransform: 'uppercase',
                                letterSpacing: '1px',
                                backdropFilter: 'blur(5px)'
                            }}
                        >
                            Save Coordinates
                        </button>
                    )}
                </div>
            </div>

            {/* Hidden Login Trigger (Bottom Right, tiny dot) */}


            {/* Gallery Modal */}
            {isOpen && (
                <div style={{
                    position: 'absolute',
                    top: 0, left: 0, width: '100%', height: '100%',
                    background: 'rgba(0,0,0,0.9)',
                    zIndex: 2000,
                    display: 'flex',
                    flexDirection: 'column',
                    padding: '40px',
                    boxSizing: 'border-box',
                    color: 'white',
                    fontFamily: "'Courier New', Courier, monospace"
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
                        <h1 style={{ margin: 0, color: '#00ffff' }}>DISCOVERED WORLDS</h1>
                        <button
                            onClick={() => setIsOpen(false)}
                            style={{ background: 'none', border: 'none', color: 'white', fontSize: '24px', cursor: 'pointer' }}
                        >
                            ✕
                        </button>
                    </div>

                    {loading ? (
                        <div>Scanning Deep Space Network...</div>
                    ) : (
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
                            gap: '20px',
                            overflowY: 'auto'
                        }}>
                            {biomes.map(b => (
                                <div key={b.firestoreId} style={{
                                    border: '1px solid #333',
                                    padding: '15px',
                                    background: 'rgba(255,255,255,0.05)',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s'
                                }}
                                    onClick={() => {
                                        onLoadBiome(b);
                                        setIsOpen(false);
                                    }}
                                    onMouseEnter={e => e.currentTarget.style.borderColor = '#00ffff'}
                                    onMouseLeave={e => e.currentTarget.style.borderColor = '#333'}
                                >
                                    <h3 style={{ margin: '0 0 10px 0', fontSize: '1.2rem' }}>{b.name}</h3>
                                    <p style={{ fontSize: '0.8rem', opacity: 0.7 }}>{b.description.slice(0, 60)}...</p>
                                    <div style={{ fontSize: '0.7rem', color: '#888', marginTop: '10px' }}>
                                        {new Date(b.timestamp).toLocaleDateString()}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Auth Modal */}
            {showAuth && (
                <div style={{
                    position: 'absolute',
                    top: 0, left: 0, width: '100%', height: '100%',
                    background: 'rgba(0,0,0,0.85)',
                    zIndex: 2500,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                }}>
                    <form onSubmit={handleLogin} style={{
                        background: '#111',
                        padding: '30px',
                        border: '1px solid #333',
                        width: '300px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '15px',
                        color: 'white',
                        fontFamily: 'monospace'
                    }}>
                        <h2 style={{ margin: 0, color: '#ff00ff' }}>ACCESS CONTROL</h2>
                        <input
                            type="password"
                            placeholder="Authorization Code"
                            value={passcode}
                            onChange={e => setPasscode(e.target.value)}
                            style={{ background: '#222', border: '1px solid #444', color: 'white', padding: '10px' }}
                        />
                        {authError && <div style={{ color: 'red', fontSize: '12px' }}>{authError}</div>}
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <button type="button" onClick={() => setShowAuth(false)} style={{ background: 'none', border: '1px solid #444', color: '#888', padding: '5px 10px', cursor: 'pointer' }}>CANCEL</button>
                            <button type="submit" style={{ background: '#ff00ff', border: 'none', color: 'white', padding: '5px 15px', cursor: 'pointer' }}>VERIFY</button>
                        </div>
                    </form>
                </div>
            )}
        </>
    );
};
