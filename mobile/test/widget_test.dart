// Trivial smoke test: verifies a MaterialApp pumps and renders.
// Full app flows are covered by later phases (the real app needs
// SharedPreferences / secure storage / network, mocked elsewhere).
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  testWidgets('MaterialApp smoke test', (WidgetTester tester) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(
          body: Center(child: Text('好好学习汉语')),
        ),
      ),
    );

    expect(find.text('好好学习汉语'), findsOneWidget);
  });
}
