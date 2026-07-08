/**
 * Home tab - Dashboard (balance + stats + current shipment + services)
 */
import React, { useCallback, useMemo, useState } from 'react';
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

// TODO(wallet): استبدل هذا الرقم برصيد حقيقي بعد إضافة endpoint للمحفظة
// في الباك اند (مثال: GET /wallet/balance) وربط زين كاش / ماستر كارد كطرق شحن.
const WALLET_BALANCE_PLACEHOLDER = 0;

// TODO(rating): لا يوجد حقل تقييم في بيانات المستخدم حالياً. لما تضيف حقل
// rating في جدول المستخدم بالباك اند، استبدل هذا الرقم بـ user.rating.
const RATING_PLACEHOLDER = 5.0;

const ACTIVE_STATUSES = ['pending', 'accepted', 'arriving', 'picked_up', 'in_transit'];

const STATUS_LABEL: Record<string, string> = {
  pending: 'قيد الانتظار',
  accepted: 'تم القبول',
  arriving: 'قادم',
  picked_up: 'تم الاستلام',
  in_transit: 'في الطريق',
  completed: 'مكتمل',
  cancelled: 'ملغى',
};

const QUICK_SERVICES = [
  { key: 'storage', label: 'تخزين مؤقت', icon: 'home-outline' as const },
  { key: 'international', label: 'شحن دولي', icon: 'globe-outline' as const },
  { key: 'cold', label: 'نقل مبرد', icon: 'snow-outline' as const },
  { key: 'express', label: 'نقل سريع', icon: 'flash-outline' as const },
  { key: 'furniture', label: 'نقل أثاث', icon: 'bed-outline' as const },
];

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

  // بيانات حقيقية مبنية على الطلبات الفعلية من الـ API
  const completedCount = useMemo(
    () => orders.filter((o) => o.status === 'completed').length,
    [orders]
  );
  const activeCount = useMemo(
    () => orders.filter((o) => ACTIVE_STATUSES.includes(o.status)).length,
    [orders]
  );
  const currentShipment = useMemo(
    () => orders.find((o) => ACTIVE_STATUSES.includes(o.status)) || null,
    [orders]
  );

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
        {/* Logo */}
        <View style={styles.brandRow}>
          <View style={styles.logoChip}>
            <Image source={{ uri: LOGO_URL }} style={styles.logoImg} resizeMode="contain" />
          </View>
          <Text style={styles.brandName}>{t.appName}</Text>
        </View>

        {/* Welcome + Balance */}
        <View style={styles.welcomeRow}>
          <View style={styles.welcomeCard}>
            <View style={styles.avatarCircle}>
              <Ionicons name="person" size={24} color={colors.gold} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.welcomeTitle}>
                مرحباً {user?.name ? `${user.name}` : ''}
              </Text>
              <Text style={styles.welcomeSubtitle}>كيف يمكننا خدمتك اليوم؟</Text>
            </View>
          </View>
          <View style={styles.balanceCard}>
            <View style={{ flex: 1 }}>
              <Text style={styles.balanceLabel}>الرصيد الحالي</Text>
              <Text style={styles.balanceValue}>{formatIQD(WALLET_BALANCE_PLACEHOLDER)}</Text>
            </View>
            <View style={styles.walletIconWrap}>
              <Ionicons name="wallet" size={22} color={colors.gold} />
            </View>
          </View>
        </View>

        {/* CTA cards */}
        <View style={styles.ctaRow}>
          <Pressable
            testID="quick-order-cta"
            onPress={() => goToService('furniture')}
            style={styles.ctaPrimary}
          >
            <Text style={styles.ctaPrimaryTitle}>طلب نقل جديد</Text>
            <Text style={styles.ctaPrimarySubtitle}>أنشئ طلب توصيل الآن</Text>
            <View style={styles.ctaPrimaryIcon}>
              <Ionicons name="cube" size={26} color={colors.textOnBrand} />
            </View>
            <View style={styles.ctaBtn}>
              <Ionicons name="add" size={16} color={colors.textOnBrand} />
              <Text style={styles.ctaBtnText}>إنشاء طلب</Text>
            </View>
          </Pressable>

          <Pressable
            testID="track-shipment-cta"
            onPress={() => router.push('/(tabs)/orders')}
            style={styles.ctaSecondary}
          >
            <Text style={styles.ctaSecondaryTitle}>تتبع الشحنة</Text>
            <Text style={styles.ctaSecondarySubtitle}>تتبع شحنتك لحظة بلحظة</Text>
            <View style={styles.ctaSecondaryIcon}>
              <Ionicons name="location" size={22} color={colors.gold} />
            </View>
            <View style={styles.ctaBtnOutline}>
              <Ionicons name="locate" size={14} color={colors.gold} />
              <Text style={styles.ctaBtnOutlineText}>تتبع الأن</Text>
            </View>
          </Pressable>
        </View>

        {/* Stats row */}
        <View style={styles.statsRow}>
          <View style={styles.statCol}>
            <Ionicons name="shield-checkmark" size={20} color={colors.gold} />
            <Text style={styles.statValue}>{RATING_PLACEHOLDER.toFixed(1)}</Text>
            <Text style={styles.statLabel}>تقييمك</Text>
            <Text style={styles.statStars}>★★★★★</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statCol}>
            <Ionicons name="cube" size={20} color={colors.gold} />
            <Text style={styles.statValue}>{completedCount}</Text>
            <Text style={styles.statLabel}>طلبات مكتملة{'\n'}هذا الشهر</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statCol}>
            <Ionicons name="time" size={20} color={colors.gold} />
            <Text style={styles.statValue}>{activeCount}</Text>
            <Text style={styles.statLabel}>طلبات جارية{'\n'}الآن</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statCol}>
            <Ionicons name="wallet" size={20} color={colors.gold} />
            <Text style={styles.statValue}>{WALLET_BALANCE_PLACEHOLDER}</Text>
            <Text style={styles.statLabel}>الرصيد الحالي{'\n'}{t.currency}</Text>
          </View>
        </View>

        {/* Current shipment */}
        <View style={styles.sectionHeader}>
          <Pressable onPress={() => router.push('/(tabs)/orders')} hitSlop={10}>
            <Text style={styles.seeAll}>عرض الكل</Text>
          </Pressable>
          <Text style={styles.sectionTitle}>شحنة جارية</Text>
        </View>

        {currentShipment ? (
          <View style={styles.shipmentCard}>
            <View style={styles.routeRow}>
              <View style={styles.routePoint}>
                <View style={styles.routeDot}>
                  <Ionicons name="location" size={16} color={colors.gold} />
                </View>
                <Text style={styles.routeLabel} numberOfLines={1}>
                  {currentShipment.pickup?.address || 'نقطة الانطلاق'}
                </Text>
                <Text style={styles.routeSubLabel}>نقطة الانطلاق</Text>
              </View>
              <View style={styles.routeLine}>
                <View style={styles.routeTruck}>
                  <Ionicons name="flash" size={16} color={colors.textOnBrand} />
                </View>
              </View>
              <View style={styles.routePoint}>
                <View style={styles.routeDot}>
                  <Ionicons name="flag" size={16} color={colors.gold} />
                </View>
                <Text style={styles.routeLabel} numberOfLines={1}>
                  {currentShipment.dropoff?.address || 'نقطة الوصول'}
                </Text>
                <Text style={styles.routeSubLabel}>نقطة الوصول</Text>
              </View>
            </View>

            <View style={styles.shipmentInfoRow}>
              <View style={styles.shipmentInfoCol}>
                <Text style={styles.shipmentInfoLabel}>الحالة</Text>
                <StatusBadge
                  status={currentShipment.status}
                  label={STATUS_LABEL[currentShipment.status] || currentShipment.status}
                />
              </View>
              <View style={styles.shipmentInfoCol}>
                <Text style={styles.shipmentInfoLabel}>نوع الخدمة</Text>
                <Text style={styles.shipmentInfoValue}>
                  {currentShipment.service_type || 'نقل بضائع'}
                </Text>
              </View>
              <View style={styles.shipmentInfoCol}>
                <Text style={styles.shipmentInfoLabel}>رقم الطلب</Text>
                <Text style={styles.shipmentInfoValue}>#{currentShipment.order_number}</Text>
              </View>
            </View>
          </View>
        ) : (
          <View style={styles.empty}>
            <Ionicons name="receipt-outline" size={40} color={colors.textDisabled} />
            <Text style={styles.emptyText}>{t.noOrdersYet}</Text>
          </View>
        )}

        {/* Services */}
        <Text style={styles.sectionTitleLeft}>خدماتنا</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.servicesRow}
        >
          {QUICK_SERVICES.map((s) => (
            <Pressable
              key={s.key}
              testID={`service-${s.key}`}
              onPress={() => goToService(s.key)}
              style={({ pressed }) => [
                styles.serviceItem,
                pressed && { transform: [{ scale: 0.96 }] },
              ]}
            >
              <View style={styles.serviceIconCircle}>
                <Ionicons name={s.icon} size={24} color={colors.gold} />
              </View>
              <Text style={styles.serviceItemLabel}>{s.label}</Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* Promo banner */}
        <View style={styles.promoBanner}>
          <View style={styles.promoIconWrap}>
            <Ionicons name="gift" size={32} color={colors.gold} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.promoTitle}>وفر أكثر مع باقاتنا</Text>
            <Text style={styles.promoSubtitle}>شحنات أكثر، أسعار أقل</Text>
            <View style={styles.promoBtn}>
              <Ionicons name="arrow-back" size={14} color={colors.textOnBrand} />
              <Text style={styles.promoBtnText}>عرض الباقات</Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.appBg },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.lg },

  brandRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  logoChip: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.textPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoImg: { width: 30, height: 30 },
  brandName: { color: colors.textPrimary, fontSize: 18, fontWeight: '700' },

  welcomeRow: { gap: spacing.md },
  welcomeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface1,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.darkBrown,
  },
  avatarCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.surface2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  welcomeTitle: { color: colors.textPrimary, fontSize: 17, fontWeight: '700' },
  welcomeSubtitle: { color: colors.textSecondary, fontSize: 13, marginTop: 2 },

  balanceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface1,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.darkBrown,
  },
  balanceLabel: { color: colors.textSecondary, fontSize: 12 },
  balanceValue: { color: colors.gold, fontSize: 18, fontWeight: '700', marginTop: 2 },
  walletIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(212,164,55,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  ctaRow: { flexDirection: 'row', gap: spacing.md },
  ctaPrimary: {
    flex: 1,
    backgroundColor: colors.gold,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: 4,
    ...shadows.button,
  },
  ctaPrimaryTitle: { color: colors.textOnBrand, fontSize: 15, fontWeight: '700' },
  ctaPrimarySubtitle: { color: colors.textOnBrand, fontSize: 11, opacity: 0.8 },
  ctaPrimaryIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(13,9,7,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: spacing.sm,
  },
  ctaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.textOnBrand,
    opacity: 0.9,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radius.pill,
    alignSelf: 'flex-start',
  },
  ctaBtnText: { color: colors.gold, fontSize: 12, fontWeight: '700' },

  ctaSecondary: {
    flex: 1,
    backgroundColor: colors.surface1,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: 4,
    borderWidth: 1,
    borderColor: colors.darkBrown,
  },
  ctaSecondaryTitle: { color: colors.textPrimary, fontSize: 15, fontWeight: '700' },
  ctaSecondarySubtitle: { color: colors.textSecondary, fontSize: 11 },
  ctaSecondaryIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: colors.surface3,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: spacing.sm,
  },
  ctaBtnOutline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: colors.gold,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radius.pill,
    alignSelf: 'flex-start',
  },
  ctaBtnOutlineText: { color: colors.gold, fontSize: 12, fontWeight: '700' },

  statsRow: {
    flexDirection: 'row',
    backgroundColor: colors.surface1,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.darkBrown,
  },
  statCol: { flex: 1, alignItems: 'center', gap: 4 },
  statDivider: { width: 1, backgroundColor: colors.darkBrown, marginHorizontal: 4 },
  statValue: { color: colors.gold, fontSize: 18, fontWeight: '700' },
  statLabel: { color: colors.textSecondary, fontSize: 11, textAlign: 'center' },
  statStars: { color: colors.gold, fontSize: 10 },

  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: { color: colors.textPrimary, fontSize: 17, fontWeight: '700' },
  sectionTitleLeft: { color: colors.textPrimary, fontSize: 17, fontWeight: '700' },
  seeAll: { color: colors.gold, fontSize: 13, fontWeight: '600' },

  shipmentCard: {
    backgroundColor: colors.surface1,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.darkBrown,
    gap: spacing.md,
  },
  routeRow: { flexDirection: 'row', alignItems: 'center' },
  routePoint: { flex: 1, alignItems: 'center', gap: 4 },
  routeDot: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(212,164,55,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  routeLabel: { color: colors.textPrimary, fontSize: 12, fontWeight: '600' },
  routeSubLabel: { color: colors.textSecondary, fontSize: 10 },
  routeLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.gold,
    marginTop: -20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  routeTruck: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shipmentInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.darkBrown,
  },
  shipmentInfoCol: { alignItems: 'center', gap: 4 },
  shipmentInfoLabel: { color: colors.textSecondary, fontSize: 11 },
  shipmentInfoValue: { color: colors.textPrimary, fontSize: 13, fontWeight: '600' },

  empty: { alignItems: 'center', paddingVertical: spacing.xl, gap: spacing.sm },
  emptyText: { color: colors.textDisabled, fontSize: 14 },

  servicesRow: { flexDirection: 'row', gap: spacing.lg, paddingVertical: spacing.xs },
  serviceItem: { alignItems: 'center', gap: spacing.xs, width: 72 },
  serviceIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: colors.surface1,
    borderWidth: 1,
    borderColor: colors.darkBrown,
    alignItems: 'center',
    justifyContent: 'center',
  },
  serviceItemLabel: { color: colors.textSecondary, fontSize: 11, textAlign: 'center' },

  promoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface1,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.darkBrown,
  },
  promoIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 16,
    backgroundColor: colors.surface3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  promoTitle: { color: colors.textPrimary, fontSize: 15, fontWeight: '700' },
  promoSubtitle: { color: colors.textSecondary, fontSize: 12, marginTop: 2, marginBottom: spacing.sm },
  promoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.gold,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
    alignSelf: 'flex-start',
  },
  promoBtnText: { color: colors.textOnBrand, fontSize: 12, fontWeight: '700' },
});
