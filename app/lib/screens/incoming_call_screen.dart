import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../providers/chat_provider.dart';
import '../services/call_service.dart';
import '../services/socket_service.dart';
import '../theme.dart';
import '../widgets/avatar.dart';
import 'call_screen.dart';

/// Full-screen "someone is calling you" screen with Accept / Decline.
class IncomingCallScreen extends StatefulWidget {
  const IncomingCallScreen({super.key, required this.call});

  final IncomingCall call;

  @override
  State<IncomingCallScreen> createState() => _IncomingCallScreenState();
}

class _IncomingCallScreenState extends State<IncomingCallScreen> {
  bool _accepted = false;

  /// Best-effort lookup of the caller's name from the chats we already have.
  String _name(BuildContext context) {
    final chat = context.read<ChatProvider>();
    for (final conversation in chat.conversations) {
      for (final member in conversation.members) {
        if (member.id == widget.call.peerId) return member.displayName;
      }
    }
    return 'Someone';
  }

  void _accept(String name) {
    final calls = context.read<CallService>();
    final pending = calls.take();
    if (pending == null) return;

    setState(() => _accepted = true);
    Navigator.of(context).pushReplacement(
      MaterialPageRoute(
        builder: (_) => CallScreen(
          peerId: pending.peerId,
          peerName: name,
          video: pending.video,
          isCaller: false,
          initialOffer: pending.offer,
          earlyIce: pending.ice,
        ),
      ),
    );
  }

  void _decline() {
    context.read<SocketService>().callEvent('call:reject', {'to': widget.call.peerId});
    context.read<CallService>().clear();
    Navigator.of(context).maybePop();
  }

  @override
  Widget build(BuildContext context) {
    final calls = context.watch<CallService>();
    final incoming = calls.incoming;

    // The caller hung up before we answered.
    if (incoming == null && !_accepted) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) Navigator.of(context).maybePop();
      });
      return const SizedBox.shrink();
    }

    final isVideo = (incoming ?? widget.call).video;
    final name = _name(context);

    return Scaffold(
      backgroundColor: AppTheme.background,
      body: SafeArea(
        child: Column(
          children: [
            const Spacer(),
            Avatar(name: name, size: 110),
            const SizedBox(height: 20),
            Text(
              name,
              style: const TextStyle(fontSize: 26, fontWeight: FontWeight.w700),
            ),
            const SizedBox(height: 8),
            Text(
              isVideo ? 'Incoming video call…' : 'Incoming voice call…',
              style: const TextStyle(color: AppTheme.textMuted),
            ),
            const Spacer(),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceEvenly,
              children: [
                _action(
                  icon: Icons.call_end,
                  label: 'Decline',
                  color: AppTheme.danger,
                  onTap: _decline,
                ),
                _action(
                  icon: isVideo ? Icons.videocam : Icons.call,
                  label: 'Accept',
                  color: AppTheme.success,
                  onTap: () => _accept(name),
                ),
              ],
            ),
            const SizedBox(height: 56),
          ],
        ),
      ),
    );
  }

  Widget _action({
    required IconData icon,
    required String label,
    required Color color,
    required VoidCallback onTap,
  }) {
    return Column(
      children: [
        CircleAvatar(
          radius: 34,
          backgroundColor: color,
          child: IconButton(
            iconSize: 30,
            icon: Icon(icon, color: Colors.white),
            onPressed: onTap,
          ),
        ),
        const SizedBox(height: 8),
        Text(label, style: const TextStyle(color: AppTheme.textMuted)),
      ],
    );
  }
}
