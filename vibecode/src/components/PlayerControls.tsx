import { useRef, useEffect } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import { PointerLockControls } from '@react-three/drei';
import { Group, Vector3, Raycaster } from 'three';

interface PlayerControlsProps {
    mode: 'fly' | 'walk';
    terrainMesh: React.RefObject<Group | null>;
}

export const PlayerControls: React.FC<PlayerControlsProps> = ({ mode, terrainMesh }) => {
    const { camera } = useThree();
    const controlsRef = useRef<any>(null); // eslint-disable-line @typescript-eslint/no-explicit-any
    const raycaster = useRef(new Raycaster());
    const downVector = new Vector3(0, -1, 0);

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
    const GRAVITY = 30.0;
    const JUMP_FORCE = 15.0;

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
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
                    if (mode === 'fly') {
                        moveState.current.up = true;
                    } else {
                        // Check if close enough to ground to jump (Coyote time / Tolerance)
                        // Uses the last calculated ground check or simply heuristic
                        // We can trust isGrounded, OR we can check if velocity is downward and we are close to ground.
                        // Let's rely on isGrounded but make isGrounded stickier in useFrame.
                        if (isGrounded.current) {
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
    }, [mode]);

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

            // Reset phsyics state
            velocity.current.set(0, 0, 0);
            isGrounded.current = false;

        } else {
            // --- WALK MODE ---

            // 1. Horizontal Movement (XZ)
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

            // 2. Terrain Physics & Gravity
            let terrainHeight = -100;

            if (terrainMesh.current) {
                raycaster.current.set(
                    new Vector3(camera.position.x, 1000, camera.position.z),
                    downVector
                );

                // Use recursive intersection for Groups
                const intersects = raycaster.current.intersectObject(terrainMesh.current, true);
                if (intersects.length > 0) {
                    terrainHeight = intersects[0].point.y;
                }
            }

            // Apply Gravity
            velocity.current.y -= GRAVITY * delta;

            // Apply Velocity
            camera.position.y += velocity.current.y * delta;

            // Ground Collision
            const groundY = terrainHeight + PLAYER_HEIGHT;

            // Simple ground collision: if feet go below ground, snap up.
            // "Feet" position is CameraY - PLAYER_HEIGHT.

            // Tolerance for "snapping" to ground when walking down slopes
            const SNAP_TOLERANCE = 0.2;

            if (camera.position.y <= groundY + SNAP_TOLERANCE && velocity.current.y <= 0) {
                // Only snap if we are falling or level, not if jumping up
                camera.position.y = groundY;
                velocity.current.y = 0; // Stop falling
                isGrounded.current = true;
            } else {
                isGrounded.current = false;
            }
        }
    });

    return (
        <PointerLockControls ref={controlsRef} />
    );
};
