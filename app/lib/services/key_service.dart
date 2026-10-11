import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import 'crypto_service.dart';

/// Stores encryption identities in the platform keystore.
///
/// Keys are namespaced per user id, so signing in as a different account on the
/// same device uses a separate identity. The private key never leaves the device.
class KeyService {
  KeyService([FlutterSecureStorage? storage])
      : _storage = storage ?? const FlutterSecureStorage();

  final FlutterSecureStorage _storage;

  String _userId = 'default';
  Identity? _cached;

  /// Point the service at the signed-in user before calling [identity].
  void setUser(String userId) {
    if (userId == _userId) return;
    _userId = userId;
    _cached = null;
  }

  String get _publicKeyName => 'mytext.identity.$_userId.public';
  String get _privateKeyName => 'mytext.identity.$_userId.private';

  /// The current identity, creating and persisting one on first use.
  Future<Identity> identity() async {
    if (_cached != null) return _cached!;

    final publicKey = await _storage.read(key: _publicKeyName);
    final privateKey = await _storage.read(key: _privateKeyName);

    if (publicKey != null && privateKey != null) {
      _cached = Identity(publicKey: publicKey, privateKey: privateKey);
      return _cached!;
    }

    final fresh = await CryptoService.generateIdentity();
    await _storage.write(key: _publicKeyName, value: fresh.publicKey);
    await _storage.write(key: _privateKeyName, value: fresh.privateKey);
    _cached = fresh;
    return fresh;
  }

  /// Remove this user's identity from the device.
  Future<void> clear() async {
    _cached = null;
    await _storage.delete(key: _publicKeyName);
    await _storage.delete(key: _privateKeyName);
  }
}
