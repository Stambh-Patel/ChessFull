'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/* ============================================================
   Chess Engine Laboratory - Frontend (Next.js / React port)
   ------------------------------------------------------------
   Talks to this same app's own API routes under /api. Nothing
   rendered here is fabricated: board state, legal moves,
   evaluation numbers, node counts, and the search tree all come
   straight from the API's JSON responses - ported 1:1 from the
   original vanilla-JS app.js.
   ============================================================ */

const API_BASE = '/api';

const PIECE_GLYPH: Record<string, string> = {
  WK: '\u2654', WQ: '\u2655', WR: '\u2656', WB: '\u2657', WN: '\u2658', WP: '\u2659',
  BK: '\u265A', BQ: '\u265B', BR: '\u265C', BB: '\u265D', BN: '\u265E', BP: '\u265F',
};

const PIECE_NAME: Record<string, string> = {
  K: 'King', Q: 'Queen', R: 'Rook', B: 'Bishop', N: 'Knight', P: 'Pawn',
};

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];

function squareFromRowCol(row: number, col: number) {
  return FILES[col] + (8 - row);
}

function oppositeColor(c: string) {
  return c === 'WHITE' ? 'BLACK' : 'WHITE';
}

type MoveDetail = {
  uci: string;
  from: string;
  to: string;
  piece: string;
  pieceDisplayName: string;
  type: string;
  isCapture: boolean;
  capturedPiece?: string;
  promotionType?: string;
};

type GameStateDto = {
  fen: string;
  sideToMove: string;
  status: string;
  castlingRights: string;
  enPassantTarget: string | null;
  halfmoveClock: number;
  fullmoveNumber: number;
  board: (string | null)[][];
};

type SearchNodeDto = {
  move: string | null;
  depth: number;
  evaluation: number | null;
  alpha: number;
  beta: number;
  pruned: boolean;
  maximizing: boolean;
  children?: SearchNodeDto[];
  childCount?: number;
};

type SearchResultDto = {
  bestMove: string | null;
  bestMoveDetail: MoveDetail | null;
  evaluationCentipawns: number;
  evaluation: number;
  depth: number;
  nodesSearched: number;
  nodesPruned: number;
  pruningPercentage: number;
  executionTimeMs: number;
  tree: SearchNodeDto;
};

type DebugEvent = { time: string; method: string; endpoint: string; summary: string };
type StepLine = { label: string; message: string };
type Toast = { id: number; message: string };
type TabId = 'play' | 'board-rep' | 'fen' | 'data-structures' | 'engine' | 'learn' | 'debug';

function escapeHtml(s: string) {
  return s;
}

// ------------------------------------------------------------------
// Static content ported from app.js
// ------------------------------------------------------------------
const DATA_STRUCTURES = [
  {
    name: 'Board', file: 'lib/chess/types.ts (Board)',
    summary: 'The 8x8 grid of pieces.',
    stores: 'A (Piece|null)[8][8] array. squares[0] is rank 8, squares[7] is rank 1; col 0 is file a.',
    why: 'Every rule in the engine - movement, captures, check detection - ultimately reads or writes this grid. Keeping it as the simplest possible representation (a flat array board, not bitboards) means a student can trace exactly how a move changes it.',
    how: 'moveGenerator.ts reads it to find legal moves; moveExecutor.ts writes a *copy* of it (Board.copy()) when applying a move, so the original position is never mutated - this is what makes Undo and the search tree both safe.',
  },
  {
    name: 'Move', file: 'lib/chess/types.ts (Move)',
    summary: 'An immutable description of one move.',
    stores: 'from square, to square, the piece moved, the captured piece (if any), a MoveType (normal/castle/en passant/promotion/double-push), and a promotion piece type if relevant.',
    why: 'Rather than re-deriving "what kind of move was this" every time it is needed, Move records it once at generation time - moveExecutor.ts branches on move.type to know exactly what side effects to apply.',
    how: 'Produced by moveGenerator.ts, filtered by legalMoveGenerator.ts, consumed by moveExecutor.ts. Its UCI form (e.g. "e2e4") is the exact format used across the REST API and the engine\'s search-tree output.',
  },
  {
    name: 'Piece', file: 'lib/chess/types.ts (Piece)',
    summary: 'An immutable (color, type) pair.',
    stores: 'A PieceColor (WHITE/BLACK) and a PieceType (PAWN..KING).',
    why: 'Because it is immutable, the exact same Piece object can be safely shared across many Board copies during search - moving a piece just moves the reference, never mutates the piece itself.',
    how: 'Board.get(square) returns a Piece or null (empty). Its type feeds directly into evaluation.ts\'s material score.',
  },
  {
    name: 'GameState', file: 'lib/chess/types.ts (GameState)',
    summary: 'A full snapshot of a position.',
    stores: 'A Board, whose turn it is, CastlingRights, the en-passant target square, and the two FEN move counters (halfmove clock, fullmove number).',
    why: 'A Board alone cannot tell you whether castling is still legal, or whether an en-passant capture is available right now - GameState is the complete, self-sufficient unit the engine actually reasons about.',
    how: 'Immutable, like Move and Piece: moveExecutor.ts\'s applyMove() takes one GameState and a Move and returns a brand-new GameState, which is exactly what lets minimax explore a whole tree of hypothetical positions without corrupting the real game.',
  },
  {
    name: 'MoveList', file: '(Move[])',
    summary: 'The set of moves available in a position.',
    stores: 'An ordered array of Move objects - either pseudo-legal (from moveGenerator.ts) or fully legal (from legalMoveGenerator.ts, after filtering out moves that leave your own king in check).',
    why: 'Separating "moves that follow piece-movement rules" from "moves that are actually legal right now" mirrors how the step panel teaches move validation as two distinct stages.',
    how: 'The frontend fetches this directly from GET /api/game/legal-moves to highlight destination squares, and the search algorithms iterate over it at every node of the game tree.',
  },
  {
    name: 'TranspositionTable', file: '(planned - not yet implemented)',
    summary: 'A cache of previously-searched positions.',
    stores: 'A hash of each position (Zobrist hashing is the standard technique) mapped to the best move and evaluation already computed for it.',
    why: 'The same position can be reached by different move orders ("transposing"). Without a cache, the search re-analyzes it from scratch every time; with one, it can reuse the earlier result instantly.',
    how: 'Not yet wired into this engine\'s search - the minimax and alpha-beta searches currently re-explore every node fresh. This is the natural next performance upgrade alongside iterative deepening.',
  },
];

const LESSONS = [
  { title: 'Board Representation', eyebrow: 'Lesson 1',
    body: 'The engine represents the board as an 8x8 array of pieces, not as a picture. Row 0 is rank 8, column 0 is file a. Every piece is either a Piece object or null (empty).',
    challenge: 'Open the "Board Representation" tab and click a few squares. Can you find the internal row/column for e4?' },
  { title: 'Pieces', eyebrow: 'Lesson 2',
    body: 'A Piece is just a (color, type) pair - immutable, so it can be safely shared across many board copies during search. Each PieceType also carries a standard material value used by evaluation (pawn=100, knight=320, bishop=330, rook=500, queen=900).',
    challenge: 'Open the "Data Structures" tab and read the Piece card. Why does immutability matter for search?' },
  { title: 'Move Generation', eyebrow: 'Lesson 3',
    body: 'The move generator produces every move a piece could physically make - sliding pieces stop at the first blocker, knights jump in fixed L-shapes, pawns get special forward/capture/en-passant/promotion rules. These are called "pseudo-legal" because they don\'t yet check whether your own king ends up in check.',
    challenge: 'Go to Play, click any knight, and count how many destination dots appear. Does it match what you\'d expect?' },
  { title: 'Legal Moves', eyebrow: 'Lesson 4',
    body: 'The legal move generator takes every pseudo-legal move, actually plays it on a copy of the board, and checks whether your own king is in check afterward. If so, the move is discarded. A pinned piece is the clearest example: it might have plenty of pseudo-legal moves, but almost all of them are illegal.',
    challenge: 'Try selecting your king early in the game. Notice how few legal moves it has compared to a knight or bishop.' },
  { title: 'Check', eyebrow: 'Lesson 5',
    body: 'Check detection answers "is this square attacked?" by checking every attack pattern (pawn, knight, king, sliding bishop/rook - a queen matches both) from the target square\'s point of view. A king is "in check" exactly when its own square is attacked by the opponent.',
    challenge: 'Play a few moves until you deliver check. Watch the king\'s square highlight in red and the status pill change.' },
  { title: 'Checkmate', eyebrow: 'Lesson 6',
    body: 'Checkmate is simply: the side to move is in check, AND has zero legal moves. Stalemate is the same check for "zero legal moves" but WITHOUT being in check - that\'s a draw, not a loss.',
    challenge: 'Try the FEN tab: load "rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3" (the "Fool\'s Mate" final position) and see what the status pill reports.' },
  { title: 'Minimax', eyebrow: 'Lesson 7',
    body: 'Minimax explores the tree of possible future moves: White (MAX) picks the move that maximizes the evaluation, assuming Black (MIN) will always reply with the move that minimizes it. Every leaf gets a static evaluation; every internal node\'s value is computed from its children.',
    challenge: 'Open "Engine Search," select Minimax and depth 2, and run it. Click through the tree - can you see the MAX/MIN alternation?' },
  { title: 'Alpha-Beta Pruning', eyebrow: 'Lesson 8',
    body: 'Alpha-beta tracks a window [alpha, beta] of scores still worth exploring. The moment a node proves the opponent already has a better alternative elsewhere (beta <= alpha), the remaining siblings at that node are skipped entirely - they can\'t change the outcome. Same final answer as minimax, far fewer nodes visited.',
    challenge: 'Run the same position with Alpha-Beta instead of Minimax at the same depth. Compare "Positions Searched."' },
  { title: 'Evaluation Function', eyebrow: 'Lesson 9',
    body: 'The evaluation function scores a position in centipawns (100 = one pawn) from White\'s perspective: material value plus a piece-square table bonus for good positioning (e.g. a centralized knight scores higher than a cornered one). Checkmate scores as a dominant +-1,000,000.',
    challenge: 'Watch the Eval meter next to the board update after you run "Calculate Best Move." What does a positive number mean?' },
  { title: 'Transposition Tables', eyebrow: 'Lesson 10',
    body: 'Different move orders can reach the exact same position ("transposing"). A transposition table caches positions already analyzed so the engine doesn\'t redo the same work. This engine doesn\'t have one yet - see the Data Structures tab for why it would help.',
    challenge: 'Think about it: 1.e4 e5 2.Nf3 and 1.Nf3 e5 2.e4 reach the same position by different paths. How would you detect that in code?' },
  { title: 'Iterative Deepening', eyebrow: 'Lesson 11',
    body: 'Rather than searching directly to depth 6, iterative deepening searches depth 1, then 2, then 3... reusing information from each shallow pass to search the next, deeper pass more efficiently (especially move ordering). It also means the engine always has *some* answer ready, even if interrupted.',
    challenge: 'Notice how much slower depth 5-6 alpha-beta searches feel compared to depth 2-3 in this engine - that gap is exactly what iterative deepening + move ordering would close.' },
  { title: 'Complete Chess Engine', eyebrow: 'Lesson 12',
    body: 'Putting it together: Board + Piece + GameState represent a position; move generation + legal move generation find what\'s allowed; check detection + move execution make it safe to explore; evaluation scores a position; Minimax/Alpha-Beta search the tree of future positions; and a REST API exposes all of it to this very frontend.',
    challenge: 'Play a full game against the AI (Human vs AI mode) and try to spot each of these components working as you play.' },
];

let debugEventSeq = 0;
let toastSeq = 0;

export default function ChessLab() {
  // ------------------------------------------------------------------
  // Server / connectivity
  // ------------------------------------------------------------------
  const [serverOnline, setServerOnlineState] = useState<boolean | null>(null);

  // ------------------------------------------------------------------
  // Core play state
  // ------------------------------------------------------------------
  const [boardGrid, setBoardGrid] = useState<(string | null)[][] | null>(null);
  const [sideToMove, setSideToMove] = useState('WHITE');
  const [status, setStatus] = useState('ONGOING');
  const [fen, setFen] = useState('');
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const [legalFromSelected, setLegalFromSelected] = useState<MoveDetail[]>([]);
  const [lastMove, setLastMove] = useState<{ from: string; to: string } | null>(null);
  const [mode, setMode] = useState<'hvh' | 'hva' | 'ava'>('hvh');
  const [humanColor] = useState('WHITE');
  const [depth, setDepth] = useState(3);
  const [algorithm, setAlgorithm] = useState('alphabeta');
  const [lastEvalCentipawns, setLastEvalCentipawns] = useState<number | null>(null);
  const [moveHistory, setMoveHistory] = useState<MoveDetail[]>([]);
  const [currentPly, setCurrentPly] = useState(0);
  const [buttonsDisabled, setButtonsDisabled] = useState(false);

  const [stepLines, setStepLines] = useState<StepLine[]>([
    { label: '', message: 'Click a piece to begin.' },
  ]);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const autoPlayTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const modeRef = useRef(mode);
  const statusRef = useRef(status);
  const sideToMoveRef = useRef(sideToMove);
  useEffect(() => { modeRef.current = mode; }, [mode]);
  useEffect(() => { statusRef.current = status; }, [status]);
  useEffect(() => { sideToMoveRef.current = sideToMove; }, [sideToMove]);

  // ------------------------------------------------------------------
  // Debug event log
  // ------------------------------------------------------------------
  const [debugEvents, setDebugEvents] = useState<DebugEvent[]>([]);
  const [debugRevealedCount, setDebugRevealedCount] = useState(0);
  const [debugPaused, setDebugPaused] = useState(false);
  const debugPausedRef = useRef(debugPaused);
  useEffect(() => { debugPausedRef.current = debugPaused; }, [debugPaused]);

  const debugLog = useCallback((method: string, endpoint: string, summary: string) => {
    const time = new Date().toLocaleTimeString('en-US', { hour12: false });
    debugEventSeq++;
    setDebugEvents((prev) => {
      const next = [...prev, { time, method, endpoint, summary }];
      if (!debugPausedRef.current) setDebugRevealedCount(next.length);
      return next;
    });
  }, []);

  function summarizeResponse(json: any): string {
    if (json.error) return `error: ${json.error}`;
    if ('legal' in json && json.legal === false) return `illegal: ${json.reason}`;
    if (json.move) return `move ${json.move}${json.isCapture ? ' (capture)' : ''} \u2192 ${json.status || ''}`;
    if (json.bestMove) return `bestMove ${json.bestMove}  eval ${json.evaluation}  nodes ${json.nodesSearched} pruned ${json.nodesPruned}`;
    if (json.fen) return json.fen;
    if (json.grid) return '8x8 board grid';
    if (json.moves) return `${json.count} move(s)`;
    if ('sideToMove' in json) return `${json.sideToMove} to move, status ${json.status}`;
    return JSON.stringify(json).slice(0, 90);
  }

  const apiGet = useCallback(async (path: string) => {
    try {
      const res = await fetch(`${API_BASE}${path}`);
      const json = await res.json();
      setServerOnlineState(true);
      debugLog('GET', path, summarizeResponse(json));
      return json;
    } catch (err: any) {
      setServerOnlineState(false);
      debugLog('GET', path, `network error: ${err.message}`);
      throw err;
    }
  }, [debugLog]);

  const apiPost = useCallback(async (path: string, body?: unknown) => {
    try {
      const res = await fetch(`${API_BASE}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body || {}),
      });
      const json = await res.json();
      setServerOnlineState(true);
      debugLog('POST', path, summarizeResponse(json));
      return json;
    } catch (err: any) {
      setServerOnlineState(false);
      debugLog('POST', path, `network error: ${err.message}`);
      throw err;
    }
  }, [debugLog]);

  // ------------------------------------------------------------------
  // Step panel + toast helpers
  // ------------------------------------------------------------------
  const stepPanelAdd = useCallback((label: string, message: string) => {
    setStepLines((prev) => [...prev, { label, message }]);
  }, []);
  const stepPanelClear = useCallback(() => setStepLines([]), []);

  const showToast = useCallback((message: string) => {
    toastSeq++;
    const id = toastSeq;
    setToasts((prev) => [...prev, { id, message }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4500);
  }, []);

  // ------------------------------------------------------------------
  // Refresh state from backend
  // ------------------------------------------------------------------
  const refreshAll = useCallback(async () => {
    const state: GameStateDto = await apiGet('/game/state');
    setBoardGrid(state.board);
    setSideToMove(state.sideToMove);
    setStatus(state.status);
    setFen(state.fen);

    const history = await apiGet('/game/moves');
    setMoveHistory(history.moves || []);
    setCurrentPly(history.currentPly || 0);

    const finished = state.status === 'CHECKMATE' || state.status === 'STALEMATE';
    setButtonsDisabled(finished);

    return state;
  }, [apiGet]);

  // ------------------------------------------------------------------
  // Evaluation meter
  // ------------------------------------------------------------------
  function updateEvalMeter(centipawns: number | null | undefined) {
    setLastEvalCentipawns(centipawns === undefined ? null : centipawns);
  }

  function evalReadout() {
    const cp = lastEvalCentipawns;
    if (cp === null || cp === undefined) return 'n/a';
    const isMate = Math.abs(cp) >= 900000;
    return isMate ? (cp > 0 ? 'M+' : 'M-') : (cp / 100).toFixed(2);
  }

  function evalFillPct() {
    const cp = lastEvalCentipawns;
    if (cp === null || cp === undefined) return { white: 0, black: 0 };
    const clamped = Math.max(-800, Math.min(800, cp));
    const pct = (Math.abs(clamped) / 800) * 50;
    return cp >= 0 ? { white: pct, black: 0 } : { white: 0, black: pct };
  }

  // ------------------------------------------------------------------
  // Engine controls
  // ------------------------------------------------------------------
  const calculateBestMove = useCallback(async (playIt: boolean) => {
    stepPanelAdd('ENGINE', `Searching at depth ${depth} using ${algorithm === 'minimax' ? 'plain Minimax' : algorithm === 'iterative' ? 'Iterative Deepening' : 'Alpha-Beta pruning'}...`);
    const result: SearchResultDto = await apiPost('/engine/best-move', { depth, algorithm });
    updateEvalMeter(result.evaluationCentipawns);

    if (!result.bestMove) {
      stepPanelAdd('ENGINE', 'No legal moves available (game is over).');
      return null;
    }

    stepPanelAdd('ENGINE',
      `Best move: ${result.bestMove}  |  eval ${result.evaluation}  |  ${result.nodesSearched} nodes searched, ${result.nodesPruned} pruned (${result.pruningPercentage}%)  |  ${result.executionTimeMs}ms`);

    if (playIt && result.bestMoveDetail) {
      await attemptMove(result.bestMoveDetail.from, result.bestMoveDetail.to, result.bestMoveDetail.promotionType || null);
    }
    return result;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [depth, algorithm, apiPost, stepPanelAdd]);

  const calculateBestMoveRef = useRef(calculateBestMove);
  useEffect(() => { calculateBestMoveRef.current = calculateBestMove; }, [calculateBestMove]);

  function stopAutoPlay() {
    if (autoPlayTimer.current) {
      clearInterval(autoPlayTimer.current);
      autoPlayTimer.current = null;
    }
  }

  function startAutoPlay() {
    if (autoPlayTimer.current) return;
    autoPlayTimer.current = setInterval(() => {
      if (statusRef.current === 'CHECKMATE' || statusRef.current === 'STALEMATE') {
        stopAutoPlay();
        return;
      }
      calculateBestMoveRef.current(true);
    }, 1200);
  }

  function maybeTriggerAiMove() {
    if (statusRef.current === 'CHECKMATE' || statusRef.current === 'STALEMATE') return;
    if (modeRef.current === 'hva' && sideToMoveRef.current !== humanColor) {
      setTimeout(() => calculateBestMoveRef.current(true), 400);
    }
  }

  // ------------------------------------------------------------------
  // Selecting a piece / attempting a move
  // ------------------------------------------------------------------
  function clearSelection() {
    setSelectedSquare(null);
    setLegalFromSelected([]);
  }

  async function attemptMove(from: string, to: string, promotionType: string | null) {
    stepPanelAdd('STEP 4', `Validating: is ${to} legal for the piece on ${from}? (re-checked by the backend, not trusted client-side)`);

    const body: Record<string, string> = { from, to };
    if (promotionType) body.promotion = promotionType.charAt(0).toLowerCase();

    const result = await apiPost('/game/move', body);

    if (!result.legal) {
      stepPanelAdd('REJECTED', result.reason);
      clearSelection();
      return;
    }

    stepPanelAdd('STEP 5', `Move executed: ${result.from} \u2192 ${result.to}${result.isCapture ? ' (capture)' : ''} [${result.type}]`);
    stepPanelAdd('STEP 6', 'Board updated.');
    stepPanelAdd('STEP 7', `Game state updated: ${result.status === 'ONGOING' ? oppositeColor(sideToMoveRef.current) + ' to move' : result.status}`);

    setLastMove({ from: result.from, to: result.to });
    clearSelection();
    const newState = await refreshAll();

    if (result.status === 'CHECKMATE') {
      showToast(`Checkmate. ${sideToMoveRef.current === 'WHITE' ? 'Black' : 'White'} wins.`);
    } else if (result.status === 'STALEMATE') {
      showToast('Stalemate. The game is drawn.');
    } else if (result.status === 'CHECK') {
      stepPanelAdd('CHECK', `${newState.sideToMove}'s king is in check.`);
    }

    maybeTriggerAiMove();
  }

  async function promptPromotionChoice(candidates: MoveDetail[]): Promise<string | null> {
    const choice = window.prompt(
      `Promote to which piece? Options: ${candidates.map((c) => c.promotionType).join(', ')}\nType one exactly (e.g. QUEEN):`,
      'QUEEN'
    );
    if (!choice) return null;
    const match = candidates.find((c) => c.promotionType === choice.toUpperCase());
    return match ? match.promotionType! : null;
  }

  async function onSquareClick(algebraic: string) {
    if (status === 'CHECKMATE' || status === 'STALEMATE') return;
    if (!boardGrid) return;

    const row = 8 - parseInt(algebraic[1], 10);
    const col = FILES.indexOf(algebraic[0]);
    const code = boardGrid[row][col];

    if (selectedSquare && legalFromSelected.some((m) => m.to === algebraic)) {
      const candidates = legalFromSelected.filter((m) => m.to === algebraic);
      let promotion: string | null = null;
      if (candidates.length > 1) {
        promotion = await promptPromotionChoice(candidates);
        if (!promotion) return;
      }
      await attemptMove(selectedSquare, algebraic, promotion);
      return;
    }

    if (code) {
      const pieceColor = code[0] === 'W' ? 'WHITE' : 'BLACK';
      if (pieceColor !== sideToMove) {
        stepPanelAdd('BLOCKED', `That's a ${pieceColor} piece, but it's ${sideToMove}'s turn.`);
        return;
      }
      setSelectedSquare(algebraic);
      stepPanelClear();
      const pieceName = PIECE_NAME[code[1]];
      stepPanelAdd('STEP 1', `Piece selected: ${pieceColor === 'WHITE' ? 'White' : 'Black'} ${pieceName} at ${algebraic}`);
      stepPanelAdd('STEP 2', 'Generating legal moves via the legal move generator...');

      const data = await apiGet(`/game/legal-moves?square=${algebraic}`);
      const moves: MoveDetail[] = data.moves || [];
      setLegalFromSelected(moves);

      if (moves.length === 0) {
        stepPanelAdd('STEP 3', 'No legal moves. This piece is pinned, blocked, or has nowhere safe to go.');
      } else {
        const list = moves.map((m) => m.to).join(', ');
        stepPanelAdd('STEP 3', `Possible destinations (${moves.length}): ${list}`);
      }
      return;
    }

    clearSelection();
  }

  function findKingSquare(grid: (string | null)[][], color: string) {
    const code = color === 'WHITE' ? 'WK' : 'BK';
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        if (grid[row][col] === code) return squareFromRowCol(row, col);
      }
    }
    return null;
  }

  // ------------------------------------------------------------------
  // Toolbar actions
  // ------------------------------------------------------------------
  async function onNewGame() {
    stopAutoPlay();
    clearSelection();
    setLastMove(null);
    updateEvalMeter(null);
    await apiPost('/game/new');
    stepPanelClear();
    stepPanelAdd('NEW GAME', 'Board reset to the standard starting position.');
    await refreshAll();
  }

  async function onUndo() {
    const result = await apiPost('/game/undo');
    if (result.success === false) { showToast(result.reason); return; }
    clearSelection();
    await refreshAll();
  }

  async function onRedo() {
    const result = await apiPost('/game/redo');
    if (result.success === false) { showToast(result.reason); return; }
    clearSelection();
    await refreshAll();
  }

  function onModeChange(newMode: 'hvh' | 'hva' | 'ava') {
    setMode(newMode);
    stopAutoPlay();
    const label = newMode === 'hvh' ? 'Human vs Human' : newMode === 'hva' ? 'Human vs AI' : 'AI vs AI';
    stepPanelAdd('MODE', `Switched to ${label}.`);
    if (newMode === 'ava') {
      stepPanelAdd('MODE', 'Use Step or Auto Play to make the engine play both sides.');
    }
    modeRef.current = newMode;
    maybeTriggerAiMove();
  }

  function onStep() {
    stopAutoPlay();
    if (statusRef.current === 'CHECKMATE' || statusRef.current === 'STALEMATE') return;
    calculateBestMove(true);
  }

  function onAutoPlay() {
    stepPanelAdd('AUTO PLAY', 'Running continuously until Pause is pressed or the game ends.');
    startAutoPlay();
  }

  function onPause() {
    stopAutoPlay();
    stepPanelAdd('PAUSE', 'Auto play stopped.');
  }

  async function gotoPly(ply: number) {
    await apiPost('/game/goto', { ply });
    clearSelection();
    await refreshAll();
  }

  // ------------------------------------------------------------------
  // FEN tab
  // ------------------------------------------------------------------
  const [fenFields, setFenFields] = useState<string[] | null>(null);
  const [fenInput, setFenInput] = useState('');
  const [fenLoadMsg, setFenLoadMsg] = useState<{ text: string; ok: boolean } | null>(null);

  const refreshFenTab = useCallback(async () => {
    const data = await apiGet('/fen');
    setFenFields(data.fen.split(' '));
    setFenInput(data.fen);
  }, [apiGet]);

  async function loadFenIntoGame() {
    const value = fenInput.trim();
    if (!value) return;
    const result = await apiPost('/game/load-fen', { fen: value });
    if (result.error) {
      setFenLoadMsg({ text: `Rejected: ${result.error}`, ok: false });
      return;
    }
    setFenLoadMsg({ text: 'Position loaded into the live game.', ok: true });
    clearSelection();
    await refreshAll();
    await refreshFenTab();
  }

  async function copyFen() {
    try {
      await navigator.clipboard.writeText(fen);
      setFenLoadMsg({ text: 'Copied to clipboard.', ok: true });
    } catch {
      showToast('Clipboard access was blocked by the browser.');
    }
  }

  // ------------------------------------------------------------------
  // Board Representation tab
  // ------------------------------------------------------------------
  const [arrayGrid, setArrayGrid] = useState<(string | null)[][] | null>(null);
  const [squareDetail, setSquareDetail] = useState<{ row: number; col: number; code: string | null } | null>(null);

  const refreshBoardRepTab = useCallback(async () => {
    const data = await apiGet('/board');
    setArrayGrid(data.grid);
  }, [apiGet]);

  // ------------------------------------------------------------------
  // Data structures tab
  // ------------------------------------------------------------------
  const [dsIndex, setDsIndex] = useState(0);

  // ------------------------------------------------------------------
  // Engine search tab
  // ------------------------------------------------------------------
  const [engineDepth, setEngineDepth] = useState(3);
  const [engineAlgo, setEngineAlgo] = useState('alphabeta');
  const [engineResult, setEngineResult] = useState<SearchResultDto | null>(null);
  const [engineSearching, setEngineSearching] = useState(false);

  async function runEngineSearch() {
    setEngineSearching(true);
    const data: SearchResultDto = await apiGet(`/engine/search?depth=${engineDepth}&algorithm=${engineAlgo}&treeDepth=2`);
    setEngineResult(data);
    setEngineSearching(false);
  }

  // ------------------------------------------------------------------
  // Learn tab
  // ------------------------------------------------------------------
  const [lessonIndex, setLessonIndex] = useState(0);

  // ------------------------------------------------------------------
  // Tabs
  // ------------------------------------------------------------------
  const [activeTab, setActiveTab] = useState<TabId>('play');

  function onTabClick(tab: TabId) {
    setActiveTab(tab);
    if (tab === 'board-rep') refreshBoardRepTab();
    if (tab === 'fen') refreshFenTab();
  }

  // ------------------------------------------------------------------
  // Boot
  // ------------------------------------------------------------------
  useEffect(() => {
    (async () => {
      try {
        await refreshAll();
        stepPanelAdd('READY', 'Connected to the backend. Click a piece to begin.');
      } catch {
        stepPanelAdd('ERROR', 'Could not reach the backend API routes under /api.');
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => () => stopAutoPlay(), []);

  const evalPct = evalFillPct();
  const kingInCheckSquare = boardGrid && (status === 'CHECK' || status === 'CHECKMATE') ? findKingSquare(boardGrid, sideToMove) : null;

  return (
    <div className="app-shell">
      <header className="app-header">
        <div>
          <h1 className="app-title">Chess Engine <span className="dim">Laboratory</span><span className="cursor"></span></h1>
          <div className="app-subtitle">an interactive Next.js app for watching a search algorithm think</div>
        </div>
        <div className="server-indicator">
          <span className={`server-dot ${serverOnline === true ? 'online' : serverOnline === false ? 'offline' : ''}`}></span>
          <span>
            {serverOnline === null && 'connecting to backend\u2026'}
            {serverOnline === true && `connected \u2014 ${API_BASE}`}
            {serverOnline === false && `cannot reach the backend at ${API_BASE}`}
          </span>
        </div>
      </header>

      <nav className="tab-bar">
        {([
          ['play', 'Play'],
          ['board-rep', 'Board Representation'],
          ['fen', 'FEN'],
          ['data-structures', 'Data Structures'],
          ['engine', 'Engine Search'],
          ['learn', 'Learn Chess Engine'],
          ['debug', 'Debug Mode'],
        ] as [TabId, string][]).map(([id, label]) => (
          <button key={id} className={`tab-btn ${activeTab === id ? 'active' : ''}`} onClick={() => onTabClick(id)}>
            {label}
          </button>
        ))}
      </nav>

      {/* ================= PLAY ================= */}
      {activeTab === 'play' && (
        <section className="tab-panel">
          <div className="toolbar">
            <div className="toolbar-group">
              <button className="btn primary" onClick={onNewGame}>New Game</button>
              <button className="btn" onClick={onUndo}>Undo</button>
              <button className="btn" onClick={onRedo}>Redo</button>
            </div>
            <div className="toolbar-group">
              <span className="toolbar-label">Mode</span>
              <button className={`btn small ${mode === 'hvh' ? 'primary' : ''}`} onClick={() => onModeChange('hvh')}>Human vs Human</button>
              <button className={`btn small ${mode === 'hva' ? 'primary' : ''}`} onClick={() => onModeChange('hva')}>Human vs AI</button>
              <button className={`btn small ${mode === 'ava' ? 'primary' : ''}`} onClick={() => onModeChange('ava')}>AI vs AI</button>
            </div>
            <div className="toolbar-group">
              <span className="toolbar-label">Depth</span>
              <DepthSelector value={depth} onChange={setDepth} />
              <select className="algo-select" value={algorithm} onChange={(e) => setAlgorithm(e.target.value)}>
                <option value="alphabeta">Alpha-Beta</option>
                <option value="minimax">Minimax</option>
                <option value="iterative">Iterative Deepening</option>
              </select>
            </div>
            <div className="toolbar-group">
              <button className="btn" disabled={buttonsDisabled} onClick={() => calculateBestMove(false)}>Calculate Best Move</button>
              <button className="btn small" disabled={buttonsDisabled} onClick={onStep}>Step</button>
              <button className="btn small" disabled={buttonsDisabled} onClick={onAutoPlay}>Auto Play</button>
              <button className="btn small" onClick={onPause}>Pause</button>
            </div>
          </div>

          <div className="play-layout">
            <div className="board-column">
              <div className="board-frame">
                <div></div>
                {FILES.map((f) => <div key={f} className="coord">{f}</div>)}
                {Array.from({ length: 8 }).map((_, row) => (
                  <BoardRow
                    key={row}
                    row={row}
                    boardGrid={boardGrid}
                    selectedSquare={selectedSquare}
                    legalFromSelected={legalFromSelected}
                    lastMove={lastMove}
                    kingInCheckSquare={kingInCheckSquare}
                    onSquareClick={onSquareClick}
                  />
                ))}
              </div>
            </div>

            <div className="eval-meter">
              <span className="eval-label">Eval</span>
              <div className="eval-track">
                <div className="eval-fill-black" style={{ height: `${evalPct.black}%` }}></div>
                <div className="eval-zero-line" style={{ top: '50%' }}></div>
                <div className="eval-fill-white" style={{ height: `${evalPct.white}%` }}></div>
              </div>
              <span className="eval-readout">{evalReadout()}</span>
            </div>

            <div className="right-rail">
              <div className="panel">
                <div className="panel-title">Game State</div>
                <div className="state-grid">
                  <div className="stat-box"><span className="label">Turn</span><span className="value">{sideToMove === 'WHITE' ? 'White' : 'Black'}</span></div>
                  <div className="stat-box"><span className="label">Status</span><span className="value"><span className={`status-pill ${status.toLowerCase()}`}>{status.charAt(0) + status.slice(1).toLowerCase()}</span></span></div>
                  <div className="stat-box wide"><span className="label">Selected Piece</span><span className="value">{selectedSquare || '\u2014'}</span></div>
                  <div className="stat-box wide"><span className="label">FEN</span><span className="value mono" style={{ fontSize: '10.5px', wordBreak: 'break-all', display: 'block' }}>{fen || '\u2014'}</span></div>
                </div>
              </div>
              <div className="panel">
                <div className="panel-title">Move History</div>
                <MoveList moves={moveHistory} currentPly={currentPly} onGotoPly={gotoPly} />
              </div>
            </div>
          </div>

          <div className="console">
            <div className="console-header">
              <span className="title">Step-by-Step Execution</span>
              <button className="btn small" onClick={stepPanelClear}>Clear</button>
            </div>
            <ConsoleBody lines={stepLines.map((l) => ({ tag: l.label, msg: l.message }))} />
          </div>
        </section>
      )}

      {/* ================= BOARD REPRESENTATION ================= */}
      {activeTab === 'board-rep' && (
        <section className="tab-panel">
          <div className="two-col">
            <div className="panel">
              <div className="panel-title">8 &times; 8 Array &mdash; live from the backend</div>
              <p className="muted" style={{ marginTop: '-6px' }}>This is the actual grid the Board module holds right now, fetched from <code>GET /api/board</code>.</p>
              <div className="array-grid">
                {arrayGrid && arrayGrid.map((rowArr, row) => rowArr.map((code, col) => (
                  <div
                    key={`${row}-${col}`}
                    className={`array-cell ${code ? 'filled' : ''} ${squareDetail && squareDetail.row === row && squareDetail.col === col ? 'selected' : ''}`}
                    onClick={() => setSquareDetail({ row, col, code })}
                  >
                    {code || '\u00b7\u00b7'}
                  </div>
                )))}
              </div>
            </div>
            <div className="panel">
              <div className="panel-title">Square Detail</div>
              {!squareDetail && <div className="muted">Click any square in the array to inspect it.</div>}
              {squareDetail && (
                <div className="fen-field-grid">
                  <dt>Square</dt><dd>{squareFromRowCol(squareDetail.row, squareDetail.col)}</dd>
                  <dt>Piece</dt><dd>{squareDetail.code ? `${squareDetail.code[0] === 'W' ? 'White' : 'Black'} ${PIECE_NAME[squareDetail.code[1]]} (code "${squareDetail.code}")` : 'empty'}</dd>
                  <dt>Internal row</dt><dd>{squareDetail.row} <span className="muted">(0 = rank 8)</span></dd>
                  <dt>Internal column</dt><dd>{squareDetail.col} <span className="muted">(0 = file a)</span></dd>
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* ================= FEN ================= */}
      {activeTab === 'fen' && (
        <section className="tab-panel">
          <div className="two-col">
            <div className="panel">
              <div className="panel-title">Position &rarr; FEN</div>
              {fenFields && (
                <dl className="fen-field-grid">
                  <dt>Full FEN</dt><dd>{fenFields.join(' ')}</dd>
                  <dt>Piece placement</dt><dd>{fenFields[0]}</dd>
                  <dt>Side to move</dt><dd>{fenFields[1] === 'w' ? 'White (w)' : 'Black (b)'}</dd>
                  <dt>Castling rights</dt><dd>{fenFields[2]}</dd>
                  <dt>En passant target</dt><dd>{fenFields[3]}</dd>
                  <dt>Halfmove clock</dt><dd>{fenFields[4]}</dd>
                  <dt>Fullmove number</dt><dd>{fenFields[5]}</dd>
                </dl>
              )}
            </div>
            <div className="panel">
              <div className="panel-title">FEN &rarr; Position</div>
              <p className="muted" style={{ marginTop: '-6px' }}>Paste a FEN string and load it into the live game session.</p>
              <input
                className="fen-input"
                value={fenInput}
                onChange={(e) => setFenInput(e.target.value)}
                placeholder="rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
              />
              <div style={{ marginTop: '10px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button className="btn primary" onClick={loadFenIntoGame}>Load Position</button>
                <button className="btn" onClick={copyFen}>Copy Current FEN</button>
              </div>
              {fenLoadMsg && (
                <div className="muted" style={{ marginTop: '8px', fontSize: '12px', color: fenLoadMsg.ok ? 'var(--accent-signal)' : 'var(--accent-alert)' }}>
                  {fenLoadMsg.text}
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* ================= DATA STRUCTURES ================= */}
      {activeTab === 'data-structures' && (
        <section className="tab-panel">
          <div className="panel">
            <div className="panel-title">Backend Data Structures</div>
            <div className="data-structure-grid">
              {DATA_STRUCTURES.map((ds, i) => (
                <div key={ds.name} className="ds-card" onClick={() => setDsIndex(i)}>
                  <h4>{ds.name}</h4>
                  <p>{ds.summary}</p>
                </div>
              ))}
            </div>
            <div className="ds-detail">
              <h3>{DATA_STRUCTURES[dsIndex].name} <span className="muted mono" style={{ fontSize: '12px' }}>&mdash; {DATA_STRUCTURES[dsIndex].file}</span></h3>
              <div className="field"><span className="field-label">What it stores</span><p>{DATA_STRUCTURES[dsIndex].stores}</p></div>
              <div className="field"><span className="field-label">Why it exists</span><p>{DATA_STRUCTURES[dsIndex].why}</p></div>
              <div className="field"><span className="field-label">How it is used</span><p>{DATA_STRUCTURES[dsIndex].how}</p></div>
            </div>
          </div>
        </section>
      )}

      {/* ================= ENGINE SEARCH ================= */}
      {activeTab === 'engine' && (
        <section className="tab-panel">
          <div className="panel">
            <div className="panel-title">Run A Search Against The Current Position</div>
            <div className="toolbar-group" style={{ display: 'inline-flex', marginBottom: '14px' }}>
              <span className="toolbar-label">Depth</span>
              <DepthSelector value={engineDepth} onChange={setEngineDepth} />
              <select className="algo-select" value={engineAlgo} onChange={(e) => setEngineAlgo(e.target.value)}>
                <option value="alphabeta">Alpha-Beta</option>
                <option value="minimax">Minimax</option>
                <option value="iterative">Iterative Deepening</option>
              </select>
              <button className="btn primary" onClick={runEngineSearch}>Run Search</button>
            </div>

            <div className="search-stats">
              {engineSearching && <span className="muted">Searching...</span>}
              {!engineSearching && engineResult && [
                ['Best Move', engineResult.bestMove || '\u2014'],
                ['Evaluation', `${engineResult.evaluation} (${engineResult.evaluationCentipawns}cp)`],
                ['Depth', engineResult.depth],
                ['Positions Searched', engineResult.nodesSearched.toLocaleString()],
                ['Positions Pruned', engineResult.nodesPruned.toLocaleString()],
                ['Pruning %', `${engineResult.pruningPercentage}%`],
                ['Execution Time', `${engineResult.executionTimeMs}ms`],
              ].map(([label, value]) => (
                <div key={label as string} className="stat-box"><span className="label">{label}</span><span className="value">{value}</span></div>
              ))}
            </div>

            <div className="panel-title" style={{ marginTop: '16px' }}>Search Tree &mdash; first 2 plies from root</div>
            <div className="tree-view">
              {!engineResult && <span className="muted">Run a search to see the tree.</span>}
              {engineResult && <TreeNodeView node={engineResult.tree} isAlphaBeta={engineAlgo !== 'minimax'} />}
            </div>
            {engineResult && engineAlgo !== 'minimax' && engineResult.nodesPruned > 0 && (
              <div className="explain-box">
                {engineAlgo === 'iterative'
                  ? `${engineResult.nodesPruned} branch(es) were pruned across all depths searched (1 through ${engineResult.depth}) - iterative deepening reuses each shallow pass's best move to prune even more effectively at deeper plies. Node counts above are summed across every depth actually searched.`
                  : `${engineResult.nodesPruned} branch(es) were pruned: once a node found a reply proving the opponent already has a better alternative elsewhere in the tree (beta <= alpha), the remaining sibling moves at that node could not change the result, so they were never searched. Dashed, faded nodes below were never evaluated.`}
              </div>
            )}
          </div>
        </section>
      )}

      {/* ================= LEARN ================= */}
      {activeTab === 'learn' && (
        <section className="tab-panel">
          <div className="lesson-layout">
            <div className="lesson-list">
              {LESSONS.map((l, i) => (
                <button key={l.title} className={`lesson-list-item ${lessonIndex === i ? 'active' : ''}`} onClick={() => setLessonIndex(i)}>
                  <span className="num">{String(i + 1).padStart(2, '0')}</span> {l.title}
                </button>
              ))}
            </div>
            <div className="panel lesson-body">
              <div className="lesson-eyebrow">{LESSONS[lessonIndex].eyebrow} of {LESSONS.length}</div>
              <h2>{LESSONS[lessonIndex].title}</h2>
              <p>{LESSONS[lessonIndex].body}</p>
              <div className="lesson-challenge">
                <span className="challenge-label">Try it yourself</span>
                <p>{LESSONS[lessonIndex].challenge}</p>
              </div>
              <div className="lesson-nav">
                <button className="btn" disabled={lessonIndex === 0} onClick={() => setLessonIndex((i) => i - 1)}>&larr; Previous</button>
                <button className="btn primary" disabled={lessonIndex === LESSONS.length - 1} onClick={() => setLessonIndex((i) => i + 1)}>Next Step &rarr;</button>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ================= DEBUG ================= */}
      {activeTab === 'debug' && (
        <section className="tab-panel">
          <div className="console" style={{ marginTop: 0 }}>
            <div className="console-header">
              <span className="title">Backend Event Log &mdash; real API calls made this session</span>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button className="btn small" onClick={() => setDebugPaused((p) => !p)}>{debugPaused ? 'Resume' : 'Pause'}</button>
                <button className="btn small" onClick={() => setDebugRevealedCount((c) => Math.min(c + 1, debugEvents.length))}>Next Event</button>
                <button className="btn small" onClick={() => setDebugRevealedCount(debugEvents.length)}>Run All</button>
                <button className="btn small" onClick={() => { setDebugEvents([]); setDebugRevealedCount(0); }}>Clear</button>
              </div>
            </div>
            <div style={{ maxHeight: '520px', overflowY: 'auto' }}>
              <ConsoleBody
                lines={debugEvents.slice(0, debugRevealedCount).map((e) => ({ ts: e.time, tag: `${e.method} ${e.endpoint}`, msg: e.summary }))}
                emptyMessage="No events yet &mdash; interact with the app to generate real backend calls."
              />
            </div>
          </div>
        </section>
      )}

      <div id="toastContainer">
        {toasts.map((t) => (
          <div key={t.id} className="toast">{t.message}</div>
        ))}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------
// Small presentational sub-components
// ------------------------------------------------------------------
function DepthSelector({ value, onChange }: { value: number; onChange: (d: number) => void }) {
  return (
    <div className="depth-selector">
      {[1, 2, 3, 4, 5, 6].map((d) => (
        <button key={d} className={`depth-btn ${d === value ? 'active' : ''}`} onClick={() => onChange(d)}>{d}</button>
      ))}
    </div>
  );
}

function BoardRow({
  row, boardGrid, selectedSquare, legalFromSelected, lastMove, kingInCheckSquare, onSquareClick,
}: {
  row: number;
  boardGrid: (string | null)[][] | null;
  selectedSquare: string | null;
  legalFromSelected: MoveDetail[];
  lastMove: { from: string; to: string } | null;
  kingInCheckSquare: string | null;
  onSquareClick: (algebraic: string) => void;
}) {
  return (
    <>
      <div className="coord">{8 - row}</div>
      {Array.from({ length: 8 }).map((_, col) => {
        const algebraic = squareFromRowCol(row, col);
        const isLight = (row + col) % 2 === 0;
        const code = boardGrid ? boardGrid[row][col] : null;
        const classes = ['square', isLight ? 'light' : 'dark'];
        if (selectedSquare === algebraic) classes.push('selected');
        if (lastMove && (lastMove.from === algebraic || lastMove.to === algebraic)) classes.push('last-move');
        if (kingInCheckSquare === algebraic) classes.push('in-check');
        const destMove = selectedSquare ? legalFromSelected.find((m) => m.to === algebraic) : null;
        return (
          <div key={col} className={classes.join(' ')} onClick={() => onSquareClick(algebraic)}>
            {code && <span className={`piece ${code[0] === 'W' ? 'white' : 'black'}`}>{PIECE_GLYPH[code] || '?'}</span>}
            {destMove && <div className={destMove.isCapture ? 'dest-ring' : 'dest-dot'}></div>}
          </div>
        );
      })}
    </>
  );
}

function MoveList({ moves, currentPly, onGotoPly }: { moves: MoveDetail[]; currentPly: number; onGotoPly: (ply: number) => void }) {
  if (!moves || moves.length === 0) {
    return <span className="muted">No moves yet.</span>;
  }
  const rows = [];
  for (let i = 0; i < moves.length; i += 2) {
    const plyNum = i / 2 + 1;
    const whiteMove = moves[i];
    const blackMove = moves[i + 1];
    rows.push(
      <div className="move-row" key={plyNum}>
        <span className="ply-num">{plyNum}.</span>
        <MoveEntry move={whiteMove} ply={i + 1} currentPly={currentPly} onGotoPly={onGotoPly} />
        {blackMove ? <MoveEntry move={blackMove} ply={i + 2} currentPly={currentPly} onGotoPly={onGotoPly} /> : <span className="move-entry empty">-</span>}
      </div>
    );
  }
  return <div className="move-list">{rows}</div>;
}

function MoveEntry({ move, ply, currentPly, onGotoPly }: { move: MoveDetail | undefined; ply: number; currentPly: number; onGotoPly: (ply: number) => void }) {
  if (!move) return <span className="move-entry empty">-</span>;
  const isCurrent = ply === currentPly;
  return (
    <button className={`move-entry ${isCurrent ? 'current-ply' : ''}`} onClick={() => onGotoPly(ply)}>{move.uci}</button>
  );
}

function ConsoleBody({ lines, emptyMessage }: { lines: { ts?: string; tag: string; msg: string }[]; emptyMessage?: string }) {
  if (!lines || lines.length === 0) {
    return (
      <div className="console-body">
        <div className="console-line muted"><span className="msg">{emptyMessage || 'Click a piece to begin.'}</span></div>
      </div>
    );
  }
  return (
    <div className="console-body">
      {lines.map((l, i) => (
        <div key={i} className={`console-line ${i === lines.length - 1 ? 'step-active' : ''}`}>
          {l.ts && <span className="ts">{l.ts}</span>}
          {l.tag && <span className="tag">{l.tag}</span>}
          <span className="msg">{l.msg}</span>
        </div>
      ))}
    </div>
  );
}

function TreeNodeView({ node, isAlphaBeta }: { node: SearchNodeDto; isAlphaBeta: boolean }) {
  if (!node) return null;
  const isRoot = node.move === null;
  const pruned = node.pruned;
  const nodeClass = pruned ? 'pruned' : node.maximizing ? 'min-node' : 'max-node';
  const evalText = node.evaluation !== null && node.evaluation !== undefined
    ? (node.evaluation / 100).toFixed(2)
    : pruned ? 'not searched' : '\u2026';

  return (
    <div className="tree-row">
      <div>
        <div className={`tree-node ${nodeClass}`}>
          <span className="mv">{isRoot ? 'root' : node.move}</span>
          <span className="ev">{evalText}</span>
          {isAlphaBeta && <span className="ab">&alpha;{(node.alpha / 100).toFixed(1)} &beta;{(node.beta / 100).toFixed(1)}</span>}
        </div>
        {node.children && node.children.length > 0 && (
          <div className="tree-children">
            {node.children.map((c, i) => <TreeNodeView key={i} node={c} isAlphaBeta={isAlphaBeta} />)}
          </div>
        )}
        {(!node.children || node.children.length === 0) && (node.childCount || 0) > 0 && (
          <div className="tree-children">
            <span className="muted" style={{ padding: '6px' }}>({node.childCount} more moves not shown at this tree depth)</span>
          </div>
        )}
      </div>
    </div>
  );
}
