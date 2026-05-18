/**
 * Customer Profile tab — fully wired menu items
 */
import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Alert, Image, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, shadows } from '@/src/theme';
import { useAuth } from '@/src/context/AuthContext';
import { useLocale } from '@/src/context/LocaleContext';

const LOGO_URL =
  'https://customer-assets.emergentagent.com/job_eb826b44-ecc6-46f2-b4e7-84a184f8d38a/artifacts/x4ziw5ow_IMG_20260419_223622_456.webp';

export default function Profile() {
  const { t, locale } = useLocale();
  const { user, signOut } = useAuth();

  const doLogout = async () => {
    await signOut();
    router.replace('/(auth)/welcome');
  };

  const handleLogout = () => {
    const title = t.logout;
    const msg = locale === 'ar' ? 'هل أنت متأكد من تسجيل الخروج؟' : 'Are you sure you want to log out?';
    if (Platform.OS === 'web') {
      const ok = typeof window !== 'undefined' && window.confirm(msg);
      if (ok) doLogout();
      return;
    }
    Alert.alert(title, msg, [
      { text: t.cancel, style: 'cancel' },
      { text: t.logout, style: 'destructive', onPress: doLogout },
    ]);
  };

  const comingSoon = () => {
    const title = locale === 'ar' ? 'قريباً' : 'Coming soon';
    const body = locale === 'ar' ? 'هذه الميزة ستكون متاحة قريباً' : 'This feature will be available soon';
    if (Platform.OS === 'web') {
      typeof window !== 'undefined' && window.alert(`${title}\n${body}`);
    } else {
      Alert.alert(title, body);
    }
  };

  const menu: { key: string; icon: any; label: string; onPress: () => void; testID: string; rightChip?: string }[] = [
    {
      key: 'edit', icon: 'create-outline',
      label: locale === 'ar' ? 'تعديل الملف الشخصي' : 'Edit Profile',
      onPress: () => router.push('/settings/edit-profile'),
      testID: 'profile-menu-edit',
    },
    {
      key: 'addresses', icon: 'location-outline',
      label: locale === 'ar' ? 'عناويني المحفوظة' : 'Saved Addresses',
      onPress: comingSoon,
      testID: 'profile-menu-addresses',
      rightChip: locale === 'ar' ? 'قريباً' : 'Soon',
    },
    {
      key: 'payments', icon: 'wallet-outline',
      label: locale === 'ar' ? 'طرق الدفع' : 'Payment Methods',
      onPress: comingSoon,
      testID: 'profile-menu-payments',
      rightChip: locale === 'ar' ? 'قريباً' : 'Soon',
    },
    {
      key: 'lang', icon: 'language-outline',
      label: t.language,
      onPress: () => router.push('/settings/language'),
      testID: 'profile-menu-lang',
      rightChip: locale === 'ar' ? 'العربية' : 'English',
    },
    {
      key: 'support', icon: 'chatbubble-ellipses-outline',
      label: t.support,
      onPress: () => router.push('/support'),
      testID: 'profile-menu-support',
    },
    {
      key: 'help', icon: 'help-circle-outline',
      label: t.helpCenter,
      onPress: () => router.push('/settings/help'),
      testID: 'profile-menu-help',
    },
    {
      key: 'about', icon: 'information-circle-outline',
      label: t.aboutApp,
      onPress: () => router.push('/settings/about'),
      testID: 'profile-menu-about',
    },
  ];

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Profile header */}
        <View style={styles.profileCard}>
          <View style={styles.avatarWrap}>
            <View style={styles.avatar}>
              <Text style={styles.avatarLetter}>
                {(user?.name || (locale === 'ar' ? 'م' : 'U')).charAt(0).toUpperCase()}
              </Text>
            </View>
            <Pressable
              style={styles.editAvatar}
              testID="edit-avatar-btn"
              onPress={() => router.push('/settings/edit-profile')}
            >
              <Ionicons name="create" size={14} color={colors.textOnBrand} />
            </Pressable>
          </View>
          <Text style={styles.userName} testID="profile-user-name">
            {user?.name || (locale === 'ar' ? 'مستخدم' : 'User')}
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
              <Text style={styles.statValue}>{locale === 'ar' ? 'عضو' : 'VIP'}</Text>
              <Text style={styles.statLabel}>VIP</Text>
            </View>
          </View>
        </View>

        {/* Menu */}
        <View style={styles.menu}>
          {menu.map((m, idx) => (
            <Pressable
              key={m.key}
              testID={m.testID}
              style={[styles.menuItem, idx < menu.length - 1 && styles.menuItemBorder]}
              onPress={m.onPress}
            >
              <View style={styles.menuLeft}>
                <View style={styles.menuIconWrap}>
                  <Ionicons name={m.icon} size={20} color={colors.gold} />
                </View>
                <Text style={styles.menuLabel}>{m.label}</Text>
              </View>
              <View style={styles.menuRight}>
                {m.rightChip ? <Text style={styles.chip}>{m.rightChip}</Text> : null}
                <Ionicons
                  name={locale === 'ar' ? 'chevron-back' : 'chevron-forward'}
                  size={20}
                  color={colors.textDisabled}
                />
              </View>
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
          <Text style={styles.version}>{locale === 'ar' ? 'الإصدار' : 'Version'} 1.0.0</Text>
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
  menuRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  chip: {
    color: colors.gold, fontSize: 11, fontWeight: '700',
    paddingHorizontal: 8, paddingVertical: 3,
    backgroundColor: 'rgba(212,164,55,0.1)',
    borderRadius: radius.pill,
    borderWidth: 1, borderColor: 'rgba(212,164,55,0.3)',
  },
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
