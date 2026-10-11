import 'dart:async';

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../providers/auth_provider.dart';
import '../theme.dart';

/// Second step of sign-in: type the 6-digit code that was texted to you.
class OtpScreen extends StatefulWidget {
  const OtpScreen({super.key, required this.phone, this.devCode});

  final String phone;

  /// When the server has no SMS provider it returns the code so you can test
  /// without paying for texts. Null in normal use.
  final String? devCode;

  @override
  State<OtpScreen> createState() => _OtpScreenState();
}

class _OtpScreenState extends State<OtpScreen> {
  late final TextEditingController _code;
  String? _error;
  bool _busy = false;
  String? _devCode;
  int _resendIn = 0;
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    _devCode = widget.devCode;
    _code = TextEditingController(text: widget.devCode ?? '');
    _startCountdown();
  }

  @override
  void dispose() {
    _timer?.cancel();
    _code.dispose();
    super.dispose();
  }

  void _startCountdown() {
    setState(() => _resendIn = 30);
    _timer?.cancel();
    _timer = Timer.periodic(const Duration(seconds: 1), (t) {
      if (!mounted) return;
      setState(() => _resendIn -= 1);
      if (_resendIn <= 0) t.cancel();
    });
  }

  Future<void> _verify() async {
    final code = _code.text.trim();
    if (code.length < 4) {
      setState(() => _error = 'Enter the 6-digit code');
      return;
    }

    setState(() {
      _error = null;
      _busy = true;
    });
    try {
      await context.read<AuthProvider>().verifyOtp(widget.phone, code);
      if (!mounted) return;
      // Sign-in succeeded — drop this screen so the home screen shows.
      Navigator.of(context).popUntil((route) => route.isFirst);
    } catch (e) {
      setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _resend() async {
    setState(() {
      _error = null;
      _busy = true;
    });
    try {
      final devCode = await context.read<AuthProvider>().requestOtp(widget.phone);
      if (!mounted) return;
      setState(() => _devCode = devCode);
      if (devCode != null) _code.text = devCode;
      _startCountdown();
    } catch (e) {
      setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Verify number')),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: Column(
            children: [
              const SizedBox(height: 8),
              const Icon(Icons.sms_outlined, size: 56, color: AppTheme.primary),
              const SizedBox(height: 16),
              Text(
                'We sent a code to\n${widget.phone}',
                textAlign: TextAlign.center,
                style: const TextStyle(fontSize: 16),
              ),
              const SizedBox(height: 24),

              if (_devCode != null) ...[
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: AppTheme.surfaceAlt,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: AppTheme.border),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'Testing mode — no SMS provider configured',
                        style: TextStyle(
                          color: AppTheme.primary,
                          fontWeight: FontWeight.w700,
                          fontSize: 12,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        'Your code is $_devCode',
                        style: const TextStyle(fontSize: 15),
                      ),
                      const SizedBox(height: 4),
                      const Text(
                        'Add Twilio/MSG91 keys on the server to send real texts.',
                        style: TextStyle(color: AppTheme.textMuted, fontSize: 11),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 16),
              ],

              TextField(
                controller: _code,
                keyboardType: TextInputType.number,
                maxLength: 6,
                textAlign: TextAlign.center,
                style: const TextStyle(fontSize: 24, letterSpacing: 8),
                decoration: const InputDecoration(
                  hintText: '------',
                  counterText: '',
                ),
              ),

              if (_error != null) ...[
                const SizedBox(height: 8),
                Text(_error!, style: const TextStyle(color: AppTheme.danger)),
              ],

              const SizedBox(height: 16),
              ElevatedButton(
                onPressed: _busy ? null : _verify,
                child: _busy
                    ? const SizedBox(
                        height: 22,
                        width: 22,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Text('Verify and continue'),
              ),
              const SizedBox(height: 8),
              TextButton(
                onPressed: (_busy || _resendIn > 0) ? null : _resend,
                child: Text(
                  _resendIn > 0 ? 'Resend code in ${_resendIn}s' : 'Resend code',
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
