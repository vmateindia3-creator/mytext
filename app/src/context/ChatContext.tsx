import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { api } from '../api/client';
import { getSocket } from '../lib/socket';
import { Conversation, Message } from '../types';
import { useAuth } from './AuthContext';

interface ChatState {
  conversations: Conversation[];
  messages: Record<string, Message[]>;
  typing: Record<string, string[]>;
  refreshConversations: () => Promise<void>;
  loadMessages: (conversationId: string) => Promise<void>;
  sendMessage: (conversationId: string, text: string) => Promise<void>;
  sendMedia: (
    conversationId: string,
    file: { uri: string; name: string; type: string },
    kind: 'image' | 'file'
  ) => Promise<void>;
  markRead: (conversationId: string, messageId: string) => void;
  setTyping: (conversationId: string, typing: boolean) => void;
}

const ChatContext = createContext<ChatState | undefined>(undefined);

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const { user, token } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<Record<string, Message[]>>({});
  const [typing, setTypingState] = useState<Record<string, string[]>>({});
  const typingTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const refreshConversations = useCallback(async () => {
    const res = await api.listConversations();
    setConversations(res.conversations);
  }, []);

  const loadMessages = useCallback(async (conversationId: string) => {
    const res = await api.messages(conversationId);
    setMessages((prev) => ({ ...prev, [conversationId]: res.messages }));
  }, []);

  const sendMessage = useCallback(async (conversationId: string, text: string) => {
    const socket = getSocket();
    if (!socket) return;
    await new Promise<void>((resolve) => {
      socket.emit('message:send', { conversationId, text, kind: 'text' }, () => resolve());
    });
  }, []);

  const sendMedia = useCallback(
    async (
      conversationId: string,
      file: { uri: string; name: string; type: string },
      kind: 'image' | 'file'
    ) => {
      const socket = getSocket();
      if (!socket) return;
      const uploaded = await api.upload(file, conversationId);
      socket.emit('message:send', {
        conversationId,
        kind,
        text: '',
        media: {
          url: uploaded.url,
          name: uploaded.name,
          mime: uploaded.mime,
          size: uploaded.size,
        },
      });
    },
    []
  );

  const markRead = useCallback((conversationId: string, messageId: string) => {
    getSocket()?.emit('message:read', { conversationId, messageId });
  }, []);

  const setTyping = useCallback((conversationId: string, isTyping: boolean) => {
    getSocket()?.emit('typing', { conversationId, typing: isTyping });
  }, []);

  // Wire up real-time events once per signed-in session.
  useEffect(() => {
    if (!token || !user) return;
    const socket = getSocket();
    if (!socket) return;

    refreshConversations();

    const onNewMessage = (msg: Message) => {
      setMessages((prev) => {
        const existing = prev[msg.conversation] || [];
        if (existing.some((m) => m.id === msg.id)) return prev;
        return { ...prev, [msg.conversation]: [...existing, msg] };
      });
      setConversations((prev) => {
        const idx = prev.findIndex((c) => c.id === msg.conversation);
        if (idx === -1) return prev;
        const copy = [...prev];
        copy[idx] = {
          ...copy[idx],
          lastMessage: { id: msg.id, text: msg.text || msg.kind, kind: msg.kind, createdAt: msg.createdAt },
          lastMessageAt: msg.createdAt,
        };
        return copy.sort((a, b) => +new Date(b.lastMessageAt) - +new Date(a.lastMessageAt));
      });
    };

    const onConversationUpdated = () => refreshConversations();

    const onTyping = ({
      conversationId,
      userId,
      typing: isTyping,
    }: {
      conversationId: string;
      userId: string;
      typing: boolean;
    }) => {
      if (userId === user.id) return;
      setTypingState((prev) => {
        const list = prev[conversationId] || [];
        const next = isTyping ? [...new Set([...list, userId])] : list.filter((u) => u !== userId);
        return { ...prev, [conversationId]: next };
      });
      // Auto-clear a stale typing indicator.
      clearTimeout(typingTimers.current[`${conversationId}:${userId}`]);
      typingTimers.current[`${conversationId}:${userId}`] = setTimeout(() => {
        setTypingState((prev) => ({
          ...prev,
          [conversationId]: (prev[conversationId] || []).filter((u) => u !== userId),
        }));
      }, 4000);
    };

    const onRead = ({
      conversationId,
      messageId,
      userId,
    }: {
      conversationId: string;
      messageId: string;
      userId: string;
    }) => {
      setMessages((prev) => {
        const list = prev[conversationId];
        if (!list) return prev;
        return {
          ...prev,
          [conversationId]: list.map((m) =>
            m.id === messageId && !m.readBy.includes(userId)
              ? { ...m, readBy: [...m.readBy, userId] }
              : m
          ),
        };
      });
    };

    const onPresence = ({ userId, online }: { userId: string; online: boolean }) => {
      setConversations((prev) =>
        prev.map((c) => ({
          ...c,
          members: c.members.map((m) => (m.id === userId ? { ...m, online } : m)),
        }))
      );
    };

    socket.on('message:new', onNewMessage);
    socket.on('conversation:updated', onConversationUpdated);
    socket.on('typing', onTyping);
    socket.on('message:read', onRead);
    socket.on('presence', onPresence);

    return () => {
      socket.off('message:new', onNewMessage);
      socket.off('conversation:updated', onConversationUpdated);
      socket.off('typing', onTyping);
      socket.off('message:read', onRead);
      socket.off('presence', onPresence);
    };
  }, [token, user, refreshConversations]);

  return (
    <ChatContext.Provider
      value={{
        conversations,
        messages,
        typing,
        refreshConversations,
        loadMessages,
        sendMessage,
        sendMedia,
        markRead,
        setTyping,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
}

export function useChat(): ChatState {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error('useChat must be used inside ChatProvider');
  return ctx;
}
