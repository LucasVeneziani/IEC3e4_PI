import { Ionicons } from '@expo/vector-icons';
import { useCameraPermissions } from 'expo-camera';
import { router } from 'expo-router';
import React, { useEffect } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { loginColors as c } from '@/lib/theme';

export default function PermissionScreen() {
  const [permission, requestPermission] = useCameraPermissions();

  useEffect(() => {
    if (permission?.granted) router.replace('/scanner');
  }, [permission?.granted]);

  const blocked = permission && !permission.granted && !permission.canAskAgain;

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.icon}>
        <Ionicons name="camera-outline" size={48} color={c.accent} />
      </View>
      <Text style={styles.title}>Acesso à câmera</Text>
      <Text style={styles.body}>
        Para escanear roupas e objetos, o AppBrechó precisa usar a câmera do seu celular. As fotos ficam salvas apenas no seu histórico.
      </Text>
      <Pressable
        style={({ pressed }) => [styles.button, pressed && { opacity: 0.85 }]}
        onPress={blocked ? () => Linking.openSettings() : requestPermission}
        accessibilityRole="button"
      >
        <Text style={styles.buttonText}>{blocked ? 'Abrir configurações' : 'Permitir câmera'}</Text>
      </Pressable>
      {blocked && <Text style={styles.hint}>A permissão foi negada. Ative a câmera nas configurações do sistema.</Text>}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: c.background, alignItems: 'center', justifyContent: 'center', padding: 32 },
  icon: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: c.field,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  title: { color: c.text, fontSize: 24, fontWeight: '700', marginBottom: 12 },
  body: { color: c.muted, fontSize: 15, textAlign: 'center', lineHeight: 22, marginBottom: 32 },
  button: { backgroundColor: c.accent, height: 50, borderRadius: 12, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center' },
  buttonText: { color: '#14202F', fontSize: 16, fontWeight: '700' },
  hint: { color: c.muted, fontSize: 13, textAlign: 'center', marginTop: 16 },
});
