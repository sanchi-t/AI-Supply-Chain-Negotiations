# Architecture

This scaffold keeps the codebase intentionally small:

- `web` contains the user interface and route structure.
- `backend` exposes a minimal API for health and run resources.
- `runs` stores generated local run JSON files.
- `events` stores generated local event streams.
- `exports` stores generated export artifacts.
- `shared` is reserved for shared schemas, prompts, or documentation.

The initial scaffold favors readability over abstraction.
