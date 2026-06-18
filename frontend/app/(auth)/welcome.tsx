/**
 * Welcome / Splash screen
 */
import React from 'react';
import { View, Text, StyleSheet, ImageBackground, Image, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography, radius, shadows } from '@/src/theme';
import { translations } from '@/src/i18n';
import { Button } from '@/src/components/ui';

const LOGO_URL =
  'https://customer-assets.emergentagent.com/job_eb826b44-ecc6-46f2-b4e7-84a184f8d38a/artifacts/x4ziw5ow_IMG_20260419_223622_456.webp';
const BG_URL =
  'https://static.prod-images.emergentagent.com/jobs/eb826b44-ecc6-46f2-b4e7-84a184f8d38a/images/61df99897cce870648c8537857ad64e46112a9cacab3c03ea5f555a99b86e2bf.png';

export default function Welcome() {
  const t = translations.ar;

  return (
    <View style={styles.root} testID="welcome-screen">
      <ImageBackground source={{ uri: BG_URL }} style={styles.bg} resizeMode="cover">
        <LinearGradient
          colors={['rgba(13,9,7,0.4)', 'rgba(13,9,7,0.85)', colors.appBg]}
          locations={[0, 0.55, 1]}
          style={StyleSheet.absoluteFill}
        />
        <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
          <View style={styles.top}>
            <View style={styles.logoBox}>
              <Image source={{ uri: LOGO_URL }} style={styles.logo} resizeMode="contain" />
            </View>
          </View>

          <View style={styles.bottom}>
            <View style={styles.glow} />
            <Text style={styles.title}>{t.welcomeTitle}</Text>
            <Text style={styles.subtitle}>{t.welcomeSubtitle}</Text>

            <View style={styles.features}>
              <FeaturePill icon="flash" label="نقل سريع" />
              <FeaturePill icon="shield-checkmark" label="نقل آمن" />
              <FeaturePill icon="cash" label="أسعار شفافة" />
            </View>

            <Button
              testID="get-started-btn"
              label={t.getStarted}
              onPress={() => router.push('/(auth)/login')}
            />

            <Pressable onPress={() => router.push('/(auth)/login')} style={styles.signInRow}>
              <Text style={styles.signInText}>
                لديك حساب؟ <Text style={styles.signInLink}>سجل الدخول</Text>
              </Text>
            </Pressable>

            <Pressable
              onPress={() => router.push('/(auth)/admin-login')}
              style={styles.adminRow}
              testID="admin-login-link"
            >
              <Ionicons name="shield-checkmark" size={14} color={colors.gold} />
              <Text style={styles.adminText}>دخول الإدارة</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </ImageBackground>
    </View>
  );
}

function FeaturePill({ icon, label }: { icon: any; label: string }) {
  return (
    <View style={styles.pill}>
      <Ionicons name={icon} size={14} color={colors.gold} />
      <Text style={styles.pillText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.appBg },
  bg: { flex: 1 },
  safe: { flex: 1, justifyContent: 'space-between' },
  top: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: spacing.lg },
  logoBox: {
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: colors.appBg,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.button,
    shadowOpacity: 0.5,
    shadowRadius: 24,
    borderWidth: 1,
    borderColor: colors.darkBrown,
  },
  logo: { width: 160, height: 160 },
  bottom: { padding: spacing.lg, gap: spacing.md },
  glow: {
    position: 'absolute',
    top: -120,
    alignSelf: 'center',
    width: 240,
    height: 240,
    backgroundColor: colors.gold,
    opacity: 0.06,
    borderRadius: 9999,
  },
  title: { ...typography.h1, color: colors.textPrimary, textAlign: 'center' },
  subtitle: {
    ...typography.bodyLarge,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  features: {
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.darkBrown,
  },
  pillText: { color: colors.textPrimary, fontSize: 12, fontWeight: '600' },
  signInRow: { alignItems: 'center', marginTop: spacing.sm },
  signInText: { color: colors.textSecondary, fontSize: 14 },
  signInLink: { color: colors.gold, fontWeight: '700' },
  adminRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: spacing.sm,
    paddingVertical: 8,
    opacity: 0.7,
  },
  adminText: { color: colors.gold, fontSize: 12, fontWeight: '600' },
});
