/// App-wide configuration.
///
/// The only value you normally need to change is [apiUrl]. Point it at your
/// running backend (see the top-level README for how to deploy it).
class AppConfig {
  AppConfig._();

  /// Base URL of the Mytext backend, without a trailing slash.
  ///
  /// Local development on an Android emulator uses 10.0.2.2 (the emulator's
  /// alias for your computer). On a real phone, use your computer's LAN IP,
  /// e.g. 'http://192.168.1.20:4000'.
  static const String apiUrl = 'http://10.0.2.2:4000';

  /// App display name.
  static const String appName = 'Mytext';
}
