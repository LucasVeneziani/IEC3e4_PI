import { useCameraPermissions } from 'expo-camera';
import { Redirect } from 'expo-router';
import React from 'react';
import { ActivityIndicator, View } from 'react-native';

import { useAuth } from '@/lib/auth';
import { loginColors } from '@/lib/theme';

/** Ponto de entrada: primeiro o login, depois a permissão da câmera, depois o scanner. */
export default function Index() {
  const { user, ready } = useAuth();
  const [permission] = useCameraPermissions();

  if (!ready || (user && !permission)) {
    return (
      <View style={{ flex: 1, backgroundColor: loginColors.background, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={loginColors.accent} />
      </View>
    );
  }
  if (!user) return <Redirect href="/login" />;
  if (!permission?.granted) return <Redirect href="/permission" />;
  return <Redirect href="/scanner" />;
}
