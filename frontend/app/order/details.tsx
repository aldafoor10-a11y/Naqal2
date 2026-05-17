/**
 * Order Details - cargo description + photos + confirm
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  Pressable,
  Image,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { colors, spacing, typography, radius, shadows } from '@/src/theme';
import { translations } from '@/src/i18n';
import { Button } from '@/src/components/ui';
import { createOrder } from '@/src/api/client';
import { formatIQD, formatKm, formatMinutes } from '@/src/utils/format';

const SERVICE_LABELS: Record<string, string> = {
  furniture: 'نقل الأثاث',
  goods: 'نقل البضائع',
  appliances: 'الأجهزة الكهربائية',
  special: 'طلب خاص',
};

const VEHICLE_LABELS: Record<string, string> = {
  kia_pickup: 'بيك أب كيا',
  pickup_truck: 'بيك أب',
  medium_truck: 'شاحنة متوسطة',
  large_truck: 'شاحنة كبيرة',
};

export default function OrderDetails() {
  const t = translations.ar;
  const params = useLocalSearchParams<{
    service: string;
    vehicle: string;
    pickupLat: string;
    pickupLng: string;
    dropoffLat: string;
    dropoffLng: string;
    distance: string;
    eta: string;
    price: string;
  }>();

  const [cargoDesc, setCargoDesc] = useState('');
  const [notes, setNotes] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const handlePickImage = async () => {
    if (images.length >= 3) {
      Alert.alert('الحد الأقصى', 'يمكنك إضافة حتى 3 صور فقط');
      return;
    }
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('إذن الصور', 'يجب السماح بالوصول إلى الصور');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      base64: true,
      quality: 0.6,
      allowsEditing: true,
      aspect: [4, 3],
    });
    if (!result.canceled && result.assets[0]?.base64) {
      const b64 = `data:image/jpeg;base64,${result.assets[0].base64}`;
      setImages([...images, b64]);
    }
  };

  const handleSubmit = async () => {
    if (!cargoDesc.trim()) {
      Alert.alert('وصف الحمولة', 'يرجى وصف الحمولة');
      return;
    }
    setSubmitting(true);
    try {
      const order = await createOrder({
        service_type: params.service,
        pickup: {
          address: `${parseFloat(params.pickupLat).toFixed(4)}, ${parseFloat(params.pickupLng).toFixed(4)}`,
          latitude: parseFloat(params.pickupLat),
          longitude: parseFloat(params.pickupLng),
        },
        dropoff: {
          address: `${parseFloat(params.dropoffLat).toFixed(4)}, ${parseFloat(params.dropoffLng).toFixed(4)}`,
          latitude: parseFloat(params.dropoffLat),
          longitude: parseFloat(params.dropoffLng),
        },
        vehicle_type: params.vehicle,
        cargo_description: cargoDesc.trim(),
        cargo_notes: notes.trim(),
        cargo_images: images,
      });
      router.replace(`/order/${order.id}`);
    } catch (e: any) {
      Alert.alert('خطأ', e?.response?.data?.detail || 'فشل إنشاء الطلب');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        {/* Header */}
        <View style={styles.header}>
          <Pressable
            onPress={() => router.back()}
            style={styles.iconBtn}
            testID="details-back-btn"
            hitSlop={20}
          >
            <Ionicons name="chevron-forward" size={24} color={colors.textPrimary} />
          </Pressable>
          <Text style={styles.headerTitle}>تفاصيل الطلب</Text>
          <View style={{ width: 44 }} />
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Summary card */}
          <View style={styles.summaryCard}>
            <View style={styles.summaryRow}>
              <Ionicons name="cube" size={18} color={colors.gold} />
              <Text style={styles.summaryLabel}>الخدمة</Text>
              <Text style={styles.summaryValue}>{SERVICE_LABELS[params.service]}</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryRow}>
              <Ionicons name="car" size={18} color={colors.gold} />
              <Text style={styles.summaryLabel}>المركبة</Text>
              <Text style={styles.summaryValue}>{VEHICLE_LABELS[params.vehicle]}</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryRow}>
              <Ionicons name="speedometer" size={18} color={colors.gold} />
              <Text style={styles.summaryLabel}>{t.distance}</Text>
              <Text style={styles.summaryValue}>{formatKm(parseFloat(params.distance))}</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryRow}>
              <Ionicons name="time" size={18} color={colors.gold} />
              <Text style={styles.summaryLabel}>{t.estimatedTime}</Text>
              <Text style={styles.summaryValue}>{formatMinutes(parseInt(params.eta))}</Text>
            </View>
          </View>

          {/* Cargo description */}
          <View style={styles.inputBlock}>
            <Text style={styles.label}>{t.cargoDescription} *</Text>
            <TextInput
              testID="cargo-desc-input"
              value={cargoDesc}
              onChangeText={setCargoDesc}
              placeholder={t.cargoDescPlaceholder}
              placeholderTextColor={colors.textDisabled}
              style={styles.input}
              multiline
              numberOfLines={3}
              maxLength={200}
            />
          </View>

          <View style={styles.inputBlock}>
            <Text style={styles.label}>{t.additionalNotes}</Text>
            <TextInput
              testID="cargo-notes-input"
              value={notes}
              onChangeText={setNotes}
              placeholder="مثال: يوجد طابق ثاني بدون مصعد"
              placeholderTextColor={colors.textDisabled}
              style={styles.input}
              multiline
              numberOfLines={2}
              maxLength={200}
            />
          </View>

          {/* Photos */}
          <View style={styles.inputBlock}>
            <Text style={styles.label}>
              {t.addPhotos}{' '}
              <Text style={styles.labelHint}>(اختياري - حتى 3 صور)</Text>
            </Text>
            <View style={styles.photoRow}>
              {images.map((img, i) => (
                <View key={i} style={styles.photoBox}>
                  <Image source={{ uri: img }} style={styles.photo} />
                  <Pressable
                    style={styles.photoRemove}
                    onPress={() => setImages(images.filter((_, idx) => idx !== i))}
                    testID={`remove-photo-${i}`}
                  >
                    <Ionicons name="close" size={14} color={colors.textOnBrand} />
                  </Pressable>
                </View>
              ))}
              {images.length < 3 && (
                <Pressable
                  testID="add-photo-btn"
                  onPress={handlePickImage}
                  style={styles.photoAdd}
                >
                  <Ionicons name="camera" size={28} color={colors.gold} />
                  <Text style={styles.photoAddText}>إضافة</Text>
                </Pressable>
              )}
            </View>
          </View>

          {/* Payment method */}
          <View style={styles.inputBlock}>
            <Text style={styles.label}>{t.paymentMethod}</Text>
            <View style={styles.payCard}>
              <Ionicons name="cash" size={24} color={colors.gold} />
              <View style={{ flex: 1 }}>
                <Text style={styles.payTitle}>{t.cashOnDelivery}</Text>
                <Text style={styles.paySub}>الدفع للسائق نقداً عند التسليم</Text>
              </View>
              <Ionicons name="checkmark-circle" size={20} color={colors.gold} />
            </View>
          </View>

          {/* Final price */}
          <View style={styles.priceCard}>
            <View>
              <Text style={styles.priceCardLabel}>{t.finalPrice}</Text>
              <Text style={styles.priceCardValue}>{formatIQD(parseFloat(params.price))}</Text>
            </View>
            <View style={styles.priceBadge}>
              <Ionicons name="shield-checkmark" size={14} color={colors.success} />
              <Text style={styles.priceBadgeText}>سعر ثابت</Text>
            </View>
          </View>

          <Button
            testID="confirm-order-btn"
            label={t.confirmOrder}
            onPress={handleSubmit}
            loading={submitting}
          />
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
  headerTitle: { flex: 1, textAlign: 'center', color: colors.textPrimary, fontWeight: '700', fontSize: 16 },
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },
  summaryCard: {
    backgroundColor: colors.surface1,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.darkBrown,
  },
  summaryRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xs },
  summaryLabel: { color: colors.textSecondary, fontSize: 13, flex: 1 },
  summaryValue: { color: colors.textPrimary, fontWeight: '700', fontSize: 13 },
  summaryDivider: { height: 1, backgroundColor: colors.darkBrown, marginVertical: 2 },
  inputBlock: { gap: spacing.sm },
  label: { color: colors.textPrimary, fontWeight: '600', fontSize: 14 },
  labelHint: { color: colors.textDisabled, fontWeight: '400', fontSize: 12 },
  input: {
    backgroundColor: colors.surface1,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.darkBrown,
    padding: spacing.md,
    color: colors.textPrimary,
    fontSize: 15,
    textAlignVertical: 'top',
    minHeight: 60,
  },
  photoRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  photoBox: { position: 'relative', width: 90, height: 90 },
  photo: { width: '100%', height: '100%', borderRadius: radius.md, backgroundColor: colors.surface1 },
  photoRemove: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoAdd: {
    width: 90,
    height: 90,
    borderRadius: radius.md,
    backgroundColor: colors.surface1,
    borderWidth: 1.5,
    borderColor: colors.darkBrown,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  photoAddText: { color: colors.gold, fontSize: 11, fontWeight: '600' },
  payCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface1,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1.5,
    borderColor: colors.gold,
  },
  payTitle: { color: colors.textPrimary, fontWeight: '700', fontSize: 14 },
  paySub: { color: colors.textSecondary, fontSize: 12, marginTop: 2 },
  priceCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(212,164,55,0.08)',
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.gold,
    ...shadows.button,
  },
  priceCardLabel: { color: colors.textSecondary, fontSize: 12 },
  priceCardValue: { color: colors.gold, fontWeight: '700', fontSize: 28, marginTop: 2 },
  priceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(52,199,89,0.12)',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
  },
  priceBadgeText: { color: colors.success, fontSize: 11, fontWeight: '700' },
});
