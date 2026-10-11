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

export function NewGroupScreen({ navigation }: { navigation: any }) {
  const { refreshConversations } = useChat();
  const [name, setName] = useState('');
  const [query, setQuery] = useState('');
  const [users, setUsers] = useState<User[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState('');

  const load = useCallback(async (q: string) => {
    const res = await api.searchUsers(q);
    setUsers(res.users);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => load(query), 250);
    return () => clearTimeout(t);
  }, [query, load]);

  const toggle = (id: string) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const create = async () => {
    setError('');
    if (!name.trim()) return setError('Enter a group name');
    if (selected.length < 1) return setError('Select at least one member');
    try {
      const res = await api.createGroup(name.trim(), selected);
      await refreshConversations();
      navigation.replace('Chat', { conversationId: res.conversation.id });
    } catch (e: any) {
      setError(e.message);
    }
  };

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.input}
        placeholder="Group name"
        placeholderTextColor={COLORS.textMuted}
        value={name}
        onChangeText={setName}
      />
      <TextInput
        style={styles.input}
        placeholder="Search members"
        placeholderTextColor={COLORS.textMuted}
        autoCapitalize="none"
        value={query}
        onChangeText={setQuery}
      />
      <Text style={styles.count}>{selected.length} selected</Text>
      {!!error && <Text style={styles.error}>{error}</Text>}

      <FlatList
        data={users}
        keyExtractor={(u) => u.id}
        renderItem={({ item }) => {
          const active = selected.includes(item.id);
          return (
            <TouchableOpacity style={styles.row} onPress={() => toggle(item.id)}>
              <Avatar name={item.displayName} uri={item.avatarUrl} />
              <View style={styles.rowText}>
                <Text style={styles.name}>{item.displayName}</Text>
                <Text style={styles.handle}>@{item.username}</Text>
              </View>
              <Text style={[styles.check, active && styles.checkActive]}>{active ? '✓' : '○'}</Text>
            </TouchableOpacity>
          );
        }}
      />

      <TouchableOpacity style={styles.button} onPress={create}>
        <Text style={styles.buttonText}>Create group</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  input: {
    backgroundColor: COLORS.surface,
    color: COLORS.text,
    marginHorizontal: 12,
    marginTop: 12,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  count: { color: COLORS.textMuted, paddingHorizontal: 16, paddingTop: 10 },
  row: { flexDirection: 'row', alignItems: 'center', padding: 14 },
  rowText: { marginLeft: 12, flex: 1 },
  name: { color: COLORS.text, fontSize: 16, fontWeight: '600' },
  handle: { color: COLORS.textMuted, fontSize: 13 },
  check: { color: COLORS.textMuted, fontSize: 20 },
  checkActive: { color: COLORS.primary },
  button: {
    backgroundColor: COLORS.primary,
    margin: 12,
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
  },
  buttonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  error: { color: COLORS.danger, paddingHorizontal: 16 },
});
