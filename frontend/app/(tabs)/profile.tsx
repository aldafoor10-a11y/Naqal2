/**
 * Profile tab
 */
import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Alert, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography, radius, shadows } from '@/src/theme';
import { translations } from '@/src/i18n';
import { useAuth } from '@/src/context/AuthContext';

const LOGO_URL =
  'https://customer-assets.emergentagent.com/job_eb826b44-ecc6-46f2-b4e7-84a184f8d38a/artifacts/x4ziw5ow_IMG_20260419_223622_456.webp';

const MENU: { key: string; icon: any; label: string; action?: string }[] = [
  { key: 'edit', icon: 'create-outline', label: 'تعديل الملف الشخصي' },
  { key: 'addresses', icon: 'location-outline', label: 'عناويني المحفوظة' },
  { key: 'payments', icon: 'wallet-outline', label: 'طرق الدفع' },
  { key: 'notifications', icon: 'notifications-outline', label: 'الإشعارات' },
  { key: 'lang', icon: 'language-outline', label: 'اللغة' },
  { key: 'help', icon: 'help-circle-outline', label: 'مركز المساعدة' },
  { key: 'about', icon: 'information-circle-outline', label: 'عن التطبيق' },
];

export default function Profile() {
  const t = translations.ar;
  const { user, signOut } = useAuth();

  const handleLogout = () => {
    Alert.alert('تسجيل الخروج', 'هل أنت متأكد من تسجيل الخروج؟', [
      { text: 'إلغاء', style: 'cancel' },
      {
        text: 'خروج',
        style: 'destructive',
        onPress: async () => {
          await signOut();
          router.replace('/(auth)/welcome');
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Profile header */}
        <View style={styles.profileCard}>
          <View style={styles.avatarWrap}>
            <View style={styles.avatar}>
              <Text style={styles.avatarLetter}>
                {(user?.name || 'م').charAt(0)}
              </Text>
            </View>
            <Pressable style={styles.editAvatar} testID="edit-avatar-btn">
              <Ionicons name="camera" size={14} color={colors.textOnBrand} />
            </Pressable>
          </View>
          <Text style={styles.userName} testID="profile-user-name">
            {user?.name || 'مستخدم'}
          </Text>
          <Text style={styles.userPhone}>{user?.phone}</Text>

          <View style={styles.statsRow}>
            <View style={styles.stat}>
              <Text style={styles.statValue}>{user?.total_orders ?? 0}</Text>
              <Text style={styles.statLabel}>{t.totalOrders}</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.stat}>
              <View style={styles.ratingRow}>
                <Ionicons name="star" size={14} color={colors.gold} />
                <Text style={styles.statValue}>{(user?.rating ?? 5).toFixed(1)}</Text>
              </View>
              <Text style={styles.statLabel}>{t.rating}</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.stat}>
              <Text style={styles.statValue}>عضو</Text>
              <Text style={styles.statLabel}>VIP</Text>
            </View>
          </View>
        </View>

        {/* Menu */}
        <View style={styles.menu}>
          {MENU.map((m, idx) => (
            <Pressable
              key={m.key}
              testID={`profile-menu-${m.key}`}
              style={[styles.menuItem, idx < MENU.length - 1 && styles.menuItemBorder]}
              onPress={() => Alert.alert('قريباً', 'هذه الميزة ستكون متاحة قريباً')}
            >
              <View style={styles.menuLeft}>
                <View style={styles.menuIconWrap}>
                  <Ionicons name={m.icon} size={20} color={colors.gold} />
                </View>
                <Text style={styles.menuLabel}>{m.label}</Text>
              </View>
              <Ionicons name="chevron-back" size={20} color={colors.textDisabled} />
            </Pressable>
          ))}
        </View>

        <Pressable
          testID="logout-btn"
          style={styles.logoutBtn}
          onPress={handleLogout}
        >
          <Ionicons name="log-out-outline" size={20} color={colors.error} />
          <Text style={styles.logoutText}>{t.logout}</Text>
        </Pressable>

        <View style={styles.footer}>
          <Image source={{ uri: LOGO_URL }} style={styles.footerLogo} resizeMode="contain" />
          <Text style={styles.version}>الإصدار 1.0.0</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.appBg },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.lg },
  profileCard: {
    backgroundColor: colors.surface1,
    borderRadius: radius.lg,
    padding: spacing.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.darkBrown,
    ...shadows.card,
  },
  avatarWrap: { position: 'relative', marginBottom: spacing.md },
  avatar: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: colors.surface2,
  },
  avatarLetter: { color: colors.textOnBrand, fontSize: 36, fontWeight: '700' },
  editAvatar: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.gold,
    borderWidth: 2,
    borderColor: colors.surface1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userName: { color: colors.textPrimary, fontSize: 22, fontWeight: '700' },
  userPhone: { color: colors.textSecondary, fontSize: 14, marginTop: 2 },
  statsRow: {
    flexDirection: 'row',
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.darkBrown,
    alignSelf: 'stretch',
    justifyContent: 'space-around',
  },
  stat: { alignItems: 'center', flex: 1, gap: 2 },
  statValue: { color: colors.textPrimary, fontWeight: '700', fontSize: 18 },
  statLabel: { color: colors.textSecondary, fontSize: 12 },
  statDivider: { width: 1, backgroundColor: colors.darkBrown, marginVertical: spacing.sm },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  menu: {
    backgroundColor: colors.surface1,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.darkBrown,
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
  },
  menuItemBorder: { borderBottomWidth: 1, borderBottomColor: colors.darkBrown },
  menuLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  menuIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: 'rgba(212,164,55,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuLabel: { color: colors.textPrimary, fontSize: 15 },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: 'rgba(255,69,58,0.1)',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(255,69,58,0.3)',
    paddingVertical: spacing.md,
  },
  logoutText: { color: colors.error, fontWeight: '700', fontSize: 15 },
  footer: { alignItems: 'center', gap: spacing.xs, marginTop: spacing.md },
  footerLogo: { width: 60, height: 60, opacity: 0.5 },
  version: { color: colors.textDisabled, fontSize: 12 },
});
