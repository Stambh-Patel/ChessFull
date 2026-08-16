import { isInCheck, isSquareAttacked } from './checkDetector';
import { applyMove } from './moveExecutor';
import { generatePseudoLegalMoves } from './moveGenerator';
import { Board, GameState, GameStatus, Move, PieceColor, Square, moveIsCastle, oppositeColor, square, squaresEqual } from './types';

/** Turns pseudo-legal moves into fully legal ones by simulating each move
 *  and discarding any that leave the mover's own king in check. Ported
 *  1:1 from com.chesslab.engine.LegalMoveGenerator. */

export function generateLegalMoves(state: GameState): Move[] {
  const pseudoLegal = generatePseudoLegalMoves(state);
  const legal: Move[] = [];
  const mover = state.sideToMove;

  for (const move of pseudoLegal) {
    if (moveIsCastle(move) && !isCastlingActuallyLegal(state, move, mover)) continue;
    const resulting = applyMove(state, move);
    if (!isInCheck(resulting, mover)) legal.push(move);
  }
  return legal;
}

export function generateLegalMovesForSquare(state: GameState, from: Square): Move[] {
  return generateLegalMoves(state).filter((m) => squaresEqual(m.from, from));
}

function isCastlingActuallyLegal(state: GameState, move: Move, color: PieceColor): boolean {
  if (isInCheck(state, color)) return false;

  const row = move.from.row;
  const passThrough = move.type === 'CASTLE_KINGSIDE' ? square(row, 5) : square(row, 3);

  const board: Board = state.board;
  const enemy = oppositeColor(color);
  if (isSquareAttacked(board, passThrough, enemy)) return false;
  if (isSquareAttacked(board, move.to, enemy)) return false;
  return true;
}

export function getStatus(state: GameState): GameStatus {
  const inCheck = isInCheck(state, state.sideToMove);
  const hasLegalMoves = generateLegalMoves(state).length > 0;

  if (hasLegalMoves) return inCheck ? 'CHECK' : 'ONGOING';
  return inCheck ? 'CHECKMATE' : 'STALEMATE';
}
