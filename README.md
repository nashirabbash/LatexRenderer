# LaTeX Renderer for ONLYOFFICE

LaTeX Renderer converts marked LaTeX in ONLYOFFICE Document Editor into native, editable equations. It can restore equations created by this plugin to their original marked source. No equation images or network service required.

Requires ONLYOFFICE Document Editor 8.2 or later. Spreadsheet and Presentation Editors are not supported.

## Quick start

Install [Bun](https://bun.sh/) and Python 3, then run from the repository root:

```sh
bun install
bun run check
cd plugin
python3 -m zipfile -c ../latexrenderer.plugin config.json index.html styles.css scripts vendor
```

In ONLYOFFICE Document Editor, open **Plugins → Plugin Manager → My plugins → Add plugin** and select `latexrenderer.plugin`. Open **Plugins → LaTeX Renderer**.

Type `The result is $a^2+b^2=c^2$.` in a document, then select **Render Equations**. The marked expression becomes an editable equation. Use **De-render All Equations** to restore `$a^2+b^2=c^2$`.

## Usage

| Marked source | Layout |
| --- | --- |
| `$a+b$` | Inline |
| `\(a+b\)` | Inline |
| `$$a+b$$` | Separate paragraph |
| `\[a+b\]` | Separate paragraph |

**Render Equations** scans document body, tables, headers, and footers. Unmatched delimiters remain unchanged. **De-render Selection** restores plugin-created equations intersecting current selection; **De-render All Equations** restores all equations created by this plugin. Neither action reconstructs LaTeX from equations created elsewhere.

Original marked text is stored in document custom properties and associated with equation bookmarks. Keep document in a format and editor that preserve these metadata if you need to restore source later. Other editors may convert equations or drop metadata; source restoration across editors is not guaranteed. Work on a copy when testing document conversions.

The **Equation size** control is currently disabled; equation sizing is handled by Document Editor. Panel status reports rendered/restored counts and names the failing operation when restoration throws.

## Development

```sh
bun install
bun run check
bun test
```

`bun run check` builds `plugin/scripts/plugin.bundle.js` and checks its syntax. After changing source in `plugin/scripts/`, rebuild before repackaging the plugin. `bun test` exercises document operations against mocked editor APIs; it does not replace a manual test in ONLYOFFICE Desktop.

To contribute, open an issue or pull request at [nashirabbash/LatexRenderer](https://github.com/nashirabbash/LatexRenderer). Include steps to reproduce user-visible bugs, test changes with commands above, and describe Desktop behavior you verified.

## License

Original project code is licensed under [MIT](LICENSE). Bundled `plugin/vendor/plugins.js` is third-party ONLYOFFICE SDK code licensed under AGPL-3.0; its license and notices remain in [`plugin/vendor/ONLYOFFICE-LICENSE`](plugin/vendor/ONLYOFFICE-LICENSE) and its source header. The distributed plugin archive contains that file and is **not MIT-only**. Redistribution must respect third-party license terms.
