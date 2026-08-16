/**
 * Core domain types for the chess engine, ported 1:1 from the original
 * Java model classes (com.chesslab.model.*). GameState/Move/Piece are
 * treated as immutable plain objects; Board is a mutable 8x8 grid that is
 * explicitly `.copy()`-ed whenever a move is applied, exactly like the
 * Java version - this is what makes the search tree and undo/redo safe.
 *
 * Coordinate convention (unchanged from Java):
 *   row 0 = rank 8 (black's back rank), row 7 = rank 1 (white's back rank)
 *   col 0 = file a, col 7 = file h
 */

export type PieceColor = 'WHITE' | 'BLACK';

export type PieceType = 'PAWN' | 'KNIGHT' | 'BISHOP' | 'ROOK' | 'QUEEN' | 'KING';

export const PIECE_TYPES: PieceType[] = ['PAWN', 'KNIGHT', 'BISHOP', 'ROOK', 'QUEEN', 'KING'];

export const PIECE_FEN_CHAR: Record<PieceType, string> = {
  PAWN: 'p',
  KNIGHT: 'n',
  BISHOP: 'b',
  ROOK: 'r',
  QUEEN: 'q',
  KING: 'k',
};

export const PIECE_VALUE: Record<PieceType, number> = {
  PAWN: 100,
  KNIGHT: 320,
  BISHOP: 330,
  ROOK: 500,
  QUEEN: 900,
  KING: 20000,
};

export function pieceTypeFromFenChar(c: string): PieceType {
  const lower = c.toLowerCase();
  for (const t of PIECE_TYPES) {
    if (PIECE_FEN_CHAR[t] === lower) return t;
  }
  throw new IllegalArgument(`Unknown FEN piece character: ${c}`);
}

export function oppositeColor(c: PieceColor): PieceColor {
  return c === 'WHITE' ? 'BLACK' : 'WHITE';
}

/** Thrown for malformed input (FEN, algebraic squares, ...) - mirrors
 *  Java's IllegalArgumentException, caught by API routes and turned into
 *  a 400 response. */
export class IllegalArgument extends Error {}

export interface Piece {
  color: PieceColor;
  type: PieceType;
}

export function makePiece(color: PieceColor, type: PieceType): Piece {
  return { color, type };
}

export function piecesEqual(a: Piece | null, b: Piece | null): boolean {
  if (a === null || b === null) return a === b;
  return a.color === b.color && a.type === b.type;
}

/** FEN character for this exact piece: uppercase for white, lowercase for black. */
export function pieceFenChar(p: Piece): string {
  const c = PIECE_FEN_CHAR[p.type];
  return p.color === 'WHITE' ? c.toUpperCase() : c;
}

/** Short code used by the frontend / debug logs, e.g. "WP", "BN", "WK". */
export function pieceCode(p: Piece): string {
  return (p.color === 'WHITE' ? 'W' : 'B') + PIECE_FEN_CHAR[p.type].toUpperCase();
}

/** Human-readable name, e.g. "White Pawn". */
export function pieceDisplayName(p: Piece): string {
  const colorName = p.color === 'WHITE' ? 'White' : 'Black';
  const typeName = p.type.charAt(0) + p.type.slice(1).toLowerCase();
  return `${colorName} ${typeName}`;
}

// ------------------------------------------------------------------
// Square
// ------------------------------------------------------------------
export interface Square {
  row: number; // 0..7, 0 = rank 8
  col: number; // 0..7, 0 = file a
}

export function square(row: number, col: number): Square {
  if (row < 0 || row > 7 || col < 0 || col > 7) {
    throw new IllegalArgument(`Square out of bounds: row=${row} col=${col}`);
  }
  return { row, col };
}

export function isInBounds(row: number, col: number): boolean {
  return row >= 0 && row < 8 && col >= 0 && col < 8;
}

export function squaresEqual(a: Square | null, b: Square | null): boolean {
  if (a === null || b === null) return a === b;
  return a.row === b.row && a.col === b.col;
}

/** Parses algebraic notation like "e4" into a Square. */
export function squareFromAlgebraic(algebraic: string): Square {
  if (!algebraic || algebraic.length !== 2) {
    throw new IllegalArgument(`Invalid algebraic square: ${algebraic}`);
  }
  const fileChar = algebraic[0].toLowerCase();
  const rankChar = algebraic[1];
  const col = fileChar.charCodeAt(0) - 'a'.charCodeAt(0);
  const rank = rankChar.charCodeAt(0) - '0'.charCodeAt(0);
  if (col < 0 || col > 7 || rank < 1 || rank > 8) {
    throw new IllegalArgument(`Invalid algebraic square: ${algebraic}`);
  }
  return { row: 8 - rank, col };
}

/** Converts back to algebraic notation, e.g. "e4". */
export function squareToAlgebraic(s: Square): string {
  const file = String.fromCharCode('a'.charCodeAt(0) + s.col);
  const rank = 8 - s.row;
  return `${file}${rank}`;
}

export function offset(s: Square, rowDelta: number, colDelta: number): Square {
  return square(s.row + rowDelta, s.col + colDelta);
}

export function isValidOffset(s: Square, rowDelta: number, colDelta: number): boolean {
  return isInBounds(s.row + rowDelta, s.col + colDelta);
}

// ------------------------------------------------------------------
// CastlingRights
// ------------------------------------------------------------------
export interface CastlingRights {
  whiteKingSide: boolean;
  whiteQueenSide: boolean;
  blackKingSide: boolean;
  blackQueenSide: boolean;
}

export function allCastlingRights(): CastlingRights {
  return { whiteKingSide: true, whiteQueenSide: true, blackKingSide: true, blackQueenSide: true };
}

export function noCastlingRights(): CastlingRights {
  return { whiteKingSide: false, whiteQueenSide: false, blackKingSide: false, blackQueenSide: false };
}

export function castlingKingSide(rights: CastlingRights, color: PieceColor): boolean {
  return color === 'WHITE' ? rights.whiteKingSide : rights.blackKingSide;
}

export function castlingQueenSide(rights: CastlingRights, color: PieceColor): boolean {
  return color === 'WHITE' ? rights.whiteQueenSide : rights.blackQueenSide;
}

export function withoutKingSide(rights: CastlingRights, color: PieceColor): CastlingRights {
  return color === 'WHITE'
    ? { ...rights, whiteKingSide: false }
    : { ...rights, blackKingSide: false };
}

export function withoutQueenSide(rights: CastlingRights, color: PieceColor): CastlingRights {
  return color === 'WHITE'
    ? { ...rights, whiteQueenSide: false }
    : { ...rights, blackQueenSide: false };
}

export function withoutBothSides(rights: CastlingRights, color: PieceColor): CastlingRights {
  return color === 'WHITE'
    ? { ...rights, whiteKingSide: false, whiteQueenSide: false }
    : { ...rights, blackKingSide: false, blackQueenSide: false };
}

/** Renders the FEN castling field, e.g. "KQkq", or "-" if none remain. */
export function castlingRightsToFenField(rights: CastlingRights): string {
  let s = '';
  if (rights.whiteKingSide) s += 'K';
  if (rights.whiteQueenSide) s += 'Q';
  if (rights.blackKingSide) s += 'k';
  if (rights.blackQueenSide) s += 'q';
  return s === '' ? '-' : s;
}

export function castlingRightsFromFenField(field: string | null | undefined): CastlingRights {
  if (!field || field === '-') return noCastlingRights();
  return {
    whiteKingSide: field.includes('K'),
    whiteQueenSide: field.includes('Q'),
    blackKingSide: field.includes('k'),
    blackQueenSide: field.includes('q'),
  };
}

// ------------------------------------------------------------------
// MoveType / Move
// ------------------------------------------------------------------
export type MoveType =
  | 'NORMAL'
  | 'DOUBLE_PAWN_PUSH'
  | 'EN_PASSANT'
  | 'CASTLE_KINGSIDE'
  | 'CASTLE_QUEENSIDE'
  | 'PROMOTION';

export interface Move {
  from: Square;
  to: Square;
  piece: Piece;
  capturedPiece: Piece | null;
  type: MoveType;
  promotionType: PieceType | null;
}

export function moveNormal(from: Square, to: Square, piece: Piece, capturedPiece: Piece | null): Move {
  return { from, to, piece, capturedPiece, type: 'NORMAL', promotionType: null };
}

export function moveDoublePawnPush(from: Square, to: Square, piece: Piece): Move {
  return { from, to, piece, capturedPiece: null, type: 'DOUBLE_PAWN_PUSH', promotionType: null };
}

export function moveEnPassant(from: Square, to: Square, piece: Piece, capturedPawn: Piece): Move {
  return { from, to, piece, capturedPiece: capturedPawn, type: 'EN_PASSANT', promotionType: null };
}

export function moveCastleKingSide(from: Square, to: Square, king: Piece): Move {
  return { from, to, piece: king, capturedPiece: null, type: 'CASTLE_KINGSIDE', promotionType: null };
}

export function moveCastleQueenSide(from: Square, to: Square, king: Piece): Move {
  return { from, to, piece: king, capturedPiece: null, type: 'CASTLE_QUEENSIDE', promotionType: null };
}

export function movePromotion(
  from: Square,
  to: Square,
  pawn: Piece,
  capturedPiece: Piece | null,
  promoteTo: PieceType
): Move {
  return { from, to, piece: pawn, capturedPiece, type: 'PROMOTION', promotionType: promoteTo };
}

export function moveIsCapture(m: Move): boolean {
  return m.capturedPiece !== null;
}

export function moveIsCastle(m: Move): boolean {
  return m.type === 'CASTLE_KINGSIDE' || m.type === 'CASTLE_QUEENSIDE';
}

/** UCI-style long algebraic notation, e.g. "e2e4", "e7e8q" for a queen promotion. */
export function moveToUci(m: Move): string {
  let s = squareToAlgebraic(m.from) + squareToAlgebraic(m.to);
  if (m.type === 'PROMOTION' && m.promotionType) {
    s += PIECE_FEN_CHAR[m.promotionType];
  }
  return s;
}

export function movesEqual(a: Move, b: Move): boolean {
  return (
    squaresEqual(a.from, b.from) &&
    squaresEqual(a.to, b.to) &&
    piecesEqual(a.piece, b.piece) &&
    piecesEqual(a.capturedPiece, b.capturedPiece) &&
    a.type === b.type &&
    a.promotionType === b.promotionType
  );
}

// ------------------------------------------------------------------
// GameStatus
// ------------------------------------------------------------------
export type GameStatus = 'ONGOING' | 'CHECK' | 'CHECKMATE' | 'STALEMATE';

// ------------------------------------------------------------------
// GameState
// ------------------------------------------------------------------
export interface GameState {
  board: Board;
  sideToMove: PieceColor;
  castlingRights: CastlingRights;
  enPassantTarget: Square | null;
  halfmoveClock: number;
  fullmoveNumber: number;
}

// ------------------------------------------------------------------
// Board - a flat 8x8 grid of Piece|null. squares[row][col].
// ------------------------------------------------------------------
export class Board {
  private squares: (Piece | null)[][];

  private constructor(squares: (Piece | null)[][]) {
    this.squares = squares;
  }

  static empty(): Board {
    const grid: (Piece | null)[][] = [];
    for (let r = 0; r < 8; r++) grid.push(new Array(8).fill(null));
    return new Board(grid);
  }

  static standard(): Board {
    const board = Board.empty();
    const backRank: PieceType[] = ['ROOK', 'KNIGHT', 'BISHOP', 'QUEEN', 'KING', 'BISHOP', 'KNIGHT', 'ROOK'];
    for (let col = 0; col < 8; col++) {
      board.squares[0][col] = makePiece('BLACK', backRank[col]);
      board.squares[1][col] = makePiece('BLACK', 'PAWN');
      board.squares[6][col] = makePiece('WHITE', 'PAWN');
      board.squares[7][col] = makePiece('WHITE', backRank[col]);
    }
    return board;
  }

  get(s: Square): Piece | null;
  get(row: number, col: number): Piece | null;
  get(a: Square | number, b?: number): Piece | null {
    if (typeof a === 'number') return this.squares[a][b as number];
    return this.squares[a.row][a.col];
  }

  set(s: Square, piece: Piece | null): void {
    this.squares[s.row][s.col] = piece;
  }

  clear(s: Square): void {
    this.squares[s.row][s.col] = null;
  }

  isEmpty(s: Square): boolean {
    return this.get(s) === null;
  }

  isOccupiedBy(s: Square, color: PieceColor): boolean {
    const p = this.get(s);
    return p !== null && p.color === color;
  }

  /** Cheap copy for the search tree - pieces are immutable so only the
   *  grid itself needs a fresh array. */
  copy(): Board {
    const grid: (Piece | null)[][] = new Array(8);
    for (let r = 0; r < 8; r++) grid[r] = this.squares[r].slice();
    return new Board(grid);
  }

  findKing(color: PieceColor): Square | null {
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const p = this.squares[r][c];
        if (p !== null && p.type === 'KING' && p.color === color) return { row: r, col: c };
      }
    }
    return null;
  }

  /** The raw 8x8 grid as short piece codes (e.g. "WP", "BN", null for empty). */
  toCodeGrid(): (string | null)[][] {
    const grid: (string | null)[][] = [];
    for (let r = 0; r < 8; r++) {
      const row: (string | null)[] = [];
      for (let c = 0; c < 8; c++) {
        const p = this.squares[r][c];
        row.push(p === null ? null : pieceCode(p));
      }
      grid.push(row);
    }
    return grid;
  }
}
