# Vibecode

A proceeding generation infinite landscape explorer built with React, Three.js, and React Three Fiber.

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (Latest LTS recommended)

### Installation

1.  Clone the repository (if you haven't already).
2.  Navigate to the project directory:
    ```bash
    cd vibecode
    ```
3.  Install the dependencies:
    ```bash
    npm install
    ```
    This command reads the `package.json` file and installs all necessary libraries (like `three`, `simplex-noise`, etc.) into a `node_modules` folder.

### Running the App

To start the local development server:

```bash
npm run dev
```

Open your browser to the URL shown in the terminal (usually `http://localhost:5173`).

## Project Structure

- `src/components/`: Reusable UI and 3D components (Terrain, PlayerControls, ChunkManager).
- `src/types/`: TypeScript definitions.
- `src/utils/`: Helper functions (mock data generation).
- `src/App.tsx`: Main application entry point.

## Controls

- **WASD / Arrow Keys**: Move
- **Shift**: Sprint
- **Space**: Jump (Walk Mode) / Up (Fly Mode)
- **Ctrl**: Down (Fly Mode)
- **Mouse**: Look around (Click to lock cursor)
