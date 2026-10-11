export interface User {
  id: string;
  username: string;
  displayName: string;
  avatarUrl?: string;
  online?: boolean;
  lastSeen?: string;
}

export type MessageKind = 'text' | 'image' | 'file' | 'call';

export interface Message {
  id: string;
  conversation: string;
  sender: User;
  kind: MessageKind;
  text: string;
  mediaUrl?: string;
  mediaName?: string;
  mediaMime?: string;
  mediaSize?: number;
  readBy: string[];
  createdAt: string;
}

export interface Conversation {
  id: string;
  type: 'direct' | 'group';
  name: string;
  avatarUrl?: string;
  members: User[];
  lastMessage?: {
    id: string;
    text: string;
    kind: MessageKind;
    createdAt: string;
  } | null;
  lastMessageAt: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}
