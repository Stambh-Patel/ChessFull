import { generateLegalMoves, generateLegalMovesForSquare, getStatus } from './legalMoveGenerator';
import { applyMove } from './moveExecutor';
import { parseFen, toFen } from './fen';
import { GameState, GameStatus, Move, Piece, PieceType, Square, pieceDisplayName, squareToAlgebraic } from './types';
import { isInCheck } from './checkDetector';

/** Outcome of makeMove(): either the matched legal Move that was applied,
 *  or a rejection with a human-readable reason. Mirrors
 *  com.chesslab.service.MoveResult. */
export type MoveResult = { legal: true; move: Move } | { legal: false; reason: string };

/** Owns the single active game session: the full history of positions
 *  (for undo/redo) and move-validation/application logic. Ported 1:1
 *  from com.chesslab.service.GameSessionService.
 *
 *  A single in-memory session (no multi-user session management) matches
 *  the original: this is a teaching tool for one student working through
 *  one game at a time, not a multi-tenant server. The instance below is
 *  kept on `globalThis` so it survives Next.js dev-server hot reloads. */
class GameSessionService {
  private states: GameState[] = [];
  private moves: Move[] = [];
  private currentIndex = 0;

  constructor() {
    this.newGame();
  }

  newGame(): void {
    this.states = [
      parseFen('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'),
    ];
    this.moves = [];
    this.currentIndex = 0;
  }

  loadFen(fen: string): void {
    const state = parseFen(fen);
    this.states = [state];
    this.moves = [];
    this.currentIndex = 0;
  }

  currentState(): GameState {
    return this.states[this.currentIndex];
  }

  currentStatus(): GameStatus {
    return getStatus(this.currentState());
  }

  currentFen(): string {
    return toFen(this.currentState());
  }

  legalMoves(): Move[] {
    return generateLegalMoves(this.currentState());
  }

  legalMovesFrom(sq: Square): Move[] {
    return generateLegalMovesForSquare(this.currentState(), sq);
  }

  moveHistory(): Move[] {
    return this.moves.slice(0, this.currentIndex);
  }

  fullMoveHistory(): Move[] {
    return this.moves.slice();
  }

  currentPly(): number {
    return this.currentIndex;
  }

  makeMove(from: Square, to: Square, promotion: PieceType | null): MoveResult {
    const legal = generateLegalMoves(this.currentState());
    let match: Move | null = null;
    for (const candidate of legal) {
      if (!squaresEqual(candidate.from, from) || !squaresEqual(candidate.to, to)) continue;
      if (candidate.type === 'PROMOTION') {
        const desired = promotion !== null ? promotion : 'QUEEN';
        if (candidate.promotionType !== desired) continue;
      }
      match = candidate;
      break;
    }

    if (match === null) {
      return { legal: false, reason: this.describeWhyIllegal(from, to) };
    }

    const next = applyMove(this.currentState(), match);

    while (this.states.length > this.currentIndex + 1) this.states.pop();
    while (this.moves.length > this.currentIndex) this.moves.pop();

    this.states.push(next);
    this.moves.push(match);
    this.currentIndex++;

    return { legal: true, move: match };
  }

  undo(): boolean {
    if (this.currentIndex === 0) return false;
    this.currentIndex--;
    return true;
  }

  redo(): boolean {
    if (this.currentIndex >= this.states.length - 1) return false;
    this.currentIndex++;
    return true;
  }

  jumpToPly(ply: number): boolean {
    if (ply < 0 || ply >= this.states.length) return false;
    this.currentIndex = ply;
    return true;
  }

  historyLength(): number {
    return this.moves.length;
  }

  private describeWhyIllegal(from: Square, to: Square): string {
    const piece: Piece | null = this.currentState().board.get(from);
    if (piece === null) {
      return `There is no piece on ${squareToAlgebraic(from)}.`;
    }
    if (piece.color !== this.currentState().sideToMove) {
      return `It is ${this.currentState().sideToMove}'s turn to move, but that piece is ${piece.color}.`;
    }
    const inCheck = isInCheck(this.currentState(), this.currentState().sideToMove);
    return (
      `Moving ${pieceDisplayName(piece)} from ${squareToAlgebraic(from)} to ${squareToAlgebraic(to)} ` +
      `is not a legal move in this position${inCheck ? ' (your king is in check).' : '.'}`
    );
  }
}

function squaresEqual(a: Square, b: Square): boolean {
  return a.row === b.row && a.col === b.col;
}

declare global {
  // eslint-disable-next-line no-var
  var __chessGameSession: GameSessionService | undefined;
}

export function getGameSession(): GameSessionService {
  if (!globalThis.__chessGameSession) {
    globalThis.__chessGameSession = new GameSessionService();
  }
  return globalThis.__chessGameSession;
}
