function schemeTokens(prefix, scheme) {
  return `
    --ds-palette-${prefix}-canvas: ${scheme.canvas};
    --ds-palette-${prefix}-surface: ${scheme.surface};
    --ds-palette-${prefix}-surface-raised: ${scheme.raisedSurface};
    --ds-palette-${prefix}-text: ${scheme.text};
    --ds-palette-${prefix}-text-muted: ${scheme.mutedText};
    --ds-palette-${prefix}-text-quiet: ${scheme.mutedText};
    --ds-palette-${prefix}-border: ${scheme.border};
    --ds-palette-${prefix}-border-strong: color-mix(in srgb, ${scheme.border} 68%, ${scheme.text});
    --ds-palette-${prefix}-action: ${scheme.action};
    --ds-palette-${prefix}-action-hover: color-mix(in srgb, ${scheme.action} 78%, ${scheme.text});
    --ds-palette-${prefix}-warning: ${scheme.warning};
    --ds-palette-${prefix}-focus: ${scheme.focus};
    --ds-palette-${prefix}-selection: color-mix(in srgb, ${scheme.action} 18%, ${scheme.surface});
    --ds-palette-${prefix}-shadow: 0 16px 42px color-mix(in srgb, ${scheme.text} 12%, transparent);`;
}

function colorChannels(hex) {
  let value = hex.slice(1);
  if (value.length === 3 || value.length === 4) value = [...value].map((character) => character.repeat(2)).join("");
  return value
    .slice(0, 6)
    .match(/.{2}/g)
    .map((channel) => Number.parseInt(channel, 16) / 255);
}

function relativeLuminance(hex) {
  const channels = colorChannels(hex).map((channel) =>
    channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
  );
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

function contrastRatio(foreground, background) {
  const values = [relativeLuminance(foreground), relativeLuminance(background)].sort((left, right) => right - left);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

function readableRelationshipLabel(diagram) {
  const preferred = diagram.relationshipLine;
  const background = diagram.relationshipLabelBackground;
  if (contrastRatio(preferred, background) >= 4.5) return preferred;
  return contrastRatio("#000000", background) >= contrastRatio("#ffffff", background) ? "#000000" : "#ffffff";
}

function activeScheme(prefix) {
  return `
    --ds-canvas: var(--ds-palette-${prefix}-canvas);
    --ds-surface: var(--ds-palette-${prefix}-surface);
    --ds-surface-raised: var(--ds-palette-${prefix}-surface-raised);
    --ds-text: var(--ds-palette-${prefix}-text);
    --ds-text-muted: var(--ds-palette-${prefix}-text-muted);
    --ds-text-quiet: var(--ds-palette-${prefix}-text-quiet);
    --ds-border: var(--ds-palette-${prefix}-border);
    --ds-border-strong: var(--ds-palette-${prefix}-border-strong);
    --ds-action: var(--ds-palette-${prefix}-action);
    --ds-action-hover: var(--ds-palette-${prefix}-action-hover);
    --ds-warning: var(--ds-palette-${prefix}-warning);
    --ds-focus: var(--ds-palette-${prefix}-focus);
    --ds-selection: var(--ds-palette-${prefix}-selection);
    --ds-shadow: var(--ds-palette-${prefix}-shadow);`;
}

export function compilePalette(palette) {
  const { light, dark } = palette.document;
  const diagram = palette.diagram;
  const relationshipLabel = readableRelationshipLabel(diagram);
  const diagramTokens = `
    --ds-diagram-neutral: ${diagram.neutralStroke};
    --ds-diagram-moss: ${diagram.primaryStroke};
    --ds-diagram-moss-soft: color-mix(in srgb, ${diagram.primaryFill} 22%, var(--ds-surface));
    --ds-diagram-rust: var(--ds-warning);
    --ds-diagram-rust-soft: color-mix(in srgb, var(--ds-warning) 18%, var(--ds-surface));
    --ds-diagram-gold: ${diagram.relationshipLine};
    --ds-diagram-gold-soft: color-mix(in srgb, ${diagram.relationshipLine} 16%, var(--ds-surface));
    --ds-diagram-blue: var(--ds-action);
    --ds-diagram-blue-soft: color-mix(in srgb, var(--ds-action) 16%, var(--ds-surface));
    --ds-diagram-violet: var(--ds-focus);
    --ds-diagram-violet-soft: color-mix(in srgb, var(--ds-focus) 14%, var(--ds-surface));`;

  const css = `@layer ds.palette {
  :root {
    color-scheme: light;${schemeTokens("light", light)}${schemeTokens("dark", dark)}
    --ds-overlay: color-mix(in srgb, ${dark.canvas} 76%, transparent);
    --ds-terminal-canvas: ${dark.canvas};
    --ds-terminal-text: ${dark.text};
    --ds-terminal-text-muted: ${dark.mutedText};
    --ds-terminal-border: ${dark.border};${activeScheme("light")}${diagramTokens}
  }

  :root[data-theme="dark"] {
    color-scheme: dark;${activeScheme("dark")}${diagramTokens}
  }

  @media (prefers-color-scheme: dark) {
    :root:not([data-theme="light"]),
    :root[data-theme="system"] {
      color-scheme: dark;${activeScheme("dark")}${diagramTokens}
    }
  }

  @media print {
    :root {
      color-scheme: light;
      --ds-canvas: #ffffff;
      --ds-surface: #ffffff;
      --ds-surface-raised: #ffffff;
      --ds-text: #111111;
      --ds-text-muted: #444444;
      --ds-text-quiet: #555555;
      --ds-border: #bbbbbb;
      --ds-border-strong: #777777;
      --ds-action: ${light.action};
      --ds-action-hover: ${light.action};
      --ds-warning: ${light.warning};
      --ds-focus: #111111;
      --ds-selection: #eeeeee;
      --ds-shadow: none;${diagramTokens}
    }
  }
}`;

  return {
    css,
    likec4Theme: {
      colors: {
        primary: {
          elements: {
            fill: diagram.primaryFill,
            stroke: diagram.primaryStroke,
            hiContrast: diagram.primaryText,
            loContrast: diagram.primaryText,
          },
          relationships: {
            line: diagram.relationshipLine,
            label: relationshipLabel,
            labelBg: diagram.relationshipLabelBackground,
          },
        },
        gray: {
          elements: {
            fill: diagram.neutralFill,
            stroke: diagram.neutralStroke,
            hiContrast: diagram.neutralText,
            loContrast: diagram.neutralText,
          },
          relationships: {
            line: diagram.relationshipLine,
            label: relationshipLabel,
            labelBg: diagram.relationshipLabelBackground,
          },
        },
      },
    },
  };
}
