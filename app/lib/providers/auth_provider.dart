import 'dart:convert';

import 'package:flutter/foundation.dart';

import '../models/user.dart';
import '../services/api_service.dart';
import '../services/key_service.dart';
import '../services/socket_service.dart';
import '../services/storage_service.dart';

/// Holds the signed-in user and drives login / registration / logout.
class AuthProvider extends ChangeNotifier {
  AuthProvider(this._api, this._storage, this._socket, this._keys);

  final ApiService _api;
  final StorageService _storage;
  final SocketService _socket;
  final KeyService _keys;

  User? _user;
  String? _token;
  bool _loading = true;

  User? get user => _user;
  String? get token => _token;
  bool get loading => _loading;
  bool get isSignedIn => _user != null && _token != null;

  /// Restore a saved session when the app starts.
  Future<void> restore() async {
    final token = await _storage.readToken();
    final userJson = await _storage.readUserJson();
    if (token != null && userJson != null) {
      _token = token;
      _user = User.fromJson(jsonDecode(userJson) as Map<String, dynamic>);
      _api.setToken(token);
      _socket.connect(token);
      await _publishIdentity();
    }
    _loading = false;
    notifyListeners();
  }

  /// Create (or load) this device's encryption identity and publish its public
  /// key so other people can message us securely.
  Future<void> _publishIdentity() async {
    if (_user == null) return;
    try {
      _keys.setUser(_user!.id);
      final identity = await _keys.identity();
      await _api.setPublicKey(identity.publicKey);
    } catch (err) {
      // Non-fatal: the app still works, messages just fall back to plaintext.
      debugPrint('Could not publish encryption key: $err');
    }
  }

  Future<void> _applySession(String token, User user) async {
    _token = token;
    _user = user;
    _api.setToken(token);
    await _storage.saveToken(token);
    await _storage.saveUserJson(jsonEncode(user.toJson()));
    _socket.connect(token);
    await _publishIdentity();
    notifyListeners();
  }

  Future<void> login(String username, String password) async {
    final res = await _api.login(username, password);
    await _applySession(res.token, res.user);
  }

  /// Ask the server to text a code to [phone].
  /// Returns the code when the server has no SMS provider configured (dev mode).
  Future<String?> requestOtp(String phone) async {
    final res = await _api.requestOtp(phone);
    return res.devCode;
  }

  /// Check the code and sign in — creating the account the first time.
  Future<void> verifyOtp(String phone, String code) async {
    final res = await _api.verifyOtp(phone, code);
    await _applySession(res.token, res.user);
  }

  Future<void> register(String username, String password, {String? displayName}) async {
    final res = await _api.register(username, password, displayName: displayName);
    await _applySession(res.token, res.user);
  }

  Future<void> logout() async {
    _socket.disconnect();
    _api.setToken(null);
    _token = null;
    _user = null;
    await _storage.clear();
    notifyListeners();
  }
}
