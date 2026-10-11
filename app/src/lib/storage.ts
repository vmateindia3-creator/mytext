import AsyncStorage from '@react-native-async-storage/async-storage';

const TOKEN_KEY = 'wavechat.token';
const USER_KEY = 'wavechat.user';

export const storage = {
  async getToken(): Promise<string | null> {
    return AsyncStorage.getItem(TOKEN_KEY);
  },
  async setToken(token: string): Promise<void> {
    await AsyncStorage.setItem(TOKEN_KEY, token);
  },
  async getUser<T>(): Promise<T | null> {
    const raw = await AsyncStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as T) : null;
  },
  async setUser(user: unknown): Promise<void> {
    await AsyncStorage.setItem(USER_KEY, JSON.stringify(user));
  },
  async clear(): Promise<void> {
    await AsyncStorage.multiRemove([TOKEN_KEY, USER_KEY]);
  },
};
