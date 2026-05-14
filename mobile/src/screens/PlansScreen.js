/**
 * Plan listesi ekrani.
 * Kullanici giris yaptiktan sonra burayi gorur.
 * 'completed' durumundaki planlari listeler, secince haftalik/gunluk plana gider.
 */
import { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback } from 'react';
import api from '../api/client';

export default function PlansScreen({ navigation, user }) {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  async function loadPlans() {
    try {
      const response = await api.get('/api/plans/');
      // Sadece tamamlanmis planlari goster
      const completed = response.data.filter((p) => p.status === 'completed');
      setPlans(completed);
    } catch (error) {
      console.error('Plans error:', error?.response?.data || error.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  // Sayfa her acildiginda yeniden yukle
  useFocusEffect(
    useCallback(() => {
      loadPlans();
    }, [])
  );

  function onRefresh() {
    setRefreshing(true);
    loadPlans();
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#6366f1" />
        <Text style={styles.loadingText}>Planlar yukleniyor...</Text>
      </View>
    );
  }

  if (user?.cluster_index === null || user?.cluster_index === undefined) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyEmoji}>📍</Text>
        <Text style={styles.emptyTitle}>Henuz bir bolge atanmadi</Text>
        <Text style={styles.emptyText}>
          Yoneticinizden size bir bolge ataması yapmasini isteyin.
        </Text>
      </View>
    );
  }

  if (plans.length === 0) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyEmoji}>📋</Text>
        <Text style={styles.emptyTitle}>Henuz tamamlanmis plan yok</Text>
        <Text style={styles.emptyText}>
          Yonetici tarafindan bir plan olusturulup tamamlandiginda burada gorunecek.
        </Text>
        <TouchableOpacity style={styles.refreshButton} onPress={onRefresh}>
          <Text style={styles.refreshButtonText}>Yenile</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <FlatList
      data={plans}
      keyExtractor={(item) => String(item.id)}
      contentContainerStyle={styles.list}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      ListHeaderComponent={
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Planlarim</Text>
          <Text style={styles.headerSubtitle}>
            Bolge {user.cluster_index + 1} • {plans.length} plan
          </Text>
        </View>
      }
      renderItem={({ item }) => (
        <TouchableOpacity
          style={styles.card}
          onPress={() => navigation.navigate('Weekly', { planId: item.id, planName: item.name })}
        >
          <View style={styles.cardRow}>
            <View style={styles.cardIconBox}>
              <Text style={styles.cardIcon}>📅</Text>
            </View>
            <View style={styles.cardContent}>
              <Text style={styles.cardTitle}>{item.name}</Text>
              <Text style={styles.cardMeta}>
                {new Date(item.created_at).toLocaleDateString('tr-TR')}
              </Text>
            </View>
            <Text style={styles.cardArrow}>›</Text>
          </View>
        </TouchableOpacity>
      )}
    />
  );
}

const styles = StyleSheet.create({
  list: { padding: 16 },
  centered: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    padding: 32, backgroundColor: '#f8fafc',
  },
  loadingText: { marginTop: 12, color: '#64748b' },
  emptyEmoji: { fontSize: 48, marginBottom: 16 },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: '#1e293b', marginBottom: 8, textAlign: 'center' },
  emptyText: { fontSize: 14, color: '#64748b', textAlign: 'center', lineHeight: 20 },
  refreshButton: {
    marginTop: 20, backgroundColor: '#6366f1', paddingHorizontal: 24,
    paddingVertical: 12, borderRadius: 8,
  },
  refreshButtonText: { color: '#fff', fontWeight: '600' },
  header: { marginBottom: 16 },
  headerTitle: { fontSize: 26, fontWeight: '700', color: '#0f172a' },
  headerSubtitle: { fontSize: 14, color: '#64748b', marginTop: 4 },
  card: {
    backgroundColor: '#fff', borderRadius: 12, marginBottom: 12,
    padding: 16, shadowColor: '#000', shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 }, shadowRadius: 6, elevation: 2,
  },
  cardRow: { flexDirection: 'row', alignItems: 'center' },
  cardIconBox: {
    width: 44, height: 44, borderRadius: 10, backgroundColor: '#eef2ff',
    alignItems: 'center', justifyContent: 'center', marginRight: 12,
  },
  cardIcon: { fontSize: 22 },
  cardContent: { flex: 1 },
  cardTitle: { fontSize: 16, fontWeight: '600', color: '#0f172a' },
  cardMeta: { fontSize: 13, color: '#64748b', marginTop: 2 },
  cardArrow: { fontSize: 28, color: '#cbd5e1' },
});
