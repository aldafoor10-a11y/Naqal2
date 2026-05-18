import React from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { View, StyleSheet, Platform } from 'react-native';
import { colors } from '@/src/theme';

export default function DriverLayout() {
  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarShowLabel: true,
        tabBarActiveTintColor: colors.gold,
        tabBarInactiveTintColor: colors.textDisabled,
        tabBarStyle: styles.tabBar,
        tabBarLabelStyle: styles.tabLabel,
        tabBarIcon: ({ color, focused }) => {
          const map: Record<string, any> = {
            index: focused ? 'speedometer' : 'speedometer-outline',
            earnings: focused ? 'wallet' : 'wallet-outline',
            history: focused ? 'time' : 'time-outline',
            profile: focused ? 'person' : 'person-outline',
          };
          return (
            <View style={[styles.iconWrap, focused && styles.iconWrapActive]}>
              <Ionicons name={map[route.name]} size={22} color={color} />
            </View>
          );
        },
      })}
    >
      <Tabs.Screen name="index" options={{ title: 'الرئيسية', tabBarButtonTestID: 'driver-tab-home' }} />
      <Tabs.Screen name="earnings" options={{ title: 'الأرباح', tabBarButtonTestID: 'driver-tab-earnings' }} />
      <Tabs.Screen name="history" options={{ title: 'الرحلات', tabBarButtonTestID: 'driver-tab-history' }} />
      <Tabs.Screen name="profile" options={{ title: 'حسابي', tabBarButtonTestID: 'driver-tab-profile' }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: colors.surface1,
    borderTopColor: colors.darkBrown,
    borderTopWidth: 1,
    height: Platform.OS === 'ios' ? 88 : 70,
    paddingTop: 8,
  },
  tabLabel: { fontSize: 11, fontWeight: '600', marginTop: 2 },
  iconWrap: { width: 40, height: 32, alignItems: 'center', justifyContent: 'center', borderRadius: 16 },
  iconWrapActive: { backgroundColor: 'rgba(212,164,55,0.12)' },
});
