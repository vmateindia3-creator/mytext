import 'dart:async';

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../models/user.dart';
import '../services/api_service.dart';
import '../theme.dart';
import '../widgets/avatar.dart';
import 'chat_screen.dart';
import 'new_group_screen.dart';

/// Start a chat either by typing someone's phone number, or by searching names.
class NewChatScreen extends StatefulWidget {
  const NewChatScreen({super.key});

  @override
  State<NewChatScreen> createState() => _NewChatScreenState();
}

class _NewChatScreenState extends State<NewChatScreen> {
  final _phone = TextEditingController();
  final _query = TextEditingController();
  Timer? _debounce;
  List<User> _users = [];
  String? _error;
  bool _busy = false;

  @override
  void initState() {
    super.initState();
    _search('');
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _phone.dispose();
    _query.dispose();
    super.dispose();
  }

  void _onQueryChanged(String value) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 250), () => _search(value));
  }

  Future<void> _search(String value) async {
    try {
      final users = await context.read<ApiService>().searchUsers(value);
      if (mounted) setState(() => _users = users);
    } catch (e) {
      if (mounted) setState(() => _error = e.toString());
    }
  }

  /// Look up the account that owns a phone number and open a chat with it.
  Future<void> _startByPhone() async {
    final number = _phone.text.trim();
    if (number.isEmpty) {
      setState(() => _error = 'Enter a phone number');
      return;
    }

    setState(() {
      _error = null;
      _busy = true;
    });
    try {
      final api = context.read<ApiService>();
      final user = await api.lookupByPhone(number);
      final conv = await api.createDirect(user.id);
      if (!mounted) return;
      Navigator.of(context).pushReplacement(
        MaterialPageRoute(builder: (_) => ChatScreen(conversationId: conv.id)),
      );
    } catch (e) {
      setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _startChat(User user) async {
    final conv = await context.read<ApiService>().createDirect(user.id);
    if (!mounted) return;
    Navigator.of(context).pushReplacement(
      MaterialPageRoute(builder: (_) => ChatScreen(conversationId: conv.id)),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('New chat'),
        actions: [
          IconButton(
            icon: const Icon(Icons.group_add_outlined),
            onPressed: () => Navigator.of(context).push(
              MaterialPageRoute(builder: (_) => const NewGroupScreen()),
            ),
          ),
        ],
      ),
      body: Column(
        children: [
          // --- Chat by phone number -----------------------------------------
          Padding(
            padding: const EdgeInsets.fromLTRB(12, 12, 12, 0),
            child: Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _phone,
                    keyboardType: TextInputType.phone,
                    autocorrect: false,
                    decoration: const InputDecoration(
                      hintText: 'Phone number, e.g. +919876543210',
                      prefixIcon: Icon(Icons.phone_outlined),
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                SizedBox(
                  height: 52,
                  child: ElevatedButton(
                    onPressed: _busy ? null : _startByPhone,
                    style: ElevatedButton.styleFrom(
                      minimumSize: const Size(80, 52),
                    ),
                    child: _busy
                        ? const SizedBox(
                            height: 20,
                            width: 20,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : const Text('Find'),
                  ),
                ),
              ],
            ),
          ),
          const Padding(
            padding: EdgeInsets.fromLTRB(16, 8, 16, 0),
            child: Align(
              alignment: Alignment.centerLeft,
              child: Text(
                'That person must already have Mytext installed and signed in.',
                style: TextStyle(color: AppTheme.textMuted, fontSize: 11),
              ),
            ),
          ),

          // --- Or search by name --------------------------------------------
          Padding(
            padding: const EdgeInsets.all(12),
            child: TextField(
              controller: _query,
              onChanged: _onQueryChanged,
              autocorrect: false,
              decoration: const InputDecoration(
                hintText: 'Search people by name or username',
                prefixIcon: Icon(Icons.search),
              ),
            ),
          ),

          if (_error != null)
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Text(_error!, style: const TextStyle(color: AppTheme.danger)),
            ),

          Expanded(
            child: ListView.builder(
              itemCount: _users.length,
              itemBuilder: (_, i) {
                final u = _users[i];
                return ListTile(
                  leading: Avatar(
                    name: u.displayName,
                    imageUrl: u.avatarUrl,
                    showPresence: true,
                    online: u.online,
                  ),
                  title: Text(u.displayName),
                  subtitle: Text(u.phone.isNotEmpty ? u.phone : '@${u.username}'),
                  onTap: () => _startChat(u),
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}
