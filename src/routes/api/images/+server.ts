import { json } from '@sveltejs/kit';
import { listImages } from '$lib/server/db';
import { parsePositiveInt } from '$lib/server/http';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = ({ url }) => {
  const page = parsePositiveInt(url.searchParams.get('page'), 1);
  const pageSize = parsePositiveInt(url.searchParams.get('pageSize'), 50, { min: 1, max: 200 });
  return json(listImages(page, pageSize));
};
