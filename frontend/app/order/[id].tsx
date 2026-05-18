/**
 * Order Tracking Screen
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography, radius, shadows } from '@/src/theme';
import { translations } from '@/src/i18n';
import { Button, StatusBadge } from '@/src/components/ui';
import MapPicker from '@/src/components/MapPicker';
import {
  getOrder,
  cancelOrder,
  simulateAccept,
  simulateProgress,
} from '@/src/api/client';
import { formatIQD, formatKm, formatMinutes } from '@/src/utils/format';

const STATUS_FLOW = ['pending', 'accepted', 'arriving', 'picked_up', 'in_transit', 'completed'];

const STATUS_LABEL: Record<string, string> = {
  pending_review: 'بانتظار موافقة الإدارة على السعر',
  pending: 'البحث عن سائق...',
  accepted: 'تم قبول الطلب',
  arriving: 'السائق قادم إليك',
  picked_up: 'تم استلام الحمولة',
  in_transit: 'الحمولة في الطريق',
  completed: 'تم التوصيل',
  cancelled: 'تم الإلغاء',
};

const STATUS_SHORT: Record<string, string> = {
  pending_review: 'مراجعة الإدارة',
  pending: 'قيد الانتظار',
  accepted: 'مقبول',
  arriving: 'قادم',
  picked_up: 'تم الاستلام',
  in_transit: 'في الطريق',
  completed: 'مكتمل',
  cancelled: 'ملغى',
};

export default function OrderTrack() {
  const t = translations.ar;
  const { id } = useLocalSearchParams<{ id: string }>();
  const [order, setOrder] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

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

  // Poll for status updates. Also auto-simulate driver acceptance after 4s (demo)
  useEffect(() => {
    if (!order) return;
    if (pollRef.current) clearInterval(pollRef.current);

    // For pending_review: poll every 5s waiting for admin to set price.
    if (order.status === 'pending_review') {
      pollRef.current = setInterval(async () => {
        try {
          const updated = await getOrder(id as string);
          if (updated && updated.status !== 'pending_review') {
            setOrder(updated);
          }
        } catch {}
      }, 5000);
    } else if (order.status === 'pending') {
      // Auto-simulate driver acceptance after 4 seconds (demo)
      pollRef.current = setInterval(async () => {
        try {
          const updated = await simulateAccept(id as string);
          if (updated && updated.status !== 'pending') {
            setOrder(updated);
          }
        } catch {}
      }, 4000);
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [order, id]);

  const handleSimulateProgress = async () => {
    try {
      const updated = await simulateProgress(id as string);
      setOrder(updated);
    } catch (e: any) {
      Alert.alert('خطأ', e?.response?.data?.detail || 'فشل تحديث الحالة');
    }
  };

  const handleCancel = () => {
    Alert.alert('إلغاء الطلب', 'هل أنت متأكد من إلغاء هذا الطلب؟', [
      { text: 'تراجع', style: 'cancel' },
      {
        text: 'إلغاء الطلب',
        style: 'destructive',
        onPress: async () => {
          try {
            await cancelOrder(id as string);
            await load();
          } catch (e: any) {
            Alert.alert('خطأ', e?.response?.data?.detail || 'فشل الإلغاء');
          }
        },
      },
    ]);
  };

  if (loading || !order) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator color={colors.gold} size="large" />
      </View>
    );
  }

  const stepIndex = STATUS_FLOW.indexOf(order.status);
  const isActive = !['completed', 'cancelled'].includes(order.status);
  const isPendingReview = order.status === 'pending_review';
  const canCancel = ['pending_review', 'pending', 'accepted'].includes(order.status);

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          onPress={() => router.replace('/(tabs)')}
          style={styles.iconBtn}
          testID="track-back-btn"
          hitSlop={20}
        >
          <Ionicons name="chevron-forward" size={24} color={colors.textPrimary} />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>تتبع الطلب</Text>
          <Text style={styles.headerSub}>#{order.order_number}</Text>
        </View>
        <View style={{ width: 44 }} />
      </View>

      {/* Map */}
      <View style={styles.mapWrap}>
        <MapPicker
          interactive={false}
          pickup={order.pickup ? { latitude: order.pickup.latitude, longitude: order.pickup.longitude } : null}
          dropoff={order.dropoff ? { latitude: order.dropoff.latitude, longitude: order.dropoff.longitude } : null}
          driverLocation={order.driver_location || null}
          initialCenter={
            order.pickup
              ? { latitude: order.pickup.latitude, longitude: order.pickup.longitude }
              : undefined
          }
        />
      </View>

      {/* Status sheet */}
      <ScrollView style={styles.sheet} contentContainerStyle={styles.sheetContent}>
        {/* Status header */}
        <View style={styles.statusHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.statusTitle}>{STATUS_LABEL[order.status]}</Text>
            {isActive && (
              <Text style={styles.statusSub}>
                {isPendingReview
                  ? 'تم إرسال طلبك إلى الإدارة لمراجعة السعر يدوياً. سيتم تحديثك فور التسعير.'
                  : order.status === 'pending'
                  ? 'جار البحث عن أفضل سائق متاح...'
                  : `الوصول المتوقع خلال ${formatMinutes(order.eta_minutes)}`}
              </Text>
            )}
          </View>
          <StatusBadge status={order.status} label={STATUS_SHORT[order.status] || order.status} />
        </View>

        {isPendingReview && (
          <View style={styles.manualReviewBox} testID="pending-review-banner">
            <Ionicons name="hourglass-outline" size={32} color={colors.warning} />
            <Text style={styles.manualReviewTitle}>تسعير يدوي قيد المراجعة</Text>
            <Text style={styles.manualReviewText}>
              مسافة هذا الطلب أكبر من 130 كم، لذا يقوم فريق الإدارة بمراجعة التفاصيل وتحديد
              السعر النهائي.
            </Text>
            <Text style={styles.manualReviewDistance}>{formatKm(order.distance_km)}</Text>
          </View>
        )}

        {/* Stepper */}
        <View style={styles.stepper}>
          {['pending', 'accepted', 'picked_up', 'completed'].map((s, i) => {
            const done = stepIndex >= STATUS_FLOW.indexOf(s);
            return (
              <View key={s} style={styles.stepWrap}>
                <View style={[styles.stepDot, done && styles.stepDotDone]}>
                  {done && <Ionicons name="checkmark" size={12} color={colors.textOnBrand} />}
                </View>
                {i < 3 && <View style={[styles.stepLine, done && styles.stepLineDone]} />}
              </View>
            );
          })}
        </View>
        <View style={styles.stepperLabels}>
          <Text style={styles.stepLabel}>طلب</Text>
          <Text style={styles.stepLabel}>قبول</Text>
          <Text style={styles.stepLabel}>استلام</Text>
          <Text style={styles.stepLabel}>توصيل</Text>
        </View>

        {/* Driver card */}
        {order.driver_id && order.status !== 'cancelled' && (
          <View style={styles.driverCard}>
            <View style={styles.driverAvatar}>
              <Text style={styles.driverInitial}>{(order.driver_name || 'D').charAt(0)}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.driverName}>{order.driver_name}</Text>
              <View style={styles.driverMeta}>
                <Ionicons name="star" size={12} color={colors.gold} />
                <Text style={styles.driverRating}>
                  {(order.driver_rating || 4.8).toFixed(1)}
                </Text>
                <Text style={styles.driverPlate}>• {order.driver_vehicle_plate}</Text>
              </View>
            </View>
            <Pressable style={styles.iconBtnSmall} testID="call-driver-btn">
              <Ionicons name="call" size={18} color={colors.gold} />
            </Pressable>
            <Pressable style={styles.iconBtnSmall} testID="chat-driver-btn">
              <Ionicons name="chatbubble" size={18} color={colors.gold} />
            </Pressable>
          </View>
        )}

        {/* Route info */}
        <View style={styles.routeCard}>
          <View style={styles.routeRow}>
            <View style={[styles.routeDot, { backgroundColor: colors.gold }]} />
            <View style={{ flex: 1 }}>
              <Text style={styles.routeLabel}>الانطلاق</Text>
              <Text style={styles.routeText} numberOfLines={2}>
                {order.pickup?.address}
              </Text>
            </View>
          </View>
          <View style={styles.routeDivider} />
          <View style={styles.routeRow}>
            <View style={[styles.routeDot, { backgroundColor: colors.error }]} />
            <View style={{ flex: 1 }}>
              <Text style={styles.routeLabel}>الوصول</Text>
              <Text style={styles.routeText} numberOfLines={2}>
                {order.dropoff?.address}
              </Text>
            </View>
          </View>
        </View>

        {/* Price summary */}
        <View style={styles.priceCard}>
          <View style={styles.priceRow}>
            <Text style={styles.priceLabel}>المسافة</Text>
            <Text style={styles.priceValue}>{formatKm(order.distance_km)}</Text>
          </View>
          <View style={styles.priceRow}>
            <Text style={styles.priceLabel}>طريقة الدفع</Text>
            <Text style={styles.priceValue}>نقداً عند التسليم</Text>
          </View>
          <View style={[styles.priceRow, styles.priceTotal]}>
            <Text style={styles.priceLabelTotal}>المجموع</Text>
            <Text style={styles.priceValueTotal}>
              {isPendingReview ? 'بانتظار التسعير' : formatIQD(order.final_price)}
            </Text>
          </View>
        </View>

        {/* Cargo */}
        {order.cargo_description && (
          <View style={styles.cargoCard}>
            <Text style={styles.label}>وصف الحمولة</Text>
            <Text style={styles.cargoText}>{order.cargo_description}</Text>
            {order.cargo_notes ? (
              <>
                <Text style={[styles.label, { marginTop: spacing.sm }]}>ملاحظات</Text>
                <Text style={styles.cargoText}>{order.cargo_notes}</Text>
              </>
            ) : null}
          </View>
        )}

        {/* Actions */}
        {canCancel && (
          <Pressable
            testID="cancel-order-btn"
            style={styles.cancelBtn}
            onPress={handleCancel}
          >
            <Ionicons name="close-circle" size={18} color={colors.error} />
            <Text style={styles.cancelText}>{t.cancelOrder}</Text>
          </Pressable>
        )}

        {/* Demo: advance status button */}
        {isActive && order.status !== 'pending' && (
          <Button
            testID="advance-status-btn"
            variant="secondary"
            label={
              order.status === 'completed'
                ? 'مكتمل'
                : `تقدم للحالة التالية (تجربة)`
            }
            onPress={handleSimulateProgress}
          />
        )}

        {order.status === 'completed' && (
          <View style={styles.completedBox}>
            <Ionicons name="checkmark-circle" size={48} color={colors.success} />
            <Text style={styles.completedTitle}>تم التوصيل بنجاح!</Text>
            <Text style={styles.completedSub}>شكراً لاستخدامك نقل قو</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.appBg },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.appBg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.darkBrown,
  },
  iconBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: colors.surface1,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: colors.darkBrown,
  },
  iconBtnSmall: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: colors.surface2,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: colors.gold,
  },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: { color: colors.textPrimary, fontWeight: '700', fontSize: 16 },
  headerSub: { color: colors.gold, fontSize: 12, marginTop: 2 },
  mapWrap: { height: '38%' },
  sheet: { flex: 1, backgroundColor: colors.surface1, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, marginTop: -spacing.lg, borderTopWidth: 1, borderColor: colors.darkBrown },
  sheetContent: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },
  statusHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  statusTitle: { color: colors.textPrimary, fontWeight: '700', fontSize: 18 },
  statusSub: { color: colors.textSecondary, fontSize: 13, marginTop: 2 },
  stepper: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.sm, marginTop: spacing.xs },
  stepWrap: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  stepDot: {
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: colors.surface2,
    borderWidth: 2, borderColor: colors.darkBrown,
    alignItems: 'center', justifyContent: 'center',
  },
  stepDotDone: { backgroundColor: colors.gold, borderColor: colors.gold },
  stepLine: { flex: 1, height: 2, backgroundColor: colors.darkBrown, marginHorizontal: 2 },
  stepLineDone: { backgroundColor: colors.gold },
  stepperLabels: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: spacing.sm },
  stepLabel: { color: colors.textSecondary, fontSize: 11, fontWeight: '600', width: 60, textAlign: 'center' },
  driverCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface2,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1, borderColor: colors.darkBrown,
  },
  driverAvatar: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: colors.gold,
    alignItems: 'center', justifyContent: 'center',
  },
  driverInitial: { color: colors.textOnBrand, fontWeight: '700', fontSize: 20 },
  driverName: { color: colors.textPrimary, fontWeight: '700', fontSize: 15 },
  driverMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  driverRating: { color: colors.textPrimary, fontWeight: '700', fontSize: 12 },
  driverPlate: { color: colors.textSecondary, fontSize: 12 },
  routeCard: { backgroundColor: colors.surface2, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.darkBrown, gap: spacing.sm },
  routeRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  routeDot: { width: 10, height: 10, borderRadius: 5, marginTop: 6 },
  routeLabel: { color: colors.textSecondary, fontSize: 11 },
  routeText: { color: colors.textPrimary, fontSize: 14, marginTop: 2 },
  routeDivider: { height: 1, backgroundColor: colors.darkBrown },
  priceCard: { backgroundColor: colors.surface2, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.darkBrown, gap: spacing.xs },
  priceRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.xs },
  priceLabel: { color: colors.textSecondary, fontSize: 13 },
  priceValue: { color: colors.textPrimary, fontSize: 13, fontWeight: '600' },
  priceTotal: { borderTopWidth: 1, borderTopColor: colors.darkBrown, marginTop: spacing.xs, paddingTop: spacing.sm },
  priceLabelTotal: { color: colors.textPrimary, fontWeight: '700', fontSize: 15 },
  priceValueTotal: { color: colors.gold, fontWeight: '700', fontSize: 20 },
  cargoCard: { backgroundColor: colors.surface2, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.darkBrown },
  label: { color: colors.textSecondary, fontSize: 12, fontWeight: '600' },
  cargoText: { color: colors.textPrimary, fontSize: 14, marginTop: 4 },
  cancelBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,69,58,0.1)',
    borderWidth: 1, borderColor: 'rgba(255,69,58,0.3)',
  },
  cancelText: { color: colors.error, fontWeight: '700' },
  completedBox: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.lg, backgroundColor: 'rgba(52,199,89,0.08)', borderRadius: radius.md, borderWidth: 1, borderColor: 'rgba(52,199,89,0.3)' },
  completedTitle: { color: colors.textPrimary, fontSize: 18, fontWeight: '700' },
  completedSub: { color: colors.textSecondary, fontSize: 13 },
  manualReviewBox: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
    backgroundColor: 'rgba(255,159,10,0.08)',
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.warning,
  },
  manualReviewTitle: { color: colors.warning, fontSize: 17, fontWeight: '700' },
  manualReviewText: {
    color: colors.textPrimary,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
  },
  manualReviewDistance: {
    color: colors.gold,
    fontSize: 20,
    fontWeight: '700',
    marginTop: spacing.xs,
  },
});
