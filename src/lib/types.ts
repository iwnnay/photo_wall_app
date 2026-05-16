export type Image = {
  id: number;
  filename: string;
  original_name: string;
  mime_type: string;
  size: number;
  width: number | null;
  height: number | null;
  favorite: boolean;
  created_at: string;
};
