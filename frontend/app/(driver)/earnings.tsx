/**
 * Driver Earnings tab
 */
import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, shadows } from '@/src/theme';
import { driverEarnings } from '@/src/api/client';
import { formatIQD } from '@/src/utils/format';

export default function Earnings() {
  const [data, setData] = useState<any | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const e = await driverEarnings();
      setData(e);
    } catch {}
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await load();
              setRefreshing(false);
            }}
            tintColor={colors.gold}
          />
        }
      >
        <Text style={styles.title}>الأرباح</Text>

        {/* Total earnings hero */}
        <View style={styles.hero}>
          <Text style={styles.heroLabel}>إجمالي الأرباح</Text>
          <Text style={styles.heroValue} testID="total-earnings">
            {data ? formatIQD(data.total_earnings) : '0 د.ع'}
          </Text>
          <View style={styles.heroFooter}>
            <Ionicons name="trending-up" size={14} color={colors.appBg} />
            <Text style={styles.heroFooterText}>
              {data?.total_trips ?? 0} رحلة مكتملة
            </Text>
          </View>
        </View>

        {/* Today / Week */}
        <View style={styles.gridRow}>
          <View style={styles.gridCard}>
            <Ionicons name="today" size={20} color={colors.gold} />
            <Text style={styles.gridLabel}>اليوم</Text>
            <Text style={styles.gridValue}>{data ? formatIQD(data.today_earnings) : '—'}</Text>
            <Text style={styles.gridSub}>{data?.today_trips ?? 0} رحلة</Text>
          </View>
          <View style={styles.gridCard}>
            <Ionicons name="calendar" size={20} color={colors.gold} />
            <Text style={styles.gridLabel}>هذا الأسبوع</Text>
            <Text style={styles.gridValue}>{data ? formatIQD(data.week_earnings) : '—'}</Text>
            <Text style={styles.gridSub}>{data?.week_trips ?? 0} رحلة</Text>
          </View>
        </View>

        {/* Rating */}
        <View style={styles.ratingCard}>
          <Ionicons name="star" size={28} color={colors.gold} />
          <View style={{ flex: 1 }}>
            <Text style={styles.ratingValue}>{(data?.rating ?? 5).toFixed(1)} / 5.0</Text>
            <Text style={styles.ratingLabel}>تقييم العملاء</Text>
          </View>
        </View>

        {/* Payout note */}
        <View style={styles.note}>
          <Ionicons name="information-circle" size={16} color={colors.info} />
          <Text style={styles.noteText}>
            يتم تسوية الأرباح أسبوعياً عبر تحويل بنكي أو زين كاش.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.appBg },
  content: { padding: spacing.lg, gap: spacing.md },
  title: { color: colors.textPrimary, fontSize: 26, fontWeight: '700' },
  hero: {
    backgroundColor: colors.gold,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.xs,
    ...shadows.button,
  },
  heroLabel: { color: colors.appBg, fontSize: 13, opacity: 0.85, fontWeight: '600' },
  heroValue: { color: colors.appBg, fontSize: 36, fontWeight: '700' },
  heroFooter: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  heroFooterText: { color: colors.appBg, fontSize: 12, fontWeight: '700' },
  gridRow: { flexDirection: 'row', gap: spacing.md },
  gridCard: {
    flex: 1,
    backgroundColor: colors.surface1,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.darkBrown,
    gap: 4,
  },
  gridLabel: { color: colors.textSecondary, fontSize: 12, marginTop: 4 },
  gridValue: { color: colors.textPrimary, fontWeight: '700', fontSize: 18 },
  gridSub: { color: colors.textDisabled, fontSize: 11 },
  ratingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface1,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.darkBrown,
  },
  ratingValue: { color: colors.textPrimary, fontWeight: '700', fontSize: 20 },
  ratingLabel: { color: colors.textSecondary, fontSize: 12, marginTop: 2 },
  note: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: 'rgba(10,132,255,0.08)',
    borderRadius: radius.sm,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(10,132,255,0.3)',
  },
  noteText: { color: colors.textPrimary, fontSize: 12, flex: 1 },
});
