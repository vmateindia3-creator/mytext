import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { MessageBubble } from '../components/MessageBubble';
import { COLORS } from '../config';
import { useAuth } from '../context/AuthContext';
import { useChat } from '../context/ChatContext';
import { getSocket } from '../lib/socket';

export function ChatScreen({ route, navigation }: { route: any; navigation: any }) {
  const conversationId: string = route.params.conversationId;
  const { user } = useAuth();
  const { conversations, messages, typing, loadMessages, sendMessage, sendMedia, markRead, setTyping } =
    useChat();
  const [text, setText] = useState('');
  const listRef = useRef<FlatList<any>>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout>>();

  const conversation = conversations.find((c) => c.id === conversationId);
  const thread = messages[conversationId] || [];
  const typingUsers = typing[conversationId] || [];

  const title = (() => {
    if (!conversation) return 'Chat';
    if (conversation.type === 'group') return conversation.name || 'Group';
    const other = conversation.members.find((m) => m.id !== user!.id);
    return other?.displayName || other?.username || 'Chat';
  })();

  useEffect(() => {
    loadMessages(conversationId);
    getSocket()?.emit('conversation:join', { conversationId });
    return () => {
      getSocket()?.emit('conversation:leave', { conversationId });
    };
  }, [conversationId, loadMessages]);

  // Mark the newest incoming message as read while this screen is open.
  useEffect(() => {
    const last = thread[thread.length - 1];
    if (last && last.sender.id !== user!.id && !last.readBy.includes(user!.id)) {
      markRead(conversationId, last.id);
    }
  }, [thread, conversationId, user, markRead]);

  useLayoutEffect(() => {
    const other =
      conversation && conversation.type === 'direct'
        ? conversation.members.find((m) => m.id !== user!.id)
        : null;
    navigation.setOptions({
      title,
      headerRight: () =>
        other ? (
          <TouchableOpacity
            onPress={() =>
              navigation.navigate('Call', {
                peerId: other.id,
                peerName: other.displayName || other.username,
                video: true,
              })
            }
          >
            <Text style={styles.callBtn}>📹</Text>
          </TouchableOpacity>
        ) : null,
    });
  }, [navigation, title, conversation, user]);

  const onSend = useCallback(async () => {
    const value = text.trim();
    if (!value) return;
    setText('');
    setTyping(conversationId, false);
    await sendMessage(conversationId, value);
  }, [text, conversationId, sendMessage, setTyping]);

  const onChangeText = (value: string) => {
    setText(value);
    setTyping(conversationId, true);
    clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => setTyping(conversationId, false), 1500);
  };

  const pickImage = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ quality: 0.7 });
    if (!res.canceled && res.assets[0]) {
      const a = res.assets[0];
      await sendMedia(
        conversationId,
        { uri: a.uri, name: a.fileName || 'photo.jpg', type: a.mimeType || 'image/jpeg' },
        'image'
      );
    }
  };

  const pickFile = async () => {
    const res = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true });
    if (!res.canceled && res.assets[0]) {
      const a = res.assets[0];
      await sendMedia(
        conversationId,
        { uri: a.uri, name: a.name, type: a.mimeType || 'application/octet-stream' },
        'file'
      );
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      <FlatList
        ref={listRef}
        data={thread}
        keyExtractor={(m) => m.id}
        renderItem={({ item }) => <MessageBubble message={item} mine={item.sender.id === user!.id} />}
        contentContainerStyle={styles.listContent}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
      />

      {typingUsers.length > 0 && (
        <Text style={styles.typing}>
          {conversation?.type === 'group' ? 'Someone is typing…' : 'typing…'}
        </Text>
      )}

      <View style={styles.inputBar}>
        <TouchableOpacity onPress={pickImage} style={styles.attach}>
          <Text style={styles.attachText}>📷</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={pickFile} style={styles.attach}>
          <Text style={styles.attachText}>📎</Text>
        </TouchableOpacity>
        <TextInput
          style={styles.input}
          placeholder="Message"
          placeholderTextColor={COLORS.textMuted}
          value={text}
          onChangeText={onChangeText}
          multiline
        />
        <TouchableOpacity onPress={onSend} style={styles.send}>
          <Text style={styles.sendText}>➤</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  listContent: { paddingVertical: 12 },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 8,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  input: {
    flex: 1,
    color: COLORS.text,
    backgroundColor: COLORS.surfaceAlt,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    maxHeight: 120,
    marginHorizontal: 6,
  },
  attach: { paddingHorizontal: 6, paddingBottom: 8 },
  attachText: { fontSize: 22 },
  send: {
    backgroundColor: COLORS.primary,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendText: { color: '#fff', fontSize: 16 },
  typing: { color: COLORS.textMuted, fontStyle: 'italic', paddingHorizontal: 16, paddingBottom: 4 },
  callBtn: { fontSize: 20, paddingHorizontal: 8 },
});
