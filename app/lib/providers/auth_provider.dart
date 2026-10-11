import 'dart:convert';

import 'package:flutter/foundation.dart';

import '../models/user.dart';
import '../services/api_service.dart';
import '../services/socket_service.dart';
import '../services/storage_service.dart';

/// Holds the signed-in user and drives login / registration / logout.
class AuthProvider extends ChangeNotifier {
  AuthProvider(this._api, this._storage, this._socket);

  final ApiService _api;
  final StorageService _storage;
  final SocketService _socket;

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
    }
    _loading = false;
    notifyListeners();
  }

  Future<void> _applySession(String token, User user) async {
    _token = token;
    _user = user;
    _api.setToken(token);
    await _storage.saveToken(token);
    await _storage.saveUserJson(jsonEncode(user.toJson()));
    _socket.connect(token);
    notifyListeners();
  }

  Future<void> login(String username, String password) async {
    final res = await _api.login(username, password);
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
