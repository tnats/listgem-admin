import axios from 'axios';
import { recordError, recordResponse } from './requestLog';

const API_URL = import.meta.env.DEV ? '' : import.meta.env.VITE_API_URL || 'http://localhost:3000';

const client = axios.create({
  baseURL: API_URL,
  timeout: 30000,
});

// Attach JWT to every request, and stamp a start time so the request log can
// report how long each call actually took.
client.interceptors.request.use((config) => {
  const token = sessionStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  config.meta = { startedAt: Date.now() };
  return config;
});

// Redirect to login on 401/403
client.interceptors.response.use(
  (response) => {
    recordResponse(response, response.config?.meta?.startedAt);
    return response;
  },
  (error) => {
    recordError(error, error.config?.meta?.startedAt);
    if (error.response?.status === 401 || error.response?.status === 403) {
      sessionStorage.removeItem('token');
      sessionStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default client;
