import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';

import { Sheet } from '@/components/Sheet';
import { type Palette, useTheme } from '@/lib/theme';

type SettingRow = {
  key: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  title: string;
  subtitle?: string;
  /** Conteúdo à direita (ex.: um Switch). Sem ele, a linha mostra uma seta. */
  render?: () => React.ReactNode;
  /** Torna a linha inteira tocável (ex.: abrir outra tela). */
  onPress?: () => void;
};

type SettingSection = { title: string; rows: SettingRow[] };

/** Lista rolável de seções; adicione novas linhas em `sections` conforme surgirem novas configurações. */
export default function SettingsScreen() {
  const { mode, setMode, colors } = useTheme();

  const sections: SettingSection[] = [
    {
      title: 'Aparência',
      rows: [
        {
          key: 'dark-mode',
          icon: mode === 'dark' ? 'moon' : 'sunny',
          title: 'Modo escuro',
          subtitle: mode === 'dark' ? 'Ativado' : 'Desativado (modo claro)',
          render: () => (
            <Switch
              value={mode === 'dark'}
              onValueChange={(on) => setMode(on ? 'dark' : 'light')}
              trackColor={{ true: colors.accent, false: colors.border }}
              thumbColor="#fff"
            />
          ),
        },
      ],
    },
    {
      title: 'Ajuda',
      rows: [
        {
          key: 'faq',
          icon: 'help-circle-outline',
          title: 'Perguntas frequentes',
          subtitle: 'Como escanear, histórico, códigos e conta',
          onPress: () => router.push('/faq'),
        },
      ],
    },
  ];

  const s = makeStyles(colors);
  return (
    <Sheet tab="settings" title="Configurações">
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }}>
        {sections.map((section) => (
          <View key={section.title} style={{ marginBottom: 20 }}>
            <Text style={s.sectionTitle}>{section.title.toUpperCase()}</Text>
            <View style={s.card}>
              {section.rows.map((row, i) => (
                <Pressable
                  key={row.key}
                  onPress={row.onPress}
                  disabled={!row.onPress}
                  accessibilityRole={row.onPress ? 'button' : undefined}
                  style={({ pressed }) => [s.row, i > 0 && s.rowDivider, pressed && { opacity: 0.7 }]}
                >
                  <View style={s.iconWrap}>
                    <Ionicons name={row.icon} size={18} color={colors.accent} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.title}>{row.title}</Text>
                    {row.subtitle && <Text style={s.subtitle}>{row.subtitle}</Text>}
                  </View>
                  {row.render ? row.render() : <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />}
                </Pressable>
              ))}
            </View>
          </View>
        ))}
      </ScrollView>
    </Sheet>
  );
}

function makeStyles(c: Palette) {
  return StyleSheet.create({
    sectionTitle: { color: c.textMuted, fontSize: 12, fontWeight: '600', letterSpacing: 0.6, marginBottom: 8, marginLeft: 6 },
    card: { backgroundColor: c.surface, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: c.border },
    row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
    rowDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border },
    iconWrap: { width: 32, height: 32, borderRadius: 8, backgroundColor: c.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
    title: { color: c.text, fontSize: 15, fontWeight: '500' },
    subtitle: { color: c.textMuted, fontSize: 12, marginTop: 2 },
  });
}
