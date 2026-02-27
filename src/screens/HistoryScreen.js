import { useState, useEffect } from 'react';
import { View, Text, Pressable, FlatList, Alert, StyleSheet } from 'react-native';
import { getState, subscribe } from '../state/store.js';
import { computeStandings } from '../logic/standings.js';
import {
  reopenTournament, reopenCurrentTournament,
  deleteHistoryEntry, abandonTournament,
} from '../state/tournament.js';

export default function HistoryScreen({ navigation }) {
  const [appState, setAppState] = useState(getState());

  useEffect(() => {
    const unsub = subscribe(s => setAppState(s));
    return unsub;
  }, []);

  const { pastTournaments = [], players, tournament } = appState;
  const hasActive = tournament?.status === 'active';
  const playerMap = Object.fromEntries(players.map(p => [p.id, p.name]));

  // Unified list: current completed tournament first, then archive
  const allFinished = [
    ...(tournament?.status === 'complete' ? [{ ...tournament, _isCurrent: true }] : []),
    ...pastTournaments.map(t => ({ ...t, _isCurrent: false })),
  ];

  const handleReopen = (t) => {
    if (hasActive) {
      Alert.alert('Cannot Reopen', 'Finish or abandon the active tournament first.');
      return;
    }
    Alert.alert(
      'Reopen Tournament',
      'Reopen this tournament to make corrections?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reopen',
          onPress: () => {
            if (t._isCurrent) reopenCurrentTournament();
            else reopenTournament(t.id);
            navigation.navigate('Tournament', { screen: 'Pairings' });
          },
        },
      ]
    );
  };

  const handleDelete = (t) => {
    Alert.alert(
      'Delete Tournament',
      'Delete this tournament from history? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            if (t._isCurrent) abandonTournament();
            else deleteHistoryEntry(t.id);
          },
        },
      ]
    );
  };

  if (allFinished.length === 0) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyState}>No past tournaments yet.</Text>
      </View>
    );
  }

  const getWinner = (t) => {
    const completedRounds = (t.rounds ?? []).filter(r => r.status === 'complete');
    if (completedRounds.length === 0) return '—';
    const standings = computeStandings(t.activePlayers ?? [], completedRounds);
    if (standings.length === 0) return '—';
    return playerMap[standings[0].playerId] ?? standings[0].playerId;
  };

  return (
    <FlatList
      style={styles.container}
      data={allFinished}
      keyExtractor={t => t.id}
      renderItem={({ item: t }) => {
        const playerCount = (t.activePlayers?.length ?? 0) + (t.droppedPlayers?.length ?? 0);
        const roundCount = t.rounds?.length ?? 0;
        const winner = getWinner(t);

        return (
          <View style={styles.card}>
            <View style={styles.cardInfo}>
              <Text style={styles.cardDate}>{t.dateStr}</Text>
              <Text style={styles.cardMeta}>{playerCount} players · {roundCount} rounds</Text>
              <Text style={styles.cardWinner}>🏆 {winner}</Text>
            </View>
            <View style={styles.cardActions}>
              <Pressable
                style={[styles.reopenBtn, hasActive && styles.disabledBtn]}
                onPress={() => handleReopen(t)}
              >
                <Text style={[styles.reopenBtnText, hasActive && styles.disabledBtnText]}>Reopen</Text>
              </Pressable>
              <Pressable style={styles.deleteBtn} onPress={() => handleDelete(t)}>
                <Text style={styles.deleteBtnText}>Delete</Text>
              </Pressable>
            </View>
          </View>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#000',
  },
  emptyState: {
    color: '#888',
    fontSize: 15,
  },
  card: {
    backgroundColor: '#111',
    marginHorizontal: 12,
    marginTop: 12,
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: '#333',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardInfo: {
    flex: 1,
    gap: 3,
  },
  cardDate: {
    fontSize: 15,
    fontWeight: '600',
    color: '#eee',
  },
  cardMeta: {
    fontSize: 13,
    color: '#888',
  },
  cardWinner: {
    fontSize: 13,
    color: '#aaa',
    marginTop: 2,
  },
  cardActions: {
    flexDirection: 'row',
    gap: 8,
    marginLeft: 10,
  },
  reopenBtn: {
    borderWidth: 1,
    borderColor: '#555',
    borderRadius: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  reopenBtnText: {
    fontSize: 13,
    color: '#ddd',
  },
  deleteBtn: {
    borderWidth: 1,
    borderColor: '#dc2626',
    borderRadius: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  deleteBtnText: {
    fontSize: 13,
    color: '#dc2626',
  },
  disabledBtn: {
    borderColor: '#333',
  },
  disabledBtnText: {
    color: '#555',
  },
});
