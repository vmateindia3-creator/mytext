import 'package:flutter/material.dart';

import 'app.dart';
import 'config.dart';
import 'theme.dart';

void main() {
  runApp(const MytextRoot());
}

/// Wraps [MytextApp] in a MaterialApp so the theme and app name live in one place.
class MytextRoot extends StatelessWidget {
  const MytextRoot({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: AppConfig.appName,
      debugShowCheckedModeBanner: false,
      theme: AppTheme.dark(),
      home: const MytextApp(),
    );
  }
}
