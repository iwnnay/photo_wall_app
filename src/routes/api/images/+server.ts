import { json } from '@sveltejs/kit';
import { listImages } from '$lib/server/db';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = ({ url }) => {
  const page = Number(url.searchParams.get('page') ?? '1') || 1;
  const pageSize = Math.min(
    200,
    Math.max(1, Number(url.searchParams.get('pageSize') ?? '50') || 50)
  );
  return json(listImages(page, pageSize));
};
