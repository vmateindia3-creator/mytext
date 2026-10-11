import React, { useCallback, useEffect, useState } from 'react';
import {
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { api } from '../api/client';
import { Avatar } from '../components/Avatar';
import { COLORS } from '../config';
import { useChat } from '../context/ChatContext';
import { User } from '../types';

export function NewChatScreen({ navigation }: { navigation: any }) {
  const { refreshConversations } = useChat();
  const [query, setQuery] = useState('');
  const [users, setUsers] = useState<User[]>([]);
  const [error, setError] = useState('');

  const load = useCallback(async (q: string) => {
    try {
      const res = await api.searchUsers(q);
      setUsers(res.users);
    } catch (e: any) {
      setError(e.message);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => load(query), 250);
    return () => clearTimeout(t);
  }, [query, load]);

  const startChat = async (userId: string) => {
    const res = await api.createDirect(userId);
    await refreshConversations();
    navigation.replace('Chat', { conversationId: res.conversation.id });
  };

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.search}
        placeholder="Search people by name or username"
        placeholderTextColor={COLORS.textMuted}
        autoCapitalize="none"
        value={query}
        onChangeText={setQuery}
      />
      {!!error && <Text style={styles.error}>{error}</Text>}
      <FlatList
        data={users}
        keyExtractor={(u) => u.id}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.row} onPress={() => startChat(item.id)}>
            <Avatar name={item.displayName} uri={item.avatarUrl} online={item.online} />
            <View style={styles.rowText}>
              <Text style={styles.name}>{item.displayName}</Text>
              <Text style={styles.handle}>@{item.username}</Text>
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={<Text style={styles.empty}>No users found.</Text>}
      />
      <TouchableOpacity style={styles.newGroup} onPress={() => navigation.navigate('NewGroup')}>
        <Text style={styles.newGroupText}>＋ New group</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  search: {
    backgroundColor: COLORS.surface,
    color: COLORS.text,
    margin: 12,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  row: { flexDirection: 'row', alignItems: 'center', padding: 14 },
  rowText: { marginLeft: 12 },
  name: { color: COLORS.text, fontSize: 16, fontWeight: '600' },
  handle: { color: COLORS.textMuted, fontSize: 13 },
  empty: { color: COLORS.textMuted, textAlign: 'center', marginTop: 24 },
  error: { color: COLORS.danger, paddingHorizontal: 16 },
  newGroup: { padding: 18, borderTopWidth: 1, borderTopColor: COLORS.border },
  newGroupText: { color: COLORS.primary, fontSize: 16, fontWeight: '600' },
});
