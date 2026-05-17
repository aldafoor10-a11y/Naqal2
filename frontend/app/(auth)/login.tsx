/**
 * Phone login - enter phone, send OTP
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography, radius } from '@/src/theme';
import { translations } from '@/src/i18n';
import { Button } from '@/src/components/ui';
import { sendOtp } from '@/src/api/client';

export default function Login() {
  const t = translations.ar;
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSend = async () => {
    const clean = phone.replace(/\D/g, '');
    if (clean.length < 9) {
      Alert.alert('رقم غير صحيح', 'يرجى إدخال رقم هاتف صحيح');
      return;
    }
    setLoading(true);
    try {
      const fullPhone = clean.startsWith('964')
        ? '+' + clean
        : clean.startsWith('0')
        ? '+964' + clean.slice(1)
        : '+964' + clean;
      const res = await sendOtp(fullPhone);
      router.push({ pathname: '/(auth)/verify', params: { phone: res.phone } });
    } catch (e: any) {
      Alert.alert('خطأ', e?.response?.data?.detail || 'فشل إرسال الرمز');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.kbd}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Pressable
            onPress={() => router.back()}
            style={styles.backBtn}
            testID="login-back-btn"
            hitSlop={20}
          >
            <Ionicons name="chevron-forward" size={28} color={colors.textPrimary} />
          </Pressable>

          <View style={styles.header}>
            <View style={styles.iconCircle}>
              <Ionicons name="phone-portrait" size={32} color={colors.gold} />
            </View>
            <Text style={styles.title}>{t.loginTitle}</Text>
            <Text style={styles.subtitle}>{t.loginSubtitle}</Text>
          </View>

          <View style={styles.inputWrap}>
            <Text style={styles.label}>{t.phoneLabel}</Text>
            <View style={styles.phoneRow}>
              <View style={styles.countryCode}>
                <Text style={styles.flag}>🇮🇶</Text>
                <Text style={styles.codeText}>+964</Text>
              </View>
              <TextInput
                testID="phone-input"
                value={phone}
                onChangeText={setPhone}
                placeholder={t.phonePlaceholder}
                placeholderTextColor={colors.textDisabled}
                keyboardType="phone-pad"
                style={styles.input}
                maxLength={11}
                autoFocus
              />
            </View>
            <Text style={styles.hint}>سيتم إرسال رمز التحقق على هذا الرقم</Text>
          </View>

          <View style={styles.spacer} />

          <Button
            testID="send-otp-btn"
            label={t.sendCode}
            onPress={handleSend}
            loading={loading}
            disabled={phone.length < 9}
          />

          <Text style={styles.terms}>
            بالمتابعة فإنك توافق على{' '}
            <Text style={styles.termsLink}>شروط الاستخدام</Text> و{' '}
            <Text style={styles.termsLink}>سياسة الخصوصية</Text>
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.appBg },
  kbd: { flex: 1 },
  content: { flexGrow: 1, padding: spacing.lg, paddingTop: spacing.md },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    backgroundColor: colors.surface1,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.darkBrown,
    marginBottom: spacing.lg,
  },
  header: { alignItems: 'flex-start', marginBottom: spacing.xl },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.darkBrown,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  title: { ...typography.h1, color: colors.textPrimary, marginBottom: spacing.xs },
  subtitle: { ...typography.bodyLarge, color: colors.textSecondary },
  inputWrap: { gap: spacing.sm, marginBottom: spacing.lg },
  label: { color: colors.textSecondary, fontSize: 14, fontWeight: '600' },
  phoneRow: {
    flexDirection: 'row',
    backgroundColor: colors.surface1,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.darkBrown,
    overflow: 'hidden',
  },
  countryCode: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface2,
    borderRightWidth: 1,
    borderRightColor: colors.darkBrown,
  },
  flag: { fontSize: 20 },
  codeText: { color: colors.textPrimary, fontWeight: '700', fontSize: 16 },
  input: {
    flex: 1,
    padding: spacing.md,
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'left',
    writingDirection: 'ltr',
  },
  hint: { color: colors.textDisabled, fontSize: 12 },
  spacer: { flex: 1, minHeight: spacing.xl },
  terms: {
    textAlign: 'center',
    color: colors.textDisabled,
    fontSize: 12,
    marginTop: spacing.md,
    lineHeight: 18,
  },
  termsLink: { color: colors.gold, fontWeight: '600' },
});
