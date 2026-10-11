import 'dart:convert';
import 'dart:io';

import 'package:http/http.dart' as http;

import '../config.dart';
import '../models/conversation.dart';
import '../models/message.dart';
import '../models/user.dart';

/// Thrown when the API returns an error response.
class ApiException implements Exception {
  ApiException(this.message, [this.statusCode = 0]);

  final String message;
  final int statusCode;

  @override
  String toString() => message;
}

/// Thin wrapper around the Mytext REST API.
class ApiService {
  ApiService();

  String? _token;

  /// Store the JWT so every later request is authenticated.
  void setToken(String? token) => _token = token;

  Map<String, String> get _headers => {
        'Content-Type': 'application/json',
        if (_token != null) 'Authorization': 'Bearer $_token',
      };

  Future<Map<String, dynamic>> _send(
    String method,
    String path, {
    Map<String, dynamic>? body,
  }) async {
    final uri = Uri.parse('${AppConfig.apiUrl}$path');
    late http.Response res;

    switch (method) {
      case 'POST':
        res = await http.post(uri, headers: _headers, body: jsonEncode(body ?? {}));
        break;
      case 'GET':
      default:
        res = await http.get(uri, headers: _headers);
    }

    final decoded = res.body.isEmpty
        ? <String, dynamic>{}
        : jsonDecode(res.body) as Map<String, dynamic>;

    if (res.statusCode >= 400) {
      throw ApiException(
        (decoded['error'] ?? 'Request failed') as String,
        res.statusCode,
      );
    }
    return decoded;
  }

  // ---- Auth ---------------------------------------------------------------

  Future<({String token, User user})> register(
    String username,
    String password, {
    String? displayName,
  }) async {
    final data = await _send('POST', '/api/auth/register', body: {
      'username': username,
      'password': password,
      if (displayName != null) 'displayName': displayName,
    });
    return (
      token: data['token'] as String,
      user: User.fromJson(data['user'] as Map<String, dynamic>),
    );
  }

  Future<({String token, User user})> login(
    String username,
    String password,
  ) async {
    final data = await _send('POST', '/api/auth/login', body: {
      'username': username,
      'password': password,
    });
    return (
      token: data['token'] as String,
      user: User.fromJson(data['user'] as Map<String, dynamic>),
    );
  }

  // ---- Users --------------------------------------------------------------

  Future<List<User>> searchUsers(String query) async {
    final data = await _send('GET', '/api/users?q=${Uri.encodeQueryComponent(query)}');
    return (data['users'] as List<dynamic>)
        .map((e) => User.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  // ---- Conversations ------------------------------------------------------

  Future<List<Conversation>> listConversations() async {
    final data = await _send('GET', '/api/conversations');
    return (data['conversations'] as List<dynamic>)
        .map((e) => Conversation.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  Future<Conversation> createDirect(String userId) async {
    final data = await _send('POST', '/api/conversations', body: {
      'type': 'direct',
      'userId': userId,
    });
    return Conversation.fromJson(data['conversation'] as Map<String, dynamic>);
  }

  Future<Conversation> createGroup(String name, List<String> memberIds) async {
    final data = await _send('POST', '/api/conversations', body: {
      'type': 'group',
      'name': name,
      'memberIds': memberIds,
    });
    return Conversation.fromJson(data['conversation'] as Map<String, dynamic>);
  }

  Future<List<Message>> messages(String conversationId) async {
    final data = await _send('GET', '/api/conversations/$conversationId/messages');
    return (data['messages'] as List<dynamic>)
        .map((e) => Message.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  // ---- Media upload -------------------------------------------------------

  /// Upload a local file and return its public URL + metadata.
  Future<({String url, String name, String mime, int size})> uploadFile(
    File file,
    String conversationId,
  ) async {
    final uri = Uri.parse('${AppConfig.apiUrl}/api/upload');
    final request = http.MultipartRequest('POST', uri)
      ..fields['conversationId'] = conversationId
      ..files.add(await http.MultipartFile.fromPath('file', file.path));

    if (_token != null) {
      request.headers['Authorization'] = 'Bearer $_token';
    }

    final streamed = await request.send();
    final res = await http.Response.fromStream(streamed);
    final data = res.body.isEmpty
        ? <String, dynamic>{}
        : jsonDecode(res.body) as Map<String, dynamic>;

    if (res.statusCode >= 400) {
      throw ApiException((data['error'] ?? 'Upload failed') as String, res.statusCode);
    }

    return (
      url: data['url'] as String,
      name: (data['name'] ?? file.path.split('/').last) as String,
      mime: (data['mime'] ?? 'application/octet-stream') as String,
      size: (data['size'] ?? 0) as int,
    );
  }
}
