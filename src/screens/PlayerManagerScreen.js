import { useState, useEffect } from 'react';
import {
  View, Text, TextInput, Pressable, FlatList,
  Alert, Modal, StyleSheet, KeyboardAvoidingView, Platform,
} from 'react-native';
import { getState, subscribe } from '../state/store.js';
import { addPlayer, editPlayer, deletePlayer, initPlayers } from '../state/players.js';

export default function PlayerManagerScreen({ navigation }) {
  const [players, setPlayers] = useState(getState().players);
  const [newName, setNewName] = useState('');
  const [editingPlayer, setEditingPlayer] = useState(null);
  const [editName, setEditName] = useState('');

  useEffect(() => {
    initPlayers();
    const unsub = subscribe(state => setPlayers(state.players));
    return unsub;
  }, []);

  useEffect(() => {
    navigation.setOptions({ title: `Players (${players.length})` });
  }, [players.length]);

  const sorted = [...players].sort((a, b) => a.name.localeCompare(b.name));

  const handleAdd = () => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    addPlayer(trimmed);
    setNewName('');
  };

  const handleDelete = (player) => {
    Alert.alert(
      'Remove Player',
      `Remove "${player.name}" from the master list?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => deletePlayer(player.id) },
      ]
    );
  };

  const openEdit = (player) => {
    setEditingPlayer(player);
    setEditName(player.name);
  };

  const handleEditSave = () => {
    const trimmed = editName.trim();
    if (trimmed && trimmed !== editingPlayer.name) {
      editPlayer(editingPlayer.id, trimmed);
    }
    setEditingPlayer(null);
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Add row */}
      <View style={styles.addRow}>
        <TextInput
          style={styles.input}
          placeholder="New player name"
          maxLength={40}
          value={newName}
          onChangeText={setNewName}
          onSubmitEditing={handleAdd}
          returnKeyType="done"
        />
        <Pressable style={styles.addBtn} onPress={handleAdd}>
          <Text style={styles.addBtnText}>Add</Text>
        </Pressable>
      </View>

      {/* Player list or empty state */}
      {sorted.length === 0 ? (
        <Text style={styles.emptyState}>No players yet. Add some above.</Text>
      ) : (
        <FlatList
          data={sorted}
          keyExtractor={p => p.id}
          renderItem={({ item }) => (
            <View style={styles.playerRow}>
              <Text style={styles.playerName}>{item.name}</Text>
              <View style={styles.actions}>
                <Pressable style={styles.editBtn} onPress={() => openEdit(item)}>
                  <Text style={styles.editBtnText}>Edit</Text>
                </Pressable>
                <Pressable style={styles.deleteBtn} onPress={() => handleDelete(item)}>
                  <Text style={styles.deleteBtnText}>Delete</Text>
                </Pressable>
              </View>
            </View>
          )}
        />
      )}

      {/* Start Tournament */}
      <Pressable style={styles.startBtn} onPress={() => navigation.navigate('TournamentSetup')}>
        <Text style={styles.startBtnText}>Start Tournament →</Text>
      </Pressable>

      {/* Rename Modal */}
      <Modal visible={!!editingPlayer} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Rename Player</Text>
            <TextInput
              style={styles.modalInput}
              value={editName}
              onChangeText={setEditName}
              autoFocus
              maxLength={40}
              onSubmitEditing={handleEditSave}
              returnKeyType="done"
            />
            <View style={styles.modalButtons}>
              <Pressable style={styles.modalCancel} onPress={() => setEditingPlayer(null)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.modalSave} onPress={handleEditSave}>
                <Text style={styles.modalSaveText}>Save</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  addRow: {
    flexDirection: 'row',
    padding: 12,
    gap: 8,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 15,
    backgroundColor: '#fff',
  },
  addBtn: {
    backgroundColor: '#2563eb',
    borderRadius: 6,
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  addBtnText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 15,
  },
  emptyState: {
    flex: 1,
    textAlign: 'center',
    marginTop: 60,
    color: '#999',
    fontSize: 15,
  },
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  playerName: {
    flex: 1,
    fontSize: 15,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
  },
  editBtn: {
    borderWidth: 1,
    borderColor: '#999',
    borderRadius: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  editBtnText: {
    fontSize: 13,
    color: '#333',
  },
  deleteBtn: {
    borderWidth: 1,
    borderColor: '#dc2626',
    borderRadius: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  deleteBtnText: {
    fontSize: 13,
    color: '#dc2626',
  },
  startBtn: {
    margin: 12,
    backgroundColor: '#16a34a',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
  },
  startBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalBox: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 20,
    width: '80%',
    gap: 12,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  modalInput: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 15,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  modalCancel: {
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  modalCancelText: {
    color: '#666',
    fontSize: 15,
  },
  modalSave: {
    backgroundColor: '#2563eb',
    borderRadius: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  modalSaveText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 15,
  },
});
