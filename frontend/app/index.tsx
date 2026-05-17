/**
 * Entry - redirect based on auth status
 */
import React from 'react';
import { Redirect } from 'expo-router';
import { ActivityIndicator, View, StyleSheet } from 'react-native';
import { useAuth } from '@/src/context/AuthContext';
import { colors } from '@/src/theme';

export default function Index() {
  const { isLoading, isAuthenticated, user } = useAuth();

  if (isLoading) {
    return (
      <View style={styles.loader} testID="root-loader">
        <ActivityIndicator color={colors.gold} size="large" />
      </View>
    );
  }

  if (!isAuthenticated) return <Redirect href="/(auth)/welcome" />;
  if (!user?.name) return <Redirect href="/(auth)/register" />;
  return <Redirect href="/(tabs)" />;
}

const styles = StyleSheet.create({
  loader: {
    flex: 1,
    backgroundColor: colors.appBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
