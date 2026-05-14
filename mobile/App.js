/**
 * Ana uygulama.
 * 
 * Akis:
 *   1. App acilinca AsyncStorage'dan token kontrol edilir
 *   2. Token varsa → Plans ekrani, yoksa → Login ekrani
 *   3. Login basarili olunca state guncellenir, otomatik Plans'a gecer
 */
import { useState, useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { TouchableOpacity, Text, View, ActivityIndicator } from 'react-native';

import LoginScreen from './src/screens/LoginScreen';
import PlansScreen from './src/screens/PlansScreen';
import WeeklyScreen from './src/screens/WeeklyScreen';
import DailyMapScreen from './src/screens/DailyMapScreen';
import { getToken, getUser, clearAuth } from './src/utils/auth';

const Stack = createNativeStackNavigator();

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  async function checkAuth() {
    try {
      const token = await getToken();
      const savedUser = await getUser();
      if (token && savedUser) {
        setUser(savedUser);
      }
    } catch (e) {
      console.error('Auth check error:', e);
    } finally {
      setLoading(false);
    }
  }

  async function handleLogout() {
    await clearAuth();
    setUser(null);
  }

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0c1222' }}>
        <ActivityIndicator size="large" color="#6366f1" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <StatusBar style="auto" />
      <Stack.Navigator
        screenOptions={{
          headerStyle: { backgroundColor: '#0c1222' },
          headerTintColor: '#fff',
          headerTitleStyle: { fontWeight: '700' },
        }}
      >
        {!user ? (
          <Stack.Screen name="Login" options={{ headerShown: false }}>
            {(props) => <LoginScreen {...props} onLogin={setUser} />}
          </Stack.Screen>
        ) : (
          <>
            <Stack.Screen
              name="Plans"
              options={{
                title: 'Saha Satis',
                headerRight: () => (
                  <TouchableOpacity onPress={handleLogout}>
                    <Text style={{ color: '#fff', fontSize: 13 }}>Cikis</Text>
                  </TouchableOpacity>
                ),
              }}
            >
              {(props) => <PlansScreen {...props} user={user} />}
            </Stack.Screen>
            <Stack.Screen
              name="Weekly"
              component={WeeklyScreen}
              options={{ title: 'Planim' }}
            />
            <Stack.Screen
              name="DailyMap"
              component={DailyMapScreen}
              options={{ title: 'Rota' }}
            />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
