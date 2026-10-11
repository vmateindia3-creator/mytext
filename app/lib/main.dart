import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import 'app.dart';
import 'config.dart';
import 'providers/auth_provider.dart';
import 'providers/chat_provider.dart';
import 'screens/incoming_call_screen.dart';
import 'services/api_service.dart';
import 'services/call_service.dart';
import 'services/key_service.dart';
import 'services/socket_service.dart';
import 'services/storage_service.dart';
import 'theme.dart';

/// Lets us show the incoming-call screen from anywhere in the app.
final GlobalKey<NavigatorState> navigatorKey = GlobalKey<NavigatorState>();

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
        ChangeNotifierProvider(
          create: (ctx) => CallService(ctx.read<SocketService>())..attach(),
        ),
      ],
      child: MaterialApp(
        title: AppConfig.appName,
        debugShowCheckedModeBanner: false,
        theme: AppTheme.dark(),
        navigatorKey: navigatorKey,
        home: const IncomingCallListener(child: AuthGate()),
      ),
    );
  }
}

/// Watches for incoming calls and shows the ringing screen, whichever screen
/// the user happens to be on at the time.
class IncomingCallListener extends StatefulWidget {
  const IncomingCallListener({super.key, required this.child});

  final Widget child;

  @override
  State<IncomingCallListener> createState() => _IncomingCallListenerState();
}

class _IncomingCallListenerState extends State<IncomingCallListener> {
  String? _shownFor;

  @override
  Widget build(BuildContext context) {
    final calls = context.watch<CallService>();
    final incoming = calls.incoming;

    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      if (incoming != null && _shownFor != incoming.peerId) {
        _shownFor = incoming.peerId;
        navigatorKey.currentState?.push(
          MaterialPageRoute(builder: (_) => IncomingCallScreen(call: incoming)),
        );
      } else if (incoming == null) {
        _shownFor = null;
      }
    });

    return widget.child;
  }
}
