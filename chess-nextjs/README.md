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
  shapes (`/api/game/new`, `/api/game/move`, `/api/game/undo`, `/api/game/redo`,
  `/api/game/goto`, `/api/game/load-fen`, `/api/game/state`,
  `/api/game/legal-moves`, `/api/game/moves`, `/api/board`, `/api/fen`,
  `/api/engine/best-move`, `/api/engine/search`).
- **Session state**: the original ran one in-memory game session per server
  process. This port keeps that same model (a singleton on `globalThis`,
  see `lib/chess/gameSession.ts`) rather than introducing a database — it's
  a single-player teaching tool, not a multi-tenant service. If you deploy
  this to a serverless platform where each request may hit a cold instance,
  state won't persist between requests; run it with `npm start` on a normal
  long-lived Node process (or add a real datastore) for production use.
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
