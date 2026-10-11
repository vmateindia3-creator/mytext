import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_webrtc/flutter_webrtc.dart';
import 'package:provider/provider.dart';

import '../services/socket_service.dart';
import '../theme.dart';

/// A 1:1 voice/video call built on WebRTC, with signalling relayed by the
/// Mytext backend over Socket.io.
class CallScreen extends StatefulWidget {
  const CallScreen({
    super.key,
    required this.peerId,
    required this.peerName,
    this.video = true,
  });

  final String peerId;
  final String peerName;
  final bool video;

  @override
  State<CallScreen> createState() => _CallScreenState();
}

class _CallScreenState extends State<CallScreen> {
  final _localRenderer = RTCVideoRenderer();
  final _remoteRenderer = RTCVideoRenderer();

  RTCPeerConnection? _pc;
  MediaStream? _localStream;
  SocketService? _socket;

  String _status = 'Connecting…';
  bool _muted = false;

  static const _iceConfig = {
    'iceServers': [
      {'urls': 'stun:stun.l.google.com:19302'},
      {'urls': 'stun:stun1.l.google.com:19302'},
    ],
  };

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _start());
  }

  @override
  void dispose() {
    _localStream?.getTracks().forEach((t) => t.stop());
    _pc?.close();
    _localRenderer.dispose();
    _remoteRenderer.dispose();
    super.dispose();
  }

  Future<void> _start() async {
    _socket = context.read<SocketService>();

    await _localRenderer.initialize();
    await _remoteRenderer.initialize();

    _socket!.on('call:answer', _onAnswer);
    _socket!.on('call:ice', _onIce);
    _socket!.on('call:end', (_) => _hangup());
    _socket!.on('call:reject', (_) => _hangup());

    await _startMedia();
    _pc = await createPeerConnection(_iceConfig);

    _pc!.onIceCandidate = (candidate) {
      if (candidate.candidate != null) {
        _socket!.callEvent('call:ice', {'to': widget.peerId, 'candidate': candidate.toMap()});
      }
    };
    _pc!.onTrack = (event) {
      if (event.streams.isNotEmpty) {
        _remoteRenderer.srcObject = event.streams.first;
        setState(() => _status = 'Connected');
      }
    };

    _localStream!.getTracks().forEach((track) {
      _pc!.addTrack(track, _localStream!);
    });

    // Caller flow: invite then send an offer.
    _socket!.callEvent('call:invite', {'to': widget.peerId, 'video': widget.video});
    final offer = await _pc!.createOffer();
    await _pc!.setLocalDescription(offer);
    _socket!.callEvent('call:offer', {'to': widget.peerId, 'sdp': offer.toMap()});
    setState(() => _status = 'Ringing…');
  }

  Future<void> _startMedia() async {
    final stream = await navigator.mediaDevices.getUserMedia({
      'audio': true,
      'video': widget.video
          ? {'facingMode': 'user'}
          : false,
    });
    _localStream = stream;
    _localRenderer.srcObject = stream;
  }

  Future<void> _onAnswer(dynamic payload) async {
    final map = payload as Map<String, dynamic>;
    if (map['from'] != widget.peerId) return;
    final sdp = map['sdp'] as Map<String, dynamic>;
    await _pc?.setRemoteDescription(RTCSessionDescription(sdp['sdp'] as String, sdp['type'] as String));
    setState(() => _status = 'Connected');
  }

  Future<void> _onIce(dynamic payload) async {
    final map = payload as Map<String, dynamic>;
    if (map['from'] != widget.peerId) return;
    final candidate = map['candidate'] as Map<String, dynamic>;
    try {
      await _pc?.addCandidate(RTCIceCandidate(
        candidate['candidate'] as String?,
        candidate['sdpMid'] as String?,
        candidate['sdpMLineIndex'] as int?,
      ));
    } catch (_) {
      // Ignore candidates that arrive after the call has ended.
    }
  }

  void _toggleMute() {
    final tracks = _localStream?.getAudioTracks() ?? const [];
    if (tracks.isEmpty) return;
    final track = tracks.first;
    track.enabled = _muted;
    setState(() => _muted = !_muted);
  }

  void _hangup() {
    _socket?.callEvent('call:end', {'to': widget.peerId});
    if (mounted) Navigator.of(context).maybePop();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppTheme.background,
      body: SafeArea(
        child: Stack(
          children: [
            // Remote video (full screen) or a placeholder while ringing.
            Positioned.fill(
              child: _remoteRenderer.srcObject != null
                  ? RTCVideoView(_remoteRenderer, objectFit: RTCVideoViewObjectFit.RTCVideoViewObjectFitCover)
                  : Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const CircleAvatar(
                          radius: 48,
                          backgroundColor: AppTheme.surfaceAlt,
                          child: Icon(Icons.person, size: 48, color: AppTheme.textMuted),
                        ),
                        const SizedBox(height: 16),
                        Text(
                          widget.peerName,
                          style: const TextStyle(fontSize: 24, fontWeight: FontWeight.w700),
                        ),
                        const SizedBox(height: 8),
                        Text(_status, style: const TextStyle(color: AppTheme.textMuted)),
                      ],
                    ),
            ),

            // Local preview in the corner.
            if (widget.video && _localRenderer.srcObject != null)
              Positioned(
                right: 16,
                top: 16,
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(12),
                  child: SizedBox(
                    width: 110,
                    height: 150,
                    child: RTCVideoView(_localRenderer, mirror: true),
                  ),
                ),
              ),

            // Controls.
            Positioned(
              bottom: 32,
              left: 0,
              right: 0,
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  _roundButton(
                    icon: _muted ? Icons.mic_off : Icons.mic,
                    onTap: _toggleMute,
                  ),
                  const SizedBox(width: 24),
                  _roundButton(
                    icon: Icons.call_end,
                    color: AppTheme.danger,
                    onTap: _hangup,
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _roundButton({
    required IconData icon,
    required VoidCallback onTap,
    Color color = AppTheme.surfaceAlt,
  }) {
    return CircleAvatar(
      radius: 30,
      backgroundColor: color,
      child: IconButton(
        icon: Icon(icon, color: Colors.white),
        onPressed: onTap,
      ),
    );
  }
}
