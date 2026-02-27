import { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';

import { load } from './src/state/store.js';
import PlayerManagerScreen from './src/screens/PlayerManagerScreen.js';
import TournamentSetupScreen from './src/screens/TournamentSetupScreen.js';
import PairingsScreen from './src/screens/PairingsScreen.js';
import StandingsScreen from './src/screens/StandingsScreen.js';
import HistoryScreen from './src/screens/HistoryScreen.js';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

const stackScreenOptions = {
  headerStyle: { backgroundColor: '#111' },
  headerTintColor: '#fff',
  headerTitleStyle: { fontWeight: '700' },
};

const tabHeaderOptions = {
  headerStyle: { backgroundColor: '#111' },
  headerTintColor: '#fff',
  headerTitleStyle: { fontWeight: '700' },
};

function TournamentStack() {
  return (
    <Stack.Navigator screenOptions={stackScreenOptions} initialRouteName="TournamentSetup">
      <Stack.Screen name="TournamentSetup" component={TournamentSetupScreen} options={{ title: 'Tournament' }} />
      <Stack.Screen name="Pairings" component={PairingsScreen} options={{ title: 'Pairings' }} />
    </Stack.Navigator>
  );
}

export default function App() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    load().then(() => setReady(true));
  }, []);

  if (!ready) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#000' }}>
        <ActivityIndicator size="large" color="#2563eb" />
        <StatusBar style="light" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Tab.Navigator
        initialRouteName="Tournament"
        screenOptions={{
          tabBarStyle: { backgroundColor: '#111', borderTopColor: '#333' },
          tabBarActiveTintColor: '#2563eb',
          tabBarInactiveTintColor: '#666',
        }}
      >
        <Tab.Screen
          name="Players"
          component={PlayerManagerScreen}
          options={{
            ...tabHeaderOptions,
            title: 'Players',
            tabBarLabel: 'Players',
            tabBarIcon: ({ focused, color, size }) => (
              <Ionicons name={focused ? 'people' : 'people-outline'} size={size} color={color} />
            ),
          }}
        />
        <Tab.Screen
          name="Tournament"
          component={TournamentStack}
          options={{
            headerShown: false,
            tabBarLabel: 'Tournament',
            tabBarIcon: ({ focused, color, size }) => (
              <Ionicons name={focused ? 'trophy' : 'trophy-outline'} size={size} color={color} />
            ),
          }}
        />
        <Tab.Screen
          name="Standings"
          component={StandingsScreen}
          options={{
            ...tabHeaderOptions,
            title: 'Standings',
            tabBarLabel: 'Standings',
            tabBarIcon: ({ focused, color, size }) => (
              <Ionicons name={focused ? 'bar-chart' : 'bar-chart-outline'} size={size} color={color} />
            ),
          }}
        />
        <Tab.Screen
          name="History"
          component={HistoryScreen}
          options={{
            ...tabHeaderOptions,
            title: 'History',
            tabBarLabel: 'History',
            tabBarIcon: ({ focused, color, size }) => (
              <Ionicons name={focused ? 'time' : 'time-outline'} size={size} color={color} />
            ),
          }}
        />
      </Tab.Navigator>
      <StatusBar style="light" />
    </NavigationContainer>
  );
}
