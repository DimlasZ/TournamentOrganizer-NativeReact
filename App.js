import { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';

import { load } from './src/state/store.js';
import PlayerManagerScreen from './src/screens/PlayerManagerScreen.js';
import TournamentSetupScreen from './src/screens/TournamentSetupScreen.js';
import PairingsScreen from './src/screens/PairingsScreen.js';
import StandingsScreen from './src/screens/StandingsScreen.js';
import HistoryScreen from './src/screens/HistoryScreen.js';

const Stack = createStackNavigator();

export default function App() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    load().then(() => setReady(true));
  }, []);

  if (!ready) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" />
        <StatusBar style="auto" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="PlayerManager">
        <Stack.Screen name="PlayerManager" component={PlayerManagerScreen} options={{ title: 'Players' }} />
        <Stack.Screen name="TournamentSetup" component={TournamentSetupScreen} options={{ title: 'New Tournament' }} />
        <Stack.Screen name="Pairings" component={PairingsScreen} options={{ title: 'Pairings' }} />
        <Stack.Screen name="Standings" component={StandingsScreen} options={{ title: 'Standings' }} />
        <Stack.Screen name="History" component={HistoryScreen} options={{ title: 'History' }} />
      </Stack.Navigator>
      <StatusBar style="auto" />
    </NavigationContainer>
  );
}
