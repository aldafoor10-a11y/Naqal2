/**
 * Orders tab - list of all orders
 */
import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography, radius } from '@/src/theme';
import { translations } from '@/src/i18n';
import { listOrders } from '@/src/api/client';
import { StatusBadge } from '@/src/components/ui';
import { formatIQD } from '@/src/utils/format';

const STATUS_LABEL: Record<string, string> = {
  pending: 'قيد الانتظار',
  accepted: 'تم القبول',
  arriving: 'قادم',
  picked_up: 'تم الاستلام',
  in_transit: 'في الطريق',
  completed: 'مكتمل',
  cancelled: 'ملغى',
};

const TABS = [
  { key: 'all', label: 'الكل' },
  { key: 'active', label: 'نشطة' },
  { key: 'completed', label: 'مكتملة' },
];

export default function Orders() {
  const t = translations.ar;
  const [orders, setOrders] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState('all');

  const load = useCallback(async () => {
    try {
      const data = await listOrders();
      setOrders(data || []);
    } catch (e) {
      console.warn(e);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const filtered = orders.filter((o) => {
    if (tab === 'active') return !['completed', 'cancelled'].includes(o.status);
    if (tab === 'completed') return o.status === 'completed';
    return true;
  });

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>طلباتي</Text>
      </View>

      <View style={styles.tabs}>
        {TABS.map((tt) => (
          <Pressable
            key={tt.key}
            onPress={() => setTab(tt.key)}
            testID={`orders-tab-${tt.key}`}
            style={[styles.tab, tab === tt.key && styles.tabActive]}
          >
            <Text style={[styles.tabLabel, tab === tt.key && styles.tabLabelActive]}>
              {tt.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(i) => i.id}
        contentContainerStyle={styles.list}
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
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="receipt-outline" size={64} color={colors.textDisabled} />
            <Text style={styles.emptyTitle}>{t.noOrdersYet}</Text>
            <Text style={styles.emptyDesc}>ابدأ بطلبك الأول من الصفحة الرئيسية</Text>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            testID={`orders-list-item-${item.id}`}
            onPress={() => router.push(`/order/${item.id}`)}
            style={styles.card}
          >
            <View style={styles.cardTop}>
              <Text style={styles.cardNumber}>#{item.order_number}</Text>
              <StatusBadge
                status={item.status}
                label={STATUS_LABEL[item.status] || item.status}
              />
            </View>

            <View style={styles.timeline}>
              <View style={styles.tlPoint}>
                <View style={[styles.dot, { backgroundColor: colors.gold }]} />
                <View style={styles.dashedLine} />
                <View style={[styles.dot, { backgroundColor: colors.error }]} />
              </View>
              <View style={styles.tlText}>
                <Text style={styles.addr} numberOfLines={1}>
                  {item.pickup?.address}
                </Text>
                <View style={{ height: spacing.md }} />
                <Text style={styles.addr} numberOfLines={1}>
                  {item.dropoff?.address}
                </Text>
              </View>
            </View>

            <View style={styles.cardFoot}>
              <View>
                <Text style={styles.priceLabel}>المبلغ</Text>
                <Text style={styles.price}>{formatIQD(item.final_price)}</Text>
              </View>
              <View>
                <Text style={styles.priceLabel}>المسافة</Text>
                <Text style={styles.distance}>{item.distance_km?.toFixed(1)} كم</Text>
              </View>
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
  title: { ...typography.h1, color: colors.textPrimary, fontSize: 28 },
  tabs: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  tab: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.surface1,
    borderWidth: 1,
    borderColor: colors.darkBrown,
  },
  tabActive: { backgroundColor: colors.gold, borderColor: colors.gold },
  tabLabel: { color: colors.textSecondary, fontSize: 13, fontWeight: '600' },
  tabLabelActive: { color: colors.textOnBrand, fontWeight: '700' },
  list: { padding: spacing.lg, paddingTop: 0, gap: spacing.md, flexGrow: 1 },
  empty: { alignItems: 'center', paddingVertical: spacing.xxl, gap: spacing.sm },
  emptyTitle: { color: colors.textPrimary, fontSize: 18, fontWeight: '700' },
  emptyDesc: { color: colors.textSecondary, fontSize: 14, textAlign: 'center' },
  card: {
    backgroundColor: colors.surface1,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.darkBrown,
    gap: spacing.sm,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardNumber: { color: colors.gold, fontWeight: '700', fontSize: 13 },
  timeline: { flexDirection: 'row', gap: spacing.sm, paddingVertical: spacing.xs },
  tlPoint: { alignItems: 'center', justifyContent: 'space-between', paddingVertical: 4 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  dashedLine: { width: 1, flex: 1, borderRightWidth: 1, borderColor: colors.darkBrown, borderStyle: 'dashed', minHeight: 24 },
  tlText: { flex: 1, justifyContent: 'space-between' },
  addr: { color: colors.textPrimary, fontSize: 14 },
  cardFoot: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.darkBrown,
  },
  priceLabel: { color: colors.textDisabled, fontSize: 11 },
  price: { color: colors.gold, fontWeight: '700', fontSize: 16 },
  distance: { color: colors.textPrimary, fontWeight: '700', fontSize: 16 },
});
