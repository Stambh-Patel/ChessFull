# Chess Engine Laboratory — Next.js Edition

This is a full conversion of the original **Java (Spring-style backend) +
vanilla JS frontend** "Chess Engine Laboratory" into a single **Next.js 14
(App Router, TypeScript)** application. There is no separate backend to run
— the entire chess engine (move generation, check detection, FEN, and all
three search algorithms) has been ported to TypeScript and lives inside
this app's own API routes.

## Running it

```bash
npm install
npm run dev
```

Then open http://localhost:3000.

```bash
npm run build && npm start   # production build
```

## What changed vs. the original

- **Backend**: every Java class under `com.chesslab.{model,engine,service,util}`
  was ported 1:1 to TypeScript under `lib/chess/`. Algorithms (pseudo-legal
  move generation, legal-move filtering, check detection, move execution,
  evaluation + piece-square tables, move ordering, minimax, alpha-beta,
  iterative deepening, FEN parsing) are logically identical to the Java
  source — same board representation (8×8 grid, row 0 = rank 8), same
  scoring, same pruning behavior.
- **REST API**: the original Spring `@RestController` endpoints are now
  Next.js Route Handlers under `app/api/`, with the same paths and JSON
  shapes, but **stateless** — `GET`/`POST` `fen` parameters replace the
  original's server-held session (`/api/game/move`, `/api/game/state`,
  `/api/game/legal-moves`, `/api/board`, `/api/engine/best-move`,
  `/api/engine/search`, `/api/game/new`, `/api/game/load-fen`). The
  original's `/undo`, `/redo`, `/goto`, `/moves` endpoints are gone
  entirely — that bookkeeping now lives client-side, see below.
- **Session state**: the very first version of this port kept one
  in-memory game session per server process (a singleton on
  `globalThis`). That breaks on serverless platforms like Netlify, where
  consecutive requests can land on different, cold function instances
  with no shared memory — moves would appear to randomly "not happen."
  This version fixes that: **every API route is now stateless**. The
  client (`components/ChessLab.tsx`) holds the full ply-by-ply game
  history itself and sends the current position's FEN with every
  request; each route is a pure function of the FEN (and move) it's
  given. Undo/Redo/jump-to-ply are now instant and require no network
  call at all — they just re-point the client at an earlier entry in its
  own history array. See `lib/chess/gameOps.ts`.
- **Frontend**: the vanilla HTML/CSS/JS app (`index.html` / `app.js` /
  `style.css`) was rebuilt as a single React client component,
  `components/ChessLab.tsx`, preserving all 7 tabs (Play, Board
  Representation, FEN, Data Structures, Engine Search, Learn, Debug Mode)
  and the exact same interaction model — click-to-select, legal-move dots,
  step-by-step execution log, evaluation meter, move history with
  time-travel, and the live search-tree visualizer. The original
  `style.css` design system (CSS custom properties, dark "oscilloscope"
  theme) was carried over almost verbatim into `app/globals.css`.

## Project layout

```
app/
  layout.tsx, page.tsx, globals.css
  api/
    game/{new,move,undo,redo,goto,load-fen,state,legal-moves,moves}/route.ts
    board/route.ts
    fen/route.ts
    engine/{best-move,search}/route.ts
components/
  ChessLab.tsx        - the entire frontend UI
lib/chess/
  types.ts            - Board, Piece, Square, Move, GameState, CastlingRights
  moveGenerator.ts     - pseudo-legal move generation
  checkDetector.ts     - attack / check detection
  moveExecutor.ts      - applies a Move to a GameState
  legalMoveGenerator.ts- legal-move filtering + game status
  evaluation.ts         - material + positional scoring
  pieceSquareTables.ts  - the standard piece-square tables
  moveOrderer.ts         - MVV move ordering for iterative deepening
  search.ts              - minimax / alpha-beta / iterative deepening
  fen.ts                  - FEN parsing/serialization
  dto.ts                  - JSON response shaping (mirrors the original DtoMapper)
  gameSession.ts          - in-memory single-session game state
```

## Notes

- No network access was available in the environment that generated this
  project, so `npm install` has not been run here — do that first.
  The TypeScript engine code (`lib/chess/**`) and every API route were
  type-checked in isolation during generation and are syntactically clean.
- The original Java backend and vanilla-JS frontend are left untouched in
  case you want to diff behavior against them; they are not part of this
  Next.js app and can be deleted once you've verified the port.
