import 'package:flutter_test/flutter_test.dart';
import 'package:mytext/models/conversation.dart';
import 'package:mytext/models/message.dart';
import 'package:mytext/models/user.dart';

void main() {
  group('User.fromJson', () {
    test('reads all fields', () {
      final user = User.fromJson({
        'id': 'u1',
        'username': 'alice',
        'displayName': 'Alice',
        'online': true,
      });
      expect(user.id, 'u1');
      expect(user.username, 'alice');
      expect(user.displayName, 'Alice');
      expect(user.online, isTrue);
    });

    test('falls back to username when displayName is missing', () {
      final user = User.fromJson({'id': 'u2', 'username': 'bob'});
      expect(user.displayName, 'bob');
    });

    test('reads the phone number', () {
      final user = User.fromJson({
        'id': 'u3',
        'username': 'user123456',
        'phone': '+919876543210',
      });
      expect(user.phone, '+919876543210');
    });
  });

  group('messageKindFromString', () {
    test('maps known kinds', () {
      expect(messageKindFromString('image'), MessageKind.image);
      expect(messageKindFromString('file'), MessageKind.file);
      expect(messageKindFromString('call'), MessageKind.call);
    });

    test('defaults to text', () {
      expect(messageKindFromString(null), MessageKind.text);
      expect(messageKindFromString('unknown'), MessageKind.text);
    });
  });

  group('Conversation', () {
    test('titleFor uses the other member in a direct chat', () {
      final conv = Conversation.fromJson({
        'id': 'c1',
        'type': 'direct',
        'name': '',
        'lastMessageAt': DateTime.now().toIso8601String(),
        'members': [
          {'id': 'me', 'username': 'me', 'displayName': 'Me'},
          {'id': 'them', 'username': 'sam', 'displayName': 'Sam'},
        ],
      });
      expect(conv.titleFor('me'), 'Sam');
      expect(conv.isGroup, isFalse);
    });

    test('titleFor uses the group name for groups', () {
      final conv = Conversation.fromJson({
        'id': 'c2',
        'type': 'group',
        'name': 'Weekend Plans',
        'lastMessageAt': DateTime.now().toIso8601String(),
        'members': [
          {'id': 'me', 'username': 'me'},
        ],
      });
      expect(conv.titleFor('me'), 'Weekend Plans');
      expect(conv.isGroup, isTrue);
    });
  });
}
