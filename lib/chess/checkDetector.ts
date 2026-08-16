import { Board, GameState, PieceColor, Square, isInBounds, oppositeColor } from './types';

/** Answers "is this square attacked by color X?" and "is this king in
 *  check?" - ported 1:1 from com.chesslab.engine.CheckDetector. */

const BISHOP_DIRECTIONS: [number, number][] = [
  [-1, -1], [-1, 1], [1, -1], [1, 1],
];
const ROOK_DIRECTIONS: [number, number][] = [
  [-1, 0], [1, 0], [0, -1], [0, 1],
];
const KNIGHT_OFFSETS: [number, number][] = [
  [-2, -1], [-2, 1], [-1, -2], [-1, 2],
  [1, -2], [1, 2], [2, -1], [2, 1],
];
const KING_OFFSETS: [number, number][] = [
  [-1, -1], [-1, 0], [-1, 1], [0, -1],
  [0, 1], [1, -1], [1, 0], [1, 1],
];

export function isInCheck(state: GameState, kingColor: PieceColor): boolean {
  const kingSquare = state.board.findKing(kingColor);
  if (kingSquare === null) return false;
  return isSquareAttacked(state.board, kingSquare, oppositeColor(kingColor));
}

export function isSquareAttacked(board: Board, target: Square, attacker: PieceColor): boolean {
  return (
    isAttackedByPawn(board, target, attacker) ||
    isAttackedByKnight(board, target, attacker) ||
    isAttackedBySliding(board, target, attacker, BISHOP_DIRECTIONS, 'BISHOP') ||
    isAttackedBySliding(board, target, attacker, ROOK_DIRECTIONS, 'ROOK') ||
    isAttackedByKing(board, target, attacker)
  );
}

function isAttackedByPawn(board: Board, target: Square, attacker: PieceColor): boolean {
  const dir = attacker === 'WHITE' ? 1 : -1;
  for (const dc of [-1, 1]) {
    const r = target.row + dir;
    const c = target.col + dc;
    if (!isInBounds(r, c)) continue;
    const p = board.get(r, c);
    if (p !== null && p.color === attacker && p.type === 'PAWN') return true;
  }
  return false;
}

function isAttackedByKnight(board: Board, target: Square, attacker: PieceColor): boolean {
  for (const [dr, dc] of KNIGHT_OFFSETS) {
    const r = target.row + dr;
    const c = target.col + dc;
    if (!isInBounds(r, c)) continue;
    const p = board.get(r, c);
    if (p !== null && p.color === attacker && p.type === 'KNIGHT') return true;
  }
  return false;
}

function isAttackedByKing(board: Board, target: Square, attacker: PieceColor): boolean {
  for (const [dr, dc] of KING_OFFSETS) {
    const r = target.row + dr;
    const c = target.col + dc;
    if (!isInBounds(r, c)) continue;
    const p = board.get(r, c);
    if (p !== null && p.color === attacker && p.type === 'KING') return true;
  }
  return false;
}

function isAttackedBySliding(
  board: Board,
  target: Square,
  attacker: PieceColor,
  directions: [number, number][],
  matchingType: 'BISHOP' | 'ROOK'
): boolean {
  for (const [dr, dc] of directions) {
    let r = target.row;
    let c = target.col;
    while (true) {
      r += dr;
      c += dc;
      if (!isInBounds(r, c)) break;
      const p = board.get(r, c);
      if (p === null) continue;
      if (p.color === attacker && (p.type === matchingType || p.type === 'QUEEN')) return true;
      break;
    }
  }
  return false;
}
