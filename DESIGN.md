# Design System

## Theme

Big Video uses a restrained dark interface suited to watching media in mixed ambient light.
The interface should feel like a precise browser utility rather than entertainment branding.

## Color

- Canvas: `#0d0e1d`
- Surface: `#15172c`
- Raised surface: `#202345`
- Border: `#34375f`
- Primary text: `#f1f2ff`
- Secondary text: `#b7bad3`
- Accent: `#9ca0ff`
- Focus: `#aeb1ff`

All text and interactive states must meet WCAG 2.2 AA contrast requirements.

## Typography

Use the system sans-serif stack for every extension surface.
Keep the hierarchy compact, with 11 to 16 pixel type and clear weight changes instead of decorative typography.

## Components

Buttons use an 8 to 10 pixel radius, visible borders, direct labels, and complete hover, active, focus, and disabled states.
Injected media controls are circular, high contrast, and visually consistent with the popup.
Switches retain native checkbox semantics while presenting a compact visual track.

## Layout

The popup is 304 pixels wide with 14 to 16 pixel section padding.
Related controls are grouped by function without nested card layouts.

## Motion

Use 160 millisecond ease-out transitions only for direct state feedback.
Disable nonessential transitions when reduced motion is requested.
