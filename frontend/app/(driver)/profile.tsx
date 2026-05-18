/**
 * Driver profile
 */
import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Alert, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius } from '@/src/theme';
import { useAuth } from '@/src/context/AuthContext';

const VEHICLE_LABEL: Record<string, string> = {
  kia_pickup: 'بيك أب كيا',
  pickup_truck: 'بيك أب',
  medium_truck: 'شاحنة متوسطة',
  large_truck: 'شاحنة كبيرة',
};

export default function DriverProfile() {
  const { user, signOut } = useAuth();

  const doLogout = async () => {
    await signOut();
    router.replace('/(auth)/welcome');
  };

  const handleLogout = () => {
    if (Platform.OS === 'web') {
      const ok = typeof window !== 'undefined' && window.confirm('تسجيل الخروج؟');
      if (ok) doLogout();
      return;
    }
    Alert.alert('تسجيل الخروج', 'هل أنت متأكد؟', [
      { text: 'إلغاء', style: 'cancel' },
      { text: 'خروج', style: 'destructive', onPress: doLogout },
    ]);
  };

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarLetter}>{(user?.name || 'D').charAt(0)}</Text>
          </View>
          <Text style={styles.name}>{user?.name}</Text>
          <Text style={styles.phone}>{user?.phone}</Text>
          <View style={styles.approvedBadge}>
            <Ionicons name="shield-checkmark" size={14} color={colors.success} />
            <Text style={styles.approvedText}>سائق معتمد</Text>
          </View>
        </View>

        {/* Vehicle card */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>معلومات المركبة</Text>
          <View style={styles.vehCard}>
            <View style={styles.vehIcon}>
              <Ionicons name="car-sport" size={32} color={colors.gold} />
            </View>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={styles.vehName}>
                {VEHICLE_LABEL[(user as any)?.vehicle_type] || 'مركبة'}
              </Text>
              <Text style={styles.vehPlate}>
                {(user as any)?.vehicle_plate || '—'}
              </Text>
            </View>
          </View>
        </View>

        {/* Menu */}
        <View style={styles.menu}>
          {[
            { icon: 'document-text-outline', label: 'الوثائق', key: 'docs' },
            { icon: 'wallet-outline', label: 'حساب الدفع', key: 'pay' },
            { icon: 'language-outline', label: 'اللغة', key: 'lang' },
            { icon: 'help-circle-outline', label: 'الدعم', key: 'help' },
          ].map((m, i, arr) => (
            <Pressable
              key={m.key}
              style={[styles.menuItem, i < arr.length - 1 && styles.menuItemBorder]}
              onPress={() => Alert.alert('قريباً', 'هذه الميزة قيد التطوير')}
              testID={`driver-menu-${m.key}`}
            >
              <View style={styles.menuLeft}>
                <View style={styles.menuIconWrap}>
                  <Ionicons name={m.icon as any} size={20} color={colors.gold} />
                </View>
                <Text style={styles.menuLabel}>{m.label}</Text>
              </View>
              <Ionicons name="chevron-back" size={20} color={colors.textDisabled} />
            </Pressable>
          ))}
        </View>

        <Pressable style={styles.logoutBtn} onPress={handleLogout} testID="driver-logout-btn">
          <Ionicons name="log-out-outline" size={20} color={colors.error} />
          <Text style={styles.logoutText}>تسجيل الخروج</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.appBg },
  content: { padding: spacing.lg, gap: spacing.md },
  profileCard: {
    backgroundColor: colors.surface1,
    borderRadius: radius.lg,
    padding: spacing.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.darkBrown,
    gap: 4,
  },
  avatar: {
    width: 90, height: 90, borderRadius: 45,
    backgroundColor: colors.gold,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  avatarLetter: { color: colors.appBg, fontSize: 36, fontWeight: '700' },
  name: { color: colors.textPrimary, fontWeight: '700', fontSize: 22 },
  phone: { color: colors.textSecondary, fontSize: 13 },
  approvedBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.md, paddingVertical: 6,
    backgroundColor: 'rgba(52,199,89,0.1)',
    borderRadius: radius.pill,
    borderWidth: 1, borderColor: 'rgba(52,199,89,0.3)',
  },
  approvedText: { color: colors.success, fontWeight: '700', fontSize: 12 },
  section: { gap: spacing.sm },
  sectionTitle: { color: colors.textPrimary, fontWeight: '700', fontSize: 15 },
  vehCard: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    backgroundColor: colors.surface1,
    borderRadius: radius.md, padding: spacing.md,
    borderWidth: 1, borderColor: colors.darkBrown,
  },
  vehIcon: {
    width: 56, height: 56, borderRadius: radius.md,
    backgroundColor: 'rgba(212,164,55,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  vehName: { color: colors.textPrimary, fontWeight: '700', fontSize: 15 },
  vehPlate: { color: colors.gold, fontSize: 13, fontWeight: '600' },
  menu: {
    backgroundColor: colors.surface1,
    borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.darkBrown,
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: spacing.md,
  },
  menuItemBorder: { borderBottomWidth: 1, borderBottomColor: colors.darkBrown },
  menuLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  menuIconWrap: {
    width: 36, height: 36, borderRadius: 12,
    backgroundColor: 'rgba(212,164,55,0.1)',
    alignItems: 'center', justifyContent: 'center',
  },
  menuLabel: { color: colors.textPrimary, fontSize: 15 },
  logoutBtn: {
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: spacing.sm,
    backgroundColor: 'rgba(255,69,58,0.1)',
    borderRadius: radius.md,
    borderWidth: 1, borderColor: 'rgba(255,69,58,0.3)',
    paddingVertical: spacing.md,
  },
  logoutText: { color: colors.error, fontWeight: '700' },
});
