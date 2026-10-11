import 'dart:io';

import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:provider/provider.dart';

import '../models/conversation.dart';
import '../providers/auth_provider.dart';
import '../providers/chat_provider.dart';
import '../services/socket_service.dart';
import '../theme.dart';
import '../widgets/avatar.dart';
import '../widgets/message_bubble.dart';
import 'call_screen.dart';

/// The conversation view: message thread + composer.
class ChatScreen extends StatefulWidget {
  const ChatScreen({super.key, required this.conversationId});

  final String conversationId;

  @override
  State<ChatScreen> createState() => _ChatScreenState();
}

class _ChatScreenState extends State<ChatScreen> {
  final _text = TextEditingController();
  final _scroll = ScrollController();
  bool _typingSent = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) async {
      final chat = context.read<ChatProvider>();
      final socket = context.read<SocketService>();
      socket.joinConversation(widget.conversationId);
      await chat.loadMessages(widget.conversationId);
      _scrollToBottom();
    });
  }

  @override
  void dispose() {
    context.read<SocketService>().leaveConversation(widget.conversationId);
    _text.dispose();
    _scroll.dispose();
    super.dispose();
  }

  void _scrollToBottom() {
    if (!_scroll.hasClients) return;
    _scroll.jumpTo(_scroll.position.maxScrollExtent);
  }

  void _onChanged(String value) {
    final chat = context.read<ChatProvider>();
    if (value.trim().isNotEmpty && !_typingSent) {
      _typingSent = true;
      chat.setTyping(widget.conversationId, true);
    } else if (value.trim().isEmpty && _typingSent) {
      _typingSent = false;
      chat.setTyping(widget.conversationId, false);
    }
  }

  void _send() {
    final value = _text.text.trim();
    if (value.isEmpty) return;
    context.read<ChatProvider>().sendMessage(widget.conversationId, value);
    _text.clear();
    if (_typingSent) {
      _typingSent = false;
      context.read<ChatProvider>().setTyping(widget.conversationId, false);
    }
    WidgetsBinding.instance.addPostFrameCallback((_) => _scrollToBottom());
  }

  Future<void> _sendMedia(File file, String kind) async {
    try {
      await context.read<ChatProvider>().sendMedia(widget.conversationId, file, kind);
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Upload failed: $e')),
      );
    }
  }

  Future<void> _pickImage() async {
    final picked = await ImagePicker().pickImage(source: ImageSource.gallery);
    if (picked != null) await _sendMedia(File(picked.path), 'image');
  }

  Future<void> _pickFile() async {
    final result = await FilePicker.platform.pickFiles();
    final path = result?.files.single.path;
    if (path != null) await _sendMedia(File(path), 'file');
  }

  Conversation? _findConversation(ChatProvider chat) {
    for (final c in chat.conversations) {
      if (c.id == widget.conversationId) return c;
    }
    return null;
  }

  @override
  Widget build(BuildContext context) {
    final chat = context.watch<ChatProvider>();
    final myId = context.watch<AuthProvider>().user?.id ?? '';
    final conversation = _findConversation(chat);
    final messages = chat.messagesFor(widget.conversationId);
    final typing = chat.typingIn(widget.conversationId);

    final title = conversation?.titleFor(myId) ?? 'Chat';
    final other = conversation != null && !conversation.isGroup
        ? conversation.otherMember(myId)
        : null;

    // Mark the newest incoming message as read.
    if (messages.isNotEmpty) {
      final last = messages.last;
      if (last.sender.id != myId && !last.readBy.contains(myId)) {
        WidgetsBinding.instance.addPostFrameCallback(
          (_) => chat.markRead(widget.conversationId, last.id),
        );
      }
    }

    return Scaffold(
      appBar: AppBar(
        titleSpacing: 0,
        title: Row(
          children: [
            Avatar(
              name: title,
              imageUrl: other?.avatarUrl,
              size: 36,
              showPresence: other != null,
              online: other?.online ?? false,
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Text(title, maxLines: 1, overflow: TextOverflow.ellipsis),
            ),
          ],
        ),
        actions: [
          if (other != null)
            IconButton(
              icon: const Icon(Icons.videocam_outlined),
              onPressed: () => Navigator.of(context).push(
                MaterialPageRoute(
                  builder: (_) => CallScreen(
                    peerId: other.id,
                    peerName: other.displayName,
                  ),
                ),
              ),
            ),
        ],
      ),
      body: Column(
        children: [
          Expanded(
            child: ListView.builder(
              controller: _scroll,
              padding: const EdgeInsets.symmetric(vertical: 12),
              itemCount: messages.length,
              itemBuilder: (_, i) {
                final m = messages[i];
                return MessageBubble(message: m, isMine: m.sender.id == myId);
              },
            ),
          ),
          if (typing.isNotEmpty)
            const Padding(
              padding: EdgeInsets.only(left: 16, bottom: 4),
              child: Align(
                alignment: Alignment.centerLeft,
                child: Text(
                  'typing…',
                  style: TextStyle(
                    color: AppTheme.textMuted,
                    fontStyle: FontStyle.italic,
                  ),
                ),
              ),
            ),
          _composer(),
        ],
      ),
    );
  }

  Widget _composer() {
    return Container(
      padding: const EdgeInsets.fromLTRB(8, 6, 8, 8),
      decoration: const BoxDecoration(
        color: AppTheme.surface,
        border: Border(top: BorderSide(color: AppTheme.border)),
      ),
      child: SafeArea(
        top: false,
        child: Row(
          children: [
            IconButton(
              icon: const Icon(Icons.image_outlined),
              onPressed: _pickImage,
            ),
            IconButton(
              icon: const Icon(Icons.attach_file),
              onPressed: _pickFile,
            ),
            Expanded(
              child: TextField(
                controller: _text,
                onChanged: _onChanged,
                minLines: 1,
                maxLines: 5,
                decoration: const InputDecoration(
                  hintText: 'Message',
                  contentPadding: EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                ),
              ),
            ),
            const SizedBox(width: 6),
            CircleAvatar(
              backgroundColor: AppTheme.primary,
              child: IconButton(
                icon: const Icon(Icons.send, color: Colors.white, size: 20),
                onPressed: _send,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
