import { listImages } from '$lib/server/db';
import type { PageServerLoad } from './$types';

const PAGE_SIZE = 50;

export const load: PageServerLoad = ({ url }) => {
  const page = Number(url.searchParams.get('page') ?? '1') || 1;
  return listImages(page, PAGE_SIZE);
};
