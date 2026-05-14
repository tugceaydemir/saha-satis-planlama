/**
 * Gunluk harita ekrani — Faz 1'in zirvesi.
 * 
 * Backend'in /api/plans/{id}/routes/{day}/geometry endpoint'inden
 * TomTom'dan gelen GERCEK YOL noktalarini cizer.
 * 
 * Ozellikler:
 *   - Harita uzerinde gercek yol cizgisi (Polyline)
 *   - Depo + musteri markerlari (siralı)
 *   - Ziyaret listesi (alt bolum)
 *   - "Tum gunu navige et" butonu → Google Maps'i deep link ile acar
 */
import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Linking,
  Alert,
  Platform,
} from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_DEFAULT } from 'react-native-maps';
import api from '../api/client';

const COLORS = {
  route: '#6366f1',
  depot: '#ef4444',
  marker: '#6366f1',
};

export default function DailyMapScreen({ route, navigation }) {
  const { planId, day, dayName } = route.params;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [geometry, setGeometry] = useState([]);
  const [waypoints, setWaypoints] = useState([]);
  const [stops, setStops] = useState([]); // Musteri isim+sira icin myPlan'dan cekiyoruz
  const [depot, setDepot] = useState(null);
  const [distance, setDistance] = useState(0);
  const [duration, setDuration] = useState(0);
  const mapRef = useRef(null);

  useEffect(() => {
    navigation.setOptions({ title: dayName || 'Rota' });
    loadData();
  }, [planId, day]);

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      // Paralel: geometry + my-plan + depot
      const [geomRes, myPlanRes, depotRes] = await Promise.all([
        api.get(`/api/plans/${planId}/routes/${day}/geometry`),
        api.get(`/api/plans/${planId}/my-plan`),
        api.get('/api/settings/depot'),
      ]);

      setGeometry(geomRes.data.geometry || []);
      setWaypoints(geomRes.data.waypoints || []);
      setDistance(geomRes.data.distance_meters || 0);
      setDuration(geomRes.data.duration_seconds || 0);
      setDepot(depotRes.data);

      // Durak listesi: my-plan'daki o gunun rotasindan al
      const dayRoute = (myPlanRes.data.routes || []).find(
        (r) => r.day_of_week === day
      );
      setStops(dayRoute?.stops || []);

      // Haritayi rotaya gore zoomla
      setTimeout(() => {
        if (mapRef.current && geomRes.data.geometry?.length > 0) {
          const coords = geomRes.data.geometry.map(([lat, lon]) => ({
            latitude: lat,
            longitude: lon,
          }));
          mapRef.current.fitToCoordinates(coords, {
            edgePadding: { top: 60, right: 60, bottom: 60, left: 60 },
            animated: true,
          });
        }
      }, 500);
    } catch (err) {
      console.error('DailyMap error:', err?.response?.data || err.message);
      setError(err?.response?.data?.detail || 'Rota yuklenemedi');
    } finally {
      setLoading(false);
    }
  }

  // Tum gunu Google Maps'te navige et
  function navigateAll() {
    if (waypoints.length < 2) {
      Alert.alert('Hata', 'Navigasyon icin yeterli nokta yok');
      return;
    }

    // Google Maps multi-waypoint URL formati:
    // https://www.google.com/maps/dir/?api=1&origin=lat,lng&destination=lat,lng&waypoints=lat,lng|lat,lng
    const origin = waypoints[0]; // depo
    const destination = waypoints[waypoints.length - 1]; // depo (geri)
    const middleStops = waypoints.slice(1, -1); // arada musteriler

    const waypointsParam = middleStops
      .map(([lat, lon]) => `${lat},${lon}`)
      .join('|');

    let url = `https://www.google.com/maps/dir/?api=1`;
    url += `&origin=${origin[0]},${origin[1]}`;
    url += `&destination=${destination[0]},${destination[1]}`;
    if (waypointsParam) {
      url += `&waypoints=${waypointsParam}`;
    }
    url += `&travelmode=driving`;

    Linking.openURL(url).catch(() => {
      Alert.alert('Hata', 'Google Maps acilamadi');
    });
  }

  // Tek bir duraga git
  function navigateToStop(stop) {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${stop.x},${stop.y}&travelmode=driving`;
    Linking.openURL(url).catch(() => {
      Alert.alert('Hata', 'Google Maps acilamadi');
    });
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#6366f1" />
        <Text style={styles.loadingText}>Rota hesaplaniyor...</Text>
        <Text style={styles.loadingSubtext}>
          TomTom'dan gercek yol bilgisi aliniyor
        </Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorEmoji}>⚠️</Text>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={loadData}>
          <Text style={styles.retryButtonText}>Tekrar Dene</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Polyline koordinatlari: backend [lat, lon] formatinda donuyor
  const polylineCoords = geometry.map(([lat, lon]) => ({
    latitude: lat,
    longitude: lon,
  }));

  // Baslangic merkezi: ilk koordinat veya depo
  const initialRegion = polylineCoords[0]
    ? {
        latitude: polylineCoords[0].latitude,
        longitude: polylineCoords[0].longitude,
        latitudeDelta: 0.1,
        longitudeDelta: 0.1,
      }
    : depot
    ? {
        latitude: depot.depot_x,
        longitude: depot.depot_y,
        latitudeDelta: 0.1,
        longitudeDelta: 0.1,
      }
    : null;

  return (
    <View style={styles.container}>
      {/* Harita */}
      <View style={styles.mapContainer}>
        {initialRegion && (
          <MapView
            ref={mapRef}
            provider={PROVIDER_DEFAULT}
            style={styles.map}
            initialRegion={initialRegion}
          >
            {/* Gercek yol cizgisi */}
            {polylineCoords.length > 1 && (
              <Polyline
                coordinates={polylineCoords}
                strokeColor={COLORS.route}
                strokeWidth={4}
              />
            )}

            {/* Depo marker (ilk waypoint) */}
            {depot && (
              <Marker
                coordinate={{
                  latitude: depot.depot_x,
                  longitude: depot.depot_y,
                }}
                title="Depo"
                pinColor="red"
              />
            )}

            {/* Musteri markerlari */}
            {stops.map((stop) => (
              <Marker
                key={stop.customer_id}
                coordinate={{ latitude: stop.x, longitude: stop.y }}
                title={`${stop.visit_order}. ${stop.customer_name}`}
                description={
                  stop.estimated_arrival_minutes != null
                    ? `Tahmini varis: ${Math.round(stop.estimated_arrival_minutes)} dk`
                    : undefined
                }
                pinColor={COLORS.marker}
              />
            ))}
          </MapView>
        )}
      </View>

      {/* Ozet bandı */}
      <View style={styles.summary}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValue}>{(distance / 1000).toFixed(1)}</Text>
          <Text style={styles.summaryLabel}>km</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValue}>{Math.round(duration / 60)}</Text>
          <Text style={styles.summaryLabel}>dk</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValue}>{stops.length}</Text>
          <Text style={styles.summaryLabel}>durak</Text>
        </View>
      </View>

      {/* Navigasyonu baslat butonu */}
      <TouchableOpacity style={styles.navButton} onPress={navigateAll}>
        <Text style={styles.navButtonText}>📍  Navigasyonu Baslat</Text>
      </TouchableOpacity>

      {/* Durak listesi */}
      <ScrollView style={styles.stopsList} contentContainerStyle={{ paddingBottom: 24 }}>
        <Text style={styles.stopsTitle}>Ziyaret Listesi ({stops.length})</Text>
        {stops.map((stop) => (
          <TouchableOpacity
            key={stop.customer_id}
            style={styles.stopRow}
            onPress={() => navigateToStop(stop)}
          >
            <View style={styles.stopOrder}>
              <Text style={styles.stopOrderText}>{stop.visit_order}</Text>
            </View>
            <View style={styles.stopContent}>
              <Text style={styles.stopName}>{stop.customer_name}</Text>
              {stop.estimated_arrival_minutes != null && (
                <Text style={styles.stopMeta}>
                  Tahmini varis: {Math.round(stop.estimated_arrival_minutes)} dk
                </Text>
              )}
            </View>
            <Text style={styles.stopArrow}>›</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  centered: {
    flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32,
  },
  loadingText: { marginTop: 16, fontSize: 16, fontWeight: '600', color: '#0f172a' },
  loadingSubtext: { marginTop: 6, fontSize: 13, color: '#64748b' },
  errorEmoji: { fontSize: 48, marginBottom: 12 },
  errorText: { fontSize: 15, color: '#475569', textAlign: 'center', marginBottom: 20 },
  retryButton: {
    backgroundColor: '#6366f1', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8,
  },
  retryButtonText: { color: '#fff', fontWeight: '600' },
  mapContainer: { height: 320, backgroundColor: '#e2e8f0' },
  map: { flex: 1 },
  summary: {
    flexDirection: 'row', backgroundColor: '#fff', paddingVertical: 16,
    borderBottomWidth: 1, borderBottomColor: '#e2e8f0',
  },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryValue: { fontSize: 22, fontWeight: '700', color: '#0f172a' },
  summaryLabel: { fontSize: 12, color: '#94a3b8', marginTop: 2 },
  summaryDivider: { width: 1, backgroundColor: '#e2e8f0', marginVertical: 8 },
  navButton: {
    backgroundColor: '#6366f1', margin: 16, padding: 16,
    borderRadius: 12, alignItems: 'center',
  },
  navButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  stopsList: { flex: 1, paddingHorizontal: 16 },
  stopsTitle: {
    fontSize: 15, fontWeight: '700', color: '#0f172a',
    marginBottom: 10, marginTop: 4,
  },
  stopRow: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff',
    padding: 12, borderRadius: 10, marginBottom: 8,
  },
  stopOrder: {
    width: 32, height: 32, borderRadius: 8, backgroundColor: '#6366f1',
    alignItems: 'center', justifyContent: 'center', marginRight: 12,
  },
  stopOrderText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  stopContent: { flex: 1 },
  stopName: { fontSize: 15, fontWeight: '600', color: '#0f172a' },
  stopMeta: { fontSize: 12, color: '#64748b', marginTop: 2 },
  stopArrow: { fontSize: 24, color: '#cbd5e1' },
});
