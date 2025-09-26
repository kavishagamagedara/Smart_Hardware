import axios from 'axios';
export const API_BASE = 'http://localhost:3001';

function randomHex24() {
  const arr = new Uint8Array(12);
  window.crypto.getRandomValues(arr);
  return [...arr].map(b => b.toString(16).padStart(2,'0')).join('');
}

function getAuth() {
  const stored = JSON.parse(localStorage.getItem('auth') || '{}');
  const userId = stored.userId || randomHex24();
  // we always behave as user on customer pages
  const role = 'user';
  const userName = stored.userName || 'Guest';
  if (!stored.userId) localStorage.setItem('auth', JSON.stringify({ ...stored, userId, userName, role }));
  return { userId, role, userName };
}

export const api = axios.create({ baseURL: `${API_BASE}/api` });

api.interceptors.request.use((config) => {
  const { userId, role, userName } = getAuth();
  config.headers['x-user-id'] = userId;
  config.headers['x-user-role'] = role;
  config.headers['x-user-name'] = userName;
  return config;
});

