import { isInCheck } from './checkDetector';
import { evaluate } from './evaluation';
import { generateLegalMoves } from './legalMoveGenerator';
import { applyMove } from './moveExecutor';
import { orderMoves } from './moveOrderer';
import { GameState, GameStatus, Move } from './types';

/** One node of the search tree - mirrors com.chesslab.engine.SearchNode.
 *  Structured so the frontend can render it directly: move, depth,
 *  evaluation, alpha, beta, pruned/searched. Every field is set by an
 *  actual search algorithm walking the real game tree - nothing here is
 *  fabricated. */
export interface SearchNode {
  move: Move | null; // null for the synthetic root node
  depth: number; // ply distance from the root
  children: SearchNode[];
  evaluation: number | null; // null until fully searched
  alpha: number;
  beta: number;
  pruned: boolean;
  maximizing: boolean; // whose turn is "to move" at this node
}

function newNode(move: Move | null, depth: number, alpha: number, beta: number, maximizing: boolean): SearchNode {
  return { move, depth, children: [], evaluation: null, alpha, beta, pruned: false, maximizing };
}

/** Complete output of one search call - mirrors
 *  com.chesslab.engine.SearchResult. */
export interface SearchResult {
  bestMove: Move | null;
  evaluation: number;
  nodesSearched: number;
  nodesPruned: number;
  maxDepth: number;
  executionTimeMillis: number;
  rootNode: SearchNode;
}

export function pruningPercentage(result: SearchResult): number {
  const total = result.nodesSearched + result.nodesPruned;
  return total === 0 ? 0 : (100 * result.nodesPruned) / total;
}

const MIN_SCORE = -Infinity;
const MAX_SCORE = Infinity;

function statusOf(state: GameState, legalMoves: Move[]): GameStatus {
  const inCheck = isInCheck(state, state.sideToMove);
  if (legalMoves.length > 0) return inCheck ? 'CHECK' : 'ONGOING';
  return inCheck ? 'CHECKMATE' : 'STALEMATE';
}

function pickBestChildMove(root: SearchNode, maximizing: boolean, requirePresent: boolean): Move | null {
  let best: Move | null = null;
  let bestScore: number | null = null;
  for (const child of root.children) {
    if (requirePresent && (child.pruned || child.evaluation === null)) continue;
    const childScore = child.evaluation as number;
    if (bestScore === null || (maximizing && childScore > bestScore) || (!maximizing && childScore < bestScore)) {
      bestScore = childScore;
      best = child.move;
    }
  }
  return best;
}

// ------------------------------------------------------------------
// Plain minimax - no pruning at all. Ported 1:1 from MinimaxSearch.java.
// ------------------------------------------------------------------
export function minimaxSearch(rootState: GameState, depth: number): SearchResult {
  let nodesSearched = 0;
  const startTime = Date.now();

  const maximizing = rootState.sideToMove === 'WHITE';
  const root = newNode(null, 0, MIN_SCORE, MAX_SCORE, maximizing);

  function minimax(state: GameState, depthRemaining: number, maximizing: boolean, node: SearchNode): number {
    nodesSearched++;

    const legalMoves = generateLegalMoves(state);
    const status = statusOf(state, legalMoves);

    if (depthRemaining === 0 || status === 'CHECKMATE' || status === 'STALEMATE') {
      const score = evaluate(state, status);
      node.evaluation = score;
      return score;
    }

    let best = maximizing ? MIN_SCORE : MAX_SCORE;
    for (const move of legalMoves) {
      const childState = applyMove(state, move);
      const childNode = newNode(move, node.depth + 1, node.alpha, node.beta, !maximizing);
      const childScore = minimax(childState, depthRemaining - 1, !maximizing, childNode);
      node.children.push(childNode);

      best = maximizing ? Math.max(best, childScore) : Math.min(best, childScore);
    }

    node.evaluation = best;
    return best;
  }

  const score = minimax(rootState, depth, maximizing, root);
  const bestMove = pickBestChildMove(root, maximizing, false);
  const elapsed = Date.now() - startTime;

  return { bestMove, evaluation: score, nodesSearched, nodesPruned: 0, maxDepth: depth, executionTimeMillis: elapsed, rootNode: root };
}

// ------------------------------------------------------------------
// Alpha-beta pruning. Ported 1:1 from AlphaBetaSearch.java.
// ------------------------------------------------------------------
export function alphaBetaSearch(rootState: GameState, depth: number): SearchResult {
  let nodesSearched = 0;
  let nodesPruned = 0;
  const startTime = Date.now();

  const maximizing = rootState.sideToMove === 'WHITE';
  const root = newNode(null, 0, MIN_SCORE, MAX_SCORE, maximizing);

  function markRemainingAsPruned(
    legalMoves: Move[],
    fromIndex: number,
    parent: SearchNode,
    alpha: number,
    beta: number,
    childMaximizing: boolean
  ) {
    for (let j = fromIndex; j < legalMoves.length; j++) {
      const prunedNode = newNode(legalMoves[j], parent.depth + 1, alpha, beta, childMaximizing);
      prunedNode.pruned = true;
      parent.children.push(prunedNode);
      nodesPruned++;
    }
  }

  function ab(
    state: GameState,
    depthRemaining: number,
    alpha: number,
    beta: number,
    maximizing: boolean,
    node: SearchNode
  ): number {
    nodesSearched++;

    const legalMoves = generateLegalMoves(state);
    const status = statusOf(state, legalMoves);

    if (depthRemaining === 0 || status === 'CHECKMATE' || status === 'STALEMATE') {
      const score = evaluate(state, status);
      node.evaluation = score;
      return score;
    }

    let best = maximizing ? MIN_SCORE : MAX_SCORE;

    for (let i = 0; i < legalMoves.length; i++) {
      const move = legalMoves[i];
      const childState = applyMove(state, move);
      const childNode = newNode(move, node.depth + 1, alpha, beta, !maximizing);
      const childScore = ab(childState, depthRemaining - 1, alpha, beta, !maximizing, childNode);
      node.children.push(childNode);

      if (maximizing) {
        best = Math.max(best, childScore);
        alpha = Math.max(alpha, best);
      } else {
        best = Math.min(best, childScore);
        beta = Math.min(beta, best);
      }
      node.alpha = alpha;
      node.beta = beta;

      if (beta <= alpha) {
        markRemainingAsPruned(legalMoves, i + 1, node, alpha, beta, !maximizing);
        break;
      }
    }

    node.evaluation = best;
    return best;
  }

  const score = ab(rootState, depth, MIN_SCORE, MAX_SCORE, maximizing, root);
  const bestMove = pickBestChildMove(root, maximizing, true);
  const elapsed = Date.now() - startTime;

  return { bestMove, evaluation: score, nodesSearched, nodesPruned, maxDepth: depth, executionTimeMillis: elapsed, rootNode: root };
}

// ------------------------------------------------------------------
// Alpha-beta wrapped in iterative deepening + move ordering. Ported 1:1
// from IterativeDeepeningSearch.java.
// ------------------------------------------------------------------
export function iterativeDeepeningSearch(rootState: GameState, maxDepth: number): SearchResult {
  const startTime = Date.now();
  const maximizing = rootState.sideToMove === 'WHITE';

  let totalNodesSearched = 0;
  let totalNodesPruned = 0;
  let principalVariationMove: Move | null = null;
  let finalRoot: SearchNode | null = null;
  let finalScore = 0;

  for (let depth = 1; depth <= maxDepth; depth++) {
    let nodesSearched = 0;
    let nodesPruned = 0;

    const root = newNode(null, 0, MIN_SCORE, MAX_SCORE, maximizing);

    function ab(
      state: GameState,
      depthRemaining: number,
      alpha: number,
      beta: number,
      maximizing: boolean,
      node: SearchNode,
      preferredMove: Move | null
    ): number {
      nodesSearched++;

      const legalMoves = generateLegalMoves(state);
      const status = statusOf(state, legalMoves);

      if (depthRemaining === 0 || status === 'CHECKMATE' || status === 'STALEMATE') {
        const score = evaluate(state, status);
        node.evaluation = score;
        return score;
      }

      const ordered = orderMoves(legalMoves, node.depth === 0 ? preferredMove : null);
      let best = maximizing ? MIN_SCORE : MAX_SCORE;

      for (let i = 0; i < ordered.length; i++) {
        const move = ordered[i];
        const childState = applyMove(state, move);
        const childNode = newNode(move, node.depth + 1, alpha, beta, !maximizing);
        const childScore = ab(childState, depthRemaining - 1, alpha, beta, !maximizing, childNode, null);
        node.children.push(childNode);

        if (maximizing) {
          best = Math.max(best, childScore);
          alpha = Math.max(alpha, best);
        } else {
          best = Math.min(best, childScore);
          beta = Math.min(beta, best);
        }
        node.alpha = alpha;
        node.beta = beta;

        if (beta <= alpha) {
          for (let j = i + 1; j < ordered.length; j++) {
            const prunedNode = newNode(ordered[j], node.depth + 1, alpha, beta, !maximizing);
            prunedNode.pruned = true;
            node.children.push(prunedNode);
            nodesPruned++;
          }
          break;
        }
      }

      node.evaluation = best;
      return best;
    }

    const score = ab(rootState, depth, MIN_SCORE, MAX_SCORE, maximizing, root, principalVariationMove);

    totalNodesSearched += nodesSearched;
    totalNodesPruned += nodesPruned;

    const bestThisIteration = pickBestChildMove(root, maximizing, true);
    if (bestThisIteration !== null) principalVariationMove = bestThisIteration;
    finalRoot = root;
    finalScore = score;
  }

  const elapsed = Date.now() - startTime;
  return {
    bestMove: principalVariationMove,
    evaluation: finalScore,
    nodesSearched: totalNodesSearched,
    nodesPruned: totalNodesPruned,
    maxDepth,
    executionTimeMillis: elapsed,
    rootNode: finalRoot as SearchNode,
  };
}

export const MIN_DEPTH = 1;
export const MAX_DEPTH = 6;

export function search(state: GameState, depth: number, algorithm: string): SearchResult {
  const clampedDepth = Math.max(MIN_DEPTH, Math.min(MAX_DEPTH, depth));
  const algo = (algorithm || 'alphabeta').toLowerCase();
  if (algo === 'minimax') return minimaxSearch(state, clampedDepth);
  if (algo === 'iterative') return iterativeDeepeningSearch(state, clampedDepth);
  return alphaBetaSearch(state, clampedDepth);
}
