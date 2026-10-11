import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import 'providers/auth_provider.dart';
import 'providers/chat_provider.dart';
import 'screens/home_screen.dart';
import 'screens/login_screen.dart';
import 'services/api_service.dart';
import 'services/key_service.dart';
import 'services/socket_service.dart';
import 'services/storage_service.dart';

/// The root widget: wires up the services, providers and the auth gate.
class MytextApp extends StatelessWidget {
  const MytextApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        Provider(create: (_) => ApiService()),
        Provider(create: (_) => StorageService()),
        Provider(create: (_) => SocketService()),
        Provider(create: (_) => KeyService()),
        ChangeNotifierProvider(
          create: (ctx) => AuthProvider(
            ctx.read<ApiService>(),
            ctx.read<StorageService>(),
            ctx.read<SocketService>(),
            ctx.read<KeyService>(),
          )..restore(),
        ),
        ChangeNotifierProvider(
          create: (ctx) => ChatProvider(
            ctx.read<ApiService>(),
            ctx.read<SocketService>(),
            ctx.read<KeyService>(),
          ),
        ),
      ],
      child: const _AuthGate(),
    );
  }
}

/// Shows the login screen when signed out, and the chat list when signed in.
class _AuthGate extends StatelessWidget {
  const _AuthGate();

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();

    if (auth.loading) {
      return const Scaffold(
        body: Center(child: CircularProgressIndicator()),
      );
    }

    return auth.isSignedIn ? const HomeScreen() : const LoginScreen();
  }
}
