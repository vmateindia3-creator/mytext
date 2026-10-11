import 'dart:async';

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../models/user.dart';
import '../services/api_service.dart';
import '../theme.dart';
import '../widgets/avatar.dart';
import 'chat_screen.dart';

/// Pick members and a name to create a group chat.
class NewGroupScreen extends StatefulWidget {
  const NewGroupScreen({super.key});

  @override
  State<NewGroupScreen> createState() => _NewGroupScreenState();
}

class _NewGroupScreenState extends State<NewGroupScreen> {
  final _name = TextEditingController();
  final _query = TextEditingController();
  Timer? _debounce;
  List<User> _users = [];
  final Set<String> _selected = {};
  String? _error;

  @override
  void initState() {
    super.initState();
    _search('');
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _name.dispose();
    _query.dispose();
    super.dispose();
  }

  Future<void> _search(String value) async {
    final users = await context.read<ApiService>().searchUsers(value);
    if (mounted) setState(() => _users = users);
  }

  void _onQueryChanged(String value) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 250), () => _search(value));
  }

  Future<void> _create() async {
    setState(() => _error = null);
    if (_name.text.trim().isEmpty) {
      setState(() => _error = 'Enter a group name');
      return;
    }
    if (_selected.isEmpty) {
      setState(() => _error = 'Select at least one member');
      return;
    }
    try {
      final conv = await context
          .read<ApiService>()
          .createGroup(_name.text.trim(), _selected.toList());
      if (!mounted) return;
      Navigator.of(context).pushReplacement(
        MaterialPageRoute(builder: (_) => ChatScreen(conversationId: conv.id)),
      );
    } catch (e) {
      setState(() => _error = e.toString());
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('New group')),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(12, 12, 12, 0),
            child: TextField(
              controller: _name,
              decoration: const InputDecoration(hintText: 'Group name'),
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(12),
            child: TextField(
              controller: _query,
              onChanged: _onQueryChanged,
              autocorrect: false,
              decoration: const InputDecoration(
                hintText: 'Search members',
                prefixIcon: Icon(Icons.search),
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Align(
              alignment: Alignment.centerLeft,
              child: Text(
                '${_selected.length} selected',
                style: const TextStyle(color: AppTheme.textMuted),
              ),
            ),
          ),
          if (_error != null)
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
              child: Text(_error!, style: const TextStyle(color: AppTheme.danger)),
            ),
          Expanded(
            child: ListView.builder(
              itemCount: _users.length,
              itemBuilder: (_, i) {
                final u = _users[i];
                final active = _selected.contains(u.id);
                return CheckboxListTile(
                  value: active,
                  onChanged: (_) => setState(() {
                    if (active) {
                      _selected.remove(u.id);
                    } else {
                      _selected.add(u.id);
                    }
                  }),
                  secondary: Avatar(name: u.displayName, imageUrl: u.avatarUrl),
                  title: Text(u.displayName),
                  subtitle: Text('@${u.username}'),
                  activeColor: AppTheme.primary,
                );
              },
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(12),
            child: ElevatedButton(
              onPressed: _create,
              child: const Text('Create group'),
            ),
          ),
        ],
      ),
    );
  }
}
