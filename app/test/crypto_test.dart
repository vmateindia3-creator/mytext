import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:mytext/services/crypto_service.dart';

void main() {
  test('encrypt then decrypt round-trips for every recipient', () async {
    final alice = await CryptoService.generateIdentity();
    final bob = await CryptoService.generateIdentity();

    final payload = await CryptoService.encrypt(
      plaintext: 'hello bob',
      senderPublicKey: alice.publicKey,
      senderPrivateKey: alice.privateKey,
      recipientPublicKeys: [bob.publicKey],
    );

    final text = await CryptoService.decrypt(
      payload: payload,
      myPublicKey: bob.publicKey,
      myPrivateKey: bob.privateKey,
    );
    expect(text, 'hello bob');
  });

  test('the payload never contains the plaintext', () async {
    final alice = await CryptoService.generateIdentity();
    final bob = await CryptoService.generateIdentity();

    final payload = await CryptoService.encrypt(
      plaintext: 'top secret',
      senderPublicKey: alice.publicKey,
      senderPrivateKey: alice.privateKey,
      recipientPublicKeys: [bob.publicKey],
    );

    expect(jsonEncode(payload).contains('top secret'), isFalse);
  });

  test('someone outside the conversation cannot decrypt', () async {
    final alice = await CryptoService.generateIdentity();
    final bob = await CryptoService.generateIdentity();
    final eve = await CryptoService.generateIdentity();

    final payload = await CryptoService.encrypt(
      plaintext: 'for bob only',
      senderPublicKey: alice.publicKey,
      senderPrivateKey: alice.privateKey,
      recipientPublicKeys: [bob.publicKey],
    );

    final text = await CryptoService.decrypt(
      payload: payload,
      myPublicKey: eve.publicKey,
      myPrivateKey: eve.privateKey,
    );
    expect(text, isNull);
  });

  test('tampered ciphertext is rejected, not returned as garbage', () async {
    final alice = await CryptoService.generateIdentity();
    final bob = await CryptoService.generateIdentity();

    final payload = await CryptoService.encrypt(
      plaintext: 'integrity',
      senderPublicKey: alice.publicKey,
      senderPrivateKey: alice.privateKey,
      recipientPublicKeys: [bob.publicKey],
    );

    final tampered = jsonDecode(jsonEncode(payload)) as Map<String, dynamic>;
    final box = (tampered['boxes'] as Map)[bob.publicKey] as Map;
    final bytes = base64Decode(box['c'] as String);
    bytes[0] = bytes[0] ^ 0xFF;
    box['c'] = base64Encode(bytes);

    final text = await CryptoService.decrypt(
      payload: tampered,
      myPublicKey: bob.publicKey,
      myPrivateKey: bob.privateKey,
    );
    expect(text, isNull);
  });
}
