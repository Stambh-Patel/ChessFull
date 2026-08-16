import { NextResponse } from 'next/server';
import { gameStateDto } from '@/lib/chess/dto';
import { getGameSession } from '@/lib/chess/gameSession';

export async function GET() {
  const session = getGameSession();
  return NextResponse.json(gameStateDto(session.currentState(), session.currentStatus(), session.currentFen()));
}
