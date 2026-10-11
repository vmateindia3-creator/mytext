import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_webrtc/flutter_webrtc.dart';
import 'package:provider/provider.dart';

import '../services/call_service.dart';
import '../services/socket_service.dart';
import '../theme.dart';

/// A 1:1 voice or video call built on WebRTC. Signalling (offer/answer/ICE) is
/// relayed by the Mytext backend over Socket.io; the audio and video themselves
/// travel directly between the two phones, or through a TURN relay when the
/// network makes that necessary.
class CallScreen extends StatefulWidget {
  const CallScreen({
    super.key,
    required this.peerId,
    required this.peerName,
    this.video = true,
    this.isCaller = true,
    this.initialOffer,
    this.earlyIce = const [],
  });

  final String peerId;
  final String peerName;

  /// True for a video call, false for voice-only.
  final bool video;

  /// True when we are placing the call; false when we are answering one.
  final bool isCaller;

  /// The caller's SDP (only used when answering).
  final Map<String, dynamic>? initialOffer;

  /// ICE candidates that arrived before we answered.
  final List<Map<String, dynamic>> earlyIce;

  @override
  State<CallScreen> createState() => _CallScreenState();
}

class _CallScreenState extends State<CallScreen> {
  final _localRenderer = RTCVideoRenderer();
  final _remoteRenderer = RTCVideoRenderer();

  RTCPeerConnection? _pc;
  MediaStream? _localStream;
  SocketService? _socket;
  CallService? _calls;

  String _status = 'Connecting…';
  bool _muted = false;
  bool _cameraOn = true;
  bool _answered = false;
  bool _ended = false;

  /// Used only if the server has not told us which ICE servers to use.
  static const _fallbackIce = [
    {'urls': 'stun:stun.l.google.com:19302'},
  ];

  @override
  void initState() {
    super.initState();
    _cameraOn = widget.video;
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
    _calls = context.read<CallService>();

    await _localRenderer.initialize();
    await _remoteRenderer.initialize();

    _socket!.on('call:answer', _onAnswer);
    _socket!.on('call:offer', _onOffer);
    _socket!.on('call:ice', _onIce);
    _socket!.on('call:end', (_) => _finish());
    _socket!.on('call:reject', (_) => _finish());

    await _startMedia();

    final iceServers = _socket!.lastIceServers ?? _fallbackIce;
    _pc = await createPeerConnection({'iceServers': iceServers});

    _pc!.onIceCandidate = (candidate) {
      if (candidate.candidate != null) {
        _socket!.callEvent('call:ice', {
          'to': widget.peerId,
          'candidate': candidate.toMap(),
        });
      }
    };

    _pc!.onTrack = (event) {
      if (event.streams.isNotEmpty) {
        _remoteRenderer.srcObject = event.streams.first;
        if (mounted) setState(() => _status = 'Connected');
      }
    };

    for (final track in _localStream!.getTracks()) {
      await _pc!.addTrack(track, _localStream!);
    }

    if (widget.isCaller) {
      // We are placing the call: invite, then send our offer.
      _socket!.callEvent('call:invite', {'to': widget.peerId, 'video': widget.video});
      final offer = await _pc!.createOffer();
      await _pc!.setLocalDescription(offer);
      _socket!.callEvent('call:offer', {'to': widget.peerId, 'sdp': offer.toMap()});
      if (mounted) setState(() => _status = 'Ringing…');
    } else if (widget.initialOffer != null) {
      await _answerOffer(widget.initialOffer!, widget.earlyIce);
    } else {
      // The offer had not arrived yet; _onOffer will finish the handshake.
      if (mounted) setState(() => _status = 'Connecting…');
    }
  }

  Future<void> _startMedia() async {
    _localStream = await navigator.mediaDevices.getUserMedia({
      'audio': true,
      'video': widget.video ? {'facingMode': 'user'} : false,
    });
    _localRenderer.srcObject = _localStream;
  }

  /// Answer a caller's offer (we are the callee).
  Future<void> _answerOffer(
    Map<String, dynamic> offer,
    List<Map<String, dynamic>> ice,
  ) async {
    if (_answered || _pc == null) return;
    _answered = true;
    try {
      await _pc!.setRemoteDescription(
        RTCSessionDescription(offer['sdp'] as String, offer['type'] as String),
      );
      for (final c in ice) {
        try {
          await _pc!.addCandidate(RTCIceCandidate(
            c['candidate'] as String?,
            c['sdpMid'] as String?,
            c['sdpMLineIndex'] as int?,
          ));
        } catch (_) {
          // Ignore candidates that arrive late.
        }
      }
      final answer = await _pc!.createAnswer();
      await _pc!.setLocalDescription(answer);
      _socket!.callEvent('call:answer', {'to': widget.peerId, 'sdp': answer.toMap()});
      if (mounted) setState(() => _status = 'Connecting…');
    } catch (_) {
      if (mounted) setState(() => _status = 'Could not connect');
    }
  }

  Future<void> _onOffer(dynamic payload) async {
    if (widget.isCaller) return;
    final map = (payload as Map).cast<String, dynamic>();
    if (map['from'] != widget.peerId) return;
    final sdp = map['sdp'];
    if (sdp is! Map) return;
    await _answerOffer(sdp.cast<String, dynamic>(), const []);
  }

  Future<void> _onAnswer(dynamic payload) async {
    if (!widget.isCaller) return;
    final map = (payload as Map).cast<String, dynamic>();
    if (map['from'] != widget.peerId) return;
    final sdp = map['sdp'] as Map<String, dynamic>;
    await _pc?.setRemoteDescription(
      RTCSessionDescription(sdp['sdp'] as String, sdp['type'] as String),
    );
    if (mounted) setState(() => _status = 'Connected');
  }

  Future<void> _onIce(dynamic payload) async {
    final map = (payload as Map).cast<String, dynamic>();
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
    final next = !_muted;
    tracks.first.enabled = !next;
    setState(() => _muted = next);
  }

  void _toggleCamera() {
    final tracks = _localStream?.getVideoTracks() ?? const [];
    if (tracks.isEmpty) return;
    final next = !_cameraOn;
    tracks.first.enabled = next;
    setState(() => _cameraOn = next);
  }

  void _hangup() {
    _socket?.callEvent('call:end', {'to': widget.peerId});
    _finish();
  }

  void _finish() {
    if (_ended) return;
    _ended = true;
    _calls?.clear();
    if (mounted) Navigator.of(context).maybePop();
  }

  @override
  Widget build(BuildContext context) {
    final remoteVideoReady = _remoteRenderer.srcObject != null;

    return Scaffold(
      backgroundColor: AppTheme.background,
      body: SafeArea(
        child: Stack(
          children: [
            // --- Remote side -------------------------------------------------
            Positioned.fill(
              child: widget.video && remoteVideoReady
                  ? RTCVideoView(
                      _remoteRenderer,
                      objectFit: RTCVideoViewObjectFit.RTCVideoViewObjectFitCover,
                    )
                  : _placeholder(),
            ),

            // --- Our own camera, small, in the corner -------------------------
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

            // --- Controls ----------------------------------------------------
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
                  if (widget.video) ...[
                    const SizedBox(width: 20),
                    _roundButton(
                      icon: _cameraOn ? Icons.videocam : Icons.videocam_off,
                      onTap: _toggleCamera,
                    ),
                  ],
                  const SizedBox(width: 20),
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

  Widget _placeholder() {
    return Column(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        CircleAvatar(
          radius: 48,
          backgroundColor: AppTheme.surfaceAlt,
          child: Icon(
            widget.video ? Icons.person : Icons.phone_in_talk_outlined,
            size: 44,
            color: AppTheme.textMuted,
          ),
        ),
        const SizedBox(height: 16),
        Text(
          widget.peerName,
          style: const TextStyle(fontSize: 24, fontWeight: FontWeight.w700),
        ),
        const SizedBox(height: 8),
        Text(_status, style: const TextStyle(color: AppTheme.textMuted)),
        const SizedBox(height: 4),
        Text(
          widget.video ? 'Video call' : 'Voice call',
          style: const TextStyle(color: AppTheme.textMuted, fontSize: 12),
        ),
      ],
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
