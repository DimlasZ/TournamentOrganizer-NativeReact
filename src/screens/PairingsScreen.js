import { useState, useEffect } from 'react';
import {
  View, Text, Pressable, FlatList, ScrollView,
  Alert, Modal, TextInput, StyleSheet,
} from 'react-native';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { getState, subscribe } from '../state/store.js';
import {
  pairNextRound, reshuffleSeating, completeCurrentRound,
  finishTournament, submitResult, dropPlayer,
  canCorrectResult, swapPlayers, reassignBye, repairActiveRound,
} from '../state/tournament.js';
import { computeStandings } from '../logic/standings.js';
import { generateCSV, exportFilename } from '../logic/csv.js';
import { pushResultsToGitHub, getStoredToken, setStoredToken } from '../logic/github.js';
import useTimer from '../hooks/useTimer.js';
import TimerAlarmModal from '../components/TimerAlarmModal.js';

const RESULT_OPTIONS = [
  { label: '2-0', p1: 2, p2: 0, d: 0 },
  { label: '2-1', p1: 2, p2: 1, d: 0 },
  { label: '1-0', p1: 1, p2: 0, d: 0 },
  { label: '1-1', p1: 1, p2: 1, d: 0 },
  { label: '0-0', p1: 0, p2: 0, d: 0 },
  { label: '0-1', p1: 0, p2: 1, d: 0 },
  { label: '1-2', p1: 1, p2: 2, d: 0 },
  { label: '0-2', p1: 0, p2: 2, d: 0 },
];

export default function PairingsScreen({ navigation }) {
  const [appState, setAppState] = useState(getState());
  const [swapSourceId, setSwapSourceId] = useState(null);
  const [byeReassignMode, setByeReassignMode] = useState(false);
  const [expandedRounds, setExpandedRounds] = useState(new Set());
  const [showPlayerMgmt, setShowPlayerMgmt] = useState(false);
  const [showTimerEdit, setShowTimerEdit] = useState(false);
  const [timerInput, setTimerInput] = useState('');
  const [showTokenModal, setShowTokenModal] = useState(false);
  const [tokenInput, setTokenInput] = useState('');
  const [githubLoading, setGithubLoading] = useState(false);

  const timer = useTimer({
    sound40min: require('../../assets/sounds/40_min_left.mp3'),
    sound20min: require('../../assets/sounds/20_min_left.mp3'),
    alarmSound: require('../../assets/sounds/alarm.wav'),
  });

  useEffect(() => {
    const unsub = subscribe(s => setAppState(s));
    return unsub;
  }, []);

  const { tournament, players } = appState;
  const playerMap = Object.fromEntries(players.map(p => [p.id, p.name]));

  const toggleRound = (num) => setExpandedRounds(prev => {
    const next = new Set(prev);
    next.has(num) ? next.delete(num) : next.add(num);
    return next;
  });

  const handleTimerEditSave = () => {
    const val = timerInput.trim();
    let ms;
    if (val.includes(':')) {
      const [m, s] = val.split(':').map(n => parseInt(n, 10));
      if (isNaN(m) || isNaN(s)) return;
      ms = (m * 60 + s) * 1000;
    } else {
      const min = parseInt(val, 10);
      if (isNaN(min) || min < 1) return;
      ms = min * 60 * 1000;
    }
    if (ms < 1000) return;
    timer.setDuration(ms);
    if (timer.isRunning) timer.start();
    setShowTimerEdit(false);
  };

  // ── No tournament ─────────────────────────────────────────────────────────

  if (!tournament) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyState}>No active tournament.</Text>
        <Pressable style={[styles.primaryBtn, { marginTop: 16 }]} onPress={() => navigation.navigate('TournamentSetup')}>
          <Text style={styles.primaryBtnText}>Create Tournament</Text>
        </Pressable>
        <TimerAlarmModal visible={timer.showAlarm} onDismiss={timer.dismissAlarm} />
      </View>
    );
  }

  // ── Tournament complete ───────────────────────────────────────────────────

  if (tournament.status === 'complete') {
    const standings = computeStandings(tournament.activePlayers, tournament.rounds);

    const handleExportCSV = async () => {
      try {
        const csv = generateCSV(tournament, players, tournament.dateStr);
        const filename = exportFilename(tournament.dateStr);
        const path = FileSystem.documentDirectory + filename;
        await FileSystem.writeAsStringAsync(path, csv, { encoding: FileSystem.EncodingType.UTF8 });
        await Sharing.shareAsync(path, { mimeType: 'text/csv', dialogTitle: 'Download CSV' });
      } catch (e) {
        Alert.alert('Export Failed', e.message);
      }
    };

    const handleUploadGitHub = async (tokenOverride) => {
      const token = tokenOverride ?? await getStoredToken();
      if (!token) {
        setShowTokenModal(true);
        return;
      }
      setGithubLoading(true);
      const csv = generateCSV(tournament, players, tournament.dateStr);
      const filename = exportFilename(tournament.dateStr);
      const result = await pushResultsToGitHub(filename, csv, token);
      setGithubLoading(false);
      if (result.ok) {
        Alert.alert('Uploaded', result.message);
      } else {
        Alert.alert('Upload Failed', result.message);
        if (result.message.includes('token') || result.message.includes('Invalid')) {
          setShowTokenModal(true);
        }
      }
    };

    const handleTokenSave = async () => {
      const t = tokenInput.trim();
      if (!t) return;
      await setStoredToken(t);
      setShowTokenModal(false);
      setTokenInput('');
      handleUploadGitHub(t);
    };

    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
        <Text style={styles.bigTitle}>Tournament Complete!</Text>
        {standings.map((s, idx) => (
          <View key={s.playerId} style={[styles.finalRow, idx === 0 && styles.championRow]}>
            <Text style={[styles.finalRank, idx === 0 && styles.championText]}>{idx + 1}.</Text>
            <Text style={[styles.finalName, idx === 0 && styles.championText]} numberOfLines={1}>
              {playerMap[s.playerId] ?? s.playerId}
            </Text>
            <Text style={[styles.finalPts, idx === 0 && styles.championText]}>{s.matchPoints} pts</Text>
            <Text style={styles.finalRecord}>{s.matchWins}-{s.matchLosses}-{s.matchDraws}</Text>
          </View>
        ))}
        <Pressable style={[styles.primaryBtn, { marginTop: 20 }]} onPress={handleExportCSV}>
          <Text style={styles.primaryBtnText}>Download CSV ({tournament.dateStr})</Text>
        </Pressable>
        <Pressable
          style={[styles.secondaryBtn, { marginTop: 8 }, githubLoading && styles.disabledBtn]}
          onPress={() => !githubLoading && handleUploadGitHub()}
        >
          <Text style={styles.secondaryBtnText}>{githubLoading ? 'Uploading…' : 'Upload to GitHub'}</Text>
        </Pressable>
        <RoundHistory
          rounds={tournament.rounds}
          playerMap={playerMap}
          expandedRounds={expandedRounds}
          onToggle={toggleRound}
        />
        <TokenInputModal
          visible={showTokenModal}
          value={tokenInput}
          onChangeText={setTokenInput}
          onSave={handleTokenSave}
          onCancel={() => { setShowTokenModal(false); setTokenInput(''); }}
        />
      </ScrollView>
    );
  }

  const completedRounds = tournament.rounds.filter(r => r.status === 'complete');
  const activeRound = tournament.rounds.find(r => r.status === 'active');

  // ── Seating (no rounds yet) ───────────────────────────────────────────────

  if (!activeRound && completedRounds.length === 0) {
    const seating = tournament.seatingOrder ?? [...tournament.activePlayers];
    return (
      <View style={styles.container}>
        <Text style={styles.sectionHeader}>Seating — Round 1</Text>
        <Text style={styles.mutedCenter}>{tournament.activePlayers.length} players</Text>
        <FlatList
          data={seating}
          keyExtractor={(id, i) => id + i}
          renderItem={({ item: id, index }) => (
            <View style={styles.seatingRow}>
              <Text style={styles.seatNum}>{index + 1}</Text>
              <Text style={styles.seatName}>{playerMap[id] ?? id}</Text>
            </View>
          )}
        />
        <View style={styles.footer}>
          <Pressable style={styles.secondaryBtn} onPress={reshuffleSeating}>
            <Text style={styles.secondaryBtnText}>Randomize Seating</Text>
          </Pressable>
          <Pressable style={styles.primaryBtn} onPress={() => { pairNextRound(); timer.start(); }}>
            <Text style={styles.primaryBtnText}>Start Round 1</Text>
          </Pressable>
        </View>
        <TimerAlarmModal visible={timer.showAlarm} onDismiss={timer.dismissAlarm} />
      </View>
    );
  }

  // ── Active round ──────────────────────────────────────────────────────────

  if (activeRound) {
    const pendingMatches = activeRound.matches.filter(m => !m.isBye && !m.result);
    const canSwap = pendingMatches.length >= 2;
    const allDone = activeRound.matches.every(m => m.isBye || m.result !== null);

    const swapStillValid = swapSourceId &&
      pendingMatches.some(m => m.player1Id === swapSourceId || m.player2Id === swapSourceId);
    const effectiveSwapId = swapStillValid ? swapSourceId : null;
    const effectiveByeReassign = byeReassignMode && pendingMatches.length > 0;

    const _standings = completedRounds.length > 0
      ? computeStandings(tournament.activePlayers, completedRounds)
      : [];
    const pointsMap = Object.fromEntries(_standings.map(s => [s.playerId, s.matchPoints]));
    const ptsLabel = id => completedRounds.length > 0 ? ` (${pointsMap[id] ?? 0})` : '';

    const timerColor = timer.isExpired ? '#dc2626' : timer.isWarning ? '#d97706' : '#111';

    return (
      <View style={styles.container}>
        {/* Timer header */}
        <View style={styles.timerRow}>
          <Text style={styles.roundLabel}>Round {activeRound.roundNumber}</Text>
          <Pressable onPress={() => { setTimerInput(''); setShowTimerEdit(true); }}>
            <Text style={[styles.timerDisplay, { color: timerColor }]}>
              {timer.isExpired ? 'TIME' : timer.display}
            </Text>
          </Pressable>
        </View>

        {/* Swap banner */}
        {effectiveSwapId && (
          <View style={styles.banner}>
            <Text style={styles.bannerText}>
              Swapping <Text style={styles.bannerBold}>{playerMap[effectiveSwapId]}</Text> — tap a player
            </Text>
            <Pressable onPress={() => setSwapSourceId(null)}>
              <Text style={styles.bannerCancel}>Done</Text>
            </Pressable>
          </View>
        )}

        {/* Bye reassign banner */}
        {effectiveByeReassign && (
          <View style={styles.banner}>
            <Text style={styles.bannerText}>Select a player to give the bye to</Text>
            <Pressable onPress={() => setByeReassignMode(false)}>
              <Text style={styles.bannerCancel}>Cancel</Text>
            </Pressable>
          </View>
        )}

        {/* Match list */}
        <FlatList
          data={activeRound.matches}
          keyExtractor={m => m.id}
          renderItem={({ item: match, index }) => (
            <MatchCard
              match={match}
              tableNum={index + 1}
              playerMap={playerMap}
              ptsLabel={ptsLabel}
              swapSourceId={effectiveSwapId}
              byeReassignMode={effectiveByeReassign}
              canSwap={canSwap}
              onSelectSwapSource={id => { setByeReassignMode(false); setSwapSourceId(id); }}
              onSwapTarget={id => { swapPlayers(effectiveSwapId, id); setSwapSourceId(null); }}
              onByeTarget={id => { reassignBye(id); setByeReassignMode(false); }}
              onChangeBye={() => { setSwapSourceId(null); setByeReassignMode(true); }}
              onSubmitResult={(matchId, result) => submitResult(matchId, result)}
              onEditResult={(matchId, result) => { submitResult(matchId, result); repairActiveRound(); }}
            />
          )}
          ListFooterComponent={
            !effectiveSwapId && !effectiveByeReassign ? (
              <View style={styles.roundActions}>
                {allDone ? (
                  <Pressable style={styles.primaryBtn} onPress={() => { timer.stop(); completeCurrentRound(); }}>
                    <Text style={styles.primaryBtnText}>Complete Round {activeRound.roundNumber}</Text>
                  </Pressable>
                ) : (
                  <Text style={styles.mutedCenter}>Enter all results to continue.</Text>
                )}
                <RoundHistory
                  rounds={completedRounds}
                  playerMap={playerMap}
                  expandedRounds={expandedRounds}
                  onToggle={toggleRound}
                />
              </View>
            ) : null
          }
        />

        <TimerEditModal
          visible={showTimerEdit}
          value={timerInput}
          onChangeText={setTimerInput}
          onSave={handleTimerEditSave}
          onCancel={() => setShowTimerEdit(false)}
        />
        <TimerAlarmModal visible={timer.showAlarm} onDismiss={timer.dismissAlarm} />
      </View>
    );
  }

  // ── Between rounds ────────────────────────────────────────────────────────

  const lastRound = completedRounds[completedRounds.length - 1];
  const nextRoundNum = lastRound.roundNumber + 1;
  const standings = computeStandings(tournament.activePlayers, completedRounds);
  const top3 = standings.slice(0, 3);

  const handleFinish = () => {
    Alert.alert('Finish Tournament', 'Finish the tournament now?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Finish', onPress: finishTournament },
    ]);
  };

  const handleDrop = id => {
    const name = playerMap[id] ?? id;
    Alert.alert('Drop Player', `Drop "${name}" from the tournament?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Drop', style: 'destructive', onPress: () => dropPlayer(id) },
    ]);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      {/* Standings preview */}
      <View style={styles.standingsCard}>
        <Text style={styles.standingsCardTitle}>After Round {lastRound.roundNumber}</Text>
        {top3.map((s, i) => (
          <Text key={s.playerId} style={styles.standingsPreviewRow}>
            {i + 1}. {playerMap[s.playerId] ?? s.playerId} — {s.matchPoints} pts ({s.matchWins}-{s.matchLosses}-{s.matchDraws})
          </Text>
        ))}
      </View>

      {/* Round actions */}
      <View style={styles.betweenActions}>
        <Pressable style={styles.primaryBtn} onPress={() => { pairNextRound(); timer.start(); }}>
          <Text style={styles.primaryBtnText}>Pair Round {nextRoundNum}</Text>
        </Pressable>
        <Pressable style={styles.secondaryBtn} onPress={handleFinish}>
          <Text style={styles.secondaryBtnText}>Finish Tournament</Text>
        </Pressable>
      </View>

      {/* Player management */}
      <Pressable style={styles.collapsibleHeader} onPress={() => setShowPlayerMgmt(p => !p)}>
        <Text style={styles.collapsibleTitle}>Player Management {showPlayerMgmt ? '▲' : '▼'}</Text>
      </Pressable>
      {showPlayerMgmt && (
        <View style={styles.collapsibleContent}>
          {tournament.activePlayers.map(id => (
            <View key={id} style={styles.manageRow}>
              <Text style={styles.managePlayerName}>{playerMap[id] ?? id}</Text>
              <Pressable style={styles.dropBtn} onPress={() => handleDrop(id)}>
                <Text style={styles.dropBtnText}>Drop</Text>
              </Pressable>
            </View>
          ))}
        </View>
      )}

      <RoundHistory
        rounds={completedRounds}
        playerMap={playerMap}
        expandedRounds={expandedRounds}
        onToggle={toggleRound}
        allowEdit
      />

      <TimerAlarmModal visible={timer.showAlarm} onDismiss={timer.dismissAlarm} />
    </ScrollView>
  );
}

// ── MatchCard ─────────────────────────────────────────────────────────────────

function MatchCard({
  match, tableNum, playerMap, ptsLabel,
  swapSourceId, byeReassignMode, canSwap,
  onSelectSwapSource, onSwapTarget, onByeTarget, onChangeBye,
  onSubmitResult, onEditResult,
}) {
  const [editingResult, setEditingResult] = useState(false);

  // Bye match
  if (match.isBye) {
    const name = (playerMap[match.player1Id] ?? match.player1Id) + ptsLabel(match.player1Id);
    const canChange = !swapSourceId && !byeReassignMode;
    return (
      <View style={[styles.matchCard, styles.byeCard]}>
        <Text style={styles.tableLabel}>BYE</Text>
        <View style={styles.byeRow}>
          <Text style={styles.byePlayer}>{name}</Text>
          <Text style={styles.byeResult}>2-0 (auto)</Text>
          {canChange && (
            <Pressable style={styles.smallBtn} onPress={onChangeBye}>
              <Text style={styles.smallBtnText}>Change</Text>
            </Pressable>
          )}
        </View>
      </View>
    );
  }

  const p1name = (playerMap[match.player1Id] ?? match.player1Id) + ptsLabel(match.player1Id);
  const p2name = (playerMap[match.player2Id] ?? match.player2Id) + ptsLabel(match.player2Id);
  const isSource = match.player1Id === swapSourceId || match.player2Id === swapSourceId;

  // Done match
  if (match.result && !editingResult) {
    const { player1Wins, player2Wins, draws } = match.result;
    const scoreStr = draws > 0 ? `${player1Wins}-${player2Wins}-${draws}` : `${player1Wins}-${player2Wins}`;
    const winner = player1Wins > player2Wins ? p1name : player2Wins > player1Wins ? p2name : null;
    const canEdit = canCorrectResult(match.id);
    return (
      <View style={[styles.matchCard, styles.doneCard]}>
        <Text style={styles.tableLabel}>Table {tableNum}</Text>
        <View style={styles.matchPlayers}>
          <Text style={[styles.playerName, player1Wins > player2Wins && styles.winnerText]} numberOfLines={1}>{p1name}</Text>
          <Text style={styles.vs}>vs</Text>
          <Text style={[styles.playerName, player2Wins > player1Wins && styles.winnerText]} numberOfLines={1}>{p2name}</Text>
        </View>
        <View style={styles.resultRow}>
          <Text style={styles.resultScore}>{scoreStr}</Text>
          {winner && <Text style={styles.resultWinner}>{winner} wins</Text>}
          {!winner && <Text style={styles.resultDraw}>Draw</Text>}
          {canEdit && (
            <Pressable style={styles.smallBtn} onPress={() => setEditingResult(true)}>
              <Text style={styles.smallBtnText}>Edit</Text>
            </Pressable>
          )}
        </View>
      </View>
    );
  }

  // Swap source match
  if (swapSourceId && isSource) {
    return (
      <View style={[styles.matchCard, styles.swapSourceCard]}>
        <Text style={styles.tableLabel}>Table {tableNum}</Text>
        <View style={styles.matchPlayers}>
          <Text style={[styles.playerName, match.player1Id === swapSourceId && styles.swapSelected]} numberOfLines={1}>{p1name}</Text>
          <Text style={styles.vs}>vs</Text>
          <Text style={[styles.playerName, match.player2Id === swapSourceId && styles.swapSelected]} numberOfLines={1}>{p2name}</Text>
        </View>
        <Text style={styles.swapHint}>Select a player on another table</Text>
      </View>
    );
  }

  // Swap target match
  if (swapSourceId && !isSource) {
    return (
      <View style={[styles.matchCard, styles.swapTargetCard]}>
        <Text style={styles.tableLabel}>Table {tableNum}</Text>
        <View style={styles.matchPlayers}>
          <Pressable onPress={() => onSwapTarget(match.player1Id)}>
            <Text style={[styles.playerName, styles.swapTargetText]} numberOfLines={1}>{p1name}</Text>
          </Pressable>
          <Text style={styles.vs}>vs</Text>
          <Pressable onPress={() => onSwapTarget(match.player2Id)}>
            <Text style={[styles.playerName, styles.swapTargetText]} numberOfLines={1}>{p2name}</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // Bye reassign target match
  if (byeReassignMode) {
    return (
      <View style={[styles.matchCard, styles.swapTargetCard]}>
        <Text style={styles.tableLabel}>Table {tableNum}</Text>
        <View style={styles.matchPlayers}>
          <Pressable onPress={() => onByeTarget(match.player1Id)}>
            <Text style={[styles.playerName, styles.swapTargetText]} numberOfLines={1}>{p1name}</Text>
          </Pressable>
          <Text style={styles.vs}>vs</Text>
          <Pressable onPress={() => onByeTarget(match.player2Id)}>
            <Text style={[styles.playerName, styles.swapTargetText]} numberOfLines={1}>{p2name}</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // Normal pending match (or editing result)
  const handleResult = (opt) => {
    const result = { player1Wins: opt.p1, player2Wins: opt.p2, draws: opt.d };
    if (editingResult) {
      onEditResult(match.id, result);
      setEditingResult(false);
    } else {
      onSubmitResult(match.id, result);
    }
  };

  return (
    <View style={[styles.matchCard, styles.pendingCard]}>
      <Text style={styles.tableLabel}>Table {tableNum}</Text>
      <View style={styles.matchPlayers}>
        <View style={styles.playerSwapWrap}>
          <Text style={styles.playerName} numberOfLines={1}>{p1name}</Text>
          {canSwap && !editingResult && (
            <Pressable style={styles.swapBtn} onPress={() => onSelectSwapSource(match.player1Id)}>
              <Text style={styles.swapBtnText}>⇄</Text>
            </Pressable>
          )}
        </View>
        <Text style={styles.vs}>vs</Text>
        <View style={styles.playerSwapWrap}>
          {canSwap && !editingResult && (
            <Pressable style={styles.swapBtn} onPress={() => onSelectSwapSource(match.player2Id)}>
              <Text style={styles.swapBtnText}>⇄</Text>
            </Pressable>
          )}
          <Text style={styles.playerName} numberOfLines={1}>{p2name}</Text>
        </View>
      </View>
      <View style={styles.resultBtns}>
        {RESULT_OPTIONS.map(opt => (
          <Pressable key={opt.label} style={styles.resultBtn} onPress={() => handleResult(opt)}>
            <Text style={styles.resultBtnText}>{opt.label}</Text>
          </Pressable>
        ))}
      </View>
      {editingResult && (
        <Pressable onPress={() => setEditingResult(false)}>
          <Text style={styles.cancelEditText}>Cancel edit</Text>
        </Pressable>
      )}
    </View>
  );
}

// ── RoundHistory ──────────────────────────────────────────────────────────────

function RoundHistory({ rounds, playerMap, expandedRounds, onToggle, allowEdit = false }) {
  if (rounds.length === 0) return null;

  return (
    <View style={styles.historySection}>
      <Text style={styles.historySectionTitle}>Round History</Text>
      {[...rounds].reverse().map(round => (
        <View key={round.roundNumber}>
          <Pressable style={styles.historyRoundHeader} onPress={() => onToggle(round.roundNumber)}>
            <Text style={styles.historyRoundTitle}>
              Round {round.roundNumber} {expandedRounds.has(round.roundNumber) ? '▲' : '▼'}
            </Text>
          </Pressable>
          {expandedRounds.has(round.roundNumber) && (
            <View style={styles.historyMatches}>
              {round.matches.map(match => (
                <HistoryMatchRow
                  key={match.id}
                  match={match}
                  playerMap={playerMap}
                  allowEdit={allowEdit}
                />
              ))}
            </View>
          )}
        </View>
      ))}
    </View>
  );
}

function HistoryMatchRow({ match, playerMap, allowEdit }) {
  const [editing, setEditing] = useState(false);

  if (match.isBye) {
    return (
      <View style={styles.historyMatch}>
        <Text style={styles.historyP1}>{playerMap[match.player1Id] ?? match.player1Id}</Text>
        <Text style={styles.historyScore}>BYE 2-0</Text>
        <Text style={styles.historyP2} />
      </View>
    );
  }

  const p1 = playerMap[match.player1Id] ?? match.player1Id;
  const p2 = playerMap[match.player2Id] ?? match.player2Id;

  if (!match.result) {
    return (
      <View style={styles.historyMatch}>
        <Text style={styles.historyP1}>{p1}</Text>
        <Text style={styles.historyScore}>—</Text>
        <Text style={styles.historyP2}>{p2}</Text>
      </View>
    );
  }

  const { player1Wins, player2Wins, draws } = match.result;
  const score = draws > 0 ? `${player1Wins}-${player2Wins}-${draws}` : `${player1Wins}-${player2Wins}`;

  if (editing) {
    return (
      <View style={styles.historyEditRow}>
        <Text style={styles.historyEditLabel}>{p1} vs {p2}</Text>
        <View style={styles.resultBtns}>
          {RESULT_OPTIONS.map(opt => (
            <Pressable
              key={opt.label}
              style={styles.resultBtn}
              onPress={() => {
                submitResult(match.id, { player1Wins: opt.p1, player2Wins: opt.p2, draws: opt.d });
                repairActiveRound();
                setEditing(false);
              }}
            >
              <Text style={styles.resultBtnText}>{opt.label}</Text>
            </Pressable>
          ))}
        </View>
        <Pressable onPress={() => setEditing(false)}>
          <Text style={styles.cancelEditText}>Cancel</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.historyMatch}>
      <Text style={[styles.historyP1, player1Wins > player2Wins && styles.winnerText]} numberOfLines={1}>{p1}</Text>
      <Text style={styles.historyScore}>{score}</Text>
      <Text style={[styles.historyP2, player2Wins > player1Wins && styles.winnerText]} numberOfLines={1}>{p2}</Text>
      {allowEdit && (
        <Pressable style={styles.smallBtn} onPress={() => setEditing(true)}>
          <Text style={styles.smallBtnText}>Edit</Text>
        </Pressable>
      )}
    </View>
  );
}

// ── TimerEditModal ────────────────────────────────────────────────────────────

function TimerEditModal({ visible, value, onChangeText, onSave, onCancel }) {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.modalOverlay}>
        <View style={styles.modalBox}>
          <Text style={styles.modalTitle}>Set Timer</Text>
          <Text style={styles.modalHint}>Enter minutes (e.g. 65) or M:SS (e.g. 65:00)</Text>
          <TextInput
            style={styles.modalInput}
            value={value}
            onChangeText={onChangeText}
            placeholder="65"
            keyboardType="numbers-and-punctuation"
            autoFocus
            onSubmitEditing={onSave}
            returnKeyType="done"
          />
          <View style={styles.modalButtons}>
            <Pressable style={styles.modalCancel} onPress={onCancel}>
              <Text style={styles.modalCancelText}>Cancel</Text>
            </Pressable>
            <Pressable style={styles.modalSave} onPress={onSave}>
              <Text style={styles.modalSaveText}>Set</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ── TokenInputModal ───────────────────────────────────────────────────────────

function TokenInputModal({ visible, value, onChangeText, onSave, onCancel }) {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.modalOverlay}>
        <View style={styles.modalBox}>
          <Text style={styles.modalTitle}>GitHub Token</Text>
          <Text style={styles.modalHint}>Enter a GitHub PAT with repo write access. It will be saved for future uploads.</Text>
          <TextInput
            style={styles.modalInput}
            value={value}
            onChangeText={onChangeText}
            placeholder="ghp_..."
            autoCapitalize="none"
            autoCorrect={false}
            secureTextEntry
            autoFocus
            returnKeyType="done"
            onSubmitEditing={onSave}
          />
          <View style={styles.modalButtons}>
            <Pressable style={styles.modalCancel} onPress={onCancel}>
              <Text style={styles.modalCancelText}>Cancel</Text>
            </Pressable>
            <Pressable style={styles.modalSave} onPress={onSave}>
              <Text style={styles.modalSaveText}>Save & Upload</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  scrollContent: { padding: 12, gap: 10, paddingBottom: 40 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 },
  emptyState: { color: '#999', fontSize: 15 },

  // Timer header
  timerRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: '#fff', paddingHorizontal: 16, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: '#e0e0e0',
  },
  roundLabel: { fontSize: 17, fontWeight: '700', color: '#222' },
  timerDisplay: { fontSize: 22, fontWeight: '700', fontVariant: ['tabular-nums'] },

  // Banner
  banner: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: '#fef3c7', paddingHorizontal: 14, paddingVertical: 8,
    borderBottomWidth: 1, borderBottomColor: '#fcd34d',
  },
  bannerText: { fontSize: 14, color: '#92400e', flex: 1 },
  bannerBold: { fontWeight: '700' },
  bannerCancel: { fontSize: 14, color: '#2563eb', fontWeight: '600', paddingLeft: 12 },

  // Match cards
  matchCard: {
    backgroundColor: '#fff', marginHorizontal: 10, marginTop: 8,
    borderRadius: 10, padding: 12, borderWidth: 1, borderColor: '#e0e0e0',
  },
  byeCard: { borderColor: '#d1d5db', backgroundColor: '#f9fafb' },
  doneCard: { borderColor: '#d1fae5', backgroundColor: '#f0fdf4' },
  pendingCard: { borderColor: '#bfdbfe', backgroundColor: '#eff6ff' },
  swapSourceCard: { borderColor: '#fbbf24', backgroundColor: '#fffbeb', borderWidth: 2 },
  swapTargetCard: { borderColor: '#a78bfa', backgroundColor: '#f5f3ff', borderWidth: 2 },

  tableLabel: { fontSize: 11, color: '#888', fontWeight: '600', textTransform: 'uppercase', marginBottom: 6 },

  matchPlayers: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  playerName: { flex: 1, fontSize: 14, color: '#333' },
  vs: { fontSize: 12, color: '#999', paddingHorizontal: 4 },
  winnerText: { fontWeight: '700', color: '#15803d' },
  swapSelected: { fontWeight: '700', color: '#d97706' },
  swapTargetText: { color: '#7c3aed', fontWeight: '600', textDecorationLine: 'underline' },
  swapHint: { fontSize: 12, color: '#92400e', marginTop: 4 },

  playerSwapWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 4 },
  swapBtn: { padding: 4 },
  swapBtnText: { fontSize: 16, color: '#6b7280' },

  resultRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 },
  resultScore: { fontSize: 16, fontWeight: '700', color: '#222' },
  resultWinner: { fontSize: 13, color: '#15803d', flex: 1 },
  resultDraw: { fontSize: 13, color: '#6b7280', flex: 1 },

  resultBtns: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  resultBtn: {
    borderWidth: 1, borderColor: '#2563eb', borderRadius: 6,
    paddingHorizontal: 10, paddingVertical: 6, backgroundColor: '#fff',
  },
  resultBtnText: { fontSize: 13, color: '#2563eb', fontWeight: '600' },

  cancelEditText: { fontSize: 13, color: '#dc2626', marginTop: 6, textAlign: 'center' },

  smallBtn: { borderWidth: 1, borderColor: '#999', borderRadius: 5, paddingHorizontal: 8, paddingVertical: 4 },
  smallBtnText: { fontSize: 12, color: '#555' },

  byeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  byePlayer: { fontSize: 14, flex: 1 },
  byeResult: { fontSize: 13, color: '#6b7280' },

  // Round actions
  roundActions: { padding: 12, gap: 10, alignItems: 'center' },

  // Seating
  sectionHeader: {
    fontSize: 14, fontWeight: '600', color: '#555',
    paddingHorizontal: 14, paddingTop: 12, paddingBottom: 4,
    textTransform: 'uppercase', letterSpacing: 0.5,
  },
  mutedCenter: { textAlign: 'center', color: '#888', fontSize: 14, marginBottom: 8 },
  seatingRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff', paddingHorizontal: 14, paddingVertical: 11,
    borderBottomWidth: 1, borderBottomColor: '#e0e0e0', gap: 12,
  },
  seatNum: { width: 28, fontSize: 14, color: '#888', textAlign: 'right' },
  seatName: { fontSize: 15 },

  // Footer
  footer: {
    backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#e0e0e0',
    padding: 12, gap: 10,
  },

  // Between rounds
  standingsCard: {
    backgroundColor: '#fff', borderRadius: 10, padding: 14,
    borderWidth: 1, borderColor: '#e0e0e0', gap: 6,
  },
  standingsCardTitle: { fontSize: 13, fontWeight: '600', color: '#888', textTransform: 'uppercase' },
  standingsPreviewRow: { fontSize: 14, color: '#333' },
  betweenActions: { gap: 10 },

  // Collapsible
  collapsibleHeader: {
    backgroundColor: '#fff', padding: 14, borderRadius: 8,
    borderWidth: 1, borderColor: '#e0e0e0',
  },
  collapsibleTitle: { fontSize: 15, fontWeight: '600', color: '#333' },
  collapsibleContent: {
    backgroundColor: '#fff', borderRadius: 8, borderWidth: 1,
    borderColor: '#e0e0e0', overflow: 'hidden',
  },
  manageRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 11,
    borderBottomWidth: 1, borderBottomColor: '#f0f0f0',
  },
  managePlayerName: { fontSize: 15 },
  dropBtn: { borderWidth: 1, borderColor: '#dc2626', borderRadius: 5, paddingHorizontal: 10, paddingVertical: 5 },
  dropBtnText: { fontSize: 13, color: '#dc2626' },

  // Complete screen
  bigTitle: { fontSize: 22, fontWeight: '700', color: '#222', textAlign: 'center', marginBottom: 8 },
  finalRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff', paddingHorizontal: 14, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#e0e0e0', gap: 8,
  },
  championRow: { backgroundColor: '#fffbeb' },
  finalRank: { width: 24, fontSize: 14, color: '#888' },
  finalName: { flex: 1, fontSize: 15 },
  finalPts: { fontSize: 15, fontWeight: '700' },
  finalRecord: { fontSize: 13, color: '#888' },
  championText: { color: '#92400e', fontWeight: '700' },

  // History
  historySection: { marginTop: 16 },
  historySectionTitle: { fontSize: 14, fontWeight: '600', color: '#555', marginBottom: 6, textTransform: 'uppercase' },
  historyRoundHeader: {
    backgroundColor: '#e5e7eb', padding: 10, borderRadius: 6, marginBottom: 2,
  },
  historyRoundTitle: { fontSize: 14, fontWeight: '600', color: '#374151' },
  historyMatches: { backgroundColor: '#fff', borderRadius: 6, marginBottom: 6, overflow: 'hidden' },
  historyMatch: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 8,
    borderBottomWidth: 1, borderBottomColor: '#f3f4f6', gap: 6,
  },
  historyP1: { flex: 1, fontSize: 13, textAlign: 'right' },
  historyScore: { width: 50, fontSize: 13, fontWeight: '600', textAlign: 'center', color: '#374151' },
  historyP2: { flex: 1, fontSize: 13 },
  historyEditRow: { padding: 12, gap: 6 },
  historyEditLabel: { fontSize: 13, color: '#555' },

  // Buttons
  primaryBtn: { backgroundColor: '#2563eb', borderRadius: 8, padding: 14, alignItems: 'center' },
  primaryBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  secondaryBtn: { borderWidth: 1, borderColor: '#999', borderRadius: 8, padding: 14, alignItems: 'center' },
  secondaryBtnText: { fontSize: 15, color: '#333', fontWeight: '600' },
  disabledBtn: { opacity: 0.5 },
  mutedText: { color: '#888', fontSize: 14, textAlign: 'center', padding: 8 },

  // Timer edit modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' },
  modalBox: { backgroundColor: '#fff', borderRadius: 10, padding: 20, width: '80%', gap: 10 },
  modalTitle: { fontSize: 16, fontWeight: '600' },
  modalHint: { fontSize: 13, color: '#888' },
  modalInput: {
    borderWidth: 1, borderColor: '#ccc', borderRadius: 6,
    paddingHorizontal: 10, paddingVertical: 8, fontSize: 15,
  },
  modalButtons: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 4 },
  modalCancel: { paddingHorizontal: 14, paddingVertical: 8 },
  modalCancelText: { color: '#666', fontSize: 15 },
  modalSave: { backgroundColor: '#2563eb', borderRadius: 6, paddingHorizontal: 14, paddingVertical: 8 },
  modalSaveText: { color: '#fff', fontWeight: '600', fontSize: 15 },
});
