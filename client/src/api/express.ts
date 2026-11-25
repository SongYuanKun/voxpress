import { request } from './request';

export type ExpressItem = {
  name: string;
  quantity: number;
  unit: string;
};

export type ParsedItems = {
  items: ExpressItem[];
};

export type Platform = '' | '闲鱼' | '微店' | '小红书' | '其他';

export type PhotoKind = 'weighing' | 'packing';

export type VideoParsedRecord = {
  tracking_number: string;
  tracking_confidence: number;
  tracking_evidence: string;
  raw_text: string;
  items: ExpressItem[];
  platform?: Platform;
  platform_order_note?: string;
};

export type VideoParseResult = {
  tracking_numbers: string[];
  tracking_evidence: string;
  raw_text: string;
  records: VideoParsedRecord[];
  source_type: 'video';
  warnings?: string[];
};

export type ExpressRecord = {
  id: number;
  client_request_id: string;
  tracking_number: string;
  raw_text: string;
  original_json: ParsedItems;
  custom_json: ParsedItems;
  platform: Platform | string;
  platform_order_note: string;
  weighing_photo: string | null;
  packing_photo: string | null;
  weighing_photo_url: string;
  packing_photo_url: string;
  weighing_photo_export?: string;
  packing_photo_export?: string;
  is_modified: boolean;
  sync_status: string;
  created_at: string;
  updated_at: string;
};

type ApiResponse<T> = {
  code: number;
  data: T;
  message: string;
};

export async function parseText(raw_text: string) {
  const res = await request.post<unknown, ApiResponse<ParsedItems>>('/express/parse', { raw_text });
  return res.data;
}

export async function createRecord(payload: {
  client_request_id: string;
  tracking_number: string;
  raw_text: string;
  items: ExpressItem[];
  platform?: Platform | string;
  platform_order_note?: string;
  duplicate_confirmed?: boolean;
}) {
  const res = await request.post<unknown, ApiResponse<ExpressRecord>>('/express', payload);
  return res.data;
}

export async function listRecords(params: Record<string, unknown> = {}) {
  const res = await request.get<unknown, ApiResponse<{ list: ExpressRecord[]; total: number; page: number; page_size: number }>>('/express', { params });
  return res.data;
}

export async function exportCsv(params: Record<string, unknown> = {}) {
  const response = await request.get<Blob>('/express/export.csv', {
    params,
    responseType: 'blob'
  });
  return response as unknown as Blob;
}

export async function getRecord(id: number) {
  const res = await request.get<unknown, ApiResponse<ExpressRecord>>(`/express/${id}`);
  return res.data;
}

export async function updateRecord(id: number, payload: {
  custom_json?: ParsedItems;
  platform?: Platform | string;
  platform_order_note?: string;
}) {
  const res = await request.patch<unknown, ApiResponse<ExpressRecord>>(`/express/${id}`, payload);
  return res.data;
}

export async function resetRecord(id: number) {
  const res = await request.post<unknown, ApiResponse<ExpressRecord>>(`/express/${id}/reset`);
  return res.data;
}

export async function deleteRecord(id: number) {
  const res = await request.delete<unknown, ApiResponse<{ id: number; status: number }>>(`/express/${id}`);
  return res.data;
}

export async function uploadRecordPhotos(id: number, files: { weighing?: File | null; packing?: File | null }) {
  const form = new FormData();
  if (files.weighing) form.append('weighing', files.weighing);
  if (files.packing) form.append('packing', files.packing);
  const res = await request.post<unknown, ApiResponse<ExpressRecord>>(`/express/${id}/photos`, form, {
    timeout: 60000,
    headers: {
      'Content-Type': 'multipart/form-data'
    }
  });
  return res.data;
}

export async function deleteRecordPhoto(id: number, kind: PhotoKind) {
  const res = await request.delete<unknown, ApiResponse<ExpressRecord>>(`/express/${id}/photos/${kind}`);
  return res.data;
}

export async function fetchRecordPhotoBlob(id: number, kind: PhotoKind) {
  const response = await request.get<Blob>(`/express/${id}/photos/${kind}`, {
    responseType: 'blob',
    timeout: 60000
  });
  return response as unknown as Blob;
}

export async function parseVideo(video: File) {
  const form = new FormData();
  form.append('video', video);
  const res = await request.post<unknown, ApiResponse<VideoParseResult>>('/video/parse', form, {
    timeout: 300000,
    headers: {
      'Content-Type': 'multipart/form-data'
    }
  });
  return res.data;
}
