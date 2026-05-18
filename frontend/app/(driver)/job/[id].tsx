/**
 * Driver active job — map + status progression + customer contact
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, shadows } from '@/src/theme';
import { Button } from '@/src/components/ui';
import MapPicker from '@/src/components/MapPicker';
import { getOrder, driverUpdateOrderStatus } from '@/src/api/client';
import { formatIQD, formatKm, formatMinutes } from '@/src/utils/format';

const NEXT_LABEL: Record<string, { label: string; next: any }> = {
  accepted: { label: 'متجه إلى الزبون', next: 'arriving' },
  arriving: { label: 'تم استلام الحمولة', next: 'picked_up' },
  picked_up: { label: 'في الطريق إلى الوجهة', next: 'in_transit' },
  in_transit: { label: 'اكتمال التوصيل', next: 'completed' },
};

const STATUS_TITLE: Record<string, string> = {
  accepted: 'توجه إلى موقع الاستلام',
  arriving: 'استلم الحمولة من الزبون',
  picked_up: 'انطلق إلى الوجهة',
  in_transit: 'أوصل الحمولة',
  completed: 'الرحلة مكتملة',
};

export default function DriverJob() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [order, setOrder] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  const load = useCallback(async () => {
    try {
      const o = await getOrder(id as string);
      setOrder(o);
    } catch (e) {
      console.warn(e);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const openNavigation = () => {
    if (!order) return;
    const target =
      order.status === 'accepted' || order.status === 'arriving'
        ? order.pickup
        : order.dropoff;
    if (!target) return;
    const url =
      Platform.OS === 'ios'
        ? `https://maps.apple.com/?daddr=${target.latitude},${target.longitude}`
        : `https://www.google.com/maps/dir/?api=1&destination=${target.latitude},${target.longitude}&travelmode=driving`;
    Linking.openURL(url).catch(() => {
      Alert.alert('خطأ', 'تعذر فتح تطبيق الخرائط');
    });
  };

  const callCustomer = () => {
    if (!order?.customer_phone) return;
    Linking.openURL(`tel:${order.customer_phone}`).catch(() => {});
  };

  const advance = async () => {
    if (!order) return;
    const next = NEXT_LABEL[order.status]?.next;
    if (!next) return;
    if (next === 'completed') {
      const confirmed =
        Platform.OS === 'web'
          ? typeof window !== 'undefined' && window.confirm('تأكيد إكمال التوصيل؟')
          : await new Promise<boolean>((resolve) =>
              Alert.alert('إكمال التوصيل', 'هل أوصلت الحمولة بنجاح؟', [
                { text: 'إلغاء', style: 'cancel', onPress: () => resolve(false) },
                { text: 'نعم', onPress: () => resolve(true) },
              ])
            );
      if (!confirmed) return;
    }
    setUpdating(true);
    try {
      const updated = await driverUpdateOrderStatus(id as string, next);
      setOrder(updated);
      if (next === 'completed') {
        setTimeout(() => router.replace('/(driver)'), 1500);
      }
    } catch (e: any) {
      Alert.alert('خطأ', e?.response?.data?.detail || 'فشل تحديث الحالة');
    } finally {
      setUpdating(false);
    }
  };

  if (loading || !order) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator color={colors.gold} size="large" />
      </View>
    );
  }

  const isDone = order.status === 'completed';
  const nextInfo = NEXT_LABEL[order.status];

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.replace('/(driver)')} style={styles.iconBtn} testID="job-back-btn" hitSlop={20}>
          <Ionicons name="chevron-forward" size={24} color={colors.textPrimary} />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>الرحلة النشطة</Text>
          <Text style={styles.headerSub}>#{order.order_number}</Text>
        </View>
        <View style={{ width: 44 }} />
      </View>

      <View style={styles.mapWrap}>
        <MapPicker
          interactive={false}
          pickup={order.pickup ? { latitude: order.pickup.latitude, longitude: order.pickup.longitude } : null}
          dropoff={order.dropoff ? { latitude: order.dropoff.latitude, longitude: order.dropoff.longitude } : null}
          initialCenter={
            order.pickup ? { latitude: order.pickup.latitude, longitude: order.pickup.longitude } : undefined
          }
        />
        <Pressable onPress={openNavigation} style={styles.navBtn} testID="open-nav-btn">
          <Ionicons name="navigate" size={20} color={colors.appBg} />
          <Text style={styles.navBtnText}>فتح الملاحة</Text>
        </Pressable>
      </View>

      <ScrollView style={styles.sheet} contentContainerStyle={styles.sheetContent}>
        <Text style={styles.statusTitle}>{STATUS_TITLE[order.status]}</Text>

        {/* Customer card */}
        <View style={styles.customerCard}>
          <View style={styles.customerAvatar}>
            <Text style={styles.customerInitial}>
              {(order.customer_name || 'C').charAt(0)}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.customerName}>{order.customer_name || 'زبون'}</Text>
            <Text style={styles.customerPhone}>{order.customer_phone}</Text>
          </View>
          <Pressable style={styles.iconCircle} onPress={callCustomer} testID="call-customer-btn">
            <Ionicons name="call" size={20} color={colors.gold} />
          </Pressable>
        </View>

        {/* Route */}
        <View style={styles.routeCard}>
          <View style={styles.routeRow}>
            <View style={[styles.routeDot, { backgroundColor: colors.gold }]} />
            <View style={{ flex: 1 }}>
              <Text style={styles.routeLabel}>استلام</Text>
              <Text style={styles.routeText} numberOfLines={2}>{order.pickup?.address}</Text>
            </View>
          </View>
          <View style={styles.routeDivider} />
          <View style={styles.routeRow}>
            <View style={[styles.routeDot, { backgroundColor: colors.error }]} />
            <View style={{ flex: 1 }}>
              <Text style={styles.routeLabel}>توصيل</Text>
              <Text style={styles.routeText} numberOfLines={2}>{order.dropoff?.address}</Text>
            </View>
          </View>
        </View>

        {/* Cargo + Stats */}
        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Ionicons name="speedometer" size={14} color={colors.gold} />
            <Text style={styles.statText}>{formatKm(order.distance_km)}</Text>
          </View>
          <View style={styles.stat}>
            <Ionicons name="time" size={14} color={colors.gold} />
            <Text style={styles.statText}>{formatMinutes(order.eta_minutes)}</Text>
          </View>
          <View style={styles.stat}>
            <Ionicons name="cash" size={14} color={colors.gold} />
            <Text style={styles.statText}>{formatIQD(order.final_price)}</Text>
          </View>
        </View>

        {order.cargo_description ? (
          <View style={styles.cargoBox}>
            <Text style={styles.cargoLabel}>وصف الحمولة</Text>
            <Text style={styles.cargoText}>{order.cargo_description}</Text>
            {order.cargo_notes ? (
              <Text style={[styles.cargoText, { color: colors.textSecondary, marginTop: 4 }]}>
                {order.cargo_notes}
              </Text>
            ) : null}
          </View>
        ) : null}

        {/* Next-status action */}
        {isDone ? (
          <View style={styles.doneBox}>
            <Ionicons name="checkmark-circle" size={48} color={colors.success} />
            <Text style={styles.doneTitle}>تم التوصيل بنجاح</Text>
            <Text style={styles.doneSub}>
              تم إضافة {formatIQD(order.final_price)} إلى أرباحك
            </Text>
          </View>
        ) : nextInfo ? (
          <Button
            testID="advance-status-btn"
            label={nextInfo.label}
            onPress={advance}
            loading={updating}
            style={{ minHeight: 56 }}
          />
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.appBg },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.appBg },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    borderBottomWidth: 1, borderBottomColor: colors.darkBrown,
  },
  iconBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: colors.surface1,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: colors.darkBrown,
  },
  iconCircle: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: colors.surface2,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: colors.gold,
  },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: { color: colors.textPrimary, fontWeight: '700', fontSize: 16 },
  headerSub: { color: colors.gold, fontSize: 12, marginTop: 2 },
  mapWrap: { height: '38%', position: 'relative' },
  navBtn: {
    position: 'absolute', bottom: spacing.md, left: spacing.md,
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: colors.gold,
    paddingHorizontal: spacing.md, paddingVertical: 10,
    borderRadius: radius.pill,
    ...shadows.button,
  },
  navBtnText: { color: colors.appBg, fontWeight: '700', fontSize: 13 },
  sheet: { flex: 1, backgroundColor: colors.surface1, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, marginTop: -spacing.lg, borderTopWidth: 1, borderColor: colors.darkBrown },
  sheetContent: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },
  statusTitle: { color: colors.textPrimary, fontSize: 18, fontWeight: '700' },
  customerCard: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.surface2,
    borderRadius: radius.md, padding: spacing.md,
    borderWidth: 1, borderColor: colors.darkBrown,
  },
  customerAvatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.gold, alignItems: 'center', justifyContent: 'center' },
  customerInitial: { color: colors.appBg, fontWeight: '700', fontSize: 20 },
  customerName: { color: colors.textPrimary, fontWeight: '700', fontSize: 15 },
  customerPhone: { color: colors.textSecondary, fontSize: 12, marginTop: 2 },
  routeCard: { backgroundColor: colors.surface2, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.darkBrown, gap: spacing.sm },
  routeRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  routeDot: { width: 10, height: 10, borderRadius: 5, marginTop: 6 },
  routeLabel: { color: colors.textSecondary, fontSize: 11 },
  routeText: { color: colors.textPrimary, fontSize: 14, marginTop: 2 },
  routeDivider: { height: 1, backgroundColor: colors.darkBrown },
  statsRow: { flexDirection: 'row', gap: spacing.sm },
  stat: { flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 4, backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.darkBrown, borderRadius: radius.sm, paddingVertical: 8 },
  statText: { color: colors.textPrimary, fontWeight: '700', fontSize: 13 },
  cargoBox: { backgroundColor: colors.surface2, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.darkBrown },
  cargoLabel: { color: colors.textSecondary, fontSize: 12, marginBottom: 2 },
  cargoText: { color: colors.textPrimary, fontSize: 14 },
  doneBox: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.lg, backgroundColor: 'rgba(52,199,89,0.08)', borderRadius: radius.md, borderWidth: 1, borderColor: 'rgba(52,199,89,0.3)' },
  doneTitle: { color: colors.textPrimary, fontWeight: '700', fontSize: 18 },
  doneSub: { color: colors.gold, fontSize: 14, fontWeight: '600' },
});
