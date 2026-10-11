import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { COLORS } from '../config';

function initials(name: string) {
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export function Avatar({
  name,
  uri,
  size = 48,
  online,
}: {
  name: string;
  uri?: string;
  size?: number;
  online?: boolean;
}) {
  return (
    <View style={{ width: size, height: size }}>
      {uri ? (
        <Image source={{ uri }} style={{ width: size, height: size, borderRadius: size / 2 }} />
      ) : (
        <View
          style={[
            styles.fallback,
            { width: size, height: size, borderRadius: size / 2 },
          ]}
        >
          <Text style={[styles.initials, { fontSize: size * 0.36 }]}>{initials(name)}</Text>
        </View>
      )}
      {online !== undefined && (
        <View
          style={[
            styles.dot,
            {
              backgroundColor: online ? COLORS.success : COLORS.textMuted,
              right: 0,
              bottom: 0,
              width: size * 0.26,
              height: size * 0.26,
              borderRadius: size * 0.13,
            },
          ]}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: {
    backgroundColor: COLORS.primaryDark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: { color: '#fff', fontWeight: '700' },
  dot: { position: 'absolute', borderWidth: 2, borderColor: COLORS.bg },
});
