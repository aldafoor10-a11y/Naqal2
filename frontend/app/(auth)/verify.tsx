/**
 * OTP verification screen
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography, radius } from '@/src/theme';
import { translations } from '@/src/i18n';
import { Button } from '@/src/components/ui';
import { sendOtp, verifyOtp } from '@/src/api/client';
import { useAuth } from '@/src/context/AuthContext';

const OTP_LEN = 6;

export default function Verify() {
  const t = translations.ar;
  const { phone } = useLocalSearchParams<{ phone: string }>();
  const { refresh } = useAuth();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendIn, setResendIn] = useState(45);
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (resendIn <= 0) return;
    const id = setInterval(() => setResendIn((s) => s - 1), 1000);
    return () => clearInterval(id);
  }, [resendIn]);

  const handleVerify = async (codeToUse?: string) => {
    const c = codeToUse ?? code;
    if (c.length < OTP_LEN) return;
    setLoading(true);
    try {
      const res = await verifyOtp(phone as string, c);
      await refresh();
      if (res.user_type === 'driver') {
        router.replace('/(driver)');
      } else if (res.needs_name) {
        router.replace('/(auth)/register');
      } else {
        router.replace('/(tabs)');
      }
    } catch (e: any) {
      Alert.alert('خطأ', e?.response?.data?.detail || 'الرمز غير صحيح');
      setCode('');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    try {
      await sendOtp(phone as string);
      setResendIn(45);
      Alert.alert('تم', 'تم إرسال رمز جديد');
    } catch {
      Alert.alert('خطأ', 'فشل إرسال الرمز');
    }
  };

  const digits = Array.from({ length: OTP_LEN }).map((_, i) => code[i] || '');

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.kbd}
      >
        <View style={styles.content}>
          <Pressable
            onPress={() => router.back()}
            style={styles.backBtn}
            testID="verify-back-btn"
            hitSlop={20}
          >
            <Ionicons name="chevron-forward" size={28} color={colors.textPrimary} />
          </Pressable>

          <View style={styles.header}>
            <View style={styles.iconCircle}>
              <Ionicons name="shield-checkmark" size={32} color={colors.gold} />
            </View>
            <Text style={styles.title}>{t.otpTitle}</Text>
            <Text style={styles.subtitle}>
              {t.otpSubtitle} <Text style={styles.phone}>{phone}</Text>
            </Text>
          </View>

          <Pressable
            onPress={() => inputRef.current?.focus()}
            style={styles.otpRow}
            testID="otp-row"
          >
            {digits.map((d, i) => (
              <View
                key={i}
                style={[
                  styles.otpBox,
                  code.length === i && styles.otpBoxActive,
                  d !== '' && styles.otpBoxFilled,
                ]}
              >
                <Text style={styles.otpDigit}>{d}</Text>
              </View>
            ))}
          </Pressable>

          {/* Hidden input that captures actual input */}
          <TextInput
            ref={inputRef}
            value={code}
            onChangeText={(v) => {
              const cleaned = v.replace(/\D/g, '').slice(0, OTP_LEN);
              setCode(cleaned);
              if (cleaned.length === OTP_LEN) handleVerify(cleaned);
            }}
            keyboardType="number-pad"
            maxLength={OTP_LEN}
            style={styles.hiddenInput}
            testID="otp-input"
            autoFocus
          />

          <View style={styles.demoHint}>
            <Ionicons name="information-circle" size={14} color={colors.gold} />
            <Text style={styles.demoText}>{t.demoOtpHint}</Text>
          </View>

          <View style={styles.spacer} />

          <Button
            testID="verify-otp-btn"
            label={t.verifyCode}
            onPress={() => handleVerify()}
            loading={loading}
            disabled={code.length < OTP_LEN}
          />

          <View style={styles.resendRow}>
            <Text style={styles.resendText}>{t.didntReceive}</Text>
            {resendIn > 0 ? (
              <Text style={styles.resendDisabled}>إعادة الإرسال خلال {resendIn} ثانية</Text>
            ) : (
              <Pressable onPress={handleResend} testID="resend-otp-btn">
                <Text style={styles.resendLink}>{t.resendCode}</Text>
              </Pressable>
            )}
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.appBg },
  kbd: { flex: 1 },
  content: { flex: 1, padding: spacing.lg, paddingTop: spacing.md },
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
  phone: { color: colors.gold, fontWeight: '700' },
  otpRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  otpBox: {
    width: 48,
    height: 56,
    borderRadius: radius.md,
    backgroundColor: colors.surface1,
    borderWidth: 1.5,
    borderColor: colors.darkBrown,
    alignItems: 'center',
    justifyContent: 'center',
  },
  otpBoxActive: { borderColor: colors.gold },
  otpBoxFilled: { backgroundColor: colors.surface2, borderColor: colors.goldDark },
  otpDigit: { color: colors.textPrimary, fontSize: 24, fontWeight: '700' },
  hiddenInput: {
    position: 'absolute',
    opacity: 0,
    height: 1,
    width: 1,
  },
  demoHint: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    backgroundColor: 'rgba(212,164,55,0.08)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    alignSelf: 'center',
  },
  demoText: { color: colors.gold, fontSize: 12, fontWeight: '600' },
  spacer: { flex: 1 },
  resendRow: { alignItems: 'center', marginTop: spacing.md, gap: spacing.xs },
  resendText: { color: colors.textSecondary, fontSize: 14 },
  resendDisabled: { color: colors.textDisabled, fontSize: 14 },
  resendLink: { color: colors.gold, fontWeight: '700', fontSize: 14 },
});
