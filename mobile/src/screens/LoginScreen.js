/**
 * Login ekrani.
 * 
 * Backend'in /api/auth/login endpoint'ine OAuth2 form formatinda istek atar.
 * Demo hesaplari icin onceden doldurulmus alanlar.
 */
import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import api from '../api/client';
import { saveAuth } from '../utils/auth';

export default function LoginScreen({ navigation, onLogin }) {
  const [email, setEmail] = useState('demo@saha.com');
  const [password, setPassword] = useState('Demo2026!');
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    if (!email || !password) {
      Alert.alert('Hata', 'Email ve sifre gerekli');
      return;
    }
    setLoading(true);
    try {
      // OAuth2PasswordRequestForm bekledigi icin form-urlencoded gondermek lazim
      const formData = new URLSearchParams();
      formData.append('username', email);
      formData.append('password', password);

      const response = await api.post('/api/auth/login', formData.toString(), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      });

      const { access_token } = response.data;

      // Token'i kaydet, sonra /me ile kullanici bilgilerini cek
      await saveAuth(access_token, {});
      const meResponse = await api.get('/api/auth/me');
      await saveAuth(access_token, meResponse.data);

      onLogin(meResponse.data);
    } catch (error) {
      console.error('Login error:', error?.response?.data || error.message);
      const detail = error?.response?.data?.detail || 'Giris yapilamadi';
      Alert.alert('Giris Hatasi', detail);
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.logoBox}>
          <View style={styles.logoCircle}>
            <Text style={styles.logoText}>SS</Text>
          </View>
          <Text style={styles.title}>Saha Satis Planlama</Text>
          <Text style={styles.subtitle}>Satis Temsilcisi Uygulamasi</Text>
        </View>

        <View style={styles.form}>
          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            placeholder="ornek@saha.com"
          />

          <Text style={styles.label}>Sifre</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholder="Sifreniz"
          />

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Giris Yap</Text>
            )}
          </TouchableOpacity>

          <View style={styles.demoBox}>
            <Text style={styles.demoTitle}>Demo Hesabi</Text>
            <Text style={styles.demoText}>demo@saha.com / Demo2026!</Text>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0c1222' },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  logoBox: { alignItems: 'center', marginBottom: 40 },
  logoCircle: {
    width: 80, height: 80, borderRadius: 20,
    backgroundColor: '#6366f1', alignItems: 'center', justifyContent: 'center',
    marginBottom: 16,
  },
  logoText: { color: '#fff', fontSize: 32, fontWeight: '800' },
  title: { color: '#fff', fontSize: 22, fontWeight: '700', marginBottom: 4 },
  subtitle: { color: '#94a3b8', fontSize: 14 },
  form: { backgroundColor: '#fff', borderRadius: 16, padding: 24 },
  label: { fontSize: 13, fontWeight: '600', color: '#475569', marginBottom: 8, marginTop: 12 },
  input: {
    borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 10,
    padding: 14, fontSize: 16, backgroundColor: '#f8fafc',
  },
  button: {
    backgroundColor: '#6366f1', borderRadius: 10, padding: 16,
    alignItems: 'center', marginTop: 24,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  demoBox: {
    marginTop: 24, padding: 12, backgroundColor: '#f1f5f9',
    borderRadius: 8, alignItems: 'center',
  },
  demoTitle: { fontSize: 12, fontWeight: '600', color: '#64748b', marginBottom: 4 },
  demoText: { fontSize: 13, color: '#475569', fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
});
