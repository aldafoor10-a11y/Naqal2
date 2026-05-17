/**
 * Order Create - Map picker for pickup & dropoff
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { colors, spacing, typography, radius, shadows } from '@/src/theme';
import { translations } from '@/src/i18n';
import { Button } from '@/src/components/ui';
import MapPicker, { LatLng, MapPickerHandle } from '@/src/components/MapPicker';
import { estimatePrice } from '@/src/api/client';
import { formatIQD, formatKm, formatMinutes } from '@/src/utils/format';

const VEHICLES = [
  { key: 'kia_pickup', labelKey: 'kiaPickup' as const, icon: 'car-sport' as const, capacity: 'حتى 500 كغ' },
  { key: 'pickup_truck', labelKey: 'pickupTruck' as const, icon: 'car' as const, capacity: 'حتى 1 طن' },
  { key: 'medium_truck', labelKey: 'mediumTruck' as const, icon: 'bus' as const, capacity: 'حتى 3 طن' },
  { key: 'large_truck', labelKey: 'largeTruck' as const, icon: 'bus-outline' as const, capacity: '5+ طن' },
];

const SERVICE_LABELS: Record<string, string> = {
  furniture: 'نقل الأثاث',
  goods: 'نقل البضائع',
  appliances: 'الأجهزة الكهربائية',
  special: 'طلب خاص',
};

export default function OrderCreate() {
  const t = translations.ar;
  const { service } = useLocalSearchParams<{ service: string }>();
  const mapRef = useRef<MapPickerHandle>(null);

  const [pickup, setPickup] = useState<LatLng | null>(null);
  const [dropoff, setDropoff] = useState<LatLng | null>(null);
  const [activeMode, setActiveMode] = useState<'pickup' | 'dropoff'>('pickup');
  const [vehicleType, setVehicleType] = useState('kia_pickup');
  const [estimate, setEstimate] = useState<any | null>(null);
  const [loadingEstimate, setLoadingEstimate] = useState(false);
  const [gettingLoc, setGettingLoc] = useState(false);

  // Try to get user current location on mount and set as pickup
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

  // Recalculate price whenever both points or vehicle change
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
      vehicle_type: vehicleType,
      service_type: service as string,
    })
      .then((r) => !cancelled && setEstimate(r))
      .catch((e) => console.warn('estimate failed', e))
      .finally(() => !cancelled && setLoadingEstimate(false));
    return () => {
      cancelled = true;
    };
  }, [pickup, dropoff, vehicleType, service]);

  const handleMapPick = useCallback((mode: 'pickup' | 'dropoff', loc: LatLng) => {
    if (mode === 'pickup') setPickup(loc);
    else setDropoff(loc);
    // switch active to next missing one
    if (mode === 'pickup' && !dropoff) setActiveMode('dropoff');
  }, [dropoff]);

  const handleUseCurrent = async () => {
    setGettingLoc(true);
    try {
      let { status } = await Location.getForegroundPermissionsAsync();
      if (status !== 'granted') {
        const req = await Location.requestForegroundPermissionsAsync();
        status = req.status;
      }
      if (status !== 'granted') {
        Alert.alert('إذن الموقع', 'يجب السماح بالوصول إلى الموقع', [
          { text: 'إلغاء' },
          { text: 'فتح الإعدادات', onPress: () => Location.requestForegroundPermissionsAsync() },
        ]);
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

  const handleContinue = () => {
    if (!pickup || !dropoff) {
      Alert.alert('تحديد المواقع', 'يرجى تحديد موقع الانطلاق والوصول');
      return;
    }
    if (!estimate) return;
    router.push({
      pathname: '/order/details',
      params: {
        service: service as string,
        vehicle: vehicleType,
        pickupLat: String(pickup.latitude),
        pickupLng: String(pickup.longitude),
        dropoffLat: String(dropoff.latitude),
        dropoffLng: String(dropoff.longitude),
        distance: String(estimate.distance_km),
        eta: String(estimate.eta_minutes),
        price: String(estimate.final_price),
      },
    });
  };

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          style={styles.iconBtn}
          testID="create-back-btn"
          hitSlop={20}
        >
          <Ionicons name="chevron-forward" size={24} color={colors.textPrimary} />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>تحديد المواقع</Text>
          <Text style={styles.headerSub}>{SERVICE_LABELS[service as string] || ''}</Text>
        </View>
        <View style={{ width: 44 }} />
      </View>

      {/* Map */}
      <View style={styles.mapWrap}>
        <MapPicker
          ref={mapRef}
          pickup={pickup}
          dropoff={dropoff}
          activeMode={activeMode}
          onLocationPicked={handleMapPick}
        />
        {/* Floating mode chips */}
        <View style={styles.mapTop}>
          <Pressable
            onPress={() => setActiveMode('pickup')}
            style={[styles.modeChip, activeMode === 'pickup' && styles.modeChipActive]}
            testID="mode-pickup-btn"
          >
            <View style={[styles.modeDot, { backgroundColor: colors.gold }]} />
            <Text
              style={[styles.modeChipText, activeMode === 'pickup' && styles.modeChipTextActive]}
            >
              الانطلاق
            </Text>
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
              الوصول
            </Text>
          </Pressable>
        </View>

        {/* Use current location FAB */}
        <Pressable
          onPress={handleUseCurrent}
          style={styles.fab}
          testID="use-current-loc-btn"
          disabled={gettingLoc}
        >
          {gettingLoc ? (
            <ActivityIndicator color={colors.gold} />
          ) : (
            <Ionicons name="locate" size={22} color={colors.gold} />
          )}
        </Pressable>

        {!pickup && !dropoff && (
          <View style={styles.hintBubble}>
            <Ionicons name="hand-left-outline" size={16} color={colors.gold} />
            <Text style={styles.hintText}>{t.tapMapToSet}</Text>
          </View>
        )}
      </View>

      {/* Bottom sheet */}
      <ScrollView style={styles.sheet} contentContainerStyle={styles.sheetContent}>
        {/* Location pills */}
        <View style={styles.locRow}>
          <View style={styles.locItem}>
            <View style={[styles.locDot, { backgroundColor: colors.gold }]} />
            <Text style={styles.locLabel}>{t.pickupLocation}</Text>
            <Text style={styles.locValue} numberOfLines={1}>
              {pickup ? `${pickup.latitude.toFixed(4)}, ${pickup.longitude.toFixed(4)}` : '—'}
            </Text>
          </View>
          <View style={styles.locItem}>
            <View style={[styles.locDot, { backgroundColor: colors.error }]} />
            <Text style={styles.locLabel}>{t.dropoffLocation}</Text>
            <Text style={styles.locValue} numberOfLines={1}>
              {dropoff ? `${dropoff.latitude.toFixed(4)}, ${dropoff.longitude.toFixed(4)}` : '—'}
            </Text>
          </View>
        </View>

        {/* Stats */}
        {estimate && (
          <View style={styles.statsCard}>
            <View style={styles.statCol}>
              <Ionicons name="speedometer" size={18} color={colors.gold} />
              <Text style={styles.statLabel}>{t.distance}</Text>
              <Text style={styles.statValue}>{formatKm(estimate.distance_km)}</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statCol}>
              <Ionicons name="time" size={18} color={colors.gold} />
              <Text style={styles.statLabel}>{t.estimatedTime}</Text>
              <Text style={styles.statValue}>{formatMinutes(estimate.eta_minutes)}</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statCol}>
              <Ionicons name="cash" size={18} color={colors.gold} />
              <Text style={styles.statLabel}>السعر</Text>
              <Text style={[styles.statValue, { color: colors.gold }]}>
                {formatIQD(estimate.final_price)}
              </Text>
            </View>
          </View>
        )}

        {/* Vehicle selection */}
        <Text style={styles.sectionLabel}>{t.selectVehicle}</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: spacing.sm }}
        >
          {VEHICLES.map((v) => {
            const selected = vehicleType === v.key;
            return (
              <Pressable
                key={v.key}
                testID={`vehicle-${v.key}`}
                onPress={() => setVehicleType(v.key)}
                style={[styles.vehCard, selected && styles.vehCardActive]}
              >
                <Ionicons
                  name={v.icon}
                  size={28}
                  color={selected ? colors.textOnBrand : colors.gold}
                />
                <Text style={[styles.vehName, selected && styles.vehNameActive]}>
                  {t[v.labelKey]}
                </Text>
                <Text style={[styles.vehCap, selected && styles.vehCapActive]}>{v.capacity}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <Button
          testID="continue-to-details-btn"
          label={t.next}
          onPress={handleContinue}
          disabled={!pickup || !dropoff || loadingEstimate}
          loading={loadingEstimate && !!pickup && !!dropoff}
        />
      </ScrollView>
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
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surface1,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.darkBrown,
  },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: { color: colors.textPrimary, fontWeight: '700', fontSize: 16 },
  headerSub: { color: colors.gold, fontSize: 12, marginTop: 2 },
  mapWrap: { flex: 1, position: 'relative' },
  mapTop: {
    position: 'absolute',
    top: spacing.md,
    left: spacing.md,
    right: spacing.md,
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'center',
  },
  modeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(26,18,12,0.92)',
    borderWidth: 1,
    borderColor: colors.darkBrown,
  },
  modeChipActive: { borderColor: colors.gold, backgroundColor: colors.surface2 },
  modeDot: { width: 10, height: 10, borderRadius: 5 },
  modeChipText: { color: colors.textSecondary, fontWeight: '600', fontSize: 13 },
  modeChipTextActive: { color: colors.textPrimary },
  fab: {
    position: 'absolute',
    bottom: spacing.md,
    right: spacing.md,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.surface1,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
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
    backgroundColor: 'rgba(26,18,12,0.95)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.gold,
  },
  hintText: { color: colors.textPrimary, fontSize: 12, fontWeight: '600' },
  sheet: {
    maxHeight: '52%',
    backgroundColor: colors.surface1,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    borderTopWidth: 1,
    borderColor: colors.darkBrown,
  },
  sheetContent: { padding: spacing.md, gap: spacing.md },
  locRow: { flexDirection: 'row', gap: spacing.sm },
  locItem: {
    flex: 1,
    backgroundColor: colors.surface2,
    padding: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.darkBrown,
    gap: 2,
  },
  locDot: { width: 8, height: 8, borderRadius: 4 },
  locLabel: { color: colors.textSecondary, fontSize: 11 },
  locValue: { color: colors.textPrimary, fontSize: 12, fontWeight: '600' },
  statsCard: {
    flexDirection: 'row',
    backgroundColor: colors.surface2,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.darkBrown,
    alignItems: 'center',
  },
  statCol: { flex: 1, alignItems: 'center', gap: 2 },
  statLabel: { color: colors.textSecondary, fontSize: 11 },
  statValue: { color: colors.textPrimary, fontWeight: '700', fontSize: 14 },
  statDivider: { width: 1, height: 36, backgroundColor: colors.darkBrown },
  sectionLabel: { color: colors.textPrimary, fontWeight: '700', fontSize: 14 },
  vehCard: {
    width: 110,
    padding: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.darkBrown,
    alignItems: 'center',
    gap: spacing.xs,
  },
  vehCardActive: { backgroundColor: colors.gold, borderColor: colors.gold },
  vehName: { color: colors.textPrimary, fontWeight: '700', fontSize: 13 },
  vehNameActive: { color: colors.textOnBrand },
  vehCap: { color: colors.textSecondary, fontSize: 10 },
  vehCapActive: { color: colors.textOnBrand, opacity: 0.7 },
});
