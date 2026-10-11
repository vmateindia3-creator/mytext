import 'dart:io';

import 'package:flutter/foundation.dart';

import '../models/conversation.dart';
import '../models/message.dart';
import '../services/api_service.dart';
import '../services/crypto_service.dart';
import '../services/key_service.dart';
import '../services/socket_service.dart';

/// Keeps the chat list and per-conversation message threads in sync with the
/// server, pushes new messages out over the socket, and handles end-to-end
/// encryption of message text.
class ChatProvider extends ChangeNotifier {
  ChatProvider(this._api, this._socket, this._keys);

  final ApiService _api;
  final SocketService _socket;
  final KeyService _keys;

  List<Conversation> _conversations = [];
  final Map<String, List<Message>> _messages = {};
  final Map<String, List<String>> _typing = {};

  /// userId -> their encryption public key (cached).
  final Map<String, String> _peerKeys = {};

  /// messageId -> decrypted plaintext.
  final Map<String, String> _plaintext = {};

  String? _myUserId;
  bool _listenersAttached = false;

  List<Conversation> get conversations => _conversations;
  List<Message> messagesFor(String id) => _messages[id] ?? const [];
  List<String> typingIn(String id) => _typing[id] ?? const [];

  /// The text to show for a message: the plaintext when it is encrypted and we
  /// could decrypt it, otherwise the message's own text.
  String displayText(Message message) {
    if (!message.encrypted) return message.text;
    return _plaintext[message.id] ?? '🔒 Encrypted message';
  }

  Conversation? conversationById(String id) {
    for (final c in _conversations) {
      if (c.id == id) return c;
    }
    return null;
  }

  /// Attach socket listeners once, after the user signs in.
  void attachListeners(String myUserId) {
    _myUserId = myUserId;
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
      _decryptThread(msg.conversationId);
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
      for (final m in thread) {
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
      lastMessageText: msg.encrypted
          ? '🔒 Encrypted message'
          : (msg.text.isEmpty ? _labelFor(msg.kind) : msg.text),
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
    await _decryptThread(conversationId);
  }

  /// Decrypt any not-yet-decrypted messages in a thread.
  Future<void> _decryptThread(String conversationId) async {
    final thread = _messages[conversationId];
    if (thread == null) return;

    Identity identity;
    try {
      identity = await _keys.identity();
    } catch (_) {
      return;
    }

    var changed = false;
    for (final m in thread) {
      if (m.encrypted && m.enc != null && !_plaintext.containsKey(m.id)) {
        final text = await CryptoService.decrypt(
          payload: m.enc!,
          myPublicKey: identity.publicKey,
          myPrivateKey: identity.privateKey,
        );
        _plaintext[m.id] = text ?? '🔒 Could not decrypt';
        changed = true;
      }
    }
    if (changed) notifyListeners();
  }

  /// Send a message. The text is end-to-end encrypted when every member's
  /// public key is known; otherwise it falls back to plaintext so the app keeps
  /// working.
  Future<void> sendMessage(String conversationId, String text) async {
    final conv = conversationById(conversationId);
    if (conv != null && _myUserId != null) {
      try {
        final enc = await _encryptFor(conv, text);
        if (enc != null) {
          _socket.sendMessage(conversationId, '', enc: enc);
          return;
        }
      } catch (_) {
        // fall through to plaintext
      }
    }
    _socket.sendMessage(conversationId, text);
  }

  Future<Map<String, dynamic>?> _encryptFor(Conversation conv, String text) async {
    final identity = await _keys.identity();

    // Make sure we have everyone's public key.
    final missing = conv.members
        .map((m) => m.id)
        .where((id) => id != _myUserId && !_peerKeys.containsKey(id))
        .toList();
    if (missing.isNotEmpty) {
      _peerKeys.addAll(await _api.fetchKeys(missing));
    }

    final recipientKeys = <String>[];
    for (final member in conv.members) {
      final key = member.id == _myUserId ? identity.publicKey : _peerKeys[member.id];
      if (key == null || key.isEmpty) return null; // someone has no key yet
      recipientKeys.add(key);
    }

    return CryptoService.encrypt(
      plaintext: text,
      senderPublicKey: identity.publicKey,
      senderPrivateKey: identity.privateKey,
      recipientPublicKeys: recipientKeys,
    );
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
    _peerKeys.clear();
    _plaintext.clear();
    _myUserId = null;
    _listenersAttached = false;
    notifyListeners();
  }
}
