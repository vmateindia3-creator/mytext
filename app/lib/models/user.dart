/// A Mytext user.
class User {
  User({
    required this.id,
    required this.username,
    required this.displayName,
    this.avatarUrl,
    this.online = false,
    this.lastSeen,
  });

  final String id;
  final String username;
  final String displayName;
  final String? avatarUrl;

  /// Presence is updated in place when a `presence` event arrives.
  bool online;
  DateTime? lastSeen;

  factory User.fromJson(Map<String, dynamic> json) {
    return User(
      id: json['id'] as String,
      username: json['username'] as String,
      displayName: (json['displayName'] ?? json['username']) as String,
      avatarUrl: json['avatarUrl'] as String?,
      online: (json['online'] ?? false) as bool,
      lastSeen: json['lastSeen'] != null
          ? DateTime.tryParse(json['lastSeen'] as String)
          : null,
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'username': username,
        'displayName': displayName,
        'avatarUrl': avatarUrl,
        'online': online,
        'lastSeen': lastSeen?.toIso8601String(),
      };
}
