import { Move, PIECE_VALUE, movesEqual } from './types';

/** Orders moves so alpha-beta finds cutoffs sooner: the previous
 *  iteration's best move first, then captures by MVV (most valuable
 *  victim first), then quiet moves. Ported 1:1 from
 *  com.chesslab.engine.MoveOrderer. Never changes the final answer, only
 *  how quickly pruning kicks in. */
export function orderMoves(moves: Move[], preferred: Move | null): Move[] {
  const captures: Move[] = [];
  const quiet: Move[] = [];
  let pvMove: Move | null = null;

  for (const move of moves) {
    if (preferred !== null && pvMove === null && movesEqual(move, preferred)) {
      pvMove = move;
      continue;
    }
    if (move.capturedPiece !== null) {
      captures.push(move);
    } else {
      quiet.push(move);
    }
  }

  captures.sort((a, b) => PIECE_VALUE[b.capturedPiece!.type] - PIECE_VALUE[a.capturedPiece!.type]);

  const ordered: Move[] = [];
  if (pvMove !== null) ordered.push(pvMove);
  ordered.push(...captures, ...quiet);
  return ordered;
}
