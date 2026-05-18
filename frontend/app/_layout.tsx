/**
 * NAQAL GO - Root layout
 * - Sets up RTL (Arabic default)
 * - Provides AuthContext
 * - Configures status bar & dark theme
 */
import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { I18nManager, View, StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from '@/src/context/AuthContext';
import { colors } from '@/src/theme';

// Force RTL for Arabic-default app
// Note: In Expo Go RTL changes require a refresh; we still set it.
if (!I18nManager.isRTL) {
  try {
    I18nManager.allowRTL(true);
    I18nManager.forceRTL(true);
  } catch {}
}

export default function RootLayout() {
  useEffect(() => {
    // ensure RTL flag persists
    if (!I18nManager.isRTL) {
      try {
        I18nManager.forceRTL(true);
      } catch {}
    }
  }, []);

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <AuthProvider>
          <StatusBar style="light" backgroundColor={colors.appBg} />
          <View style={styles.root}>
            <Stack
              screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: colors.appBg },
                animation: 'fade',
              }}
            >
              <Stack.Screen name="index" />
              <Stack.Screen name="(auth)" />
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="(driver)" />
              <Stack.Screen
                name="order/create"
                options={{ animation: 'slide_from_bottom', presentation: 'modal' }}
              />
              <Stack.Screen name="order/details" options={{ animation: 'slide_from_right' }} />
              <Stack.Screen name="order/[id]" options={{ animation: 'slide_from_right' }} />
            </Stack>
          </View>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.appBg },
});
