/**
 * Language selection screen (Arabic / English)
 */
import React from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { colors, spacing, radius } from '@/src/theme';
import { ScreenHeader } from '@/src/components/ScreenHeader';
import { useLocale } from '@/src/context/LocaleContext';

export default function LanguageScreen() {
  const { locale, t, setLocale } = useLocale();

  const choose = async (l: 'ar' | 'en') => {
    await setLocale(l);
    // Tiny feedback then go back
    setTimeout(() => router.back(), 200);
  };

  const langs: { code: 'ar' | 'en'; label: string; native: string }[] = [
    { code: 'ar', label: t.arabic, native: 'العربية' },
    { code: 'en', label: t.english, native: 'English' },
  ];

  return (
    <View style={styles.root}>
      <ScreenHeader title={t.chooseLanguage} />
      <ScrollView contentContainerStyle={styles.content}>
        {langs.map((l) => {
          const active = locale === l.code;
          return (
            <Pressable
              key={l.code}
              onPress={() => choose(l.code)}
              style={[styles.row, active && styles.rowActive]}
              testID={`lang-${l.code}`}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>{l.native}</Text>
                <Text style={styles.sub}>{l.label}</Text>
              </View>
              {active ? (
                <Ionicons name="checkmark-circle" size={26} color={colors.gold} />
              ) : (
                <View style={styles.dot} />
              )}
            </Pressable>
          );
        })}
        <View style={styles.note}>
          <Ionicons name="information-circle" size={16} color={colors.info} />
          <Text style={styles.noteText}>
            {locale === 'ar'
              ? 'يتم تغيير اللغة فوراً. اتجاه الواجهة الافتراضي هو RTL.'
              : 'Language changes apply instantly. Layout direction stays RTL by design.'}
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.appBg },
  content: { padding: spacing.lg, gap: spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface1,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.darkBrown,
    gap: spacing.md,
  },
  rowActive: { borderColor: colors.gold, backgroundColor: 'rgba(212,164,55,0.06)' },
  label: { color: colors.textPrimary, fontSize: 18, fontWeight: '700' },
  sub: { color: colors.textSecondary, fontSize: 13, marginTop: 2 },
  dot: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: colors.darkBrown },
  note: {
    flexDirection: 'row', alignItems: 'flex-start', gap: spacing.xs,
    backgroundColor: 'rgba(10,132,255,0.08)',
    borderRadius: radius.sm,
    padding: spacing.sm,
    borderWidth: 1, borderColor: 'rgba(10,132,255,0.3)',
    marginTop: spacing.md,
  },
  noteText: { color: colors.textPrimary, fontSize: 12, flex: 1 },
});
