import { generateLegalMoves, generateLegalMovesForSquare, getStatus } from './legalMoveGenerator';
import { applyMove } from './moveExecutor';
import { parseFen, STARTING_FEN, toFen } from './fen';
import { GameState, Move, PieceType, Square, pieceDisplayName, squareToAlgebraic, squaresEqual } from './types';
import { isInCheck } from './checkDetector';

/** Stateless game operations - every function takes the position it needs
 *  (as a FEN string, resolved by the caller) and returns a result. There
 *  is no server-side session: on a serverless platform (Netlify, Vercel,
 *  ...) each API call can land on a different, cold function instance,
 *  so the CLIENT is the source of truth for "what position are we at" -
 *  it sends the current FEN with every request and the server just does
 *  one unit of chess logic against it. */

export type MoveResult =
  | { legal: true; move: Move; resultingFen: string }
  | { legal: false; reason: string };

export function resolveState(fen: string | null | undefined): GameState {
  if (fen && fen.trim() !== '') return parseFen(fen);
  return parseFen(STARTING_FEN);
}

export function legalMoves(state: GameState): Move[] {
  return generateLegalMoves(state);
}

export function legalMovesFrom(state: GameState, sq: Square): Move[] {
  return generateLegalMovesForSquare(state, sq);
}

export function statusOf(state: GameState) {
  return getStatus(state);
}

export function makeMove(
  state: GameState,
  from: Square,
  to: Square,
  promotion: PieceType | null
): MoveResult {
  const legal = generateLegalMoves(state);
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
    return { legal: false, reason: describeWhyIllegal(state, from, to) };
  }

  const next = applyMove(state, match);
  return { legal: true, move: match, resultingFen: toFen(next) };
}

function describeWhyIllegal(state: GameState, from: Square, to: Square): string {
  const piece = state.board.get(from);
  if (piece === null) {
    return `There is no piece on ${squareToAlgebraic(from)}.`;
  }
  if (piece.color !== state.sideToMove) {
    return `It is ${state.sideToMove}'s turn to move, but that piece is ${piece.color}.`;
  }
  const inCheck = isInCheck(state, state.sideToMove);
  return (
    `Moving ${pieceDisplayName(piece)} from ${squareToAlgebraic(from)} to ${squareToAlgebraic(to)} ` +
    `is not a legal move in this position${inCheck ? ' (your king is in check).' : '.'}`
  );
}
