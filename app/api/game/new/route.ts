import { NextResponse } from 'next/server';
import { gameStateDto } from '@/lib/chess/dto';
import { resolveState, statusOf } from '@/lib/chess/gameOps';
import { toFen } from '@/lib/chess/fen';

/** Stateless: just returns the standard starting position. The client is
 *  responsible for actually resetting its local game state to this. */
export async function POST() {
  const state = resolveState(null);
  return NextResponse.json(gameStateDto(state, statusOf(state), toFen(state)));
}
