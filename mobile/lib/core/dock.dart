import 'dart:ui' show ImageFilter;

import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import 'theme.dart';

/// Floating pill dock — Flutter port of the web `.dock` / `.dock__item`
/// (styles/_components.scss): a centered pill floating 10px above the bottom
/// edge (plus safe-area), frosted solid surface at ~88% opacity, 1px hairline
/// border and a big soft shadow. The active item gets an accent wash plus
/// accent-colored icon and label; inactive items use the muted text-2 color.
///
/// Meant for `Scaffold(extendBody: true, bottomNavigationBar: FloatingDock(...))`
/// so body content scrolls behind the frosted pill; screens inside the shell
/// read `MediaQuery.paddingOf(context).bottom` for their scroll padding.
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

class FloatingDock extends StatelessWidget {
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
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    // Web `--surface-solid`: the opaque blend of surface-2 over the canvas.
    final solid = Color.alphaBlend(
      surface2Of(context),
      Theme.of(context).scaffoldBackgroundColor,
    );

    return SafeArea(
      top: false,
      child: Padding(
        // Web: bottom = 10px + safe-area inset (SafeArea supplies the inset).
        padding: const EdgeInsets.fromLTRB(12, 0, 12, 10),
        child: Center(
          // Shrink-wrap vertically: the nav-bar slot hands down loose
          // screen-height constraints and Center would otherwise fill them.
          heightFactor: 1,
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 440),
            child: DecoratedBox(
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(999),
                // Web `--shadow-pop`.
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: isDark ? 0.9 : 0.3),
                    offset: const Offset(0, 30),
                    blurRadius: isDark ? 90 : 70,
                    spreadRadius: isDark ? -20 : -24,
                  ),
                ],
              ),
              child: ClipRRect(
                borderRadius: BorderRadius.circular(999),
                child: BackdropFilter(
                  filter: ImageFilter.blur(sigmaX: 18, sigmaY: 18),
                  child: Container(
                    padding: const EdgeInsets.all(6),
                    decoration: BoxDecoration(
                      color: solid.withValues(alpha: 0.88),
                      borderRadius: BorderRadius.circular(999),
                      border: Border.all(color: hairline2Of(context)),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        for (var i = 0; i < destinations.length; i++) ...[
                          if (i > 0) const SizedBox(width: 2),
                          Flexible(
                            child: _DockItem(
                              destination: destinations[i],
                              active: i == selectedIndex,
                              onTap: () => onSelect(i),
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _DockItem extends StatelessWidget {
  const _DockItem({
    required this.destination,
    required this.active,
    required this.onTap,
  });

  final DockDestination destination;
  final bool active;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final color = active ? accentOf(context) : text2Of(context);
    return Semantics(
      button: true,
      selected: active,
      label: destination.label,
      child: Material(
        color: active ? accentSoftOf(context) : Colors.transparent,
        shape: const StadiumBorder(),
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: onTap,
          customBorder: const StadiumBorder(),
          child: Container(
            constraints: const BoxConstraints(minWidth: 62),
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
            alignment: Alignment.center,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(
                  active ? destination.selectedIcon : destination.icon,
                  size: 22,
                  color: color,
                ),
                const SizedBox(height: 3),
                Text(
                  destination.label,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: GoogleFonts.manrope(
                    fontSize: 10.5,
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
