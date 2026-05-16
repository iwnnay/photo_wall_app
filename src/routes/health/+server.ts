import { json } from '@sveltejs/kit';
import db from '$lib/server/db';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = () => {
  try {
    db.prepare('SELECT 1').get();
    return json({ status: 'ok', db: 'ok' });
  } catch (err) {
    return json(
      { status: 'error', db: 'error', error: err instanceof Error ? err.message : String(err) },
      { status: 503 }
    );
  }
};
