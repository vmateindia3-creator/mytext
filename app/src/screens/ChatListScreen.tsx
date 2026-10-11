import React, { useCallback, useLayoutEffect } from 'react';
import {
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Avatar } from '../components/Avatar';
import { COLORS } from '../config';
import { useAuth } from '../context/AuthContext';
import { useChat } from '../context/ChatContext';
import { Conversation } from '../types';

function titleFor(conv: Conversation, meId: string) {
  if (conv.type === 'group') return conv.name || 'Group';
  const other = conv.members.find((m) => m.id !== meId);
  return other?.displayName || other?.username || 'Chat';
}

function otherFor(conv: Conversation, meId: string) {
  return conv.members.find((m) => m.id !== meId);
}

export function ChatListScreen({ navigation }: { navigation: any }) {
  const { user, logout } = useAuth();
  const { conversations, refreshConversations } = useChat();

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <View style={{ flexDirection: 'row' }}>
          <TouchableOpacity onPress={() => navigation.navigate('NewChat')} style={styles.headerBtn}>
            <Text style={styles.headerBtnText}>＋</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={logout} style={styles.headerBtn}>
            <Text style={styles.headerBtnTextSmall}>Logout</Text>
          </TouchableOpacity>
        </View>
      ),
    });
  }, [navigation, logout]);

  const renderItem = useCallback(
    ({ item }: { item: Conversation }) => {
      const other = otherFor(item, user!.id);
      const subtitle = item.lastMessage
        ? item.lastMessage.kind === 'text'
          ? item.lastMessage.text
          : item.lastMessage.kind === 'image'
          ? '📷 Photo'
          : '📎 File'
        : 'No messages yet';
      return (
        <TouchableOpacity
          style={styles.row}
          onPress={() => navigation.navigate('Chat', { conversationId: item.id })}
        >
          <Avatar
            name={titleFor(item, user!.id)}
            uri={item.type === 'group' ? item.avatarUrl : other?.avatarUrl}
            online={item.type === 'direct' ? other?.online : undefined}
          />
          <View style={styles.rowText}>
            <Text style={styles.name} numberOfLines={1}>
              {titleFor(item, user!.id)}
            </Text>
            <Text style={styles.preview} numberOfLines={1}>
              {subtitle}
            </Text>
          </View>
        </TouchableOpacity>
      );
    },
    [user, navigation]
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={conversations}
        keyExtractor={(c) => c.id}
        renderItem={renderItem}
        onRefresh={refreshConversations}
        refreshing={false}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No chats yet.</Text>
            <Text style={styles.emptySub}>Tap ＋ to start a conversation.</Text>
          </View>
        }
        contentContainerStyle={conversations.length === 0 ? styles.emptyWrap : undefined}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  row: { flexDirection: 'row', alignItems: 'center', padding: 14 },
  rowText: { marginLeft: 12, flex: 1 },
  name: { color: COLORS.text, fontSize: 16, fontWeight: '600' },
  preview: { color: COLORS.textMuted, fontSize: 13, marginTop: 3 },
  headerBtn: { paddingHorizontal: 10 },
  headerBtnText: { color: COLORS.primary, fontSize: 26, fontWeight: '300' },
  headerBtnTextSmall: { color: COLORS.primary, fontSize: 14 },
  empty: { alignItems: 'center' },
  emptyWrap: { flexGrow: 1, justifyContent: 'center' },
  emptyText: { color: COLORS.text, fontSize: 16 },
  emptySub: { color: COLORS.textMuted, marginTop: 6 },
});
