/**
 * Shared UI primitives
 */
import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { colors, radius, spacing, typography, shadows } from '@/src/theme';

type ButtonProps = {
  label: string;
  onPress?: () => void;
  variant?: 'primary' | 'secondary' | 'ghost';
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  testID?: string;
  icon?: React.ReactNode;
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
  fullWidth = true,
  style,
  textStyle,
  testID,
  icon,
}: ButtonProps) {
  const isDisabled = disabled || loading;
  const bg =
    variant === 'primary'
      ? colors.gold
      : variant === 'secondary'
      ? colors.surface2
      : 'transparent';
  const fg =
    variant === 'primary'
      ? colors.textOnBrand
      : variant === 'secondary'
      ? colors.gold
      : colors.textPrimary;
  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      testID={testID}
      style={({ pressed }) => [
        styles.btn,
        { backgroundColor: bg, opacity: isDisabled ? 0.5 : pressed ? 0.85 : 1 },
        variant === 'secondary' && styles.btnSecondary,
        fullWidth && styles.fullWidth,
        variant === 'primary' && !isDisabled && shadows.button,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <View style={styles.btnContent}>
          {icon}
          <Text style={[styles.btnLabel, { color: fg }, textStyle]}>{label}</Text>
        </View>
      )}
    </Pressable>
  );
}

export function Card({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Divider() {
  return <View style={styles.divider} />;
}

export function StatusBadge({ status, label }: { status: string; label: string }) {
  const styleMap: Record<string, ViewStyle> = {
    pending: { backgroundColor: 'rgba(255,159,10,0.15)', borderColor: colors.warning },
    accepted: { backgroundColor: 'rgba(10,132,255,0.15)', borderColor: colors.info },
    arriving: { backgroundColor: 'rgba(10,132,255,0.15)', borderColor: colors.info },
    picked_up: { backgroundColor: 'rgba(212,164,55,0.15)', borderColor: colors.gold },
    in_transit: { backgroundColor: 'rgba(212,164,55,0.15)', borderColor: colors.gold },
    completed: { backgroundColor: 'rgba(52,199,89,0.15)', borderColor: colors.success },
    cancelled: { backgroundColor: 'rgba(255,69,58,0.15)', borderColor: colors.error },
  };
  const textColorMap: Record<string, string> = {
    pending: colors.warning,
    accepted: colors.info,
    arriving: colors.info,
    picked_up: colors.gold,
    in_transit: colors.gold,
    completed: colors.success,
    cancelled: colors.error,
  };
  return (
    <View style={[styles.badge, styleMap[status] || styleMap.pending]}>
      <Text style={[styles.badgeText, { color: textColorMap[status] || colors.warning }]}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  btn: {
    minHeight: 52,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnSecondary: { borderWidth: 1, borderColor: colors.darkBrown },
  fullWidth: { alignSelf: 'stretch' },
  btnContent: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  btnLabel: { ...typography.button },
  card: {
    backgroundColor: colors.surface1,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.darkBrown,
    padding: spacing.md,
    ...shadows.card,
  },
  divider: { height: 1, backgroundColor: colors.darkBrown, marginVertical: spacing.md },
  badge: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  badgeText: { fontSize: 12, fontWeight: '700' },
});
