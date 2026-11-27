import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { Image } from 'expo-image';
import React, { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { Sheet } from '@/components/Sheet';
import { useAuth } from '@/lib/auth';
import { getKv, setKv } from '@/lib/db';
import { formatDateTime } from '@/lib/format';
import { listScans, type SortOrder } from '@/lib/scans';
import { useTheme } from '@/lib/theme';
import type { ScanSummary } from '@/lib/types';

const SORT_KEY = 'history_sort';

export default function HistoryScreen() {
  const db = useSQLiteContext();
  const { user } = useAuth();
  const { colors } = useTheme();
  const [order, setOrder] = useState<SortOrder>('newest');
  const [items, setItems] = useState<ScanSummary[] | null>(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        if (!user) return;
        const saved = (await getKv(db, SORT_KEY)) === 'oldest' ? 'oldest' : 'newest';
        const rows = await listScans(db, user.id, saved);
        if (active) {
          setOrder(saved);
          setItems(rows);
        }
      })();
      return () => {
        active = false;
      };
    }, [db, user]),
  );

  async function changeOrder(next: SortOrder) {
    if (!user || next === order) return;
    setOrder(next);
    await setKv(db, SORT_KEY, next);
    setItems(await listScans(db, user.id, next));
  }

  const sortToggle = (
    <View style={[styles.segment, { backgroundColor: colors.surfaceAlt }]}>
      {(
        [
          ['newest', 'Último → primeiro'],
          ['oldest', 'Primeiro → último'],
        ] as const
      ).map(([key, label]) => {
        const selected = order === key;
        return (
          <Pressable
            key={key}
            onPress={() => changeOrder(key)}
            style={[styles.segmentItem, selected && { backgroundColor: colors.accent }]}
            accessibilityRole="button"
            accessibilityState={{ selected }}
          >
            <Text style={{ color: selected ? colors.background : colors.text, fontSize: 12, fontWeight: '600' }}>{label}</Text>
          </Pressable>
        );
      })}
    </View>
  );

  return (
    <Sheet tab="history" title="Histórico">
      <View style={{ paddingHorizontal: 20, paddingBottom: 8 }}>{sortToggle}</View>
      <FlatList
        data={items ?? []}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24, flexGrow: 1 }}
        ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
        ListEmptyComponent={
          items ? (
            <View style={styles.empty}>
              <Ionicons name="shirt-outline" size={40} color={colors.textMuted} />
              <Text style={{ color: colors.textMuted, textAlign: 'center' }}>Nenhum item escaneado ainda.{'\n'}Toque na lupa para começar.</Text>
            </View>
          ) : null
        }
        renderItem={({ item }) => {
          const uri = item.thumbnailUri;
          return (
            <Pressable
              style={({ pressed }) => [styles.item, { backgroundColor: colors.surface, opacity: pressed ? 0.8 : 1 }]}
              onPress={() => router.push({ pathname: '/result/[id]', params: { id: String(item.id) } })}
            >
              {uri ? <Image source={{ uri }} style={styles.thumb} /> : <View style={[styles.thumb, { backgroundColor: colors.surfaceAlt }]} />}
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text, fontSize: 15, fontWeight: '600' }} numberOfLines={2}>
                  {item.name}
                </Text>
                <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 4 }}>{formatDateTime(item.scanned_at)}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </Pressable>
          );
        }}
      />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  segment: { flexDirection: 'row', borderRadius: 10, padding: 3 },
  segmentItem: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 8 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, borderRadius: 14 },
  thumb: { width: 56, height: 56, borderRadius: 10 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingVertical: 48 },
});
