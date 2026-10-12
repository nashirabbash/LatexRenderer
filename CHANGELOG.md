# Changelog

- Remove marked source before inserting native math so insertion-only editor behavior cannot leave duplicate LaTeX; preserve source on equation failures and bookmark inserted math for restoration.
- Replace marked inline LaTeX with native equations and add source-restoration actions.

- Support `$...$`, `\(...\)`, `$$...$$`, and `\[...\]` with inline or display paragraph layout and exact source restoration.
- Separate plugin operations by responsibility and restore equations intersecting current selection.
- Report failed source restorations and handle collapsed equation selections.
- Set the plugin panel entry point to `index.html` for desktop loading.
- Refresh document paragraphs after each equation insertion.
- Report equation positioning, bookmark, metadata, and insertion failure counts.
- Split display paragraphs before inserting math to retain source bookmarks.

- Render and restore marked equations throughout document body, tables, headers, and footers.
- Restore selected equations when paragraph ranges overlap but editor intersection is empty.
- Recreate equation ownership bookmarks when equation insertion removes the original bookmark.
- Report the failing document API stage when source restoration throws.
- Resolve de-render targets through bookmark objects instead of direct bookmark-range lookup.
- Document installation, development, supported markers, and MIT/third-party license boundaries.
- Add title-free architecture and render/de-render sequence diagrams to README.
- Skip equation-specific render failures, continue later equations, and report operation counts without logging LaTeX source.
- Add a scalable SVG icon to the plugin toolbar entry.
