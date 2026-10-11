import 'dart:convert';
import 'dart:math';
import 'dart:typed_data';

import 'package:cryptography/cryptography.dart';

/// End-to-end encryption for Mytext messages.
///
/// Scheme (a straightforward "static-key" design):
///   • Every device has a long-lived X25519 key pair. Only the public key is
///     uploaded to the server; the private key never leaves the device.
///   • To send, the sender derives a shared secret with each member
///     (X25519 + HKDF-SHA256) and encrypts the text for each of them with
///     AES-256-GCM. The server only ever stores ciphertext.
///   • To read, a member derives the same shared secret with the sender's
///     public key and decrypts their own box.
///
/// This module is pure Dart (no Flutter imports) so it can be unit-tested on
/// its own. See the README for what this scheme does and does not guarantee.
class CryptoService {
  CryptoService._();

  static final _x25519 = X25519();
  static final _aes = AesGcm.with256bits();
  static final _hkdf = Hkdf(hmac: Hmac.sha256(), outputLength: 32);
  static const _info = 'mytext-message-v1';

  static final Random _rng = Random.secure();

  static List<int> randomBytes(int length) =>
      List<int>.generate(length, (_) => _rng.nextInt(256));

  static String b64(List<int> bytes) => base64Encode(bytes);
  static Uint8List unb64(String value) => base64Decode(value);

  /// Create a fresh identity. Store the returned private key securely on device.
  static Future<Identity> generateIdentity() async {
    final keyPair = await _x25519.newKeyPair();
    final privateKey = await keyPair.extractPrivateKeyBytes();
    final publicKey = await keyPair.extractPublicKey();
    return Identity(
      publicKey: b64(publicKey.bytes),
      privateKey: b64(privateKey),
    );
  }

  static Future<SimpleKeyPair> _keyPairFrom(String privateKeyB64) {
    return _x25519.newKeyPairFromSeed(unb64(privateKeyB64));
  }

  static Future<SecretKey> _deriveKey({
    required String myPrivateKeyB64,
    required String theirPublicKeyB64,
    required List<int> salt,
  }) async {
    final keyPair = await _keyPairFrom(myPrivateKeyB64);
    final shared = await _x25519.sharedSecretKey(
      keyPair: keyPair,
      remotePublicKey: SimplePublicKey(unb64(theirPublicKeyB64), type: KeyPairType.x25519),
    );
    return _hkdf.deriveKey(secretKey: shared, nonce: salt, info: utf8.encode(_info));
  }

  /// Encrypt [plaintext] for everyone in [recipientPublicKeys].
  /// Returns a JSON-ready map the server can store but cannot read.
  static Future<Map<String, dynamic>> encrypt({
    required String plaintext,
    required String senderPublicKey,
    required String senderPrivateKey,
    required List<String> recipientPublicKeys,
  }) async {
    final salt = randomBytes(16);
    final bytes = utf8.encode(plaintext);
    final boxes = <String, dynamic>{};

    for (final recipientKey in {...recipientPublicKeys, senderPublicKey}) {
      if (recipientKey.isEmpty) continue;
      final key = await _deriveKey(
        myPrivateKeyB64: senderPrivateKey,
        theirPublicKeyB64: recipientKey,
        salt: salt,
      );
      final box = await _aes.encrypt(bytes, secretKey: key);
      boxes[recipientKey] = {
        'c': b64(box.cipherText),
        'n': b64(box.nonce),
        'm': b64(box.mac.bytes),
      };
    }

    return {
      'v': 1,
      'senderKey': senderPublicKey,
      'salt': b64(salt),
      'boxes': boxes,
    };
  }

  /// Decrypt a payload produced by [encrypt].
  /// Returns null if this device is not a recipient or the data is malformed.
  static Future<String?> decrypt({
    required Map<String, dynamic> payload,
    required String myPublicKey,
    required String myPrivateKey,
  }) async {
    try {
      final boxes = (payload['boxes'] as Map).cast<String, dynamic>();
      final box = boxes[myPublicKey];
      if (box == null) return null;

      final key = await _deriveKey(
        myPrivateKeyB64: myPrivateKey,
        theirPublicKeyB64: payload['senderKey'] as String,
        salt: unb64(payload['salt'] as String),
      );

      final clear = await _aes.decrypt(
        SecretBox(
          unb64(box['c'] as String),
          nonce: unb64(box['n'] as String),
          mac: Mac(unb64(box['m'] as String)),
        ),
        secretKey: key,
      );
      return utf8.decode(clear);
    } catch (_) {
      return null;
    }
  }
}

/// A device identity: the public key is shared, the private key is secret.
class Identity {
  const Identity({required this.publicKey, required this.privateKey});

  final String publicKey;
  final String privateKey;
}
