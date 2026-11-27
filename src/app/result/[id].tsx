import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { Image } from 'expo-image';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Overlay } from '@/components/Overlay';
import { useAuth } from '@/lib/auth';
import { formatDateTime, formatMoney } from '@/lib/format';
import { deleteScan, getScan } from '@/lib/scans';
import { type Palette, useTheme } from '@/lib/theme';
import type { Scan } from '@/lib/types';

/** Resultado do escaneamento: painel na metade de cima do scanner; role dentro dele (ou expanda) para ver os detalhes. */
export default function ResultScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const db = useSQLiteContext();
  const { user } = useAuth();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const [scan, setScan] = useState<Scan | null | undefined>(undefined);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (user) getScan(db, user.id, Number(id)).then(setScan);
  }, [db, user, id]);

  const panelHeight = expanded ? height : Math.round(height * 0.5);
  const imageUri = scan?.imageUri;
  const s = makeStyles(colors);

  return (
    <Overlay>
      <View style={[s.panel, { height: panelHeight }, expanded && { borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }]}>
        {scan === undefined ? (
          <ActivityIndicator style={{ flex: 1 }} color={colors.accent} />
        ) : scan === null ? (
          <Text style={[s.body, { padding: 24, paddingTop: insets.top + 24 }]}>Escaneamento não encontrado.</Text>
        ) : (
          <ScrollView
            contentContainerStyle={{ paddingBottom: 32 }}
            showsVerticalScrollIndicator
            scrollEventThrottle={16}
            // Ao rolar para ver os detalhes, o painel ocupa a tela inteira.
            onScroll={(e) => {
              if (!expanded && e.nativeEvent.contentOffset.y > 24) setExpanded(true);
            }}
          >
            {imageUri && <Image source={{ uri: imageUri }} style={{ width: '100%', height: Math.round(height * 0.32) }} contentFit="cover" />}
            <Details scan={scan} colors={colors} />
            <Pressable
              style={s.delete}
              onPress={async () => {
                if (!user) return;
                await deleteScan(db, user.id, scan.id);
                router.back();
              }}
            >
              <Ionicons name="trash-outline" size={16} color={colors.danger} />
              <Text style={{ color: colors.danger }}>Remover do histórico</Text>
            </Pressable>
          </ScrollView>
        )}

        <View style={[s.actions, { top: insets.top + 10 }]}>
          <RoundButton icon={expanded ? 'contract-outline' : 'expand-outline'} onPress={() => setExpanded((e) => !e)} label="Expandir" />
          <RoundButton icon="close" onPress={() => router.back()} label="Fechar" />
        </View>
        {!expanded && scan && (
          <View style={s.scrollHint} pointerEvents="none">
            <Ionicons name="chevron-down" size={18} color={colors.textMuted} />
          </View>
        )}
      </View>
    </Overlay>
  );
}

function RoundButton({ icon, onPress, label }: { icon: React.ComponentProps<typeof Ionicons>['name']; onPress: () => void; label: string }) {
  return (
    <Pressable onPress={onPress} accessibilityLabel={label} hitSlop={8} style={styles.round}>
      <Ionicons name={icon} size={20} color="#fff" />
    </Pressable>
  );
}

function Details({ scan, colors }: { scan: Scan; colors: Palette }) {
  const d = scan.data;
  const s = makeStyles(colors);
  const attributes: [string, string | null | undefined][] = [
    [d.barcode_type === 'qr' ? 'QR code' : 'Código de barras', d.link ? null : d.barcode],
    ['Categoria', d.category],
    ['Cores', d.colors?.length ? d.colors.join(', ') : null],
    ['Material', d.material],
    ['Estampa', d.pattern],
    ['Estilo', d.style],
    ['Época', d.era],
    ['Estado', d.condition],
    ['Tamanho', d.size_hint],
  ];

  return (
    <View style={{ padding: 20, gap: 18 }}>
      <View>
        <Text style={s.title}>{d.name}</Text>
        {d.brand && <Text style={s.brand}>{d.brand}</Text>}
        {d.estimated_price && (
          <Text style={s.price}>
            {formatMoney(d.estimated_price.min, d.estimated_price.currency)} – {formatMoney(d.estimated_price.max, d.estimated_price.currency)}
          </Text>
        )}
        <Text style={s.muted}>Escaneado em {formatDateTime(scan.scanned_at)}</Text>
      </View>

      <Text style={s.body}>{d.description}</Text>

      {d.link && (
        <Pressable style={s.listing} onPress={() => Linking.openURL(d.link!)}>
          <Ionicons name="qr-code-outline" size={20} color={colors.accent} />
          <Text style={[s.body, { flex: 1 }]} numberOfLines={2}>
            {d.link}
          </Text>
          <Ionicons name="open-outline" size={16} color={colors.textMuted} />
        </Pressable>
      )}

      <View style={s.card}>
        {attributes
          .filter(([, v]) => v)
          .map(([label, value]) => (
            <View key={label} style={s.row}>
              <Text style={s.rowLabel}>{label}</Text>
              <Text style={s.rowValue}>{value}</Text>
            </View>
          ))}
      </View>

      {d.care?.length > 0 && (
        <View>
          <Text style={s.section}>{d.kind === 'product' ? 'Dicas' : 'Cuidados'}</Text>
          {d.care.map((c) => (
            <Text key={c} style={s.body}>
              • {c}
            </Text>
          ))}
        </View>
      )}

      {d.market?.length > 0 && (
        <View>
          <Text style={s.section}>Encontrado na internet</Text>
          {d.market.map((m) => (
            <Pressable key={m.url} style={s.listing} onPress={() => Linking.openURL(m.url)}>
              <View style={{ flex: 1 }}>
                <Text style={s.body} numberOfLines={2}>
                  {m.title}
                </Text>
                <Text style={s.muted}>{m.source}</Text>
              </View>
              {m.price && <Text style={s.listingPrice}>{m.price}</Text>}
              <Ionicons name="open-outline" size={16} color={colors.textMuted} />
            </Pressable>
          ))}
        </View>
      )}

      {d.tags?.length > 0 && (
        <View style={s.tags}>
          {d.tags.map((t) => (
            <Text key={t} style={s.tag}>
              #{t}
            </Text>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  round: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' },
});

function makeStyles(c: Palette) {
  return StyleSheet.create({
    panel: { backgroundColor: c.background, borderBottomLeftRadius: 24, borderBottomRightRadius: 24, overflow: 'hidden' },
    actions: { position: 'absolute', right: 14, flexDirection: 'row', gap: 10 },
    scrollHint: { position: 'absolute', bottom: 4, alignSelf: 'center' },
    title: { color: c.text, fontSize: 22, fontWeight: '700' },
    brand: { color: c.accent, fontSize: 15, fontWeight: '600', marginTop: 2 },
    price: { color: c.success, fontSize: 20, fontWeight: '700', marginTop: 8 },
    muted: { color: c.textMuted, fontSize: 12, marginTop: 4 },
    body: { color: c.text, fontSize: 15, lineHeight: 22 },
    section: { color: c.text, fontSize: 16, fontWeight: '700', marginBottom: 8 },
    card: { backgroundColor: c.surface, borderRadius: 14, paddingHorizontal: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: c.border },
    row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border, gap: 12 },
    rowLabel: { color: c.textMuted, fontSize: 14 },
    rowValue: { color: c.text, fontSize: 14, flexShrink: 1, textAlign: 'right' },
    listing: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: c.surface, borderRadius: 12, padding: 12, marginBottom: 8 },
    listingPrice: { color: c.success, fontWeight: '700' },
    tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    tag: { color: c.accent, backgroundColor: c.surfaceAlt, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, fontSize: 13, overflow: 'hidden' },
    delete: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'center', padding: 12 },
  });
}
