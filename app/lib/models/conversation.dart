import 'user.dart';

/// A direct (1:1) or group conversation.
class Conversation {
  Conversation({
    required this.id,
    required this.type,
    required this.name,
    required this.members,
    this.lastMessageText,
    this.lastMessageKind,
    required this.lastMessageAt,
  });

  final String id;
  final String type; // 'direct' | 'group'
  final String name;
  final List<User> members;
  final String? lastMessageText;
  final String? lastMessageKind;
  final DateTime lastMessageAt;

  bool get isGroup => type == 'group';

  /// The other participant in a 1:1 chat.
  User? otherMember(String myId) {
    for (final m in members) {
      if (m.id != myId) return m;
    }
    return null;
  }

  /// The title shown in the chat list and app bar.
  String titleFor(String myId) {
    if (isGroup) return name.isEmpty ? 'Group' : name;
    final other = otherMember(myId);
    return other?.displayName ?? other?.username ?? 'Chat';
  }

  factory Conversation.fromJson(Map<String, dynamic> json) {
    final last = json['lastMessage'] as Map<String, dynamic>?;
    return Conversation(
      id: json['id'] as String,
      type: (json['type'] ?? 'direct') as String,
      name: (json['name'] ?? '') as String,
      members: (json['members'] as List<dynamic>? ?? const [])
          .map((e) => User.fromJson(e as Map<String, dynamic>))
          .toList(),
      lastMessageText: last?['text'] as String?,
      lastMessageKind: last?['kind'] as String?,
      lastMessageAt:
          DateTime.tryParse(json['lastMessageAt'] as String? ?? '') ??
              DateTime.now(),
    );
  }
}
