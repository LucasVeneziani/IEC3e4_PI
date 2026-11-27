import { router } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { useTheme } from '@/lib/theme';

/** Fundo escurecido sobre o scanner; tocar fora do conteúdo fecha a sobreposição. */
export function Overlay({ children }: { children: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={styles.root}>
      <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: colors.scrim }]} onPress={() => router.back()} accessibilityLabel="Fechar" />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({ root: { flex: 1 } });
