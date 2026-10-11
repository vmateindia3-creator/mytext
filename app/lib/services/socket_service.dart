import 'package:socket_io_client/socket_io_client.dart' as io;

import '../config.dart';

/// Wraps the Socket.io connection and exposes the real-time events Mytext uses.
class SocketService {
  io.Socket? _socket;

  io.Socket? get socket => _socket;
  bool get isConnected => _socket?.connected ?? false;

  /// Connect with the user's JWT. Safe to call again after logout/login.
  void connect(String token) {
    disconnect();
    _socket = io.io(
      AppConfig.apiUrl,
      io.OptionBuilder()
          .setTransports(['websocket'])
          .setAuth({'token': token})
          .enableReconnection()
          .build(),
    );
    _socket!.connect();
  }

  void disconnect() {
    _socket?.dispose();
    _socket = null;
  }

  /// Subscribe to a server event.
  void on(String event, Function(dynamic) handler) {
    _socket?.on(event, handler);
  }

  void off(String event) {
    _socket?.off(event);
  }

  // ---- Conversation rooms -------------------------------------------------

  void joinConversation(String conversationId) {
    _socket?.emit('conversation:join', {'conversationId': conversationId});
  }

  void leaveConversation(String conversationId) {
    _socket?.emit('conversation:leave', {'conversationId': conversationId});
  }

  // ---- Messages -----------------------------------------------------------

  void sendMessage(
    String conversationId,
    String text, {
    String kind = 'text',
    Map<String, dynamic>? media,
    Map<String, dynamic>? enc,
  }) {
    _socket?.emit('message:send', {
      'conversationId': conversationId,
      'text': text,
      'kind': kind,
      if (media != null) 'media': media,
      if (enc != null) 'enc': enc,
    });
  }

  void sendTyping(String conversationId, bool typing) {
    _socket?.emit('typing', {'conversationId': conversationId, 'typing': typing});
  }

  void markRead(String conversationId, String messageId) {
    _socket?.emit('message:read', {
      'conversationId': conversationId,
      'messageId': messageId,
    });
  }

  // ---- Call signalling ----------------------------------------------------

  void callEvent(String event, Map<String, dynamic> payload) {
    _socket?.emit(event, payload);
  }
}
