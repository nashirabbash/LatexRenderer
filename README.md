# LaTeX Renderer for ONLYOFFICE Desktop

This Document Editor plugin replaces inline `$...$` source with native editable Office math equations, not images. Each equation is inserted at its source range, so it stays in the same paragraph and follows surrounding text size. A bookmark and document custom property retain the exact marked source for de-rendering in editors that preserve those OOXML metadata features.

The native equation format improves portability across Word, WPS Writer, and LibreOffice Writer. Google Docs may convert equations and discard bookmarks/custom properties; cross-editor source restoration is not guaranteed.

The plugin SDK bridge and all runtime code are local. It makes no network requests.

## Build

```sh
bun install
bun run check
```

## Install in ONLYOFFICE Desktop

From the repository root, create a plugin archive:

```sh
cd plugin && zip -r ../latexrenderer.plugin .
```

In Document Editor, open **Plugins → Plugin Manager → My plugins → Add plugin**, select `latexrenderer.plugin`, then open **Plugins → LaTeX Renderer**.

Use **Render Equations** to convert inline marked equations in the document body. Select a plugin-created equation before **De-render Selection**, or use **De-render All Equations** to restore all equations with retained source metadata.
