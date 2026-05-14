# Network Docs Topic Variant VS Code Extension

Adds a **Create Topic Variant** command to the VS Code Explorer and editor context menu for Markdown files.

The extension calls the repository script:

```sh
node scripts/create-topic-variant.js . --from-file <selected-topic> --release <release>
```

All topic ID, lifecycle, manifest, and concurrent-writer rules stay in `scripts/create-topic-variant.js`.

## Local Demo

1. Open this extension folder in VS Code:

   ```sh
   code tools/vscode-topic-variant
   ```

2. Press `F5` to start an Extension Development Host.
3. In the Extension Development Host, open the `network-docs-unified` repository folder.
4. Right-click a file under `topics/`.
5. Select **Create Topic Variant**.
6. Enter the target release.
7. Choose whether to create the variant, preview only, or create without manifest updates.

For regular team use, package and install the extension as a `.vsix` or publish it to your internal extension marketplace.
