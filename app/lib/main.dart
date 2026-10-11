import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import 'app.dart';
import 'config.dart';
import 'providers/auth_provider.dart';
import 'providers/chat_provider.dart';
import 'services/api_service.dart';
import 'services/key_service.dart';
import 'services/socket_service.dart';
import 'services/storage_service.dart';
import 'theme.dart';

void main() {
  runApp(const MytextRoot());
}

/// Providers live **above** MaterialApp on purpose.
///
/// Screens opened with `Navigator.push` are siblings of `home:` inside the
/// navigator, not descendants of it — so if the providers sat inside `home:`
/// those screens could not read them and would crash with
/// "Provider<...> not found".
class MytextRoot extends StatelessWidget {
  const MytextRoot({super.key});

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
      child: MaterialApp(
        title: AppConfig.appName,
        debugShowCheckedModeBanner: false,
        theme: AppTheme.dark(),
        home: const AuthGate(),
      ),
    );
  }
}
