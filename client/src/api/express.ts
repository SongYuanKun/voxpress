import { request } from './request';

export type ExpressItem = {
  name: string;
  quantity: number;
  unit: string;
};

export type ParsedItems = {
  items: ExpressItem[];
};

export type ExpressRecord = {
  id: number;
  client_request_id: string;
  tracking_number: string;
  raw_text: string;
  original_json: ParsedItems;
  custom_json: ParsedItems;
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

export async function updateRecord(id: number, custom_json: ParsedItems) {
  const res = await request.patch<unknown, ApiResponse<ExpressRecord>>(`/express/${id}`, { custom_json });
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
