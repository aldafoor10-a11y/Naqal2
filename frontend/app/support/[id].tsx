/**
 * Support ticket chat screen
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, Pressable, KeyboardAvoidingView, Platform,
  ActivityIndicator, FlatList, Alert,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius } from '@/src/theme';
import { ScreenHeader } from '@/src/components/ScreenHeader';
import { useLocale } from '@/src/context/LocaleContext';
import { useAuth } from '@/src/context/AuthContext';
import { getTicket, postTicketMessage } from '@/src/api/client';

const STATUS_COLOR: Record<string, string> = {
  open: '#34C759', pending: '#FFCC00', resolved: '#0A84FF', closed: '#8E8E93',
};

export default function TicketChat() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useLocale();
  const { user } = useAuth();
  const [ticket, setTicket] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const listRef = useRef<FlatList>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    try {
      const tk = await getTicket(id as string);
      setTicket(tk);
    } catch (e: any) {
      console.warn(e);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
    pollRef.current = setInterval(load, 5000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [load]);

  useEffect(() => {
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80);
  }, [ticket?.messages?.length]);

  const send = async () => {
    const msg = text.trim();
    if (!msg) return;
    setSending(true);
    setText('');
    try {
      const tk = await postTicketMessage(id as string, msg);
      setTicket(tk);
    } catch (e: any) {
      Alert.alert(t.error, e?.response?.data?.detail || 'Failed');
      setText(msg); // restore
    } finally {
      setSending(false);
    }
  };

  const statusLabel = (s: string) => {
    switch (s) {
      case 'open': return t.ticketStatusOpen;
      case 'pending': return t.ticketStatusPending;
      case 'resolved': return t.ticketStatusResolved;
      case 'closed': return t.ticketStatusClosed;
      default: return s;
    }
  };

  if (loading) {
    return (
      <View style={styles.root}>
        <ScreenHeader title={t.support} />
        <View style={styles.loader}><ActivityIndicator color={colors.gold} size="large" /></View>
      </View>
    );
  }

  if (!ticket) {
    return (
      <View style={styles.root}>
        <ScreenHeader title={t.support} />
        <View style={styles.loader}><Text style={{ color: colors.textSecondary }}>{t.error}</Text></View>
      </View>
    );
  }

  const headerRight = (
    <View style={[styles.statusPill, { backgroundColor: STATUS_COLOR[ticket.status] + '22', borderColor: STATUS_COLOR[ticket.status] }]}>
      <Text style={[styles.statusText, { color: STATUS_COLOR[ticket.status] }]}>{statusLabel(ticket.status)}</Text>
    </View>
  );

  return (
    <View style={styles.root}>
      <ScreenHeader title={ticket.subject} subtitle={`#${ticket.id.slice(0, 8)}`} right={headerRight} />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <FlatList
          ref={listRef}
          data={ticket.messages || []}
          keyExtractor={(m) => m.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => {
            const mine = item.author?.id === user?.id;
            return (
              <View style={[styles.row, mine ? styles.rowMine : styles.rowTheirs]}>
                {!mine ? (
                  <View style={styles.avatar}>
                    <Ionicons
                      name={item.author?.role === 'admin' ? 'shield-checkmark' : 'person'}
                      size={14}
                      color={colors.appBg}
                    />
                  </View>
                ) : null}
                <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs]}>
                  {!mine ? (
                    <Text style={styles.author}>{item.author?.role === 'admin' ? (t.support) : (item.author?.name || '')}</Text>
                  ) : null}
                  <Text style={mine ? styles.textMine : styles.textTheirs}>{item.text}</Text>
                  <Text style={[styles.time, mine ? styles.timeMine : styles.timeTheirs]}>
                    {new Date(item.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                </View>
              </View>
            );
          }}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
        />

        <View style={styles.composer}>
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder={t.typeMessage}
            placeholderTextColor={colors.textDisabled}
            style={styles.input}
            multiline
            maxLength={1000}
            testID="ticket-reply-input"
          />
          <Pressable
            onPress={send}
            disabled={!text.trim() || sending}
            style={[styles.sendBtn, (!text.trim() || sending) && { opacity: 0.5 }]}
            testID="ticket-reply-send"
          >
            {sending ? (
              <ActivityIndicator color={colors.appBg} />
            ) : (
              <Ionicons name="send" size={20} color={colors.appBg} />
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.appBg },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  statusPill: {
    paddingHorizontal: spacing.sm, paddingVertical: 3,
    borderRadius: radius.pill, borderWidth: 1,
  },
  statusText: { fontSize: 11, fontWeight: '700' },
  list: { padding: spacing.md, gap: spacing.sm, paddingBottom: spacing.lg },
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: 6, maxWidth: '88%' },
  rowMine: { alignSelf: 'flex-end' },
  rowTheirs: { alignSelf: 'flex-start' },
  avatar: { width: 26, height: 26, borderRadius: 13, backgroundColor: colors.gold, alignItems: 'center', justifyContent: 'center' },
  bubble: { borderRadius: radius.md, padding: spacing.sm, paddingHorizontal: 12 },
  bubbleMine: { backgroundColor: colors.gold, borderBottomRightRadius: 4 },
  bubbleTheirs: { backgroundColor: colors.surface1, borderWidth: 1, borderColor: colors.darkBrown, borderBottomLeftRadius: 4 },
  author: { color: colors.gold, fontSize: 11, fontWeight: '700', marginBottom: 2 },
  textMine: { color: colors.appBg, fontSize: 14 },
  textTheirs: { color: colors.textPrimary, fontSize: 14 },
  time: { fontSize: 10, marginTop: 2, alignSelf: 'flex-end' },
  timeMine: { color: 'rgba(0,0,0,0.55)' },
  timeTheirs: { color: colors.textDisabled },
  composer: {
    flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm,
    padding: spacing.sm,
    borderTopWidth: 1, borderTopColor: colors.darkBrown,
    backgroundColor: colors.surface1,
  },
  input: {
    flex: 1,
    minHeight: 40, maxHeight: 120,
    backgroundColor: colors.surface2,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    color: colors.textPrimary, fontSize: 14,
    borderWidth: 1, borderColor: colors.darkBrown,
  },
  sendBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: colors.gold,
    alignItems: 'center', justifyContent: 'center',
  },
});
