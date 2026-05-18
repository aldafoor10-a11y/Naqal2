/**
 * Edit profile name
 */
import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { router } from 'expo-router';
import { colors, spacing, radius } from '@/src/theme';
import { ScreenHeader } from '@/src/components/ScreenHeader';
import { useLocale } from '@/src/context/LocaleContext';
import { useAuth } from '@/src/context/AuthContext';
import { updateProfile } from '@/src/api/client';
import { Button } from '@/src/components/ui';

export default function EditProfileScreen() {
  const { t } = useLocale();
  const { user, refresh } = useAuth();
  const [name, setName] = useState(user?.name || '');
  const [loading, setLoading] = useState(false);

  const save = async () => {
    if (!name.trim()) return;
    setLoading(true);
    try {
      await updateProfile(name.trim());
      await refresh();
      router.back();
    } catch (e: any) {
      Alert.alert(t.error, e?.response?.data?.detail || 'Failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.root}>
      <ScreenHeader title={t.editProfile} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={styles.content}>
          <Text style={styles.label}>{t.nameLabel}</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            style={styles.input}
            placeholder={t.namePlaceholder}
            placeholderTextColor={colors.textDisabled}
            autoFocus
            testID="edit-name-input"
          />
          <View style={{ flex: 1 }} />
          <Button
            testID="edit-name-save-btn"
            label={t.saveChanges}
            onPress={save}
            loading={loading}
            disabled={!name.trim() || name.trim() === user?.name}
          />
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.appBg },
  content: { flex: 1, padding: spacing.lg, gap: spacing.sm },
  label: { color: colors.textSecondary, fontSize: 13 },
  input: {
    backgroundColor: colors.surface1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    color: colors.textPrimary,
    fontSize: 16,
    borderWidth: 1, borderColor: colors.darkBrown,
    textAlign: 'right',
  },
});
