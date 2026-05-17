/**
 * Home tab - service selection + recent orders
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Image,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography, radius, shadows } from '@/src/theme';
import { translations } from '@/src/i18n';
import { useAuth } from '@/src/context/AuthContext';
import { listOrders } from '@/src/api/client';
import { StatusBadge } from '@/src/components/ui';
import { formatIQD } from '@/src/utils/format';

const LOGO_URL =
  'https://customer-assets.emergentagent.com/job_eb826b44-ecc6-46f2-b4e7-84a184f8d38a/artifacts/x4ziw5ow_IMG_20260419_223622_456.webp';

const SERVICES = [
  {
    key: 'furniture',
    titleKey: 'serviceFurniture' as const,
    descKey: 'serviceFurnitureDesc' as const,
    icon: 'bed-outline' as const,
    gradient: ['#D4A437', '#A8821D'],
  },
  {
    key: 'goods',
    titleKey: 'serviceGoods' as const,
    descKey: 'serviceGoodsDesc' as const,
    icon: 'cube-outline' as const,
    gradient: ['#3D2817', '#281C13'],
  },
  {
    key: 'appliances',
    titleKey: 'serviceAppliances' as const,
    descKey: 'serviceAppliancesDesc' as const,
    icon: 'snow-outline' as const,
    gradient: ['#3D2817', '#281C13'],
  },
  {
    key: 'special',
    titleKey: 'serviceSpecial' as const,
    descKey: 'serviceSpecialDesc' as const,
    icon: 'star-outline' as const,
    gradient: ['#D4A437', '#A8821D'],
  },
];

const STATUS_LABEL: Record<string, string> = {
  pending: 'قيد الانتظار',
  accepted: 'تم القبول',
  arriving: 'قادم',
  picked_up: 'تم الاستلام',
  in_transit: 'في الطريق',
  completed: 'مكتمل',
  cancelled: 'ملغى',
};

export default function Home() {
  const t = translations.ar;
  const { user } = useAuth();
  const [orders, setOrders] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await listOrders();
      setOrders(data || []);
    } catch (e) {
      console.warn('failed to load orders', e);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const goToService = (key: string) => {
    router.push({ pathname: '/order/create', params: { service: key } });
  };

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.gold}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.greeting}>{t.welcome} 👋</Text>
            <Text style={styles.userName} testID="home-user-name">
              {user?.name || 'مستخدم'}
            </Text>
          </View>
          <View style={styles.logoChip}>
            <Image source={{ uri: LOGO_URL }} style={styles.logoImg} resizeMode="contain" />
          </View>
        </View>

        {/* Hero CTA */}
        <Pressable
          testID="quick-order-cta"
          onPress={() => goToService('furniture')}
          style={styles.heroCard}
        >
          <View style={styles.heroLeft}>
            <Text style={styles.heroEyebrow}>اطلب الآن</Text>
            <Text style={styles.heroTitle}>أين تريد أن ننقل لك اليوم؟</Text>
            <View style={styles.heroBtn}>
              <Text style={styles.heroBtnText}>ابدأ طلبك</Text>
              <Ionicons name="arrow-back" size={16} color={colors.textOnBrand} />
            </View>
          </View>
          <View style={styles.heroIcon}>
            <Ionicons name="navigate" size={42} color={colors.gold} />
          </View>
        </Pressable>

        {/* Services */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{t.chooseService}</Text>
        </View>

        <View style={styles.grid}>
          {SERVICES.map((s) => (
            <Pressable
              key={s.key}
              testID={`service-${s.key}`}
              onPress={() => goToService(s.key)}
              style={({ pressed }) => [
                styles.serviceCard,
                pressed && { transform: [{ scale: 0.97 }] },
              ]}
            >
              <View
                style={[
                  styles.serviceIconWrap,
                  s.key === 'furniture' || s.key === 'special'
                    ? styles.serviceIconGold
                    : styles.serviceIconBrown,
                ]}
              >
                <Ionicons
                  name={s.icon}
                  size={28}
                  color={
                    s.key === 'furniture' || s.key === 'special'
                      ? colors.textOnBrand
                      : colors.gold
                  }
                />
              </View>
              <Text style={styles.serviceTitle}>{t[s.titleKey]}</Text>
              <Text style={styles.serviceDesc}>{t[s.descKey]}</Text>
            </Pressable>
          ))}
        </View>

        {/* Recent orders */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{t.recentOrders}</Text>
          {orders.length > 0 && (
            <Pressable onPress={() => router.push('/(tabs)/orders')} hitSlop={10}>
              <Text style={styles.seeAll}>{t.seeAll}</Text>
            </Pressable>
          )}
        </View>

        {orders.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="receipt-outline" size={48} color={colors.textDisabled} />
            <Text style={styles.emptyText}>{t.noOrdersYet}</Text>
          </View>
        ) : (
          <View style={{ gap: spacing.sm }}>
            {orders.slice(0, 3).map((o) => (
              <Pressable
                key={o.id}
                testID={`order-card-${o.id}`}
                onPress={() => router.push(`/order/${o.id}`)}
                style={styles.orderCard}
              >
                <View style={styles.orderTop}>
                  <Text style={styles.orderNumber}>#{o.order_number}</Text>
                  <StatusBadge status={o.status} label={STATUS_LABEL[o.status] || o.status} />
                </View>
                <View style={styles.orderRow}>
                  <Ionicons name="location" size={14} color={colors.gold} />
                  <Text style={styles.orderAddr} numberOfLines={1}>
                    {o.pickup?.address || 'موقع الانطلاق'}
                  </Text>
                </View>
                <View style={styles.orderRow}>
                  <Ionicons name="flag" size={14} color={colors.error} />
                  <Text style={styles.orderAddr} numberOfLines={1}>
                    {o.dropoff?.address || 'موقع الوصول'}
                  </Text>
                </View>
                <View style={styles.orderFoot}>
                  <Text style={styles.orderPrice}>{formatIQD(o.final_price)}</Text>
                  <Text style={styles.orderDistance}>
                    {o.distance_km?.toFixed(1)} كم
                  </Text>
                </View>
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.appBg },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.lg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: { gap: 2 },
  greeting: { color: colors.textSecondary, fontSize: 14 },
  userName: { color: colors.textPrimary, fontSize: 22, fontWeight: '700' },
  logoChip: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.surface1,
    borderWidth: 1,
    borderColor: colors.darkBrown,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoImg: { width: 42, height: 42 },
  heroCard: {
    flexDirection: 'row',
    backgroundColor: colors.surface1,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.darkBrown,
    overflow: 'hidden',
    ...shadows.card,
  },
  heroLeft: { flex: 1, gap: spacing.sm },
  heroEyebrow: { color: colors.gold, fontSize: 12, fontWeight: '700', letterSpacing: 1 },
  heroTitle: { color: colors.textPrimary, fontSize: 18, fontWeight: '700', lineHeight: 26 },
  heroBtn: {
    marginTop: spacing.sm,
    backgroundColor: colors.gold,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  heroBtnText: { color: colors.textOnBrand, fontWeight: '700', fontSize: 13 },
  heroIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(212,164,55,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: { color: colors.textPrimary, fontSize: 18, fontWeight: '700' },
  seeAll: { color: colors.gold, fontSize: 13, fontWeight: '600' },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  serviceCard: {
    width: '47%',
    flexGrow: 1,
    backgroundColor: colors.surface1,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.darkBrown,
    gap: spacing.sm,
    ...shadows.card,
  },
  serviceIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  serviceIconGold: { backgroundColor: colors.gold },
  serviceIconBrown: { backgroundColor: colors.surface3, borderWidth: 1, borderColor: colors.gold },
  serviceTitle: { color: colors.textPrimary, fontSize: 15, fontWeight: '700' },
  serviceDesc: { color: colors.textSecondary, fontSize: 12 },
  empty: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    gap: spacing.sm,
  },
  emptyText: { color: colors.textDisabled, fontSize: 14 },
  orderCard: {
    backgroundColor: colors.surface1,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.darkBrown,
    gap: spacing.sm,
  },
  orderTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  orderNumber: { color: colors.gold, fontWeight: '700', fontSize: 13 },
  orderRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  orderAddr: { color: colors.textSecondary, fontSize: 13, flex: 1 },
  orderFoot: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.darkBrown,
  },
  orderPrice: { color: colors.textPrimary, fontWeight: '700', fontSize: 16 },
  orderDistance: { color: colors.textSecondary, fontSize: 12 },
});
