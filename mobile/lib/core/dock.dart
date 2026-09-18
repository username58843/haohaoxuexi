import 'package:flutter/material.dart';

import 'theme.dart';

class DockDestination {
  const DockDestination({
    required this.icon,
    required this.selectedIcon,
    required this.label,
  });
  final IconData icon;
  final IconData selectedIcon;
  final String label;
}

/// Full labels remain readable at narrow widths and large accessibility scales.
class FloatingDock extends StatefulWidget {
  const FloatingDock({
    super.key,
    required this.destinations,
    required this.selectedIndex,
    required this.onSelect,
  });

  final List<DockDestination> destinations;
  final int selectedIndex;
  final ValueChanged<int> onSelect;

  @override
  State<FloatingDock> createState() => _FloatingDockState();
}

class _FloatingDockState extends State<FloatingDock> {
  final _keys = <int, GlobalKey>{};

  @override
  void didUpdateWidget(covariant FloatingDock oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.selectedIndex != widget.selectedIndex ||
        oldWidget.destinations.map((item) => item.label).join('\n') !=
            widget.destinations.map((item) => item.label).join('\n')) {
      _revealSelection();
    }
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _revealSelection();
  }

  @override
  void initState() {
    super.initState();
    _revealSelection();
  }

  void _revealSelection() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      final context = _keys[widget.selectedIndex]?.currentContext;
      if (context != null) {
        Scrollable.ensureVisible(
          context,
          alignment: 0.5,
          duration: const Duration(milliseconds: 180),
        );
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      top: false,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(8, 0, 8, 8),
        child: Center(
          heightFactor: 1,
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 680),
            child: Material(
              color: Color.alphaBlend(
                surface2Of(context),
                Theme.of(context).scaffoldBackgroundColor,
              ),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(24),
                side: BorderSide(color: hairline2Of(context)),
              ),
              clipBehavior: Clip.antiAlias,
              child: SingleChildScrollView(
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.all(5),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    for (var i = 0; i < widget.destinations.length; i++)
                      _item(context, i),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _item(BuildContext context, int index) {
    final destination = widget.destinations[index];
    final active = index == widget.selectedIndex;
    final color = active ? accentOf(context) : text2Of(context);
    return Semantics(
      key: _keys.putIfAbsent(index, GlobalKey.new),
      button: true,
      selected: active,
      label: destination.label,
      excludeSemantics: true,
      onTap: () => widget.onSelect(index),
      child: Tooltip(
        message: destination.label,
        child: InkWell(
          onTap: () => widget.onSelect(index),
          borderRadius: BorderRadius.circular(20),
          child: Ink(
            decoration: BoxDecoration(
              color: active ? accentSoftOf(context) : Colors.transparent,
              borderRadius: BorderRadius.circular(20),
            ),
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 10),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(
                  active ? destination.selectedIcon : destination.icon,
                  size: 22,
                  color: color,
                ),
                const SizedBox(height: 4),
                Text(
                  destination.label,
                  softWrap: false,
                  style: TextStyle(
                    fontSize: 11.5,
                    fontWeight: FontWeight.w600,
                    color: color,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
