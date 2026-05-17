/**
 * Register - name entry for new users
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography, radius } from '@/src/theme';
import { translations } from '@/src/i18n';
import { Button } from '@/src/components/ui';
import { updateProfile } from '@/src/api/client';
import { useAuth } from '@/src/context/AuthContext';

export default function Register() {
  const t = translations.ar;
  const { refresh } = useAuth();
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);

  const handleContinue = async () => {
    if (!name.trim()) return;
    setLoading(true);
    try {
      await updateProfile(name.trim());
      await refresh();
      router.replace('/(tabs)');
    } catch (e: any) {
      Alert.alert('خطأ', e?.response?.data?.detail || 'فشل حفظ الاسم');
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
        <View style={styles.content}>
          <View style={styles.header}>
            <View style={styles.iconCircle}>
              <Ionicons name="person" size={32} color={colors.gold} />
            </View>
            <Text style={styles.title}>{t.registerTitle}</Text>
            <Text style={styles.subtitle}>دعنا نتعرف عليك أكثر</Text>
          </View>

          <View style={styles.inputWrap}>
            <Text style={styles.label}>{t.nameLabel}</Text>
            <TextInput
              testID="name-input"
              value={name}
              onChangeText={setName}
              placeholder={t.namePlaceholder}
              placeholderTextColor={colors.textDisabled}
              style={styles.input}
              autoFocus
            />
          </View>

          <View style={styles.spacer} />

          <Button
            testID="continue-btn"
            label={t.continue}
            onPress={handleContinue}
            loading={loading}
            disabled={!name.trim()}
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.appBg },
  kbd: { flex: 1 },
  content: { flex: 1, padding: spacing.lg, paddingTop: spacing.xl },
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
  inputWrap: { gap: spacing.sm },
  label: { color: colors.textSecondary, fontSize: 14, fontWeight: '600' },
  input: {
    backgroundColor: colors.surface1,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.darkBrown,
    padding: spacing.md,
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: '600',
  },
  spacer: { flex: 1 },
});
