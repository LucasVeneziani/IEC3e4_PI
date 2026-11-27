import { Stack } from 'expo-router';
import { SQLiteProvider } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';
import React, { Suspense } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider } from '@/lib/auth';
import { DATABASE_NAME, migrateDbIfNeeded } from '@/lib/db';
import { loginColors, ThemeProvider } from '@/lib/theme';

function Loading() {
  return (
    <View style={{ flex: 1, backgroundColor: loginColors.background, alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator color={loginColors.accent} />
    </View>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <Suspense fallback={<Loading />}>
        <SQLiteProvider databaseName={DATABASE_NAME} onInit={migrateDbIfNeeded} useSuspense>
          <ThemeProvider>
            <AuthProvider>
              <StatusBar style="light" />
              <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: loginColors.background } }}>
                <Stack.Screen name="index" />
                <Stack.Screen name="login" options={{ animation: 'fade' }} />
                <Stack.Screen name="permission" options={{ animation: 'fade' }} />
                <Stack.Screen name="scanner" options={{ animation: 'fade', contentStyle: { backgroundColor: '#000' } }} />
                <Stack.Screen
                  name="result/[id]"
                  options={{ presentation: 'transparentModal', animation: 'slide_from_bottom', contentStyle: { backgroundColor: 'transparent' } }}
                />
                <Stack.Screen
                  name="history"
                  options={{ presentation: 'transparentModal', animation: 'slide_from_bottom', contentStyle: { backgroundColor: 'transparent' } }}
                />
                <Stack.Screen
                  name="faq"
                  options={{ presentation: 'transparentModal', animation: 'slide_from_right', contentStyle: { backgroundColor: 'transparent' } }}
                />
                <Stack.Screen
                  name="settings"
                  options={{ presentation: 'transparentModal', animation: 'slide_from_bottom', contentStyle: { backgroundColor: 'transparent' } }}
                />
              </Stack>
            </AuthProvider>
          </ThemeProvider>
        </SQLiteProvider>
      </Suspense>
    </SafeAreaProvider>
  );
}
