import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/lib/theme';

export type Tab = 'history' | 'scan' | 'settings';

export const BOTTOM_BAR_HEIGHT = 64;

const TABS: { key: Tab; label: string; icon: React.ComponentProps<typeof Ionicons>['name'] }[] = [
  { key: 'history', label: 'Histórico', icon: 'time-outline' },
  { key: 'scan', label: 'Escanear', icon: 'scan-outline' },
  { key: 'settings', label: 'Configurações', icon: 'settings-outline' },
];

/**
 * O scanner fica sempre por baixo; Histórico e Configurações são sobreposições abertas por cima dele.
 * Cada sobreposição desenha esta mesma barra no mesmo lugar, para parecer uma única barra fixa.
 */
export function BottomBar({ active }: { active: Tab }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  function go(tab: Tab) {
    if (tab === active) return;
    if (tab === 'scan') router.dismissTo('/scanner');
    else if (active === 'scan') router.push(tab === 'history' ? '/history' : '/settings');
    else router.replace(tab === 'history' ? '/history' : '/settings');
  }

  return (
    <View style={[styles.bar, { backgroundColor: colors.tabBar, paddingBottom: insets.bottom, height: BOTTOM_BAR_HEIGHT + insets.bottom }]}>
      {TABS.map((tab) => {
        const selected = tab.key === active;
        const color = selected ? colors.accent : colors.text;
        return (
          <Pressable key={tab.key} style={styles.tab} onPress={() => go(tab.key)} accessibilityRole="tab" accessibilityState={{ selected }}>
            <Ionicons name={tab.icon} size={24} color={color} />
            <Text style={[styles.label, { color }]}>{tab.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row' },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2 },
  label: { fontSize: 11 },
});
