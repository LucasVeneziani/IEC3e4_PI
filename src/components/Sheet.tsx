import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BOTTOM_BAR_HEIGHT, BottomBar, type Tab } from './BottomBar';
import { Overlay } from './Overlay';
import { useTheme } from '@/lib/theme';

/** Painel sobre o scanner, acima da barra inferior (usado por Histórico e Configurações). */
export function Sheet({ tab, title, right, children }: { tab: Tab; title: string; right?: React.ReactNode; children: React.ReactNode }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Overlay>
      <View
        style={[
          styles.sheet,
          { backgroundColor: colors.background, top: insets.top + 48, bottom: BOTTOM_BAR_HEIGHT + insets.bottom },
        ]}
      >
        <View style={styles.grabber}>
          <View style={[styles.grabberBar, { backgroundColor: colors.border }]} />
        </View>
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
          {right}
        </View>
        {children}
      </View>
      <BottomBar active={tab} />
    </Overlay>
  );
}

const styles = StyleSheet.create({
  sheet: { position: 'absolute', left: 0, right: 0, borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: 'hidden' },
  grabber: { alignItems: 'center', paddingTop: 8 },
  grabberBar: { width: 40, height: 4, borderRadius: 2 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 12 },
  title: { fontSize: 22, fontWeight: '700' },
});
