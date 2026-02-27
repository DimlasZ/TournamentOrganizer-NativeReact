import { useState, useEffect } from 'react';
import {
  View, Text, Pressable, FlatList,
  Alert, StyleSheet, ScrollView,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { getState, subscribe } from '../state/store.js';
import { createTournament, abandonTournament } from '../state/tournament.js';

export default function TournamentSetupScreen({ navigation }) {
  const [appState, setAppState] = useState(getState());
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [date, setDate] = useState(new Date());
  const [showPicker, setShowPicker] = useState(false);

  useEffect(() => {
    const unsub = subscribe(s => setAppState(s));
    return unsub;
  }, []);

  const { players, tournament } = appState;
  const sorted = [...players].sort((a, b) => a.name.localeCompare(b.name));

  // --- Active tournament view ---
  if (tournament?.status === 'active') {
    const completedCount = tournament.rounds.filter(r => r.status === 'complete').length;
    const playerNames = tournament.activePlayers
      .map(id => players.find(p => p.id === id)?.name ?? id)
      .join(', ');

    const handleAbandon = () => {
      Alert.alert(
        'Abandon Tournament',
        'Abandon the current tournament? All data will be lost.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Abandon', style: 'destructive', onPress: abandonTournament },
        ]
      );
    };

    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Date</Text>
            <Text style={styles.infoValue}>{tournament.dateStr}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Rounds complete</Text>
            <Text style={styles.infoValue}>{completedCount}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Players</Text>
            <Text style={styles.infoValue}>{tournament.activePlayers.length}</Text>
          </View>
        </View>
        <Text style={styles.playerNames}>{playerNames}</Text>
        <Pressable style={styles.primaryBtn} onPress={() => navigation.navigate('Pairings')}>
          <Text style={styles.primaryBtnText}>Go to Rounds →</Text>
        </Pressable>
        <Pressable style={styles.dangerBtn} onPress={handleAbandon}>
          <Text style={styles.dangerBtnText}>Abandon Tournament</Text>
        </Pressable>
      </ScrollView>
    );
  }

  // --- Setup form ---
  const togglePlayer = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleStart = () => {
    if (selectedIds.size < 2) return;
    createTournament([...selectedIds], formatDate(date));
    navigation.navigate('Pairings');
  };

  return (
    <View style={styles.container}>
      <Text style={styles.sectionHeader}>Select Players</Text>

      {players.length === 0 ? (
        <Text style={styles.emptyState}>No players in master list. Add players first.</Text>
      ) : (
        <FlatList
          data={sorted}
          keyExtractor={p => p.id}
          renderItem={({ item }) => {
            const checked = selectedIds.has(item.id);
            return (
              <Pressable style={styles.checkRow} onPress={() => togglePlayer(item.id)}>
                <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
                  {checked && <Text style={styles.checkmark}>✓</Text>}
                </View>
                <Text style={styles.checkLabel}>{item.name}</Text>
              </Pressable>
            );
          }}
        />
      )}

      {/* Sticky footer */}
      <View style={styles.footer}>
        <Text style={styles.selectedCount}>
          {selectedIds.size} player{selectedIds.size !== 1 ? 's' : ''} selected
        </Text>

        {/* Date picker */}
        <View style={styles.dateRow}>
          <Text style={styles.dateLabel}>Date</Text>
          <Pressable style={styles.dateBtn} onPress={() => setShowPicker(true)}>
            <Text style={styles.dateBtnText}>{formatDate(date)}</Text>
          </Pressable>
        </View>
        {showPicker && (
          <DateTimePicker
            value={date}
            mode="date"
            display="default"
            onChange={(event, selected) => {
              setShowPicker(false);
              if (selected) setDate(selected);
            }}
          />
        )}

        <Pressable
          style={[styles.primaryBtn, selectedIds.size < 2 && styles.disabledBtn]}
          onPress={handleStart}
          disabled={selectedIds.size < 2}
        >
          <Text style={styles.primaryBtnText}>Start Tournament</Text>
        </Pressable>
      </View>
    </View>
  );
}

function formatDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  content: {
    padding: 16,
    gap: 12,
  },
  sectionHeader: {
    fontSize: 14,
    fontWeight: '600',
    color: '#888',
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  emptyState: {
    textAlign: 'center',
    marginTop: 40,
    color: '#888',
    fontSize: 15,
    paddingHorizontal: 20,
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
    gap: 12,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderWidth: 2,
    borderColor: '#555',
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
  },
  checkmark: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  checkLabel: {
    fontSize: 15,
    color: '#eee',
  },
  footer: {
    backgroundColor: '#111',
    borderTopWidth: 1,
    borderTopColor: '#333',
    padding: 12,
    gap: 10,
  },
  selectedCount: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  dateLabel: {
    fontSize: 15,
    color: '#aaa',
    width: 40,
  },
  dateBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#444',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: '#1a1a1a',
  },
  dateBtnText: {
    fontSize: 15,
    color: '#eee',
  },
  primaryBtn: {
    backgroundColor: '#2563eb',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
  },
  primaryBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  disabledBtn: {
    backgroundColor: '#1e3a8a',
    opacity: 0.6,
  },
  dangerBtn: {
    borderWidth: 1,
    borderColor: '#dc2626',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  dangerBtnText: {
    color: '#dc2626',
    fontWeight: '600',
    fontSize: 15,
  },
  infoCard: {
    backgroundColor: '#111',
    borderRadius: 10,
    padding: 16,
    gap: 10,
    borderWidth: 1,
    borderColor: '#333',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  infoLabel: {
    fontSize: 14,
    color: '#888',
  },
  infoValue: {
    fontSize: 15,
    fontWeight: '600',
    color: '#eee',
  },
  playerNames: {
    fontSize: 13,
    color: '#888',
    lineHeight: 20,
  },
});
