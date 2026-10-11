import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../models/conversation.dart';
import '../theme.dart';
import 'avatar.dart';

/// A single row in the chat list (WhatsApp-style).
class ChatTile extends StatelessWidget {
  const ChatTile({
    super.key,
    required this.conversation,
    required this.myId,
    required this.onTap,
  });

  final Conversation conversation;
  final String myId;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final other = conversation.isGroup ? null : conversation.otherMember(myId);

    final preview = conversation.lastMessageText?.isNotEmpty == true
        ? conversation.lastMessageText!
        : 'No messages yet';

    return ListTile(
      onTap: onTap,
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
      leading: Avatar(
        name: conversation.titleFor(myId),
        imageUrl: conversation.isGroup ? null : other?.avatarUrl,
        showPresence: !conversation.isGroup,
        online: other?.online ?? false,
      ),
      title: Text(
        conversation.titleFor(myId),
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
        style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 16),
      ),
      subtitle: Text(
        preview,
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
        style: const TextStyle(color: AppTheme.textMuted, fontSize: 13),
      ),
      trailing: Text(
        DateFormat.Hm().format(conversation.lastMessageAt.toLocal()),
        style: const TextStyle(color: AppTheme.textMuted, fontSize: 11),
      ),
    );
  }
}
