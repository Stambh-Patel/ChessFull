import { pruningPercentage, SearchNode, SearchResult } from './search';
import {
  Board,
  GameState,
  GameStatus,
  Move,
  castlingRightsToFenField,
  moveIsCapture,
  moveToUci,
  pieceCode,
  pieceDisplayName,
  squareToAlgebraic,
} from './types';

export function boardDto(board: Board) {
  return { grid: board.toCodeGrid() };
}

export function moveDto(move: Move) {
  const result: Record<string, unknown> = {
    uci: moveToUci(move),
    from: squareToAlgebraic(move.from),
    to: squareToAlgebraic(move.to),
    piece: pieceCode(move.piece),
    pieceDisplayName: pieceDisplayName(move.piece),
    type: move.type,
    isCapture: moveIsCapture(move),
  };
  if (moveIsCapture(move) && move.capturedPiece) {
    result.capturedPiece = pieceCode(move.capturedPiece);
  }
  if (move.type === 'PROMOTION' && move.promotionType) {
    result.promotionType = move.promotionType;
  }
  return result;
}

export function movesDto(moves: Move[]) {
  return moves.map(moveDto);
}

export function gameStateDto(state: GameState, status: GameStatus, fen: string) {
  return {
    fen,
    sideToMove: state.sideToMove,
    status,
    castlingRights: castlingRightsToFenField(state.castlingRights),
    enPassantTarget: state.enPassantTarget ? squareToAlgebraic(state.enPassantTarget) : null,
    halfmoveClock: state.halfmoveClock,
    fullmoveNumber: state.fullmoveNumber,
    board: state.board.toCodeGrid(),
  };
}

export function searchResultDto(result: SearchResult) {
  return {
    bestMove: result.bestMove ? moveToUci(result.bestMove) : null,
    bestMoveDetail: result.bestMove ? moveDto(result.bestMove) : null,
    evaluationCentipawns: result.evaluation,
    evaluation: Math.round((result.evaluation / 100) * 100) / 100,
    depth: result.maxDepth,
    nodesSearched: result.nodesSearched,
    nodesPruned: result.nodesPruned,
    pruningPercentage: Math.round(pruningPercentage(result) * 100) / 100,
    executionTimeMs: result.executionTimeMillis,
  };
}

export function searchResultWithTreeDto(result: SearchResult, treeDepthLimit: number) {
  return { ...searchResultDto(result), tree: searchNodeDto(result.rootNode, treeDepthLimit) };
}

function searchNodeDto(node: SearchNode, depthLimitRemaining: number): Record<string, unknown> {
  const base: Record<string, unknown> = {
    move: node.move ? moveToUci(node.move) : null,
    depth: node.depth,
    evaluation: node.evaluation,
    alpha: finiteOr(node.alpha),
    beta: finiteOr(node.beta),
    pruned: node.pruned,
    maximizing: node.maximizing,
  };
  if (depthLimitRemaining > 0 && node.children.length > 0) {
    base.children = node.children.map((child) => searchNodeDto(child, depthLimitRemaining - 1));
  } else {
    base.children = [];
    base.childCount = node.children.length;
  }
  return base;
}

// alpha/beta start at -Infinity/+Infinity (mirrors Java's Integer.MIN/MAX_VALUE);
// JSON has no Infinity, so clamp to a very large finite number for transport.
function finiteOr(n: number): number {
  if (n === Infinity) return 1_000_000_000;
  if (n === -Infinity) return -1_000_000_000;
  return n;
}
