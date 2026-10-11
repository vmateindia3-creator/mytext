import 'dart:io';

import 'package:flutter/foundation.dart';

import '../models/conversation.dart';
import '../models/message.dart';
import '../services/api_service.dart';
import '../services/socket_service.dart';

/// Keeps the chat list and per-conversation message threads in sync with the
/// server, and pushes new messages out over the socket.
class ChatProvider extends ChangeNotifier {
  ChatProvider(this._api, this._socket);

  final ApiService _api;
  final SocketService _socket;

  List<Conversation> _conversations = [];
  final Map<String, List<Message>> _messages = {};
  final Map<String, List<String>> _typing = {};

  List<Conversation> get conversations => _conversations;
  List<Message> messagesFor(String id) => _messages[id] ?? const [];
  List<String> typingIn(String id) => _typing[id] ?? const [];

  bool _listenersAttached = false;

  /// Attach socket listeners once, after the user signs in.
  void attachListeners() {
    if (_listenersAttached) return;
    _listenersAttached = true;

    _socket.on('message:new', (data) {
      final msg = Message.fromJson(data as Map<String, dynamic>);
      final thread = _messages[msg.conversationId] ?? [];
      if (!thread.any((m) => m.id == msg.id)) {
        thread.add(msg);
        _messages[msg.conversationId] = thread;
      }
      _bumpConversation(msg);
      notifyListeners();
    });

    _socket.on('conversation:updated', (_) => refreshConversations());

    _socket.on('typing', (data) {
      final map = data as Map<String, dynamic>;
      final convId = map['conversationId'] as String;
      final userId = map['userId'] as String;
      final typing = map['typing'] as bool;
      final list = _typing[convId] ?? [];
      if (typing && !list.contains(userId)) {
        list.add(userId);
      } else if (!typing) {
        list.remove(userId);
      }
      _typing[convId] = list;
      notifyListeners();
    });

    _socket.on('message:read', (data) {
      final map = data as Map<String, dynamic>;
      final convId = map['conversationId'] as String;
      final messageId = map['messageId'] as String;
      final userId = map['userId'] as String;
      final thread = _messages[convId];
      if (thread == null) return;
      for (var i = 0; i < thread.length; i++) {
        final m = thread[i];
        if (m.id == messageId && !m.readBy.contains(userId)) {
          m.readBy.add(userId);
        }
      }
      notifyListeners();
    });

    _socket.on('presence', (data) {
      final map = data as Map<String, dynamic>;
      final userId = map['userId'] as String;
      final online = map['online'] as bool;
      for (final conv in _conversations) {
        for (final member in conv.members) {
          if (member.id == userId) member.online = online;
        }
      }
      notifyListeners();
    });
  }

  void _bumpConversation(Message msg) {
    final index = _conversations.indexWhere((c) => c.id == msg.conversationId);
    if (index == -1) return;
    final conv = _conversations[index];
    _conversations[index] = Conversation(
      id: conv.id,
      type: conv.type,
      name: conv.name,
      members: conv.members,
      lastMessageText: msg.text.isEmpty ? _labelFor(msg.kind) : msg.text,
      lastMessageKind: msg.kind.name,
      lastMessageAt: msg.createdAt,
    );
    _conversations.sort((a, b) => b.lastMessageAt.compareTo(a.lastMessageAt));
  }

  String _labelFor(MessageKind kind) {
    switch (kind) {
      case MessageKind.image:
        return 'Photo';
      case MessageKind.file:
        return 'File';
      case MessageKind.call:
        return 'Call';
      case MessageKind.text:
        return '';
    }
  }

  Future<void> refreshConversations() async {
    _conversations = await _api.listConversations();
    notifyListeners();
  }

  Future<void> loadMessages(String conversationId) async {
    _messages[conversationId] = await _api.messages(conversationId);
    notifyListeners();
  }

  void sendMessage(String conversationId, String text) {
    _socket.sendMessage(conversationId, text);
  }

  Future<void> sendMedia(String conversationId, File file, String kind) async {
    final uploaded = await _api.uploadFile(file, conversationId);
    _socket.sendMessage(
      conversationId,
      '',
      kind: kind,
      media: {
        'url': uploaded.url,
        'name': uploaded.name,
        'mime': uploaded.mime,
        'size': uploaded.size,
      },
    );
  }

  void setTyping(String conversationId, bool typing) {
    _socket.sendTyping(conversationId, typing);
  }

  void markRead(String conversationId, String messageId) {
    _socket.markRead(conversationId, messageId);
  }

  /// Clear in-memory state on logout.
  void reset() {
    _conversations = [];
    _messages.clear();
    _typing.clear();
    _listenersAttached = false;
    notifyListeners();
  }
}
