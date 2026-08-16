import { NextResponse } from 'next/server';
import { gameStateDto } from '@/lib/chess/dto';
import { getGameSession } from '@/lib/chess/gameSession';

export async function POST() {
  const session = getGameSession();
  session.newGame();
  return NextResponse.json(gameStateDto(session.currentState(), session.currentStatus(), session.currentFen()));
}
