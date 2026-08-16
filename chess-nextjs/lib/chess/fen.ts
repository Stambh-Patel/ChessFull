import {
  Board,
  CastlingRights,
  GameState,
  IllegalArgument,
  PieceColor,
  Square,
  castlingRightsFromFenField,
  castlingRightsToFenField,
  makePiece,
  pieceFenChar,
  pieceTypeFromFenChar,
  square,
  squareFromAlgebraic,
  squareToAlgebraic,
} from './types';

export const STARTING_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

/** Parses a full FEN string into a GameState. Throws IllegalArgument on
 *  malformed input. Ported 1:1 from com.chesslab.util.FenConverter. */
export function parseFen(fen: string | null | undefined): GameState {
  if (fen === null || fen === undefined) throw new IllegalArgument('FEN string is null');
  const fields = fen.trim().split(/\s+/);
  if (fields.length !== 6) {
    throw new IllegalArgument(`FEN must have 6 space-separated fields, found ${fields.length}: "${fen}"`);
  }

  const board = parsePiecePlacement(fields[0]);
  const sideToMove = parseSideToMove(fields[1]);
  const castlingRights = castlingRightsFromFenField(fields[2]);
  const enPassantTarget = parseEnPassantTarget(fields[3]);
  const halfmoveClock = parseNonNegativeInt(fields[4], 'halfmove clock');
  const fullmoveNumber = parseNonNegativeInt(fields[5], 'fullmove number');

  return { board, sideToMove, castlingRights, enPassantTarget, halfmoveClock, fullmoveNumber };
}

/** Renders a GameState back into a single FEN string. */
export function toFen(state: GameState): string {
  return [
    piecePlacementField(state.board),
    state.sideToMove === 'WHITE' ? 'w' : 'b',
    castlingRightsToFenField(state.castlingRights),
    state.enPassantTarget === null ? '-' : squareToAlgebraic(state.enPassantTarget),
    String(state.halfmoveClock),
    String(state.fullmoveNumber),
  ].join(' ');
}

function parsePiecePlacement(field: string): Board {
  const board = Board.empty();
  const ranks = field.split('/');
  if (ranks.length !== 8) {
    throw new IllegalArgument(`Piece placement must have 8 ranks separated by '/', found ${ranks.length}: "${field}"`);
  }

  for (let row = 0; row < 8; row++) {
    const rank = ranks[row];
    let col = 0;
    for (const c of rank) {
      if (c >= '0' && c <= '9') {
        col += c.charCodeAt(0) - '0'.charCodeAt(0);
      } else {
        if (col >= 8) {
          throw new IllegalArgument(`Rank ${8 - row} overflows 8 files: "${rank}"`);
        }
        const color: PieceColor = c === c.toUpperCase() ? 'WHITE' : 'BLACK';
        const type = pieceTypeFromFenChar(c);
        board.set(square(row, col), makePiece(color, type));
        col++;
      }
    }
    if (col !== 8) {
      throw new IllegalArgument(`Rank ${8 - row} does not sum to 8 files: "${rank}"`);
    }
  }
  return board;
}

function parseSideToMove(field: string): PieceColor {
  if (field === 'w') return 'WHITE';
  if (field === 'b') return 'BLACK';
  throw new IllegalArgument(`Side to move must be 'w' or 'b', found: "${field}"`);
}

function parseEnPassantTarget(field: string): Square | null {
  if (field === '-') return null;
  try {
    return squareFromAlgebraic(field);
  } catch {
    throw new IllegalArgument(`Invalid en passant target square: "${field}"`);
  }
}

function parseNonNegativeInt(field: string, fieldName: string): number {
  const value = Number(field);
  if (!Number.isInteger(value) || value < 0 || field.trim() === '') {
    throw new IllegalArgument(`Invalid ${fieldName}: "${field}"`);
  }
  return value;
}

function piecePlacementField(board: Board): string {
  const rows: string[] = [];
  for (let row = 0; row < 8; row++) {
    let s = '';
    let emptyRun = 0;
    for (let col = 0; col < 8; col++) {
      const p = board.get(row, col);
      if (p === null) {
        emptyRun++;
      } else {
        if (emptyRun > 0) {
          s += String(emptyRun);
          emptyRun = 0;
        }
        s += pieceFenChar(p);
      }
    }
    if (emptyRun > 0) s += String(emptyRun);
    rows.push(s);
  }
  return rows.join('/');
}
