/**
 * Hidden owner admin login (phone + password).
 * On success: opens the embedded Web Admin Panel inside a WebView.
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
  ActivityIndicator,
  Alert,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, shadows } from '@/src/theme';
import { adminPhoneLogin } from '@/src/api/client';
import { Button } from '@/src/components/ui';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';
const ADMIN_WEB = `${BACKEND_URL}/api/web-admin/`;

export default function AdminLogin() {
  const [phone, setPhone] = useState('');
  const [pwd, setPwd] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPwd, setShowPwd] = useState(false);
  const [err, setErr] = useState('');

  const submit = async () => {
    setErr('');
    if (!phone.trim() || !pwd) {
      setErr('الرجاء إدخال الرقم وكلمة المرور');
      return;
    }
    setLoading(true);
    try {
      const res = await adminPhoneLogin(phone.trim(), pwd);
      if (res?.success) {
        const tokenQuery = `?t=${encodeURIComponent(res.token)}`;
        // Open the admin web panel
        try {
          await Linking.openURL(ADMIN_WEB + tokenQuery);
          router.replace('/(auth)/welcome');
        } catch {
          Alert.alert(
            'فُتحت لوحة الإدارة',
            `لوحة التحكم متاحة على:\n${ADMIN_WEB}`,
            [{ text: 'حسناً', onPress: () => router.replace('/(auth)/welcome') }]
          );
        }
      }
    } catch (e: any) {
      setErr(e?.response?.data?.detail || 'فشل تسجيل الدخول');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable
          onPress={() => router.back()}
          hitSlop={20}
          style={styles.backBtn}
          testID="admin-back-btn"
        >
          <Ionicons name="chevron-forward" size={24} color={colors.textPrimary} />
        </Pressable>

        <View style={styles.body}>
          <View style={styles.iconBox}>
            <Ionicons name="shield-checkmark" size={36} color={colors.appBg} />
          </View>
          <Text style={styles.title}>دخول الإدارة</Text>
          <Text style={styles.sub}>هذا الدخول مخصص لمالك التطبيق فقط</Text>

          <View style={styles.field}>
            <Ionicons name="call" size={18} color={colors.gold} />
            <TextInput
              placeholder="رقم الهاتف"
              placeholderTextColor={colors.textDisabled}
              keyboardType="phone-pad"
              value={phone}
              onChangeText={setPhone}
              style={styles.input}
              autoCapitalize="none"
              testID="admin-phone-input"
              textAlign="right"
            />
          </View>

          <View style={styles.field}>
            <Ionicons name="lock-closed" size={18} color={colors.gold} />
            <TextInput
              placeholder="كلمة المرور"
              placeholderTextColor={colors.textDisabled}
              value={pwd}
              onChangeText={setPwd}
              style={styles.input}
              secureTextEntry={!showPwd}
              autoCapitalize="none"
              testID="admin-password-input"
              textAlign="right"
            />
            <Pressable onPress={() => setShowPwd((s) => !s)} hitSlop={10}>
              <Ionicons
                name={showPwd ? 'eye-off' : 'eye'}
                size={18}
                color={colors.textSecondary}
              />
            </Pressable>
          </View>

          {err ? (
            <View style={styles.errBox}>
              <Ionicons name="alert-circle" size={16} color={colors.error} />
              <Text style={styles.errText}>{err}</Text>
            </View>
          ) : null}

          <Button
            testID="admin-login-submit"
            label={loading ? '...' : 'دخول الإدارة'}
            onPress={submit}
            loading={loading}
            disabled={!phone.trim() || !pwd}
          />

          <Text style={styles.hint}>
            سيتم فتح لوحة التحكم في المتصفح
          </Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.appBg },
  backBtn: {
    position: 'absolute',
    top: 50,
    right: 16,
    zIndex: 5,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surface1,
    borderWidth: 1,
    borderColor: colors.darkBrown,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { flex: 1, padding: spacing.lg, justifyContent: 'center', gap: spacing.md },
  iconBox: {
    width: 80,
    height: 80,
    borderRadius: 20,
    backgroundColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: spacing.sm,
    ...shadows.card,
  },
  title: {
    color: colors.textPrimary,
    fontSize: 26,
    fontWeight: '700',
    textAlign: 'center',
  },
  sub: { color: colors.textSecondary, textAlign: 'center', marginBottom: spacing.md },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: colors.darkBrown,
  },
  input: { flex: 1, color: colors.textPrimary, fontSize: 16 },
  errBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,69,58,0.1)',
    borderRadius: radius.sm,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(255,69,58,0.3)',
  },
  errText: { color: colors.error, fontSize: 13, flex: 1 },
  hint: { color: colors.textDisabled, fontSize: 12, textAlign: 'center', marginTop: spacing.sm },
});
