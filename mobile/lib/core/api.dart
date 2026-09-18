import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import 'i18n.dart';

/// Base URL of the HaoHao XueXi backend.
/// Override at build time: `--dart-define=API_BASE_URL=https://example.com`.
const String apiBaseUrl = String.fromEnvironment(
  'API_BASE_URL',
  defaultValue: 'https://haohaoxuexi.tech',
);

/// Thrown for every failed API call.
///
/// [code] is the stable machine string from the server error envelope
/// `{ error: { code, message } }` (e.g. `invalid_credentials`, `validation`,
/// `unauthorized`, `not_found`, `rate_limited`, `banned`, `conflict`,
/// `server_error`), or `'network'` when the request never reached the server
/// (offline, DNS failure, timeout).
class ApiException implements Exception {
  const ApiException(this.code, this.message, {this.status});

  final String code;
  final String message;
  final int? status;

  bool get isNetwork => code == 'network';

  @override
  String toString() => 'ApiException($code${status != null ? ', $status' : ''}): $message';
}

/// Thin typed wrapper around a shared [Dio] instance.
///
/// - Attaches `Authorization: Bearer <token>` from secure storage.
/// - On a 401 for an authenticated request: clears the stored token and fires
///   [onUnauthorized] (hooked up by the auth notifier to reset auth state,
///   which routes the user to /auth).
/// - All helpers return the decoded JSON object. If the server returns a
///   top-level JSON array (e.g. `GET /words/packs`) it is wrapped as
///   `{'items': <list>}` so the return type stays `Map<String, dynamic>`.
class Api {
  Api({FlutterSecureStorage? storage})
      : _storage = storage ?? const FlutterSecureStorage() {
    _dio = Dio(
      BaseOptions(
        baseUrl: '$apiBaseUrl/api/v1',
        connectTimeout: const Duration(seconds: 15),
        receiveTimeout: const Duration(seconds: 20),
        headers: const {'Accept': 'application/json'},
        contentType: 'application/json',
      ),
    );
    _dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) async {
          if (options.method == 'GET' &&
              RegExp(r'^/(words|srs|dict)(/|$)').hasMatch(options.path)) {
            options.queryParameters['catalog'] = '2026-07';
          }
          final token = await readToken();
          if (token != null && token.isNotEmpty) {
            options.headers['Authorization'] = 'Bearer $token';
          }
          handler.next(options);
        },
        onError: (e, handler) async {
          final hadToken = e.requestOptions.headers['Authorization'] != null;
          if (e.response?.statusCode == 401 && hadToken) {
            // Session expired / token revoked — drop it and notify auth state.
            await clearToken();
            onUnauthorized?.call();
          }
          handler.next(e);
        },
      ),
    );
  }

  static const String tokenKey = 'auth_token';

  final FlutterSecureStorage _storage;
  late final Dio _dio;

  /// Raw dio instance for advanced use (downloads, cancel tokens...).
  Dio get dio => _dio;

  /// Set by the auth notifier; called after a 401 cleared the token.
  void Function()? onUnauthorized;

  String? _token;
  bool _tokenLoaded = false;

  Future<String?> readToken() async {
    if (!_tokenLoaded) {
      _token = await _storage.read(key: tokenKey);
      _tokenLoaded = true;
    }
    return _token;
  }

  Future<void> saveToken(String token) async {
    _token = token;
    _tokenLoaded = true;
    await _storage.write(key: tokenKey, value: token);
  }

  Future<void> clearToken() async {
    _token = null;
    _tokenLoaded = true;
    await _storage.delete(key: tokenKey);
  }

  Future<Map<String, dynamic>> get(String path, {Map<String, dynamic>? query}) =>
      _request('GET', path, query: query);

  Future<Map<String, dynamic>> post(String path,
          {Object? body, Map<String, dynamic>? query}) =>
      _request('POST', path, body: body, query: query);

  Future<Map<String, dynamic>> put(String path,
          {Object? body, Map<String, dynamic>? query}) =>
      _request('PUT', path, body: body, query: query);

  Future<Map<String, dynamic>> delete(String path,
          {Object? body, Map<String, dynamic>? query}) =>
      _request('DELETE', path, body: body, query: query);

  Future<Map<String, dynamic>> _request(
    String method,
    String path, {
    Object? body,
    Map<String, dynamic>? query,
  }) async {
    try {
      final res = await _dio.request<dynamic>(
        path,
        data: body,
        queryParameters: query,
        options: Options(method: method),
      );
      final data = res.data;
      if (data is Map<String, dynamic>) return data;
      if (data is Map) return Map<String, dynamic>.from(data);
      if (data is List) return <String, dynamic>{'items': data};
      return <String, dynamic>{};
    } on DioException catch (e) {
      throw _toApiException(e);
    }
  }

  ApiException _toApiException(DioException e) {
    final res = e.response;
    if (res == null) {
      // Timeout / offline / DNS / TLS — never reached the server.
      // Client-generated messages are localized here so screens that surface
      // `e.message` directly stay translated.
      return ApiException('network',
          tr(null, 'error.network', 'Network error. Check your connection.'));
    }
    final data = res.data;
    if (data is Map && data['error'] is Map) {
      final err = data['error'] as Map;
      return ApiException(
        (err['code'] ?? 'server_error').toString(),
        (err['message'] ??
                tr(null, 'common.error', 'Something went wrong'))
            .toString(),
        status: res.statusCode,
      );
    }
    return ApiException(
      'server_error',
      tr(null, 'error.server', 'Server error. Please try again later.'),
      status: res.statusCode,
    );
  }
}

/// Singleton API client. Kept alive for the whole app lifetime.
final apiProvider = Provider<Api>((ref) => Api());
