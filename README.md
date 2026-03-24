# sailing-sim

A browser-based top-down sailing simulation prototype.

## Live demo

GitHub Pages: https://thirtyfiveohsix.github.io/sailing-sim/

## What it is

A small TypeScript + Canvas game prototype with:
- one player boat
- shifting wind
- rudder steering
- sail trim
- no-go zone upwind
- sequential marks to round
- HUD for speed, heading, wind, and VMG

## Run locally

```bash
npm install
npm run dev
```

Then open the local Vite URL in your browser.

## Controls

- Left / Right — steer
- Up / Down — trim sail in / ease out
- R — reset race
- Space — center camera

## Build

```bash
npm run build
```

## Deploy

The repo includes a GitHub Actions workflow that builds and deploys to GitHub Pages on every push to `main`.
