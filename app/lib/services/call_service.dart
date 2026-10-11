import 'package:flutter/foundation.dart';

import 'socket_service.dart';

/// A call that is ringing and has not been answered yet.
class IncomingCall {
  IncomingCall({required this.peerId, required this.video});

  /// The user id of the person calling.
  final String peerId;

  /// True for a video call, false for a voice-only call.
  final bool video;

  /// The caller's SDP, once it arrives.
  Map<String, dynamic>? offer;

  /// ICE candidates that arrived before the call was answered.
  final List<Map<String, dynamic>> ice = [];
}

/// Watches the socket for incoming calls, so any screen in the app can answer.
///
/// The caller sends `call:invite` and then `call:offer`. Those may arrive
/// before the user has tapped Accept, so everything is buffered here and handed
/// to the call screen in one go.
class CallService extends ChangeNotifier {
  CallService(this._socket);

  final SocketService _socket;

  IncomingCall? _incoming;
  IncomingCall? get incoming => _incoming;

  bool _attached = false;
  bool _buffering = false;

  /// Start listening. Called once, after sign-in.
  void attach() {
    if (_attached) return;
    _attached = true;

    _socket.on('call:invite', (data) {
      final map = (data as Map).cast<String, dynamic>();
      final from = map['from'] as String?;
      if (from == null) return;
      _incoming = IncomingCall(peerId: from, video: map['video'] == true);
      _buffering = true;
      notifyListeners();
    });

    _socket.on('call:offer', (data) {
      final map = (data as Map).cast<String, dynamic>();
      if (!_buffering || _incoming == null) return;
      if (map['from'] != _incoming!.peerId) return;
      final sdp = map['sdp'];
      if (sdp is Map) _incoming!.offer = sdp.cast<String, dynamic>();
      notifyListeners();
    });

    _socket.on('call:ice', (data) {
      final map = (data as Map).cast<String, dynamic>();
      if (!_buffering || _incoming == null) return;
      if (map['from'] != _incoming!.peerId) return;
      final candidate = map['candidate'];
      if (candidate is Map) _incoming!.ice.add(candidate.cast<String, dynamic>());
    });

    _socket.on('call:end', (_) => clear());
    _socket.on('call:reject', (_) => clear());
  }

  /// Take the ringing call (on Accept) and stop buffering, so the call screen
  /// takes over the signalling.
  IncomingCall? take() {
    final call = _incoming;
    _buffering = false;
    return call;
  }

  /// Forget the ringing call.
  void clear() {
    if (_incoming == null && !_buffering) return;
    _incoming = null;
    _buffering = false;
    notifyListeners();
  }

  /// Stop listening (used on sign-out).
  void detach() {
    _attached = false;
    _incoming = null;
    _buffering = false;
  }
}
