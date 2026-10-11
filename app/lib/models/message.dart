import 'user.dart';

/// The kind of content a message carries.
enum MessageKind { text, image, file, call }

MessageKind messageKindFromString(String? value) {
  switch (value) {
    case 'image':
      return MessageKind.image;
    case 'file':
      return MessageKind.file;
    case 'call':
      return MessageKind.call;
    default:
      return MessageKind.text;
  }
}

/// A single chat message.
class Message {
  Message({
    required this.id,
    required this.conversationId,
    required this.sender,
    required this.kind,
    required this.text,
    this.mediaUrl,
    this.mediaName,
    required this.createdAt,
    this.encrypted = false,
    this.enc,
    List<String>? readBy,
  }) : readBy = readBy ?? [];

  final String id;
  final String conversationId;
  final User sender;
  final MessageKind kind;
  final String text;
  final String? mediaUrl;
  final String? mediaName;
  final DateTime createdAt;
  final List<String> readBy;

  /// End-to-end encryption: when true, [text] is empty and the real content is
  /// in [enc], which only the conversation members can decrypt.
  final bool encrypted;
  final Map<String, dynamic>? enc;

  bool get isMedia => kind == MessageKind.image || kind == MessageKind.file;

  factory Message.fromJson(Map<String, dynamic> json) {
    return Message(
      id: json['id'] as String,
      conversationId: json['conversation'] as String,
      sender: User.fromJson(json['sender'] as Map<String, dynamic>),
      kind: messageKindFromString(json['kind'] as String?),
      text: (json['text'] ?? '') as String,
      mediaUrl: json['mediaUrl'] as String?,
      mediaName: json['mediaName'] as String?,
      createdAt:
          DateTime.tryParse(json['createdAt'] as String? ?? '') ?? DateTime.now(),
      encrypted: (json['encrypted'] ?? false) as bool,
      enc: (json['enc'] as Map?)?.cast<String, dynamic>(),
      readBy: (json['readBy'] as List<dynamic>? ?? const [])
          .map((e) => e.toString())
          .toList(),
    );
  }
}
