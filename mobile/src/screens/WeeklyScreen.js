/**
 * Haftalik plan ekrani.
 * Secilen planin haftalik tablosunu ve gunluk rota kartlarini gosterir.
 * Bir gune tiklayinca DailyMap ekranina gider.
 */
import { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import api from '../api/client';

const DAY_NAMES = {
  1: 'Pazartesi', 2: 'Sali', 3: 'Carsamba',
  4: 'Persembe', 5: 'Cuma', 6: 'Cumartesi'
};
const DAY_SHORT = { 1: 'Pzt', 2: 'Sal', 3: 'Car', 4: 'Per', 5: 'Cum', 6: 'Cmt' };

export default function WeeklyScreen({ route, navigation }) {
  const { planId, planName } = route.params;
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    navigation.setOptions({ title: planName || 'Planim' });
    loadPlan();
  }, [planId]);

  async function loadPlan() {
    try {
      const response = await api.get(`/api/plans/${planId}/my-plan`);
      setData(response.data);
    } catch (error) {
      console.error('MyPlan error:', error?.response?.data || error.message);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#6366f1" />
        <Text style={styles.loadingText}>Plan yukleniyor...</Text>
      </View>
    );
  }

  if (!data) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyText}>Plan verisi yuklenemedi</Text>
      </View>
    );
  }

  const totalCustomers = data.clusters?.length || 0;
  const totalVisits = data.weekly_plan?.length || 0;
  const totalDistance = (data.routes || []).reduce(
    (s, r) => s + (r.total_distance || 0), 0
  );
  const totalTime = (data.routes || []).reduce(
    (s, r) => s + (r.total_time_minutes || 0), 0
  );

  // Hangi gunlerde rota var
  const days = [...new Set((data.weekly_plan || []).map((w) => w.day_of_week))].sort();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Ozet kartlari */}
      <View style={styles.kpiGrid}>
        <View style={styles.kpiCard}>
          <Text style={styles.kpiValue}>{totalCustomers}</Text>
          <Text style={styles.kpiLabel}>Musteri</Text>
        </View>
        <View style={styles.kpiCard}>
          <Text style={styles.kpiValue}>{totalVisits}</Text>
          <Text style={styles.kpiLabel}>Ziyaret</Text>
        </View>
        <View style={styles.kpiCard}>
          <Text style={styles.kpiValue}>{totalDistance.toFixed(0)}<Text style={styles.kpiUnit}> km</Text></Text>
          <Text style={styles.kpiLabel}>Mesafe</Text>
        </View>
        <View style={styles.kpiCard}>
          <Text style={styles.kpiValue}>{Math.round(totalTime)}<Text style={styles.kpiUnit}> dk</Text></Text>
          <Text style={styles.kpiLabel}>Sure</Text>
        </View>
      </View>

      {/* Gunluk rotalar */}
      <Text style={styles.sectionTitle}>Gunluk Rotalar</Text>
      {days.length === 0 ? (
        <Text style={styles.emptyText}>Bu plan icin gunluk rota yok</Text>
      ) : (
        days.map((day) => {
          const dayCount = (data.weekly_plan || []).filter(
            (w) => w.day_of_week === day
          ).length;
          const route = (data.routes || []).find((r) => r.day_of_week === day);

          return (
            <TouchableOpacity
              key={day}
              style={styles.dayCard}
              onPress={() =>
                navigation.navigate('DailyMap', {
                  planId,
                  day,
                  dayName: DAY_NAMES[day],
                })
              }
            >
              <View style={styles.dayBadge}>
                <Text style={styles.dayBadgeText}>{DAY_SHORT[day]}</Text>
              </View>
              <View style={styles.dayContent}>
                <Text style={styles.dayTitle}>{DAY_NAMES[day]}</Text>
                <Text style={styles.dayMeta}>
                  {dayCount} musteri
                  {route?.total_distance != null && (
                    <Text>  •  {route.total_distance.toFixed(1)} km</Text>
                  )}
                  {route?.total_time_minutes != null && (
                    <Text>  •  {Math.round(route.total_time_minutes)} dk</Text>
                  )}
                </Text>
              </View>
              <Text style={styles.dayArrow}>›</Text>
            </TouchableOpacity>
          );
        })
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  content: { padding: 16 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  loadingText: { marginTop: 12, color: '#64748b' },
  emptyText: { color: '#64748b', textAlign: 'center', marginTop: 12 },
  kpiGrid: {
    flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -6, marginBottom: 16,
  },
  kpiCard: {
    width: '50%', padding: 6,
  },
  kpiValue: {
    fontSize: 24, fontWeight: '700', color: '#0f172a',
  },
  kpiUnit: { fontSize: 13, fontWeight: '500', color: '#94a3b8' },
  kpiLabel: { fontSize: 12, color: '#64748b', marginTop: 2 },
  sectionTitle: {
    fontSize: 17, fontWeight: '700', color: '#0f172a',
    marginBottom: 12, marginTop: 8,
  },
  dayCard: {
    backgroundColor: '#fff', borderRadius: 12, padding: 14,
    flexDirection: 'row', alignItems: 'center', marginBottom: 10,
    shadowColor: '#000', shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 1 }, shadowRadius: 4, elevation: 1,
  },
  dayBadge: {
    width: 48, height: 48, borderRadius: 10,
    backgroundColor: '#6366f1', alignItems: 'center', justifyContent: 'center',
    marginRight: 14,
  },
  dayBadgeText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  dayContent: { flex: 1 },
  dayTitle: { fontSize: 16, fontWeight: '600', color: '#0f172a' },
  dayMeta: { fontSize: 13, color: '#64748b', marginTop: 3 },
  dayArrow: { fontSize: 28, color: '#cbd5e1' },
});
