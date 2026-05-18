/**
 * Reusable header with back button + title used by settings/support screens
 */
import React from 'react';
import { View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { colors, spacing, radius, typography } from '@/src/theme';
import { useLocale } from '@/src/context/LocaleContext';

type Props = {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  onBack?: () => void;
};

export function ScreenHeader({ title, subtitle, right, onBack }: Props) {
  const { locale } = useLocale();
  const isRTL = locale === 'ar';
  // In RTL, back arrow visually points forward (chevron-forward).
  // In LTR, it points back (chevron-back).
  const arrow: any = isRTL ? 'chevron-forward' : 'chevron-back';
  return (
    <SafeAreaView edges={['top']} style={styles.safe}>
      <View style={styles.row}>
        <Pressable
          onPress={() => (onBack ? onBack() : router.back())}
          hitSlop={20}
          style={styles.btn}
          testID="screen-back-btn"
        >
          <Ionicons name={arrow} size={24} color={colors.textPrimary} />
        </Pressable>
        <View style={styles.center}>
          <Text style={styles.title} numberOfLines={1}>{title}</Text>
          {subtitle ? <Text style={styles.sub} numberOfLines={1}>{subtitle}</Text> : null}
        </View>
        <View style={styles.right}>{right ?? null}</View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { backgroundColor: colors.appBg },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.darkBrown,
    minHeight: 56,
  },
  btn: {
    width: 44, height: 44, borderRadius: radius.pill,
    backgroundColor: colors.surface1,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: colors.darkBrown,
  },
  center: { flex: 1, alignItems: 'center' },
  title: { ...typography.h3, color: colors.textPrimary, fontSize: 17, fontWeight: '700' },
  sub: { color: colors.gold, fontSize: 12, marginTop: 2 },
  right: { minWidth: 44, alignItems: 'flex-end' },
});
