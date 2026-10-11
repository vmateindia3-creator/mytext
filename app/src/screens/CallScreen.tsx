import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { COLORS } from '../config';
import { useAuth } from '../context/AuthContext';
import { getSocket } from '../lib/socket';

/**
 * Voice / video call screen built on WebRTC.
 *
 * NOTE: react-native-webrtc is a native module, so calls only work in a
 * development build (`npx expo run:android` or an EAS build) — not in the
 * stock Expo Go app. If the module is missing we show a friendly message
 * instead of crashing.
 */
function loadWebRTC(): any | null {
  try {
    // eslint-disable-next-line global-require
    return require('react-native-webrtc');
  } catch {
    return null;
  }
}

export function CallScreen({ route, navigation }: { route: any; navigation: any }) {
  const { peerId, peerName, video = true } = route.params;
  const { user } = useAuth();
  const [status, setStatus] = useState('Connecting…');
  const [muted, setMuted] = useState(false);
  const [iceServers, setIceServers] = useState<any[]>([]);

  const pcRef = useRef<any>(null);
  const localStreamRef = useRef<any>(null);
  const remoteStreamRef = useRef<any>(null);

  const webrtc = useRef(loadWebRTC()).current;
  const supported = !!webrtc;

  useEffect(() => {
    const socket = getSocket();
    if (!socket || !supported) return;

    const { RTCPeerConnection, mediaDevices, RTCView } = webrtc;

    const setupPeer = () => {
      const pc = new RTCPeerConnection({ iceServers });
      pc.onicecandidate = (e: any) => {
        if (e.candidate) socket.emit('call:ice', { to: peerId, candidate: e.candidate });
      };
      pc.ontrack = (e: any) => {
        remoteStreamRef.current = e.streams[0];
        setStatus('Connected');
      };
      return pc;
    };

    const startMedia = async () => {
      const stream = await mediaDevices.getUserMedia({ audio: true, video });
      localStreamRef.current = stream;
      return stream;
    };

    const startCall = async () => {
      const stream = await startMedia();
      const pc = setupPeer();
      pcRef.current = pc;
      stream.getTracks().forEach((t: any) => pc.addTrack(t, stream));
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socket.emit('call:offer', { to: peerId, sdp: offer });
      setStatus('Ringing…');
    };

    // The caller kicks things off; the callee answers the incoming offer.
    if (user!.id !== peerId) {
      // We are the caller (screen was opened from the chat header).
      socket.emit('call:invite', { to: peerId, video });
      startCall().catch(() => setStatus('Could not start call'));
    }

    const onOffer = async (payload: any) => {
      if (payload.from !== peerId) return;
      const stream = await startMedia();
      const pc = setupPeer();
      pcRef.current = pc;
      stream.getTracks().forEach((t: any) => pc.addTrack(t, stream));
      await pc.setRemoteDescription(new webrtc.RTCSessionDescription(payload.sdp));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit('call:answer', { to: peerId, sdp: answer });
      setStatus('Connected');
    };

    const onAnswer = async (payload: any) => {
      if (payload.from !== peerId || !pcRef.current) return;
      await pcRef.current.setRemoteDescription(new webrtc.RTCSessionDescription(payload.sdp));
      setStatus('Connected');
    };

    const onIce = async (payload: any) => {
      if (payload.from !== peerId || !pcRef.current) return;
      try {
        await pcRef.current.addIceCandidate(new webrtc.RTCIceCandidate(payload.candidate));
      } catch {
        /* ignore late candidates */
      }
    };

    const onEnd = () => hangup();

    socket.on('call:offer', onOffer);
    socket.on('call:answer', onAnswer);
    socket.on('call:ice', onIce);
    socket.on('call:end', onEnd);
    socket.on('call:reject', onEnd);

    return () => {
      socket.off('call:offer', onOffer);
      socket.off('call:answer', onAnswer);
      socket.off('call:ice', onIce);
      socket.off('call:end', onEnd);
      socket.off('call:reject', onEnd);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [peerId, iceServers]);

  const hangup = () => {
    getSocket()?.emit('call:end', { to: peerId });
    localStreamRef.current?.getTracks().forEach((t: any) => t.stop());
    pcRef.current?.close();
    pcRef.current = null;
    navigation.goBack();
  };

  const toggleMute = () => {
    const track = localStreamRef.current?.getAudioTracks?.()[0];
    if (track) {
      track.enabled = muted;
      setMuted(!muted);
    }
  };

  if (!supported) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Calls need a development build</Text>
        <Text style={styles.sub}>
          Voice/video calling uses the native react-native-webrtc module, which is not available in
          the stock Expo Go app. Build a dev client with `npx expo run:android` (or an EAS build) to
          enable calls. Everything else in the app works in Expo Go.
        </Text>
        <TouchableOpacity style={styles.end} onPress={() => navigation.goBack()}>
          <Text style={styles.endText}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.name}>{peerName}</Text>
      <Text style={styles.status}>{status}</Text>

      <View style={styles.controls}>
        <TouchableOpacity style={styles.ctrl} onPress={toggleMute}>
          <Text style={styles.ctrlText}>{muted ? '🔇' : '🎙️'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.end} onPress={hangup}>
          <Text style={styles.endText}>End</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  title: { color: COLORS.text, fontSize: 20, fontWeight: '700', textAlign: 'center' },
  sub: { color: COLORS.textMuted, textAlign: 'center', marginTop: 12, lineHeight: 21 },
  name: { color: COLORS.text, fontSize: 26, fontWeight: '700' },
  status: { color: COLORS.textMuted, marginTop: 8, marginBottom: 40 },
  controls: { flexDirection: 'row', alignItems: 'center' },
  ctrl: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: COLORS.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 12,
  },
  ctrlText: { fontSize: 24 },
  end: {
    backgroundColor: COLORS.danger,
    borderRadius: 30,
    paddingHorizontal: 28,
    paddingVertical: 16,
    marginTop: 20,
  },
  endText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
