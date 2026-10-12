# Changelog

- Replace marked inline LaTeX with native equations and add source-restoration actions.

- Support `$...$`, `\(...\)`, `$$...$$`, and `\[...\]` with inline or display paragraph layout and exact source restoration.
- Separate plugin operations by responsibility and restore equations intersecting current selection.
- Report failed source restorations and handle collapsed equation selections.
- Set the plugin panel entry point to `index.html` for desktop loading.
