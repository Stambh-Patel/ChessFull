import {
  CastlingRights,
  GameState,
  Move,
  PieceColor,
  Square,
  makePiece,
  oppositeColor,
  square,
  withoutBothSides,
  withoutKingSide,
  withoutQueenSide,
} from './types';

/** Applies a Move to a GameState and returns the resulting GameState.
 *  Ported 1:1 from com.chesslab.engine.MoveExecutor. GameState is treated
 *  as immutable: this always builds a fresh Board (via .copy()) and a
 *  fresh GameState object. */
export function applyMove(state: GameState, move: Move): GameState {
  const newBoard = state.board.copy();
  const mover = move.piece;
  const color = mover.color;

  newBoard.clear(move.from);

  switch (move.type) {
    case 'NORMAL':
    case 'DOUBLE_PAWN_PUSH':
      newBoard.set(move.to, mover);
      break;
    case 'EN_PASSANT': {
      newBoard.set(move.to, mover);
      const capturedSquare = square(move.from.row, move.to.col);
      newBoard.clear(capturedSquare);
      break;
    }
    case 'PROMOTION':
      newBoard.set(move.to, makePiece(color, move.promotionType!));
      break;
    case 'CASTLE_KINGSIDE': {
      newBoard.set(move.to, mover);
      const row = move.from.row;
      const rookFrom = square(row, 7);
      const rookTo = square(row, 5);
      const rook = newBoard.get(rookFrom);
      newBoard.clear(rookFrom);
      newBoard.set(rookTo, rook);
      break;
    }
    case 'CASTLE_QUEENSIDE': {
      newBoard.set(move.to, mover);
      const row = move.from.row;
      const rookFrom = square(row, 0);
      const rookTo = square(row, 3);
      const rook = newBoard.get(rookFrom);
      newBoard.clear(rookFrom);
      newBoard.set(rookTo, rook);
      break;
    }
  }

  const newRights = updateCastlingRights(state.castlingRights, move, color);
  const newEnPassantTarget = computeEnPassantTarget(move);
  const newHalfmoveClock = move.piece.type === 'PAWN' || move.capturedPiece !== null ? 0 : state.halfmoveClock + 1;
  const newFullmoveNumber = color === 'BLACK' ? state.fullmoveNumber + 1 : state.fullmoveNumber;

  return {
    board: newBoard,
    sideToMove: oppositeColor(color),
    castlingRights: newRights,
    enPassantTarget: newEnPassantTarget,
    halfmoveClock: newHalfmoveClock,
    fullmoveNumber: newFullmoveNumber,
  };
}

function computeEnPassantTarget(move: Move): Square | null {
  if (move.type !== 'DOUBLE_PAWN_PUSH') return null;
  const midRow = Math.floor((move.from.row + move.to.row) / 2);
  return square(midRow, move.from.col);
}

function updateCastlingRights(rights: CastlingRights, move: Move, color: PieceColor): CastlingRights {
  let updated = rights;

  if (move.piece.type === 'KING') {
    updated = withoutBothSides(updated, color);
  }
  if (move.piece.type === 'ROOK') {
    updated = forfeitIfRookHomeSquare(updated, move.from, color);
  }
  if (move.capturedPiece !== null && move.capturedPiece.type === 'ROOK') {
    updated = forfeitIfRookHomeSquare(updated, move.to, oppositeColor(color));
  }
  return updated;
}

function forfeitIfRookHomeSquare(rights: CastlingRights, sq: Square, rookColor: PieceColor): CastlingRights {
  const homeRow = rookColor === 'WHITE' ? 7 : 0;
  if (sq.row !== homeRow) return rights;
  if (sq.col === 0) return withoutQueenSide(rights, rookColor);
  if (sq.col === 7) return withoutKingSide(rights, rookColor);
  return rights;
}
