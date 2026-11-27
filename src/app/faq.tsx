import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Sheet } from '@/components/Sheet';
import { type Palette, useTheme } from '@/lib/theme';

type Faq = { question: string; answer: string };

/** Perguntas e respostas da tela de ajuda; para adicionar uma nova, basta incluir um item aqui. */
const FAQ: Faq[] = [
  {
    question: 'Como escaneio uma peça ou um objeto?',
    answer:
      'Aponte a câmera para a roupa ou objeto, com boa luz e o item ocupando a maior parte da tela, e toque na lupa. Em alguns segundos aparece o nome, a faixa de preço de usado e anúncios parecidos.',
  },
  {
    question: 'Só funciona com roupas?',
    answer:
      'Não. Roupas, calçados e acessórios recebem detalhes de moda (tecido, estampa, época), mas qualquer objeto pode ser escaneado: brinquedos, livros, eletrônicos, louças e decoração.',
  },
  {
    question: 'E códigos de barras e QR codes?',
    answer:
      'Quando a câmera encontra um código de barras ou QR code, aparece um cartão acima da lupa com o código. Toque em "Buscar" para consultar o produto. Se o QR code tiver um link, o app abre a página e usa o conteúdo dela.',
  },
  {
    question: 'De onde vêm as informações e o preço?',
    answer:
      'A foto é analisada por uma IA (via OpenRouter), que identifica o item. Em seguida o app busca anúncios parecidos em sites como Enjoei, Repassa, Mercado Livre e OLX, e a IA estima a faixa de preço de usado com base neles. O preço é uma estimativa, não uma avaliação oficial.',
  },
  {
    question: 'Onde ficam salvos os meus escaneamentos?',
    answer:
      'No Histórico, apenas neste celular, junto com as fotos. Cada conta vê só os próprios escaneamentos. Você pode ordenar do último para o primeiro ou do primeiro para o último, e remover um item abrindo-o e tocando em "Remover do histórico".',
  },
  {
    question: 'Por que preciso de uma conta?',
    answer:
      'A conta separa o histórico de cada pessoa que usa o mesmo aparelho. Ela fica guardada só no celular; a senha é salva de forma criptografada.',
  },
  {
    question: 'Apareceu "Não foi possível conectar ao servidor". O que faço?',
    answer:
      'O app precisa do servidor de IA rodando no computador (python backend/run.py) e o celular precisa estar na mesma rede Wi-Fi. Confira também se o firewall do computador permite o Python em redes privadas.',
  },
  {
    question: 'Como troco entre modo claro e escuro?',
    answer: 'Em Configurações > Aparência, use a chave "Modo escuro". A escolha fica salva para as próximas vezes.',
  },
];

export default function FaqScreen() {
  const { colors } = useTheme();
  const [open, setOpen] = useState<number | null>(null);
  const s = makeStyles(colors);

  const back = (
    <Pressable onPress={() => router.back()} hitSlop={10} accessibilityLabel="Voltar para Configurações" style={s.back}>
      <Ionicons name="chevron-back" size={18} color={colors.accent} />
      <Text style={{ color: colors.accent, fontSize: 15 }}>Voltar</Text>
    </Pressable>
  );

  return (
    <Sheet tab="settings" title="Perguntas frequentes" right={back}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }}>
        <View style={s.card}>
          {FAQ.map((item, i) => {
            const expanded = open === i;
            return (
              <View key={item.question} style={i > 0 && s.divider}>
                <Pressable
                  onPress={() => setOpen(expanded ? null : i)}
                  style={({ pressed }) => [s.question, pressed && { opacity: 0.7 }]}
                  accessibilityRole="button"
                  accessibilityState={{ expanded }}
                >
                  <Text style={s.questionText}>{item.question}</Text>
                  <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textMuted} />
                </Pressable>
                {expanded && <Text style={s.answer}>{item.answer}</Text>}
              </View>
            );
          })}
        </View>
      </ScrollView>
    </Sheet>
  );
}

function makeStyles(c: Palette) {
  return StyleSheet.create({
    back: { flexDirection: 'row', alignItems: 'center', gap: 2 },
    card: { backgroundColor: c.surface, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: c.border },
    divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border },
    question: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
    questionText: { flex: 1, color: c.text, fontSize: 15, fontWeight: '600' },
    answer: { color: c.textMuted, fontSize: 14, lineHeight: 21, paddingHorizontal: 14, paddingBottom: 14, marginTop: -4 },
  });
}
