import React from 'react';
import { Image, Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { COLORS } from '../config';
import { Message } from '../types';

function time(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function MessageBubble({ message, mine }: { message: Message; mine: boolean }) {
  const isMedia = message.kind === 'image' || message.kind === 'file';

  return (
    <View style={[styles.row, mine ? styles.rowMine : styles.rowTheirs]}>
      <View style={[styles.bubble, mine ? styles.mine : styles.theirs]}>
        {!mine && <Text style={styles.sender}>{message.sender.displayName}</Text>}

        {message.kind === 'image' && message.mediaUrl ? (
          <Image source={{ uri: message.mediaUrl }} style={styles.image} resizeMode="cover" />
        ) : null}

        {message.kind === 'file' && message.mediaUrl ? (
          <TouchableOpacity onPress={() => Linking.openURL(message.mediaUrl!)}>
            <Text style={[styles.file, mine ? styles.textMine : styles.textTheirs]}>
              📎 {message.mediaName || 'file'}
            </Text>
          </TouchableOpacity>
        ) : null}

        {!!message.text && (
          <Text style={[styles.text, mine ? styles.textMine : styles.textTheirs]}>
            {message.text}
          </Text>
        )}

        <View style={styles.metaRow}>
          <Text style={styles.meta}>{time(message.createdAt)}</Text>
          {mine && <Text style={styles.meta}>{message.readBy.length > 0 ? ' ✓✓' : ' ✓'}</Text>}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { marginVertical: 3, paddingHorizontal: 12 },
  rowMine: { alignItems: 'flex-end' },
  rowTheirs: { alignItems: 'flex-start' },
  bubble: { maxWidth: '80%', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 8 },
  mine: { backgroundColor: COLORS.bubbleOut, borderBottomRightRadius: 4 },
  theirs: { backgroundColor: COLORS.bubbleIn, borderBottomLeftRadius: 4 },
  sender: { color: COLORS.primary, fontSize: 12, fontWeight: '700', marginBottom: 2 },
  text: { fontSize: 15, lineHeight: 21 },
  textMine: { color: '#fff' },
  textTheirs: { color: COLORS.text },
  image: { width: 200, height: 200, borderRadius: 10, marginBottom: 4 },
  file: { fontSize: 15, textDecorationLine: 'underline' },
  metaRow: { flexDirection: 'row', alignSelf: 'flex-end', marginTop: 3 },
  meta: { color: 'rgba(255,255,255,0.65)', fontSize: 10 },
});
