import { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { getState, subscribe } from '../state/store.js';
import { computeStandings } from '../logic/standings.js';

export default function StandingsScreen() {
  const [appState, setAppState] = useState(getState());

  useEffect(() => {
    const unsub = subscribe(s => setAppState(s));
    return unsub;
  }, []);

  const { tournament, players } = appState;

  if (!tournament) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyState}>No active tournament.</Text>
      </View>
    );
  }

  if (tournament.rounds.length === 0) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyState}>No rounds played yet.</Text>
      </View>
    );
  }

  const playerMap = Object.fromEntries(players.map(p => [p.id, p.name]));
  const standings = computeStandings(tournament.activePlayers, tournament.rounds);
  const completedCount = tournament.rounds.filter(r => r.status === 'complete').length;

  return (
    <View style={styles.container}>
      <Text style={styles.subtitle}>After round {completedCount}</Text>

      <ScrollView horizontal>
        <View>
          {/* Header */}
          <View style={[styles.row, styles.headerRow]}>
            <Text style={[styles.cell, styles.rankCell, styles.headerText]}>#</Text>
            <Text style={[styles.cell, styles.nameCell, styles.headerText]}>Player</Text>
            <Text style={[styles.cell, styles.ptsCell, styles.headerText]}>Pts</Text>
            <Text style={[styles.cell, styles.recordCell, styles.headerText]}>Record</Text>
            <Text style={[styles.cell, styles.pctCell, styles.headerText]}>OMW%</Text>
            <Text style={[styles.cell, styles.pctCell, styles.headerText]}>GW%</Text>
            <Text style={[styles.cell, styles.pctCell, styles.headerText]}>OGW%</Text>
          </View>

          {/* Data rows */}
          <ScrollView>
            {standings.map((s, idx) => (
              <View
                key={s.playerId}
                style={[styles.row, idx === 0 && styles.firstRow, idx % 2 === 1 && styles.altRow]}
              >
                <Text style={[styles.cell, styles.rankCell, idx === 0 && styles.firstText]}>{idx + 1}</Text>
                <View style={[styles.cell, styles.nameCell, styles.nameWrapper]}>
                  <Text style={[styles.nameText, idx === 0 && styles.firstText]}>
                    {playerMap[s.playerId] ?? s.playerId}
                  </Text>
                  {s.hasBye && <Text style={styles.byeBadge}>BYE</Text>}
                </View>
                <Text style={[styles.cell, styles.ptsCell, styles.boldText, idx === 0 && styles.firstText]}>
                  {s.matchPoints}
                </Text>
                <Text style={[styles.cell, styles.recordCell]}>
                  {s.matchWins}-{s.matchLosses}-{s.matchDraws}
                </Text>
                <Text style={[styles.cell, styles.pctCell]}>{fmtPct(s.omwPct)}</Text>
                <Text style={[styles.cell, styles.pctCell]}>{fmtPct(s.gwPct)}</Text>
                <Text style={[styles.cell, styles.pctCell]}>{fmtPct(s.ogwPct)}</Text>
              </View>
            ))}
          </ScrollView>
        </View>
      </ScrollView>

      <Text style={styles.note}>Tiebreakers: OMW% → GW% → OGW% (33% floor)</Text>
    </View>
  );
}

function fmtPct(val) {
  return `${(val * 100).toFixed(0)}%`;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyState: {
    color: '#999',
    fontSize: 15,
  },
  subtitle: {
    fontSize: 13,
    color: '#888',
    paddingHorizontal: 14,
    paddingVertical: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    backgroundColor: '#fff',
    paddingVertical: 10,
  },
  headerRow: {
    backgroundColor: '#f0f0f0',
    borderBottomWidth: 2,
    borderBottomColor: '#ccc',
  },
  firstRow: {
    backgroundColor: '#fffbeb',
  },
  altRow: {
    backgroundColor: '#fafafa',
  },
  headerText: {
    fontWeight: '700',
    color: '#444',
    fontSize: 12,
  },
  cell: {
    paddingHorizontal: 8,
    fontSize: 14,
    color: '#333',
  },
  rankCell: {
    width: 32,
    textAlign: 'center',
  },
  nameCell: {
    width: 130,
  },
  nameWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  nameText: {
    fontSize: 14,
    color: '#333',
  },
  ptsCell: {
    width: 40,
    textAlign: 'center',
  },
  recordCell: {
    width: 70,
    textAlign: 'center',
  },
  pctCell: {
    width: 52,
    textAlign: 'center',
  },
  boldText: {
    fontWeight: '700',
  },
  firstText: {
    fontWeight: '700',
    color: '#92400e',
  },
  byeBadge: {
    fontSize: 10,
    color: '#fff',
    backgroundColor: '#6b7280',
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 1,
    overflow: 'hidden',
  },
  note: {
    fontSize: 11,
    color: '#aaa',
    textAlign: 'center',
    padding: 10,
  },
});
