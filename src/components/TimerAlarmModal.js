import { Modal, View, Text, Pressable, StyleSheet } from 'react-native';

export default function TimerAlarmModal({ visible, onDismiss }) {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.box}>
          <Text style={styles.title}>Time is up!</Text>
          <Text style={styles.subtitle}>Round time has ended.</Text>
          <Pressable style={styles.btn} onPress={onDismiss}>
            <Text style={styles.btnText}>OK</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  box: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 32,
    width: '75%',
    alignItems: 'center',
    gap: 12,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: '#dc2626',
  },
  subtitle: {
    fontSize: 15,
    color: '#666',
  },
  btn: {
    marginTop: 8,
    backgroundColor: '#2563eb',
    borderRadius: 8,
    paddingHorizontal: 40,
    paddingVertical: 12,
  },
  btnText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },
});
