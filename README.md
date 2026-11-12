# Midnight Apex

[Play the live game](https://midnight-apex-grid.higgsfield.app/)

Private multiplayer arcade racing for 2–4 players. Create a room and share its invite. Host starts a three-lap race. Controls: WASD/arrows, Shift/Space nitro; touch and gamepad supported. Automatic acceleration defaults on.

Server-authoritative physics with 20 Hz updates and independent rendering targeting 60 FPS. Four car colors, seven track hazards, nitro regeneration, collisions, reconnects, finishing order, rematch lobby, and local practice with bots. FPS depends on hardware/browser.

Game code is in app/src/logic.js; app/public/physics.js is an identical copy used for local practice. Keep them synchronized. Run node app/scripts/test-race.mjs for deterministic physics checks. Full project checks require provisioned Bun and dependencies (bun run build and bun run test from app/).

AI artwork was unavailable because the connected image service requires a paid plan. All visuals and the cover are authored procedurally.

## Run locally

With Bun installed, run these commands from the `app` directory:

```sh
bun install --frozen-lockfile
bun run dev
```

Open the local address printed by Wrangler. Create a room in one browser and open its invite in a second browser or tab. Each tab gets its own driver session.

## Checks

```sh
# From the repository root; no installed dependencies required
node app/scripts/test-race.mjs

# From app/, after installing dependencies
bun run test
bun run build
```

The deployed version passed nine deterministic physics checks and live WebSocket checks for four players, spectator restrictions, host-only starts, nitro, synchronized movement, reconnects, and room isolation. Desktop and phone layouts were inspected; the test browser rendered around 60 FPS. Performance on other devices varies.

## Hosting

The multiplayer server runs on Cloudflare Workers with one Durable Object per room. GitHub stores the source; GitHub Pages alone cannot run the multiplayer server. The linked playable version is hosted by Higgsfield.

The runtime source and assets match Higgsfield revision `1c097d1d5fc5e153be1e5700a08e0f60bdff3705`. Unused template SDK packages are omitted from this repository.
