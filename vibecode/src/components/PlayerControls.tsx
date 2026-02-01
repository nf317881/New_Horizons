import { useRef, useEffect } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import { PointerLockControls } from '@react-three/drei';
import * as THREE from 'three';
import { Group, Vector3, Raycaster } from 'three';

interface PlayerControlsProps {
    mode: 'fly' | 'walk';
    onToggleMode: () => void;
    gravityMult: number;
    terrainMesh: React.RefObject<Group | null>;
}

export const PlayerControls: React.FC<PlayerControlsProps> = ({ mode, onToggleMode, gravityMult, terrainMesh }) => {
    const { camera, gl } = useThree();
    const controlsRef = useRef<any>(null); // eslint-disable-line @typescript-eslint/no-explicit-any
    const raycaster = useRef(new Raycaster());
    const downVector = new Vector3(0, -1, 0);

    const lastSpaceTime = useRef(0);

    // Movement state
    const moveState = useRef({
        forward: false,
        backward: false,
        left: false,
        right: false,
        shift: false,
        up: false,
        down: false
    });

    // Physics State
    const velocity = useRef(new Vector3(0, 0, 0));
    const isGrounded = useRef(false);

    // Constants
    const PLAYER_HEIGHT = 1.8;
    const WALK_SPEED = 10.0;
    const RUN_SPEED = 30.0;
    const FLY_SPEED = 20.0;
    const FLY_FAST_SPEED = 60.0;
    const BASE_GRAVITY = 30.0;
    const JUMP_FORCE = 15.0;

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.repeat) return;
            switch (event.code) {
                case 'ArrowUp':
                case 'KeyW': moveState.current.forward = true; break;
                case 'ArrowLeft':
                case 'KeyA': moveState.current.left = true; break;
                case 'ArrowDown':
                case 'KeyS': moveState.current.backward = true; break;
                case 'ArrowRight':
                case 'KeyD': moveState.current.right = true; break;
                case 'ShiftLeft':
                case 'ShiftRight': moveState.current.shift = true; break;
                case 'Space':
                    const now = Date.now();
                    if (now - lastSpaceTime.current < 300) {
                        onToggleMode();
                        // Reset space logic for this tap
                        moveState.current.up = false;
                        lastSpaceTime.current = 0;
                    } else {
                        lastSpaceTime.current = now;
                        if (mode === 'fly') {
                            moveState.current.up = true;
                        } else if (isGrounded.current) {
                            velocity.current.y = JUMP_FORCE;
                            isGrounded.current = false;
                        }
                    }
                    break;
                case 'ControlLeft': moveState.current.down = true; break;
            }
        };

        const handleKeyUp = (event: KeyboardEvent) => {
            switch (event.code) {
                case 'ArrowUp':
                case 'KeyW': moveState.current.forward = false; break;
                case 'ArrowLeft':
                case 'KeyA': moveState.current.left = false; break;
                case 'ArrowDown':
                case 'KeyS': moveState.current.backward = false; break;
                case 'ArrowRight':
                case 'KeyD': moveState.current.right = false; break;
                case 'ShiftLeft':
                case 'ShiftRight': moveState.current.shift = false; break;
                case 'Space': moveState.current.up = false; break;
                case 'ControlLeft': moveState.current.down = false; break;
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        document.addEventListener('keyup', handleKeyUp);

        return () => {
            document.removeEventListener('keydown', handleKeyDown);
            document.removeEventListener('keyup', handleKeyUp);
        };
    }, [mode, onToggleMode]);

    useFrame((_, delta) => {
        if (!controlsRef.current?.isLocked) return;

        const isSprinting = moveState.current.shift;

        if (mode === 'fly') {
            // --- FLY MODE ---
            const moveVector = new Vector3();
            const forward = new Vector3();
            camera.getWorldDirection(forward).normalize();

            const right = new Vector3();
            right.crossVectors(camera.up, forward).normalize();

            if (moveState.current.forward) moveVector.add(forward);
            if (moveState.current.backward) moveVector.sub(forward);
            if (moveState.current.left) moveVector.add(right);
            if (moveState.current.right) moveVector.sub(right);
            if (moveState.current.up) moveVector.y += 1;
            if (moveState.current.down) moveVector.y -= 1;

            moveVector.normalize();
            const speed = isSprinting ? FLY_FAST_SPEED : FLY_SPEED;

            if (moveVector.lengthSq() > 0) {
                camera.position.addScaledVector(moveVector, speed * delta);
            }

            velocity.current.set(0, 0, 0);
            isGrounded.current = false;

        } else {
            // --- WALK MODE ---
            const forward = new Vector3();
            camera.getWorldDirection(forward);
            forward.y = 0;
            forward.normalize();

            const right = new Vector3();
            right.crossVectors(camera.up, forward).normalize();

            const moveVector = new Vector3();
            if (moveState.current.forward) moveVector.add(forward);
            if (moveState.current.backward) moveVector.sub(forward);
            if (moveState.current.left) moveVector.add(right);
            if (moveState.current.right) moveVector.sub(right);
            moveVector.normalize();

            const speed = isSprinting ? RUN_SPEED : WALK_SPEED;

            if (moveVector.lengthSq() > 0) {
                camera.position.addScaledVector(moveVector, speed * delta);
            }

            let terrainHeight = -100;
            if (terrainMesh.current) {
                raycaster.current.set(
                    new Vector3(camera.position.x, 1000, camera.position.z),
                    downVector
                );
                const intersects = raycaster.current.intersectObject(terrainMesh.current, true);
                if (intersects.length > 0) {
                    terrainHeight = intersects[0].point.y;
                }
            }

            // Scale gravity by biome mult
            const currentGravity = BASE_GRAVITY * gravityMult;
            velocity.current.y -= currentGravity * delta;
            camera.position.y += velocity.current.y * delta;

            const groundY = terrainHeight + PLAYER_HEIGHT;
            const SNAP_TOLERANCE = 0.2;

            // FIX: If we are below ground, always snap up. 
            // Also stop falling if we hit the ground.
            if (camera.position.y <= groundY + SNAP_TOLERANCE) {
                if (velocity.current.y <= 0 || camera.position.y < groundY - 0.1) {
                    camera.position.y = groundY;
                    velocity.current.y = 0;
                    isGrounded.current = true;
                }
            } else {
                isGrounded.current = false;
            }
        }
    });

    const lightRef = useRef<THREE.PointLight>(null);

    useFrame(() => {
        if (lightRef.current) {
            lightRef.current.position.copy(camera.position);
        }
    });

    return (
        <>
            <PointerLockControls ref={controlsRef} domElement={gl.domElement} />
            <pointLight ref={lightRef} intensity={5.0} distance={150} color="white" decay={1} />
        </>
    );
};
