/**
 * Order Create - Single-screen flow:
 * 1) Pick pickup location  2) Pick dropoff  3) Write cargo details  4) Send
 * No vehicle selection. No separate details screen. Big buttons. Modern map.
 */
import React, { useRef, useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Alert,
  ActivityIndicator,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { colors, spacing, radius, shadows } from '@/src/theme';
import { translations } from '@/src/i18n';
import { Button } from '@/src/components/ui';
import MapPicker, { LatLng, MapPickerHandle } from '@/src/components/MapPicker';
import { estimatePrice, createOrder } from '@/src/api/client';
import { formatIQD, formatKm, formatMinutes } from '@/src/utils/format';

const SERVICE_LABELS: Record<string, string> = {
  furniture: 'نقل الأثاث',
  goods: 'نقل البضائع',
  appliances: 'الأجهزة الكهربائية',
  special: 'طلب خاص',
};

// Default vehicle is always pickup_truck (most common, mid-tier price).
// Customer no longer chooses — operator dispatches the right truck.
const DEFAULT_VEHICLE = 'pickup_truck';

export default function OrderCreate() {
  const t = translations.ar;
  const { service } = useLocalSearchParams<{ service: string }>();
  const mapRef = useRef<MapPickerHandle>(null);

  const [pickup, setPickup] = useState<LatLng | null>(null);
  const [dropoff, setDropoff] = useState<LatLng | null>(null);
  const [activeMode, setActiveMode] = useState<'pickup' | 'dropoff'>('pickup');
  const [estimate, setEstimate] = useState<any | null>(null);
  const [loadingEstimate, setLoadingEstimate] = useState(false);
  const [gettingLoc, setGettingLoc] = useState(false);

  const [cargoDesc, setCargoDesc] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Auto-detect current location → pickup
  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.getForegroundPermissionsAsync();
        if (status === 'granted') {
          const loc = await Location.getCurrentPositionAsync({});
          const here: LatLng = {
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
          };
          setPickup(here);
          mapRef.current?.setCenter(here, 14);
        }
      } catch {}
    })();
  }, []);

  // Live price estimate
  useEffect(() => {
    if (!pickup || !dropoff) {
      setEstimate(null);
      return;
    }
    let cancelled = false;
    setLoadingEstimate(true);
    estimatePrice({
      pickup_lat: pickup.latitude,
      pickup_lng: pickup.longitude,
      dropoff_lat: dropoff.latitude,
      dropoff_lng: dropoff.longitude,
      vehicle_type: DEFAULT_VEHICLE,
      service_type: service as string,
    })
      .then((r) => !cancelled && setEstimate(r))
      .catch((e) => console.warn('estimate failed', e))
      .finally(() => !cancelled && setLoadingEstimate(false));
    return () => {
      cancelled = true;
    };
  }, [pickup, dropoff, service]);

  const handleMapPick = useCallback(
    (mode: 'pickup' | 'dropoff', loc: LatLng) => {
      if (mode === 'pickup') setPickup(loc);
      else setDropoff(loc);
      // Auto-switch to dropoff after pickup is set
      if (mode === 'pickup' && !dropoff) setActiveMode('dropoff');
    },
    [dropoff]
  );

  const handleUseCurrent = async () => {
    setGettingLoc(true);
    try {
      let { status } = await Location.getForegroundPermissionsAsync();
      if (status !== 'granted') {
        const req = await Location.requestForegroundPermissionsAsync();
        status = req.status;
      }
      if (status !== 'granted') {
        Alert.alert('إذن الموقع', 'يجب السماح بالوصول إلى الموقع لاستخدام هذه الميزة');
        return;
      }
      const loc = await Location.getCurrentPositionAsync({});
      const here: LatLng = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
      if (activeMode === 'pickup') setPickup(here);
      else setDropoff(here);
      mapRef.current?.setMarker(activeMode, here);
      mapRef.current?.setCenter(here, 14);
    } catch (e) {
      console.warn(e);
    } finally {
      setGettingLoc(false);
    }
  };

  const handleSend = async () => {
    if (!pickup || !dropoff) {
      Alert.alert('تحديد المواقع', 'يرجى تحديد موقع الانطلاق والوصول على الخريطة');
      return;
    }
    if (!cargoDesc.trim()) {
      Alert.alert('وصف الطلب', 'يرجى كتابة وصف مختصر للحمولة');
      return;
    }
    if (!estimate) return;
    setSubmitting(true);
    try {
      const order = await createOrder({
        service_type: (service as string) || 'goods',
        pickup: {
          address: `${pickup.latitude.toFixed(4)}, ${pickup.longitude.toFixed(4)}`,
          latitude: pickup.latitude,
          longitude: pickup.longitude,
        },
        dropoff: {
          address: `${dropoff.latitude.toFixed(4)}, ${dropoff.longitude.toFixed(4)}`,
          latitude: dropoff.latitude,
          longitude: dropoff.longitude,
        },
        vehicle_type: DEFAULT_VEHICLE,
        cargo_description: cargoDesc.trim(),
        cargo_notes: notes.trim(),
        cargo_images: [],
      });
      router.replace(`/order/${order.id}`);
    } catch (e: any) {
      Alert.alert('خطأ', e?.response?.data?.detail || 'فشل إرسال الطلب');
    } finally {
      setSubmitting(false);
    }
  };

  const canSubmit = !!pickup && !!dropoff && cargoDesc.trim().length > 0 && !!estimate;

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        {/* Header */}
        <View style={styles.header}>
          <Pressable
            onPress={() => router.back()}
            style={styles.iconBtn}
            testID="create-back-btn"
            hitSlop={20}
          >
            <Ionicons name="chevron-forward" size={26} color={colors.textPrimary} />
          </Pressable>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>طلب نقل جديد</Text>
            {service ? (
              <Text style={styles.headerSub}>{SERVICE_LABELS[service as string]}</Text>
            ) : null}
          </View>
          <View style={{ width: 48 }} />
        </View>

        {/* MAP */}
        <View style={styles.mapWrap}>
          <MapPicker
            ref={mapRef}
            pickup={pickup}
            dropoff={dropoff}
            activeMode={activeMode}
            onLocationPicked={handleMapPick}
          />

          {/* Top: mode segmented control */}
          <View style={styles.modeBar}>
            <Pressable
              onPress={() => setActiveMode('pickup')}
              style={[styles.modeChip, activeMode === 'pickup' && styles.modeChipActive]}
              testID="mode-pickup-btn"
            >
              <View style={[styles.modeDot, { backgroundColor: colors.gold }]} />
              <Text
                style={[styles.modeChipText, activeMode === 'pickup' && styles.modeChipTextActive]}
              >
                نقطة الانطلاق
              </Text>
              {pickup && <Ionicons name="checkmark-circle" size={16} color={colors.success} />}
            </Pressable>
            <Pressable
              onPress={() => setActiveMode('dropoff')}
              style={[styles.modeChip, activeMode === 'dropoff' && styles.modeChipActive]}
              testID="mode-dropoff-btn"
            >
              <View style={[styles.modeDot, { backgroundColor: colors.error }]} />
              <Text
                style={[styles.modeChipText, activeMode === 'dropoff' && styles.modeChipTextActive]}
              >
                نقطة الوصول
              </Text>
              {dropoff && <Ionicons name="checkmark-circle" size={16} color={colors.success} />}
            </Pressable>
          </View>

          {/* Locate me FAB */}
          <Pressable
            onPress={handleUseCurrent}
            style={styles.fab}
            testID="use-current-loc-btn"
            disabled={gettingLoc}
            hitSlop={10}
          >
            {gettingLoc ? (
              <ActivityIndicator color={colors.gold} />
            ) : (
              <Ionicons name="locate" size={24} color={colors.gold} />
            )}
          </Pressable>

          {/* Hint bubble when nothing picked */}
          {!pickup && !dropoff && (
            <View style={styles.hintBubble}>
              <Ionicons name="hand-left-outline" size={18} color={colors.gold} />
              <Text style={styles.hintText}>اضغط على الخريطة لتحديد الموقع</Text>
            </View>
          )}

          {/* Live price chip overlay */}
          {estimate && (
            <View style={styles.priceChip} testID="map-price-chip">
              <Ionicons name="cash" size={14} color={colors.textOnBrand} />
              <Text style={styles.priceChipText}>{formatIQD(estimate.final_price)}</Text>
            </View>
          )}
        </View>

        {/* BOTTOM SHEET */}
        <ScrollView
          style={styles.sheet}
          contentContainerStyle={styles.sheetContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.handleBar} />

          {/* Location summary row */}
          <View style={styles.locTimeline}>
            <View style={styles.locTimelineLeft}>
              <View style={[styles.tlDot, { backgroundColor: colors.gold }]} />
              <View style={styles.tlConn} />
              <View style={[styles.tlDot, { backgroundColor: colors.error }]} />
            </View>
            <View style={styles.locTimelineRight}>
              <Pressable onPress={() => setActiveMode('pickup')} style={styles.locItem}>
                <Text style={styles.locLabel}>من</Text>
                <Text style={styles.locValue} numberOfLines={1}>
                  {pickup
                    ? `${pickup.latitude.toFixed(4)}, ${pickup.longitude.toFixed(4)}`
                    : 'اختر نقطة الانطلاق'}
                </Text>
              </Pressable>
              <View style={styles.locSeparator} />
              <Pressable onPress={() => setActiveMode('dropoff')} style={styles.locItem}>
                <Text style={styles.locLabel}>إلى</Text>
                <Text style={styles.locValue} numberOfLines={1}>
                  {dropoff
                    ? `${dropoff.latitude.toFixed(4)}, ${dropoff.longitude.toFixed(4)}`
                    : 'اختر نقطة الوصول'}
                </Text>
              </Pressable>
            </View>
          </View>

          {/* Cargo description */}
          <View style={styles.inputBlock}>
            <Text style={styles.inputLabel}>وصف الحمولة</Text>
            <TextInput
              testID="cargo-desc-input"
              value={cargoDesc}
              onChangeText={setCargoDesc}
              placeholder="مثال: غرفة نوم، ثلاجة، صناديق..."
              placeholderTextColor={colors.textDisabled}
              style={styles.input}
              multiline
              maxLength={200}
            />
          </View>

          <View style={styles.inputBlock}>
            <Text style={styles.inputLabel}>
              ملاحظات إضافية <Text style={styles.optional}>(اختياري)</Text>
            </Text>
            <TextInput
              testID="cargo-notes-input"
              value={notes}
              onChangeText={setNotes}
              placeholder="مثال: الطابق الثاني، بدون مصعد"
              placeholderTextColor={colors.textDisabled}
              style={styles.input}
              multiline
              maxLength={200}
            />
          </View>

          {/* Price summary */}
          {estimate ? (
            <View style={styles.summaryCard}>
              <View style={styles.summaryTop}>
                <View style={styles.summaryCol}>
                  <Ionicons name="speedometer" size={16} color={colors.gold} />
                  <Text style={styles.summaryColLabel}>المسافة</Text>
                  <Text style={styles.summaryColValue}>{formatKm(estimate.distance_km)}</Text>
                </View>
                <View style={styles.summaryDivider} />
                <View style={styles.summaryCol}>
                  <Ionicons name="time" size={16} color={colors.gold} />
                  <Text style={styles.summaryColLabel}>الوقت</Text>
                  <Text style={styles.summaryColValue}>{formatMinutes(estimate.eta_minutes)}</Text>
                </View>
                <View style={styles.summaryDivider} />
                <View style={styles.summaryCol}>
                  <Ionicons name="wallet" size={16} color={colors.gold} />
                  <Text style={styles.summaryColLabel}>الدفع</Text>
                  <Text style={styles.summaryColValue}>نقداً</Text>
                </View>
              </View>
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>المبلغ الإجمالي</Text>
                <Text style={styles.totalValue}>{formatIQD(estimate.final_price)}</Text>
              </View>
            </View>
          ) : (
            <View style={styles.summaryPlaceholder}>
              <Ionicons name="map-outline" size={20} color={colors.textDisabled} />
              <Text style={styles.summaryPlaceholderText}>
                حدد الموقعين على الخريطة لعرض السعر
              </Text>
            </View>
          )}

          {/* Send button — big and bold */}
          <Button
            testID="send-order-btn"
            label="إرسال الطلب"
            onPress={handleSend}
            loading={submitting || loadingEstimate}
            disabled={!canSubmit}
            style={styles.sendBtn}
          />

          {/* Safety badge */}
          <View style={styles.safetyRow}>
            <Ionicons name="shield-checkmark" size={14} color={colors.success} />
            <Text style={styles.safetyText}>سعر ثابت بدون مفاجآت • الدفع عند التسليم</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.appBg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.appBg,
    borderBottomWidth: 1,
    borderBottomColor: colors.darkBrown,
  },
  iconBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.surface1,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.darkBrown,
  },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: { color: colors.textPrimary, fontWeight: '700', fontSize: 17 },
  headerSub: { color: colors.gold, fontSize: 12, marginTop: 2 },

  // MAP
  mapWrap: { flex: 1, position: 'relative', minHeight: 280 },
  modeBar: {
    position: 'absolute',
    top: spacing.md,
    left: spacing.md,
    right: spacing.md,
    flexDirection: 'row',
    gap: spacing.sm,
  },
  modeChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(26,18,12,0.92)',
    borderWidth: 1.5,
    borderColor: colors.darkBrown,
  },
  modeChipActive: { borderColor: colors.gold, backgroundColor: colors.surface2 },
  modeDot: { width: 10, height: 10, borderRadius: 5 },
  modeChipText: { color: colors.textSecondary, fontWeight: '700', fontSize: 13 },
  modeChipTextActive: { color: colors.textPrimary },

  fab: {
    position: 'absolute',
    bottom: spacing.md,
    right: spacing.md,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.surface1,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: colors.gold,
    ...shadows.card,
  },

  hintBubble: {
    position: 'absolute',
    bottom: spacing.md,
    left: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: 'rgba(26,18,12,0.96)',
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.gold,
  },
  hintText: { color: colors.textPrimary, fontSize: 13, fontWeight: '600' },

  priceChip: {
    position: 'absolute',
    top: spacing.md + 56 + spacing.sm,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.gold,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    ...shadows.button,
  },
  priceChipText: { color: colors.textOnBrand, fontWeight: '700', fontSize: 14 },

  // SHEET
  sheet: {
    backgroundColor: colors.surface1,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    borderTopWidth: 1,
    borderColor: colors.darkBrown,
    maxHeight: '58%',
  },
  sheetContent: { padding: spacing.lg, paddingTop: spacing.sm, gap: spacing.md, paddingBottom: spacing.xl },
  handleBar: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.darkBrown,
    alignSelf: 'center',
    marginBottom: spacing.sm,
  },

  // Location timeline
  locTimeline: {
    flexDirection: 'row',
    gap: spacing.sm,
    backgroundColor: colors.surface2,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.darkBrown,
  },
  locTimelineLeft: { alignItems: 'center', paddingTop: 6 },
  locTimelineRight: { flex: 1 },
  tlDot: { width: 12, height: 12, borderRadius: 6 },
  tlConn: { width: 2, height: 28, backgroundColor: colors.darkBrown, marginVertical: 4 },
  locItem: { paddingVertical: 4 },
  locSeparator: { height: 1, backgroundColor: colors.darkBrown, marginVertical: 4 },
  locLabel: { color: colors.textSecondary, fontSize: 11, fontWeight: '700' },
  locValue: { color: colors.textPrimary, fontSize: 14, fontWeight: '600', marginTop: 2 },

  // Inputs
  inputBlock: { gap: spacing.xs },
  inputLabel: { color: colors.textPrimary, fontSize: 14, fontWeight: '700' },
  optional: { color: colors.textDisabled, fontWeight: '400', fontSize: 12 },
  input: {
    backgroundColor: colors.surface2,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.darkBrown,
    padding: spacing.md,
    color: colors.textPrimary,
    fontSize: 15,
    textAlignVertical: 'top',
    minHeight: 60,
  },

  // Summary card
  summaryCard: {
    backgroundColor: colors.surface2,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.gold,
    gap: spacing.md,
  },
  summaryTop: { flexDirection: 'row', alignItems: 'center' },
  summaryCol: { flex: 1, alignItems: 'center', gap: 2 },
  summaryColLabel: { color: colors.textSecondary, fontSize: 11 },
  summaryColValue: { color: colors.textPrimary, fontWeight: '700', fontSize: 14 },
  summaryDivider: { width: 1, height: 36, backgroundColor: colors.darkBrown },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.darkBrown,
  },
  totalLabel: { color: colors.textPrimary, fontSize: 14, fontWeight: '600' },
  totalValue: { color: colors.gold, fontSize: 24, fontWeight: '700' },

  summaryPlaceholder: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface2,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.darkBrown,
    borderStyle: 'dashed',
  },
  summaryPlaceholderText: { color: colors.textDisabled, fontSize: 13 },

  sendBtn: { minHeight: 60 },

  safetyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    marginTop: -spacing.xs,
  },
  safetyText: { color: colors.textSecondary, fontSize: 12 },
});
