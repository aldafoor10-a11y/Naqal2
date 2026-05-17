import { Stack } from 'expo-router';
import { colors } from '@/src/theme';

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.appBg },
        animation: 'slide_from_right',
      }}
    />
  );
}
