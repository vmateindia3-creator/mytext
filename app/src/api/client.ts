import { API_URL } from '../config';
import { AuthResponse, Conversation, Message, User } from '../types';

let authToken: string | null = null;

export function setAuthToken(token: string | null) {
  authToken = token;
}

class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown
): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.error || 'request failed', res.status);
  return data as T;
}

export const api = {
  register: (username: string, password: string, displayName?: string) =>
    request<AuthResponse>('POST', '/api/auth/register', { username, password, displayName }),

  login: (username: string, password: string) =>
    request<AuthResponse>('POST', '/api/auth/login', { username, password }),

  me: () => request<{ user: User }>('GET', '/api/users/me'),

  searchUsers: (q: string) =>
    request<{ users: User[] }>('GET', `/api/users?q=${encodeURIComponent(q)}`),

  listConversations: () =>
    request<{ conversations: Conversation[] }>('GET', '/api/conversations'),

  createDirect: (userId: string) =>
    request<{ conversation: Conversation }>('POST', '/api/conversations', {
      type: 'direct',
      userId,
    }),

  createGroup: (name: string, memberIds: string[]) =>
    request<{ conversation: Conversation }>('POST', '/api/conversations', {
      type: 'group',
      name,
      memberIds,
    }),

  messages: (conversationId: string) =>
    request<{ messages: Message[] }>(
      'GET',
      `/api/conversations/${conversationId}/messages`
    ),

  /** Upload a local file (from expo-image-picker / expo-document-picker). */
  async upload(file: { uri: string; name: string; type: string }, conversationId: string) {
    const form = new FormData();
    // React Native's FormData accepts this shape for local files.
    form.append('file', { uri: file.uri, name: file.name, type: file.type } as never);
    form.append('conversationId', conversationId);

    const res = await fetch(`${API_URL}/api/upload`, {
      method: 'POST',
      headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
      body: form,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new ApiError(data.error || 'upload failed', res.status);
    return data as { url: string; name: string; mime: string; size: number };
  },
};

export { ApiError };
