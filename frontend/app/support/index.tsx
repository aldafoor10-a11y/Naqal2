/**
 * Support — tickets list (customer)
 */
import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, RefreshControl, ActivityIndicator } from 'react-native';
import { useFocusEffect, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius } from '@/src/theme';
import { ScreenHeader } from '@/src/components/ScreenHeader';
import { useLocale } from '@/src/context/LocaleContext';
import { listMyTickets } from '@/src/api/client';

type Ticket = {
  id: string;
  subject: string;
  status: 'open' | 'pending' | 'resolved' | 'closed';
  last_message_preview: string;
  last_message_at: string;
  unread_for_customer?: number;
};

const STATUS_COLOR: Record<string, string> = {
  open: '#34C759',
  pending: '#FFCC00',
  resolved: '#0A84FF',
  closed: '#8E8E93',
};

export default function SupportList() {
  const { t } = useLocale();
  const [items, setItems] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const list = await listMyTickets();
      setItems(list || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const statusLabel = (s: string) => {
    switch (s) {
      case 'open': return t.ticketStatusOpen;
      case 'pending': return t.ticketStatusPending;
      case 'resolved': return t.ticketStatusResolved;
      case 'closed': return t.ticketStatusClosed;
      default: return s;
    }
  };

  return (
    <View style={styles.root}>
      <ScreenHeader
        title={t.support}
        right={
          <Pressable
            onPress={() => router.push('/support/new')}
            style={styles.newBtn}
            testID="support-new-btn"
          >
            <Ionicons name="add" size={22} color={colors.appBg} />
          </Pressable>
        }
      />
      {loading ? (
        <View style={styles.loader}><ActivityIndicator color={colors.gold} size="large" /></View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(i) => i.id}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }}
              tintColor={colors.gold}
            />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="chatbubble-ellipses-outline" size={56} color={colors.textDisabled} />
              <Text style={styles.emptyTitle}>{t.noTickets}</Text>
              <Text style={styles.emptyDesc}>{t.noTicketsDesc}</Text>
              <Pressable
                onPress={() => router.push('/support/new')}
                style={styles.emptyCta}
                testID="support-empty-new"
              >
                <Ionicons name="add" size={18} color={colors.appBg} />
                <Text style={styles.emptyCtaText}>{t.newTicket}</Text>
              </Pressable>
            </View>
          }
          renderItem={({ item }) => (
            <Pressable
              onPress={() => router.push(`/support/${item.id}`)}
              style={styles.card}
              testID={`ticket-${item.id}`}
            >
              <View style={styles.cardTop}>
                <Text style={styles.subject} numberOfLines={1}>{item.subject}</Text>
                <View style={[styles.statusPill, { backgroundColor: STATUS_COLOR[item.status] + '22', borderColor: STATUS_COLOR[item.status] }]}>
                  <Text style={[styles.statusText, { color: STATUS_COLOR[item.status] }]}>
                    {statusLabel(item.status)}
                  </Text>
                </View>
              </View>
              <Text style={styles.preview} numberOfLines={2}>{item.last_message_preview}</Text>
              <View style={styles.cardFoot}>
                <Text style={styles.time}>
                  {new Date(item.last_message_at).toLocaleString()}
                </Text>
                {item.unread_for_customer && item.unread_for_customer > 0 ? (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{item.unread_for_customer}</Text>
                  </View>
                ) : null}
              </View>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.appBg },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  newBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: colors.gold,
    alignItems: 'center', justifyContent: 'center',
  },
  list: { padding: spacing.lg, gap: spacing.md, flexGrow: 1 },
  empty: { alignItems: 'center', paddingTop: spacing.xxl, gap: spacing.sm },
  emptyTitle: { color: colors.textPrimary, fontWeight: '700', fontSize: 16 },
  emptyDesc: { color: colors.textSecondary, fontSize: 13, textAlign: 'center', paddingHorizontal: spacing.lg },
  emptyCta: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: colors.gold,
    paddingHorizontal: spacing.lg, paddingVertical: 12,
    borderRadius: radius.pill, marginTop: spacing.md,
  },
  emptyCtaText: { color: colors.appBg, fontWeight: '700' },
  card: {
    backgroundColor: colors.surface1,
    borderRadius: radius.md, padding: spacing.md,
    borderWidth: 1, borderColor: colors.darkBrown,
    gap: 6,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm },
  subject: { color: colors.textPrimary, fontWeight: '700', fontSize: 15, flex: 1 },
  statusPill: {
    paddingHorizontal: spacing.sm, paddingVertical: 3,
    borderRadius: radius.pill, borderWidth: 1,
  },
  statusText: { fontSize: 11, fontWeight: '700' },
  preview: { color: colors.textSecondary, fontSize: 13 },
  cardFoot: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
  time: { color: colors.textDisabled, fontSize: 11 },
  badge: { backgroundColor: colors.gold, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  badgeText: { color: colors.appBg, fontWeight: '700', fontSize: 11 },
});
