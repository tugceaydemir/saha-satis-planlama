/**
 * Auth yardimci fonksiyonlari — token ve user bilgilerini AsyncStorage'da yonet.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

export async function saveAuth(token, user) {
  await AsyncStorage.setItem('token', token);
  await AsyncStorage.setItem('user', JSON.stringify(user));
}

export async function getToken() {
  return await AsyncStorage.getItem('token');
}

export async function getUser() {
  const userJson = await AsyncStorage.getItem('user');
  return userJson ? JSON.parse(userJson) : null;
}

export async function clearAuth() {
  await AsyncStorage.removeItem('token');
  await AsyncStorage.removeItem('user');
}
