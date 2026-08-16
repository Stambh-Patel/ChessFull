import { blackBonus, whiteBonus } from './pieceSquareTables';
import { Board, GameState, GameStatus, PIECE_VALUE } from './types';

/** Score used for a checkmated position - far larger than any realistic
 *  material+positional sum, so mate always dominates the evaluation. */
export const CHECKMATE_SCORE = 1_000_000;

/** Scores the position from White's perspective, in centipawns. Ported
 *  1:1 from com.chesslab.engine.Evaluation. */
export function evaluate(state: GameState, status: GameStatus): number {
  if (status === 'CHECKMATE') {
    return state.sideToMove === 'WHITE' ? -CHECKMATE_SCORE : CHECKMATE_SCORE;
  }
  if (status === 'STALEMATE') {
    return 0;
  }
  return materialAndPositionScore(state.board);
}

/** Pure material + piece-square score, ignoring game-ending conditions. */
export function materialAndPositionScore(board: Board): number {
  let score = 0;
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = board.get(r, c);
      if (piece === null) continue;

      const material = PIECE_VALUE[piece.type];
      const positional =
        piece.color === 'WHITE' ? whiteBonus(piece.type, r, c) : blackBonus(piece.type, r, c);

      const pieceScore = material + positional;
      score += piece.color === 'WHITE' ? pieceScore : -pieceScore;
    }
  }
  return score;
}
