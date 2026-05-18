/**
 * Support — create new ticket (subject + initial message)
 */
import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, KeyboardAvoidingView, Platform, Alert, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius } from '@/src/theme';
import { ScreenHeader } from '@/src/components/ScreenHeader';
import { Button } from '@/src/components/ui';
import { useLocale } from '@/src/context/LocaleContext';
import { createTicket } from '@/src/api/client';

const SUGGESTIONS_AR = ['مشكلة في الدفع', 'تأخير في التوصيل', 'سؤال عام', 'مشكلة في التطبيق', 'طلب استرداد'];
const SUGGESTIONS_EN = ['Payment issue', 'Late delivery', 'General question', 'App problem', 'Refund request'];

export default function NewTicketScreen() {
  const { t, locale } = useLocale();
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!subject.trim() || !message.trim()) return;
    setLoading(true);
    try {
      const ticket = await createTicket(subject.trim(), message.trim());
      router.replace(`/support/${ticket.id}`);
    } catch (e: any) {
      Alert.alert(t.error, e?.response?.data?.detail || 'Failed');
    } finally {
      setLoading(false);
    }
  };

  const suggestions = locale === 'ar' ? SUGGESTIONS_AR : SUGGESTIONS_EN;

  return (
    <View style={styles.root}>
      <ScreenHeader title={t.newTicket} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.label}>{t.ticketSubject}</Text>
          <TextInput
            value={subject}
            onChangeText={setSubject}
            placeholder={t.ticketSubjectPlaceholder}
            placeholderTextColor={colors.textDisabled}
            style={styles.input}
            maxLength={140}
            testID="ticket-subject-input"
          />
          <View style={styles.suggestionRow}>
            {suggestions.map((s) => (
              <Text
                key={s}
                style={styles.suggestion}
                onPress={() => setSubject(s)}
              >
                {s}
              </Text>
            ))}
          </View>

          <Text style={[styles.label, { marginTop: spacing.md }]}>{t.ticketMessage}</Text>
          <TextInput
            value={message}
            onChangeText={setMessage}
            placeholder={t.ticketMessagePlaceholder}
            placeholderTextColor={colors.textDisabled}
            style={[styles.input, styles.textArea]}
            multiline
            numberOfLines={6}
            textAlignVertical="top"
            testID="ticket-message-input"
          />

          <View style={{ flex: 1 }} />

          <Button
            testID="ticket-submit-btn"
            label={t.sendMessage}
            onPress={submit}
            loading={loading}
            disabled={!subject.trim() || !message.trim()}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.appBg },
  content: { padding: spacing.lg, gap: spacing.xs, flexGrow: 1 },
  label: { color: colors.textSecondary, fontSize: 13 },
  input: {
    backgroundColor: colors.surface1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md, paddingVertical: 12,
    color: colors.textPrimary, fontSize: 15,
    borderWidth: 1, borderColor: colors.darkBrown,
  },
  textArea: { minHeight: 140, textAlignVertical: 'top' },
  suggestionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  suggestion: {
    color: colors.gold, fontSize: 12, fontWeight: '600',
    paddingHorizontal: 10, paddingVertical: 5,
    backgroundColor: 'rgba(212,164,55,0.1)',
    borderRadius: radius.pill,
    borderWidth: 1, borderColor: 'rgba(212,164,55,0.3)',
  },
});
