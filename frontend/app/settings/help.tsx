/**
 * Help center — FAQ-style content + jump-to-Support shortcut
 */
import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, LayoutAnimation, Platform, UIManager } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { colors, spacing, radius } from '@/src/theme';
import { ScreenHeader } from '@/src/components/ScreenHeader';
import { useLocale } from '@/src/context/LocaleContext';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const FAQ_AR = [
  { q: 'كيف أطلب خدمة نقل؟', a: 'اذهب إلى الرئيسية، اختر نوع الخدمة، حدد موقعي الانطلاق والوصول على الخريطة، أضف وصف الحمولة، ثم اضغط تأكيد الطلب.' },
  { q: 'كيف يتم احتساب السعر؟', a: 'يتم احتساب السعر تلقائياً بناءً على المسافة ونوع المركبة. للمسافات أكثر من 75 كم، يبلغ الحد الأقصى 75,000 د.ع. وما فوق 130 كم يتطلب موافقة الإدارة يدوياً.' },
  { q: 'ما هي طرق الدفع المتاحة؟', a: 'حالياً نقبل الدفع النقدي عند الاستلام، وقريباً سيتم تفعيل الدفع عبر زين كاش.' },
  { q: 'هل يمكنني إلغاء الطلب؟', a: 'نعم، يمكنك إلغاء الطلب قبل أن يبدأ السائق برحلة التوصيل من شاشة التتبع.' },
  { q: 'كيف أتواصل مع الدعم؟', a: 'يمكنك فتح تذكرة دعم مباشرة من قسم الدعم الفني في حسابك، وسيرد عليك أحد المسؤولين في أقرب وقت.' },
];
const FAQ_EN = [
  { q: 'How do I book a transport?', a: 'Open Home, choose a service type, set pickup & drop-off on the map, describe your cargo, then confirm the order.' },
  { q: 'How is the price calculated?', a: 'Price is computed automatically from distance and vehicle type. Above 75km the price is capped at 75,000 IQD. Above 130km the order is sent to admin for manual approval.' },
  { q: 'Which payment methods are supported?', a: 'Cash on delivery is supported today. Zain Cash will be available soon.' },
  { q: 'Can I cancel my order?', a: 'Yes, you can cancel from the tracking screen as long as the driver has not started the trip yet.' },
  { q: 'How do I reach support?', a: 'Open Profile → Support, create a new ticket and an admin will reply shortly.' },
];

export default function HelpScreen() {
  const { t, locale } = useLocale();
  const faqs = locale === 'ar' ? FAQ_AR : FAQ_EN;
  const [open, setOpen] = useState<number | null>(0);

  const toggle = (i: number) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpen(open === i ? null : i);
  };

  return (
    <View style={styles.root}>
      <ScreenHeader title={t.helpCenter} />
      <ScrollView contentContainerStyle={styles.content}>
        <Pressable
          onPress={() => router.push('/support')}
          style={styles.cta}
          testID="help-open-support"
        >
          <View style={styles.ctaIcon}>
            <Ionicons name="headset" size={24} color={colors.appBg} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.ctaTitle}>{t.contactAdmin}</Text>
            <Text style={styles.ctaSub}>
              {locale === 'ar' ? 'تواصل مباشرة مع فريق الدعم' : 'Chat directly with our team'}
            </Text>
          </View>
          <Ionicons name={locale === 'ar' ? 'chevron-back' : 'chevron-forward'} size={22} color={colors.appBg} />
        </Pressable>

        <Text style={styles.section}>
          {locale === 'ar' ? 'الأسئلة الشائعة' : 'Frequently Asked Questions'}
        </Text>

        {faqs.map((f, i) => {
          const isOpen = open === i;
          return (
            <Pressable key={i} onPress={() => toggle(i)} style={styles.qa} testID={`faq-${i}`}>
              <View style={styles.qRow}>
                <Text style={styles.q}>{f.q}</Text>
                <Ionicons name={isOpen ? 'chevron-up' : 'chevron-down'} size={20} color={colors.gold} />
              </View>
              {isOpen ? <Text style={styles.a}>{f.a}</Text> : null}
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.appBg },
  content: { padding: spacing.lg, gap: spacing.sm, paddingBottom: spacing.xxl },
  cta: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    backgroundColor: colors.gold, borderRadius: radius.md, padding: spacing.md,
    marginBottom: spacing.sm,
  },
  ctaIcon: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  ctaTitle: { color: colors.appBg, fontWeight: '700', fontSize: 16 },
  ctaSub: { color: colors.appBg, fontSize: 12, opacity: 0.85, marginTop: 2 },
  section: { color: colors.textPrimary, fontWeight: '700', fontSize: 16, marginTop: spacing.md, marginBottom: spacing.xs },
  qa: {
    backgroundColor: colors.surface1,
    borderRadius: radius.md, padding: spacing.md,
    borderWidth: 1, borderColor: colors.darkBrown,
  },
  qRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm },
  q: { color: colors.textPrimary, fontWeight: '700', fontSize: 14, flex: 1 },
  a: { color: colors.textSecondary, fontSize: 13, marginTop: spacing.sm, lineHeight: 20 },
});
