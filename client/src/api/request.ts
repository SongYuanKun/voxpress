import axios from 'axios';
import { showToast } from 'vant';

export const request = axios.create({
  baseURL: '/api',
  timeout: 20000
});

request.interceptors.request.use((config) => {
  const token = localStorage.getItem('voxpress_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

request.interceptors.response.use(
  (response) => response.data,
  (error) => {
    const message = error.response?.data?.message || error.message || '请求失败';
    showToast(message);
    return Promise.reject(error.response?.data || error);
  }
);

