/**
 * Driver trip history
 */
import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, RefreshControl, Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius } from '@/src/theme';
import { driverHistory } from '@/src/api/client';
import { formatIQD, formatKm } from '@/src/utils/format';
import { StatusBadge } from '@/src/components/ui';

const STATUS_LABEL: Record<string, string> = {
  completed: 'مكتمل',
  cancelled: 'ملغى',
};

export default function History() {
  const [items, setItems] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const list = await driverHistory();
      setItems(list || []);
    } catch {}
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>سجل الرحلات</Text>
        <Text style={styles.subtitle}>{items.length} رحلة</Text>
      </View>
      <FlatList
        data={items}
        keyExtractor={(i) => i.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }}
            tintColor={colors.gold}
          />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="time-outline" size={56} color={colors.textDisabled} />
            <Text style={styles.emptyTitle}>لا توجد رحلات بعد</Text>
            <Text style={styles.emptyDesc}>ستظهر الرحلات المكتملة هنا</Text>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable style={styles.card} testID={`hist-${item.id}`}>
            <View style={styles.cardTop}>
              <Text style={styles.num}>#{item.order_number}</Text>
              <StatusBadge status={item.status} label={STATUS_LABEL[item.status] || item.status} />
            </View>
            <Text style={styles.addr} numberOfLines={1}>
              <Ionicons name="location" size={12} color={colors.gold} /> {item.pickup?.address}
            </Text>
            <Text style={styles.addr} numberOfLines={1}>
              <Ionicons name="flag" size={12} color={colors.error} /> {item.dropoff?.address}
            </Text>
            <View style={styles.cardFoot}>
              <Text style={styles.dist}>{formatKm(item.distance_km)}</Text>
              <Text style={styles.price}>{formatIQD(item.final_price)}</Text>
            </View>
          </Pressable>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.appBg },
  header: { padding: spacing.lg, paddingBottom: spacing.sm },
  title: { color: colors.textPrimary, fontSize: 26, fontWeight: '700' },
  subtitle: { color: colors.textSecondary, fontSize: 13, marginTop: 2 },
  list: { padding: spacing.lg, paddingTop: 0, gap: spacing.md, flexGrow: 1 },
  empty: { alignItems: 'center', paddingVertical: spacing.xxl, gap: spacing.sm },
  emptyTitle: { color: colors.textPrimary, fontWeight: '700', fontSize: 16 },
  emptyDesc: { color: colors.textSecondary, fontSize: 13 },
  card: {
    backgroundColor: colors.surface1,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.darkBrown,
    gap: 6,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  num: { color: colors.gold, fontWeight: '700', fontSize: 13 },
  addr: { color: colors.textPrimary, fontSize: 13 },
  cardFoot: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.darkBrown, marginTop: 4,
  },
  dist: { color: colors.textSecondary, fontSize: 13 },
  price: { color: colors.gold, fontWeight: '700', fontSize: 16 },
});
