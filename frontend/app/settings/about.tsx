/**
 * About app screen (Information)
 */
import React from 'react';
import { View, Text, StyleSheet, ScrollView, Image, Linking, Pressable, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius } from '@/src/theme';
import { ScreenHeader } from '@/src/components/ScreenHeader';
import { useLocale } from '@/src/context/LocaleContext';
import Constants from 'expo-constants';

const LOGO_URL =
  'https://customer-assets.emergentagent.com/job_eb826b44-ecc6-46f2-b4e7-84a184f8d38a/artifacts/x4ziw5ow_IMG_20260419_223622_456.webp';

export default function AboutScreen() {
  const { t, locale } = useLocale();
  const version = Constants.expoConfig?.version || '1.0.0';

  const facts = locale === 'ar'
    ? [
        { icon: 'location', label: 'الموصل، العراق' },
        { icon: 'phone-portrait', label: 'تطبيق أصلي لنظامي iOS و Android' },
        { icon: 'shield-checkmark', label: 'سائقون معتمدون من الإدارة' },
        { icon: 'flash', label: 'تسعير فوري وذكي' },
      ]
    : [
        { icon: 'location', label: 'Mosul, Iraq' },
        { icon: 'phone-portrait', label: 'Native iOS & Android app' },
        { icon: 'shield-checkmark', label: 'Admin-vetted drivers' },
        { icon: 'flash', label: 'Smart instant pricing' },
      ];

  const aboutText = locale === 'ar'
    ? 'نقل قو هي منصة نقل ذكية تربط الزبائن بالسائقين عبر خرائط تفاعلية وأسعار آلية شفافة. تعتمد المنصة على تقنيات حديثة لضمان توصيل سريع وآمن للأثاث والبضائع والأجهزة في مدينة الموصل والمدن المجاورة.'
    : 'Naqal Go is a smart transportation marketplace connecting customers and drivers in Mosul via an interactive map and transparent automatic pricing. Built on modern infrastructure to safely move furniture, goods and appliances across Iraq.';

  return (
    <View style={styles.root}>
      <ScreenHeader title={t.aboutApp} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <Image source={{ uri: LOGO_URL }} style={styles.logo} resizeMode="contain" />
          <Text style={styles.name}>{t.appName}</Text>
          <Text style={styles.tagline}>{t.tagline}</Text>
          <View style={styles.versionPill}>
            <Text style={styles.versionText}>v{version}</Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.body}>{aboutText}</Text>
        </View>

        <View style={styles.factsCard}>
          {facts.map((f, i) => (
            <View key={i} style={[styles.factRow, i < facts.length - 1 && styles.factBorder]}>
              <View style={styles.factIcon}>
                <Ionicons name={f.icon as any} size={18} color={colors.gold} />
              </View>
              <Text style={styles.factLabel}>{f.label}</Text>
            </View>
          ))}
        </View>

        <Pressable
          style={styles.linkRow}
          onPress={() => Linking.openURL('mailto:support@naqalgo.iq')}
          testID="contact-email"
        >
          <Ionicons name="mail" size={18} color={colors.gold} />
          <Text style={styles.linkText}>support@naqalgo.iq</Text>
        </Pressable>

        <Text style={styles.footerNote}>
          {locale === 'ar' ? '© 2026 نقل قو. جميع الحقوق محفوظة.' : '© 2026 Naqal Go. All rights reserved.'}
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.appBg },
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },
  hero: { alignItems: 'center', gap: spacing.xs, paddingVertical: spacing.lg },
  logo: { width: 88, height: 88, marginBottom: spacing.sm },
  name: { color: colors.textPrimary, fontWeight: '700', fontSize: 26 },
  tagline: { color: colors.textSecondary, fontSize: 13 },
  versionPill: {
    marginTop: spacing.sm,
    paddingHorizontal: spacing.md, paddingVertical: 4,
    backgroundColor: colors.surface1,
    borderRadius: radius.pill,
    borderWidth: 1, borderColor: colors.gold,
  },
  versionText: { color: colors.gold, fontWeight: '700', fontSize: 12 },
  card: {
    backgroundColor: colors.surface1,
    borderRadius: radius.md, padding: spacing.md,
    borderWidth: 1, borderColor: colors.darkBrown,
  },
  body: { color: colors.textPrimary, fontSize: 14, lineHeight: 22 },
  factsCard: {
    backgroundColor: colors.surface1,
    borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.darkBrown,
    overflow: 'hidden',
  },
  factRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md },
  factBorder: { borderBottomWidth: 1, borderBottomColor: colors.darkBrown },
  factIcon: {
    width: 36, height: 36, borderRadius: 12,
    backgroundColor: 'rgba(212,164,55,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  factLabel: { color: colors.textPrimary, fontSize: 14, flex: 1 },
  linkRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.surface1,
    borderRadius: radius.md, padding: spacing.md,
    borderWidth: 1, borderColor: colors.darkBrown,
  },
  linkText: { color: colors.gold, fontWeight: '700', fontSize: 14 },
  footerNote: {
    color: colors.textDisabled, fontSize: 12, textAlign: 'center', marginTop: spacing.md,
  },
});
