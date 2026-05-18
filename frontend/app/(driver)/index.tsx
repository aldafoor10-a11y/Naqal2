/**
 * Driver Dashboard — online/offline toggle + incoming orders feed
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
  Pressable,
  RefreshControl,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { colors, spacing, radius, shadows } from '@/src/theme';
import { useAuth } from '@/src/context/AuthContext';
import {
  driverAvailableOrders,
  driverActiveOrders,
  driverSetStatus,
  driverUpdateLocation,
  driverAcceptOrder,
  driverRejectOrder,
} from '@/src/api/client';
import { formatIQD, formatKm, formatMinutes } from '@/src/utils/format';

const SERVICE_LABELS: Record<string, string> = {
  furniture: 'نقل أثاث',
  goods: 'بضائع',
  appliances: 'أجهزة',
  special: 'خاص',
};

export default function DriverHome() {
  const { user, refresh } = useAuth();
  const [isOnline, setIsOnline] = useState<boolean>(!!user?.is_online);
  const [available, setAvailable] = useState<any[]>([]);
  const [active, setActive] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [accepting, setAccepting] = useState<string | null>(null);
  const locWatch = useRef<any>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadOrders = useCallback(async () => {
    try {
      const [av, ac] = await Promise.all([driverAvailableOrders(), driverActiveOrders()]);
      setAvailable(av || []);
      setActive(ac || []);
    } catch (e) {
      console.warn(e);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadOrders();
    }, [loadOrders])
  );

  // Poll new orders every 6s while online
  useEffect(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    if (isOnline) {
      pollRef.current = setInterval(loadOrders, 6000);
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [isOnline, loadOrders]);

  // Watch location while online
  useEffect(() => {
    let mounted = true;
    const start = async () => {
      if (!isOnline) {
        if (locWatch.current) {
          locWatch.current.remove?.();
          locWatch.current = null;
        }
        return;
      }
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') return;
        locWatch.current = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.Balanced, distanceInterval: 50, timeInterval: 15000 },
          (pos) => {
            if (!mounted) return;
            driverUpdateLocation(pos.coords.latitude, pos.coords.longitude).catch(() => {});
          }
        );
      } catch (e) {
        console.warn('location watch failed', e);
      }
    };
    start();
    return () => {
      mounted = false;
      locWatch.current?.remove?.();
      locWatch.current = null;
    };
  }, [isOnline]);

  const handleToggleOnline = async (val: boolean) => {
    setIsOnline(val);
    try {
      await driverSetStatus(val);
      await refresh();
      if (val) loadOrders();
    } catch (e: any) {
      setIsOnline(!val);
      Alert.alert('خطأ', e?.response?.data?.detail || 'فشل تغيير الحالة');
    }
  };

  const handleAccept = async (orderId: string) => {
    setAccepting(orderId);
    try {
      await driverAcceptOrder(orderId);
      router.push(`/(driver)/job/${orderId}`);
    } catch (e: any) {
      Alert.alert('تعذر القبول', e?.response?.data?.detail || 'الطلب لم يعد متاحاً');
      await loadOrders();
    } finally {
      setAccepting(null);
    }
  };

  const handleReject = async (orderId: string) => {
    try {
      await driverRejectOrder(orderId);
      setAvailable((a) => a.filter((o) => o.id !== orderId));
    } catch {}
  };

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await loadOrders();
              setRefreshing(false);
            }}
            tintColor={colors.gold}
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.hello}>مرحباً 👋</Text>
            <Text style={styles.name} testID="driver-name">{user?.name || 'سائق'}</Text>
          </View>
          <View style={styles.modeBadge}>
            <View
              style={[
                styles.modeDot,
                { backgroundColor: isOnline ? colors.success : colors.textDisabled },
              ]}
            />
            <Text style={[styles.modeText, isOnline && { color: colors.success }]}>
              {isOnline ? 'متصل' : 'غير متصل'}
            </Text>
          </View>
        </View>

        {/* Online toggle card */}
        <View style={[styles.toggleCard, isOnline && styles.toggleCardOn]}>
          <View style={{ flex: 1 }}>
            <Text style={styles.toggleTitle}>
              {isOnline ? 'أنت متاح لاستلام الطلبات' : 'أنت غير متصل'}
            </Text>
            <Text style={styles.toggleSub}>
              {isOnline ? 'سيتم إعلامك بالطلبات القادمة' : 'فعّل وضع الاتصال لاستلام الطلبات'}
            </Text>
          </View>
          <Switch
            testID="driver-online-switch"
            value={isOnline}
            onValueChange={handleToggleOnline}
            trackColor={{ false: colors.surface3, true: colors.gold }}
            thumbColor={isOnline ? colors.appBg : colors.textSecondary}
          />
        </View>

        {/* Active job pill */}
        {active.length > 0 && (
          <Pressable
            onPress={() => router.push(`/(driver)/job/${active[0].id}`)}
            style={styles.activeBar}
            testID="active-job-bar"
          >
            <Ionicons name="navigate-circle" size={28} color={colors.appBg} />
            <View style={{ flex: 1 }}>
              <Text style={styles.activeTitle}>لديك طلب نشط</Text>
              <Text style={styles.activeSub}>اضغط لمتابعة الرحلة</Text>
            </View>
            <Ionicons name="chevron-back" size={22} color={colors.appBg} />
          </Pressable>
        )}

        {/* Available orders */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>طلبات قادمة</Text>
          {isOnline && (
            <View style={styles.liveRow}>
              <View style={styles.liveDot} />
              <Text style={styles.liveText}>مباشر</Text>
            </View>
          )}
        </View>

        {!isOnline ? (
          <View style={styles.emptyState}>
            <Ionicons name="cloud-offline-outline" size={56} color={colors.textDisabled} />
            <Text style={styles.emptyTitle}>أنت غير متصل</Text>
            <Text style={styles.emptyDesc}>فعّل وضع الاتصال أعلاه لرؤية الطلبات</Text>
          </View>
        ) : available.length === 0 ? (
          <View style={styles.emptyState}>
            <ActivityIndicator color={colors.gold} size="large" />
            <Text style={styles.emptyTitle}>في انتظار الطلبات...</Text>
            <Text style={styles.emptyDesc}>سنُعلمك فور وصول طلب جديد</Text>
          </View>
        ) : (
          available.map((o) => (
            <View key={o.id} style={styles.orderCard} testID={`incoming-${o.id}`}>
              <View style={styles.orderTop}>
                <View style={styles.servicePill}>
                  <Text style={styles.servicePillText}>
                    {SERVICE_LABELS[o.service_type] || 'طلب'}
                  </Text>
                </View>
                <Text style={styles.orderPrice}>{formatIQD(o.final_price)}</Text>
              </View>

              <View style={styles.timeline}>
                <View style={styles.tlLeft}>
                  <View style={[styles.dot, { backgroundColor: colors.gold }]} />
                  <View style={styles.dashedLine} />
                  <View style={[styles.dot, { backgroundColor: colors.error }]} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.addr} numberOfLines={1}>
                    {o.pickup?.address}
                  </Text>
                  <View style={{ height: 12 }} />
                  <Text style={styles.addr} numberOfLines={1}>
                    {o.dropoff?.address}
                  </Text>
                </View>
              </View>

              <View style={styles.statsRow}>
                <View style={styles.statBox}>
                  <Ionicons name="speedometer" size={14} color={colors.gold} />
                  <Text style={styles.statTxt}>{formatKm(o.distance_km)}</Text>
                </View>
                <View style={styles.statBox}>
                  <Ionicons name="time" size={14} color={colors.gold} />
                  <Text style={styles.statTxt}>{formatMinutes(o.eta_minutes)}</Text>
                </View>
                <View style={styles.statBox}>
                  <Ionicons name="cube" size={14} color={colors.gold} />
                  <Text style={styles.statTxt} numberOfLines={1}>
                    {o.cargo_description?.slice(0, 18) || 'طلب نقل'}
                  </Text>
                </View>
              </View>

              <View style={styles.actions}>
                <Pressable
                  testID={`reject-${o.id}`}
                  onPress={() => handleReject(o.id)}
                  style={[styles.btn, styles.btnReject]}
                >
                  <Ionicons name="close" size={18} color={colors.error} />
                  <Text style={styles.btnRejectText}>رفض</Text>
                </Pressable>
                <Pressable
                  testID={`accept-${o.id}`}
                  onPress={() => handleAccept(o.id)}
                  disabled={accepting === o.id}
                  style={[styles.btn, styles.btnAccept, accepting === o.id && { opacity: 0.6 }]}
                >
                  {accepting === o.id ? (
                    <ActivityIndicator color={colors.textOnBrand} />
                  ) : (
                    <>
                      <Ionicons name="checkmark" size={18} color={colors.textOnBrand} />
                      <Text style={styles.btnAcceptText}>قبول الطلب</Text>
                    </>
                  )}
                </Pressable>
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.appBg },
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  hello: { color: colors.textSecondary, fontSize: 14 },
  name: { color: colors.textPrimary, fontWeight: '700', fontSize: 22 },
  modeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.surface1,
    borderWidth: 1,
    borderColor: colors.darkBrown,
  },
  modeDot: { width: 8, height: 8, borderRadius: 4 },
  modeText: { color: colors.textSecondary, fontSize: 12, fontWeight: '700' },
  toggleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface1,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1.5,
    borderColor: colors.darkBrown,
    gap: spacing.sm,
  },
  toggleCardOn: { borderColor: colors.gold, backgroundColor: 'rgba(212,164,55,0.06)' },
  toggleTitle: { color: colors.textPrimary, fontWeight: '700', fontSize: 15 },
  toggleSub: { color: colors.textSecondary, fontSize: 12, marginTop: 2 },
  activeBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.gold,
    borderRadius: radius.md,
    padding: spacing.md,
    ...shadows.button,
  },
  activeTitle: { color: colors.appBg, fontWeight: '700', fontSize: 15 },
  activeSub: { color: colors.appBg, fontSize: 12, opacity: 0.85 },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  sectionTitle: { color: colors.textPrimary, fontWeight: '700', fontSize: 17 },
  liveRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.success },
  liveText: { color: colors.success, fontSize: 12, fontWeight: '700' },
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    gap: spacing.sm,
    backgroundColor: colors.surface1,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.darkBrown,
    borderStyle: 'dashed',
  },
  emptyTitle: { color: colors.textPrimary, fontWeight: '700', fontSize: 15 },
  emptyDesc: { color: colors.textSecondary, fontSize: 12 },
  orderCard: {
    backgroundColor: colors.surface1,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.darkBrown,
    gap: spacing.sm,
  },
  orderTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  servicePill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.pill,
    backgroundColor: colors.surface3,
  },
  servicePillText: { color: colors.gold, fontSize: 11, fontWeight: '700' },
  orderPrice: { color: colors.gold, fontWeight: '700', fontSize: 20 },
  timeline: { flexDirection: 'row', gap: spacing.sm },
  tlLeft: { alignItems: 'center', justifyContent: 'space-between', paddingVertical: 4 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  dashedLine: { width: 1, flex: 1, borderRightWidth: 1, borderColor: colors.darkBrown, borderStyle: 'dashed', minHeight: 24 },
  addr: { color: colors.textPrimary, fontSize: 14 },
  statsRow: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  statBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.surface2,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.darkBrown,
  },
  statTxt: { color: colors.textPrimary, fontSize: 12, fontWeight: '600' },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
  btn: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 14,
    borderRadius: radius.pill,
  },
  btnReject: {
    backgroundColor: 'rgba(255,69,58,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,69,58,0.4)',
  },
  btnRejectText: { color: colors.error, fontWeight: '700', fontSize: 14 },
  btnAccept: { backgroundColor: colors.gold, flex: 2 },
  btnAcceptText: { color: colors.textOnBrand, fontWeight: '700', fontSize: 15 },
});
