/// App-wide configuration.
///
/// The only value you normally need to change is [apiUrl]. Point it at your
/// running backend (see the top-level README for how to deploy it).
class AppConfig {
  AppConfig._();

  /// Base URL of the Mytext backend, without a trailing slash.
  ///
  /// It is baked in at build time, so you can build different APKs for
  /// different servers without editing any code:
  ///
  ///   flutter build apk --release --dart-define=MYTEXT_API_URL=https://mytext-server.onrender.com
  ///
  /// The GitHub "Build APK" workflow has a box for this too.
  ///
  /// Defaults to 10.0.2.2, the Android emulator's alias for your computer.
  /// On a real phone, put your server's public URL here instead.
  static const String apiUrl = String.fromEnvironment(
    'MYTEXT_API_URL',
    defaultValue: 'http://10.0.2.2:4000',
  );

  /// App display name.
  static const String appName = 'Mytext';
}
