import {
  Board,
  GameState,
  Move,
  Piece,
  PieceColor,
  Square,
  castlingKingSide,
  castlingQueenSide,
  isInBounds,
  isValidOffset,
  moveCastleKingSide,
  moveCastleQueenSide,
  moveDoublePawnPush,
  moveEnPassant,
  moveNormal,
  movePromotion,
  offset,
  square,
  squaresEqual,
} from './types';

/**
 * Generates PSEUDO-LEGAL moves: moves that obey each piece's individual
 * movement rules (board boundaries, blocking, capture rules) but do NOT
 * yet check whether making the move leaves the mover's own king in
 * check. Ported 1:1 from com.chesslab.engine.MoveGenerator.
 */

const KNIGHT_OFFSETS: [number, number][] = [
  [-2, -1], [-2, 1], [-1, -2], [-1, 2],
  [1, -2], [1, 2], [2, -1], [2, 1],
];

const BISHOP_DIRECTIONS: [number, number][] = [
  [-1, -1], [-1, 1], [1, -1], [1, 1],
];

const ROOK_DIRECTIONS: [number, number][] = [
  [-1, 0], [1, 0], [0, -1], [0, 1],
];

const KING_OFFSETS: [number, number][] = [
  [-1, -1], [-1, 0], [-1, 1], [0, -1],
  [0, 1], [1, -1], [1, 0], [1, 1],
];

export function generatePseudoLegalMoves(state: GameState): Move[] {
  const moves: Move[] = [];
  const board = state.board;
  const side = state.sideToMove;

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = board.get(r, c);
      if (piece === null || piece.color !== side) continue;
      const from = square(r, c);
      moves.push(...generateMovesForPiece(state, from, piece));
    }
  }
  return moves;
}

export function generateMovesForPiece(state: GameState, from: Square, piece: Piece): Move[] {
  switch (piece.type) {
    case 'PAWN':
      return generatePawnMoves(state, from, piece);
    case 'KNIGHT':
      return generateOffsetMoves(state, from, piece, KNIGHT_OFFSETS);
    case 'BISHOP':
      return generateSlidingMoves(state, from, piece, BISHOP_DIRECTIONS);
    case 'ROOK':
      return generateSlidingMoves(state, from, piece, ROOK_DIRECTIONS);
    case 'QUEEN':
      return [
        ...generateSlidingMoves(state, from, piece, BISHOP_DIRECTIONS),
        ...generateSlidingMoves(state, from, piece, ROOK_DIRECTIONS),
      ];
    case 'KING':
      return generateKingMoves(state, from, piece);
  }
}

function generatePawnMoves(state: GameState, from: Square, pawn: Piece): Move[] {
  const moves: Move[] = [];
  const board = state.board;
  const direction = pawn.color === 'WHITE' ? -1 : 1;
  const startRow = pawn.color === 'WHITE' ? 6 : 1;
  const promotionRow = pawn.color === 'WHITE' ? 0 : 7;

  if (isInBounds(from.row + direction, from.col)) {
    const oneAhead = offset(from, direction, 0);
    if (board.isEmpty(oneAhead)) {
      addPawnMoveOrPromotions(moves, from, oneAhead, pawn, null, promotionRow);

      if (from.row === startRow) {
        const twoAhead = offset(from, 2 * direction, 0);
        if (board.isEmpty(twoAhead)) {
          moves.push(moveDoublePawnPush(from, twoAhead, pawn));
        }
      }
    }
  }

  for (const dc of [-1, 1]) {
    if (!isValidOffset(from, direction, dc)) continue;
    const target = offset(from, direction, dc);
    const occupant = board.get(target);
    if (occupant !== null && occupant.color !== pawn.color) {
      addPawnMoveOrPromotions(moves, from, target, pawn, occupant, promotionRow);
    } else if (occupant === null && state.enPassantTarget && squaresEqual(target, state.enPassantTarget)) {
      const capturedPawnSquare = square(from.row, target.col);
      const capturedPawn = board.get(capturedPawnSquare);
      if (capturedPawn !== null && capturedPawn.type === 'PAWN' && capturedPawn.color !== pawn.color) {
        moves.push(moveEnPassant(from, target, pawn, capturedPawn));
      }
    }
  }

  return moves;
}

function addPawnMoveOrPromotions(
  moves: Move[],
  from: Square,
  to: Square,
  pawn: Piece,
  captured: Piece | null,
  promotionRow: number
) {
  if (to.row === promotionRow) {
    for (const promo of ['QUEEN', 'ROOK', 'BISHOP', 'KNIGHT'] as const) {
      moves.push(movePromotion(from, to, pawn, captured, promo));
    }
  } else {
    moves.push(moveNormal(from, to, pawn, captured));
  }
}

function generateOffsetMoves(
  state: GameState,
  from: Square,
  piece: Piece,
  offsets: [number, number][]
): Move[] {
  const moves: Move[] = [];
  const board = state.board;
  for (const [dr, dc] of offsets) {
    if (!isValidOffset(from, dr, dc)) continue;
    const to = offset(from, dr, dc);
    const occupant = board.get(to);
    if (occupant === null) {
      moves.push(moveNormal(from, to, piece, null));
    } else if (occupant.color !== piece.color) {
      moves.push(moveNormal(from, to, piece, occupant));
    }
  }
  return moves;
}

function generateKingMoves(state: GameState, from: Square, king: Piece): Move[] {
  return [...generateOffsetMoves(state, from, king, KING_OFFSETS), ...generateCastlingMoves(state, from, king)];
}

function generateCastlingMoves(state: GameState, from: Square, king: Piece): Move[] {
  const moves: Move[] = [];
  const board = state.board;
  const color = king.color;
  const row = color === 'WHITE' ? 7 : 0;

  if (from.row !== row || from.col !== 4) return moves;

  const rights = state.castlingRights;

  if (castlingKingSide(rights, color)) {
    const f = square(row, 5);
    const g = square(row, 6);
    const h = square(row, 7);
    const rook = board.get(h);
    if (board.isEmpty(f) && board.isEmpty(g) && rook !== null && rook.type === 'ROOK' && rook.color === color) {
      moves.push(moveCastleKingSide(from, g, king));
    }
  }
  if (castlingQueenSide(rights, color)) {
    const d = square(row, 3);
    const c = square(row, 2);
    const b = square(row, 1);
    const a = square(row, 0);
    const rook = board.get(a);
    if (
      board.isEmpty(d) &&
      board.isEmpty(c) &&
      board.isEmpty(b) &&
      rook !== null &&
      rook.type === 'ROOK' &&
      rook.color === color
    ) {
      moves.push(moveCastleQueenSide(from, c, king));
    }
  }
  return moves;
}

function generateSlidingMoves(
  state: GameState,
  from: Square,
  piece: Piece,
  directions: [number, number][]
): Move[] {
  const moves: Move[] = [];
  const board = state.board;
  for (const [dr, dc] of directions) {
    let r = from.row;
    let c = from.col;
    while (true) {
      r += dr;
      c += dc;
      if (!isInBounds(r, c)) break;
      const to = square(r, c);
      const occupant = board.get(to);
      if (occupant === null) {
        moves.push(moveNormal(from, to, piece, null));
      } else {
        if (occupant.color !== piece.color) {
          moves.push(moveNormal(from, to, piece, occupant));
        }
        break;
      }
    }
  }
  return moves;
}
