import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../config.dart';
import '../providers/auth_provider.dart';
import '../theme.dart';
import '../widgets/avatar.dart';

/// Shows the signed-in user's profile and a sign-out button.
class ProfileScreen extends StatelessWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final user = auth.user;

    return Scaffold(
      appBar: AppBar(title: const Text('Profile')),
      body: user == null
          ? const Center(child: CircularProgressIndicator())
          : ListView(
              children: [
                const SizedBox(height: 24),
                Center(
                  child: Avatar(
                    name: user.displayName,
                    imageUrl: user.avatarUrl,
                    size: 96,
                  ),
                ),
                const SizedBox(height: 16),
                Center(
                  child: Text(
                    user.displayName,
                    style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w700),
                  ),
                ),
                const SizedBox(height: 4),
                Center(
                  child: Text(
                    '@${user.username}',
                    style: const TextStyle(color: AppTheme.textMuted),
                  ),
                ),
                const SizedBox(height: 32),
                ListTile(
                  leading: const Icon(Icons.info_outline),
                  title: const Text('App'),
                  subtitle: const Text(AppConfig.appName),
                ),
                ListTile(
                  leading: const Icon(Icons.cloud_outlined),
                  title: const Text('Server'),
                  subtitle: Text(AppConfig.apiUrl),
                ),
                const SizedBox(height: 12),
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  child: ElevatedButton.icon(
                    onPressed: () => context.read<AuthProvider>().logout(),
                    icon: const Icon(Icons.logout),
                    label: const Text('Log out'),
                    style: ElevatedButton.styleFrom(backgroundColor: AppTheme.danger),
                  ),
                ),
              ],
            ),
    );
  }
}
